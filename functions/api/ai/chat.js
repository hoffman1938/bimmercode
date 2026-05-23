// POST /api/ai/chat — multilingual BMW assistant (hybrid provider cascade)

import { checkRateLimit, getIpAddress, RATE_LIMITS } from "../../lib/rate-limit.js";
import { runAssistantCascade } from "../../lib/ai-assistant.js";
import {
  AI_CHAT_DAILY_MAX,
  checkAiChatDailyAllowance,
  getAiChatUsage,
  incrementAiChatUsage,
} from "../../lib/ai-chat-usage.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

const MAX_MESSAGE_LEN = 2000;
const MAX_MESSAGES = 14;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: String(m.content || "").slice(0, MAX_MESSAGE_LEN).trim(),
    }))
    .filter((m) => m.content.length > 0);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const ip = getIpAddress(request);

    const burst = await checkRateLimit(env, ip, RATE_LIMITS.AI_CHAT_BURST);
    if (!burst.allowed) {
      return json(
        {
          error: "rate_limit",
          message: "Too many messages. Please wait a minute.",
          resetAt: burst.resetAt.toISOString(),
        },
        429
      );
    }

    const dailyAllowance = await checkAiChatDailyAllowance(env.DB, ip);
    if (!dailyAllowance.allowed) {
      return json(
        {
          error: "daily_limit",
          message: "Daily free assistant limit reached. Try again tomorrow.",
          remaining: 0,
          used: dailyAllowance.count,
          limit: AI_CHAT_DAILY_MAX,
        },
        429
      );
    }

    const body = await request.json();
    const messages = sanitizeMessages(body.messages);

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "invalid_request", message: "Send at least one user message." }, 400);
    }

    const { text, provider } = await runAssistantCascade(env, messages);

    const usage = await incrementAiChatUsage(env.DB, ip);

    return json({
      reply: text,
      provider,
      remaining: usage.remaining,
      used: usage.count,
      limit: AI_CHAT_DAILY_MAX,
    });
  } catch (e) {
    const msg = e?.message || "Assistant error";
    const status = /unavailable|limit|429/i.test(msg) ? 503 : 500;
    console.error("AI chat error:", msg);
    return json({ error: "assistant_error", message: msg }, status);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const ip = getIpAddress(request);
  const usage = await getAiChatUsage(env.DB, ip);
  return json({
    remaining: usage.remaining,
    used: usage.count,
    limit: AI_CHAT_DAILY_MAX,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
