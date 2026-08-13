// functions/lib/moderation.js
// Content moderation pipeline:
//   1) Stopword / blacklist pre-filter (fast, cheap)
//   2) Cloudflare Workers AI LLM review (if env.AI binding is configured)
//   3) Decision log into `moderation_decisions` (audit trail)
//
// Returns: { decision, severity, flags, explanation, confidence, language, source }
//   decision: 'approve' | 'review' | 'block'

// -------------------------------------------------------------- Dictionaries
// Minimal baseline. Extend via env.DB `system_settings` if needed.
const BLOCK_PATTERNS = [
  // English vulgar / slurs (seed — extend carefully)
  /\b(fuck(?:er|ing)?|shit|bitch|cunt|faggot|nigger|retard)\b/i,
  // Russian мат (core roots)
  /\b(хуй|пизд\w*|ебан\w*|бляд\w*|сук[аи]|мразь|педераст)\b/i,
  // Georgian (keyword fragments commonly used)
  /(შენი\s*დედა|დედაშენ)/i,
  // Common scam / spam markers
  /\b(buy\s+now|click\s+here|free\s+bitcoin|earn\s+\$\d+)\b/i,
  /(https?:\/\/(?:bit\.ly|tinyurl\.com|t\.me\/\+))/i,
];

const DANGEROUS_ADVICE_PATTERNS = [
  /\b(remove|disable|bypass)\b.*\b(airbag|srs|abs|seat\s*belt)\b/i,
  /\b(short[- ]?circuit|jump[- ]?start).*battery/i,
];

// --------------------------------------------------------- Utility helpers
function detectLanguage(text) {
  if (!text) return "unknown";
  if (/[\u10A0-\u10FF]/.test(text)) return "ka";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  return "en";
}

