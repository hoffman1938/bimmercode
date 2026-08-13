// functions/lib/ai-assistant.js — BMW assistant: Workers AI cascade + external fallbacks

import { getCodeFromDb } from "./dtc-codes.js";

export const SYSTEM_PROMPT = `You are the official AI assistant for bimmercodes.net. Your only job is to help users with vehicle diagnostics, fault codes (DTC / hex), and coding (BimmerCode / E-Sys / ISTA).
Rules:
1. Reply strictly in the language the user writes in (Russian, English, or Georgian / ქართული). If they mix languages, prefer the latest message language.
2. When the user sends a fault code (e.g. 118001, P0300, 130108, 2A82, A0B1), explain what it means in plain language, typical symptoms, likely causes, and safe first checks. Mention when a pro scan or ISTA is needed.
3. If the question is not automotive-related, politely refuse and remind them you are an auto expert.
4. Be concise — no filler. Use short paragraphs or bullet lists for steps.
5. Never claim to be BMW AG or an official dealer. This is independent enthusiast guidance, not legal or safety-critical certification.
6. For dangerous repairs (fuel system, airbags, high voltage on hybrids), recommend a qualified workshop.`;

const CF_PRIMARY = "@cf/zai-org/glm-4.7-flash";
const CF_FALLBACK = "@cf/meta/llama-3.1-8b-instruct-fast";

const CODE_RE =
  /\b(?:P[0-9A-F]{4}|U[0-9A-F]{4}|B[0-9A-F]{4}|C[0-9A-F]{4}|[0-9A-F]{5,6}|2[0-9A-F]{3,4})\b/gi;

/** @param {string} text */
export function extractFaultCodes(text) {
  const found = new Set();
  const m = String(text || "").matchAll(CODE_RE);
  for (const hit of m) {
    found.add(hit[0].toUpperCase());
  }
  return [...found].slice(0, 5);
}

/**
 * @param {import("@cloudflare/workers-types").D1Database | null} db
 * @param {string[]} codes
 */
export async function buildCodeContext(db, codes) {
  if (!db || !codes.length) return "";
  const blocks = [];
  for (const raw of codes) {
    const code = raw.toUpperCase();
    const row = await getCodeFromDb(db, code);
    if (!row) continue;
    blocks.push(
      `[Site DB: ${row.code}] EN: ${row.title?.en || ""} — ${(row.description?.en || "").slice(0, 400)}`
    );
  }
  if (!blocks.length) return "";
  return (
    "\n\nReference from bimmercodes.net database (use if relevant, do not invent):\n" +
    blocks.join("\n")
  );
}

/**
 * @param {unknown} response
 */
export function pickAiText(response) {
  if (!response) return "";
  if (typeof response === "string") return response.trim();
  if (typeof response.response === "string") return response.response.trim();
  if (typeof response.output_text === "string") return response.output_text.trim();
  const choice = response.choices?.[0];
  if (choice?.message?.content) return String(choice.message.content).trim();
  if (choice?.text) return String(choice.text).trim();
  return "";
}

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * @param {object} env
 * @param {{ role: string, content: string }[]} messages
 * @param {string} extraSystem
 */
async function runCloudflare(env, messages, extraSystem) {
  if (!env.AI) throw new Error("Workers AI not configured");

  const payload = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT + extraSystem },
      ...messages.slice(-12),
    ],
    max_tokens: 700,
    temperature: 0.35,
  };

  for (const model of [CF_PRIMARY, CF_FALLBACK]) {
    try {
      const response = await env.AI.run(model, payload);
      const text = pickAiText(response);
      if (text) return { text, provider: model.includes("glm") ? "cloudflare-glm" : "cloudflare-llama" };
    } catch (e) {
      const msg = e?.message || String(e);
      if (/429|rate|limit|quota/i.test(msg)) throw Object.assign(new Error(msg), { status: 429 });
      console.warn(`Workers AI ${model} failed:`, msg);
    }
  }
  throw new Error("Workers AI unavailable");
}

/**
 * @param {object} env
 * @param {{ role: string, content: string }[]} messages
 * @param {string} extraSystem
 */
async function runGroq(env, messages, extraSystem) {
  const key = env.GROQ_API_KEY;
  if (!key) throw new Error("Groq not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + extraSystem },
        ...messages.slice(-12),
      ],
      max_tokens: 700,
      temperature: 0.35,
    }),
  });

  if (!res.ok) {
    const err = new Error(`Groq HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = pickAiText(data);
  if (!text) throw new Error("Empty Groq response");
  return { text, provider: "groq" };
}

/**
 * @param {object} env
 * @param {{ role: string, content: string }[]} messages
 * @param {string} extraSystem
 */
async function runGemini(env, messages, extraSystem) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini not configured");

  const contents = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(key);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT + extraSystem }] },
      contents,
      generationConfig: { maxOutputTokens: 700, temperature: 0.35 },
    }),
  });

  if (!res.ok) {
    const err = new Error(`Gemini HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  if (!text) throw new Error("Empty Gemini response");
  return { text, provider: "gemini" };
}

/**
 * @param {object} env
 * @param {{ role: string, content: string }[]} messages
 * @param {string} extraSystem
 */
async function runCohere(env, messages, extraSystem) {
  const key = env.COHERE_API_KEY;
  if (!key) throw new Error("Cohere not configured");

  const chatHistory = messages.slice(-12, -1).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  const last = messages[messages.length - 1]?.content || "";

  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "command-r-08-2024",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + extraSystem },
        ...chatHistory,
        { role: "user", content: last },
      ],
      max_tokens: 700,
      temperature: 0.35,
    }),
  });

  if (!res.ok) {
    const err = new Error(`Cohere HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text =
    data?.message?.content?.[0]?.text?.trim() ||
    data?.text?.trim() ||
    "";
  if (!text) throw new Error("Empty Cohere response");
  return { text, provider: "cohere" };
}

const CASCADE = [
  { name: "cloudflare", run: runCloudflare },
  { name: "groq", run: runGroq },
  { name: "gemini", run: runGemini },
  { name: "cohere", run: runCohere },
];

/**
 * @param {object} env
 * @param {{ role: string, content: string }[]} messages
 */
export async function runAssistantCascade(env, messages) {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const codes = extractFaultCodes(userText);
  const extraSystem = await buildCodeContext(env.DB, codes);

  const errors = [];
  for (const step of CASCADE) {
    try {
      return await step.run(env, messages, extraSystem);
    } catch (e) {
      const status = e?.status;
      const msg = e?.message || String(e);
      errors.push(`${step.name}: ${msg}`);
      if (status && !isRetryableStatus(status) && step.name !== "cloudflare") {
        continue;
      }
      console.warn(`AI cascade ${step.name} failed:`, msg);
    }
  }

  throw new Error(
    "All AI providers are temporarily unavailable. Please try again later." +
      (errors.length ? ` (${errors[errors.length - 1]})` : "")
  );
}
