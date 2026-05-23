🔹 Full GitHub README Description

BMW Diagnostic Codes Database is an open-source web application designed to help BMW owners, mechanics, and enthusiasts quickly find and understand BMW diagnostic trouble codes (DTC).

The project currently provides a searchable database of BMW error codes with detailed descriptions and suggested repair solutions in three languages:

English 🇺🇸

Russian 🇷🇺

Georgian 🇬🇪

✨ Features

🔍 Fast search by BMW DTC or OBD-II P-codes

🌍 Multilingual support (EN / RU / KA)

🧠 AI-powered diagnostic assistant for symptom-based search

📄 Detailed explanations and repair recommendations

🚗 Supports BMW E-series, F-series, and G-series

🎨 Modern UI with 3D animated background (Three.js)

🚧 Project Status

This project is actively evolving.

✅ Error code database (temporary dataset)

✅ Multilingual interface

✅ AI diagnostic chat assistant

🚧 Forum system (planned) — community discussions, real cases, and shared fixes

🚧 Database expansion and validation

⚠️ Disclaimer

This project is not affiliated with BMW AG.
BMW is a registered trademark of Bayerische Motoren Werke AG.

🌐 Live Demo

👉 https://bimmercodes.net

## AI assistant (hybrid chat)

Floating widget on all pages → `POST /api/ai/chat`.

**Provider cascade (free tiers):**

1. Cloudflare Workers AI — `@cf/zai-org/glm-4.7-flash`, then `@cf/meta/llama-3.1-8b-instruct-fast` (already bound as `AI` in `wrangler.toml`)
2. Groq — `llama-3.1-8b-instant` (optional secret)
3. Google Gemini — `gemini-1.5-flash` (optional secret)
4. Cohere — `command-r-08-2024` (optional secret)

**Rate limits (per IP):** 8 messages/minute (KV optional), **40/day** tracked in D1 (`ai_chat_usage`). Apply migration: `npm run db:migrate:remote` (includes `021_ai_chat_usage.sql`).

**Secrets (production):**

```bash
npx wrangler pages secret put GROQ_API_KEY
npx wrangler pages secret put GEMINI_API_KEY
npx wrangler pages secret put COHERE_API_KEY
```

Local dev: add the same keys to `.dev.vars`. Without fallbacks, only Workers AI is used.