async function logDecision(env, {
  entityType, entityId, userId, language, decision, severity, flags,
  source, confidence, explanation, raw,
}) {
  try {
    await env.DB.prepare(
      `INSERT INTO moderation_decisions
        (id, entity_type, entity_id, user_id, language, decision, severity,
         flags, source, confidence, explanation, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      entityType || "unknown",
      entityId || "pending",
      userId || null,
      language || null,
      decision,
      severity || null,
      JSON.stringify(flags || []),
      source || "stopwords",
      typeof confidence === "number" ? confidence : null,
      explanation || null,
      raw ? JSON.stringify(raw).slice(0, 8000) : null,
    ).run();
  } catch (e) {
    console.error("moderation log error:", e?.message || e);
  }
}

// -------------------------------------------------- Stopword pre-filter
function stopwordFilter(text) {
  const flags = [];
  let severity = "low";

  for (const re of BLOCK_PATTERNS) {
    if (re.test(text)) {
      flags.push("profanity_or_spam");
      severity = "high";
      break;
    }
  }
  for (const re of DANGEROUS_ADVICE_PATTERNS) {
    if (re.test(text)) {
      flags.push("dangerous_advice");
      severity = "critical";
      break;
    }
  }

  if (flags.length === 0) {
    return { decision: "approve", severity: "low", flags: [], confidence: 0.4 };
  }

  const blocked = severity === "critical" || flags.includes("profanity_or_spam");
  return {
    decision: blocked ? "block" : "review",
    severity,
    flags,
    confidence: 0.8,
    explanation: blocked
      ? "Matched blocked word or pattern"
      : "Flagged for manual review",
  };
}

// -------------------------------------------------- Workers AI (LlamaGuard / similar)
// Requires wrangler binding `ai`. If not available, returns null (fail-open).
async function workersAiModerate(env, text, language) {
  if (!env.AI) return null;

  const system = `You are a strict, multilingual forum moderator (EN/RU/KA) for a BMW enthusiast community.
Analyze the post. Return ONLY compact JSON:
{"is_clean":bool,"severity":"low"|"medium"|"high"|"critical","flags":["hate_speech"|"profanity"|"harassment"|"spam"|"dangerous_advice"|"explicit_sexual"|"off_topic"],"action":"approve"|"review"|"block","explanation":"...","language":"en"|"ru"|"ka"|"mixed"}
Automotive slang and technical jargon should NEVER be flagged.
When uncertain prefer "review" over "block".`;

  try {
    const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: system },
        { role: "user", content: text.slice(0, 4000) },
      ],
      max_tokens: 240,
      temperature: 0.1,
    });
    const raw = response?.response || response?.output_text || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      decision: parsed.action || (parsed.is_clean ? "approve" : "review"),
      severity: parsed.severity || "low",
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      explanation: parsed.explanation || "",
      confidence: 0.85,
      language: parsed.language || language,
      raw: parsed,
    };
  } catch (e) {
    console.error("Workers AI moderate error:", e?.message || e);
    return null;
  }
}

// ==========================================================================
// Public API
// ==========================================================================

/**
 * Moderate a piece of text.
 * @param {object} env Cloudflare bindings
 * @param {string} text
 * @param {object} ctx { entityType, entityId, userId }
 * @returns decision object
 */
export async function moderateText(env, text, ctx = {}) {
  const input = String(text || "").trim();
  const language = detectLanguage(input);

  if (!input) {
    return { decision: "approve", severity: "low", flags: [], language };
  }

  // 1) Stopword gate — quick block if hard match
  const baseline = stopwordFilter(input);
  if (baseline.decision === "block") {
    await logDecision(env, {
      ...ctx,
      language,
      decision: baseline.decision,
      severity: baseline.severity,
      flags: baseline.flags,
      source: "stopwords",
      confidence: baseline.confidence,
      explanation: baseline.explanation,
    });
    return { ...baseline, language, source: "stopwords" };
  }

  // Fast path (e.g. forum replies): no Workers AI, no extra DB round-trips for audit log — keeps HTTP latency low.
  if (ctx.skipAi) {
    return { ...baseline, language, source: "stopwords" };
  }

  // 2) Workers AI review (for ambiguous / long / multi-lingual posts)
  const aiResult = await workersAiModerate(env, input, language);
  if (aiResult) {
    await logDecision(env, {
      ...ctx,
      language: aiResult.language,
      decision: aiResult.decision,
      severity: aiResult.severity,
      flags: aiResult.flags,
      source: "workers_ai",
      confidence: aiResult.confidence,
      explanation: aiResult.explanation,
      raw: aiResult.raw,
    });
    // Merge flags from baseline (if review) — be stricter of the two
    const decision = pickStricter(baseline.decision, aiResult.decision);
    return {
      decision,
      severity: aiResult.severity,
      flags: Array.from(new Set([...(baseline.flags || []), ...(aiResult.flags || [])])),
      explanation: aiResult.explanation || baseline.explanation,
      confidence: aiResult.confidence,
      language: aiResult.language,
      source: "workers_ai",
    };
  }

  // 3) Fall back to baseline (which is either approve or review)
  await logDecision(env, {
    ...ctx,
    language,
    decision: baseline.decision,
    severity: baseline.severity,
    flags: baseline.flags,
    source: "stopwords",
    confidence: baseline.confidence,
    explanation: baseline.explanation,
  });
  return { ...baseline, language, source: "stopwords" };
}

/**
 * Moderate an image (basic file validation + optional Workers AI image check).
 * Strict validation: magic bytes + size + MIME whitelist.
 */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const IMAGE_MAGIC = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // 'RIFF' (second check for WEBP ahead)
  "image/gif":  [[0x47, 0x49, 0x46, 0x38]],
};

function matchMagic(bytes, sig) {
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

export async function moderateImage(env, file, ctx = {}) {
  if (!file) {
    return { decision: "block", reason: "No file", file_safe: false, content_safe: false };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { decision: "block", reason: `File > ${MAX_IMAGE_BYTES} bytes`, file_safe: false };
  }
  const allowed = Object.keys(IMAGE_MAGIC);
  if (!allowed.includes(file.type)) {
    return { decision: "block", reason: "Unsupported MIME", file_safe: false };
  }
  const ab = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(ab);
  const sigs = IMAGE_MAGIC[file.type];
  const magicOk = sigs.some((sig) => matchMagic(bytes, sig));
  if (!magicOk) {
    return { decision: "block", reason: "Magic bytes mismatch", file_safe: false };
  }
  // WEBP extra-check: bytes 8..11 should be 'WEBP'
  if (file.type === "image/webp") {
    const head = new TextDecoder().decode(bytes.slice(8, 12));
    if (head !== "WEBP") {
      return { decision: "block", reason: "Invalid WEBP container", file_safe: false };
    }
  }

  // TODO: Optional Workers AI vision scan when env.AI supports image models available to user.
  // For now: approve with file_safe=true.
  await logDecision(env, {
    ...ctx,
    entityType: "image",
    decision: "approve",
    severity: "low",
    flags: [],
    source: "magic_bytes",
    confidence: 0.9,
    explanation: "Basic file validation passed",
  });

  return {
    decision: "approve",
    file_safe: true,
    content_safe: true,
    reason: "Basic validation passed",
  };
}

// Helpers --------------------------------------------------------------------
function pickStricter(a, b) {
  const rank = { approve: 0, review: 1, block: 2 };
  return (rank[a] || 0) >= (rank[b] || 0) ? a : b;
}
