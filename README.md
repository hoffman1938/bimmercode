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

## Cloudflare Pages deploy checklist

After deploying static assets + `functions/`:

1. **Bind D1** in Pages → Settings → Functions → D1 bindings: `DB` → `bmw-db`.
2. **Bind R2** (uploads): `BUCKET` → `bimmercodes-media`.
3. **Secrets** (Pages → Settings → Environment variables): `JWT_SECRET`, `TURNSTILE_SECRET_KEY` (and optional admin emails from `.dev.vars.example`).
4. **Apply D1 migrations** to production:
   ```bash
   npm run db:migrate:remote
   ```
   Forum APIs need columns such as `topics.is_archived` (migration `013_topics_archive_and_denorm.sql`).
5. Redeploy after code changes; bump `?v=` on CSS/JS if the CDN caches old bundles.
