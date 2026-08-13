// functions/code/[id].js
// Dynamic SSR page for each BMW DTC code.
// Route: /code/:id  →  e.g. /code/P0100, /code/102613
//
// Data sources:
//   /data/codes.json  — 74 standard OBD2 codes (P-codes)
//   /data/data.json   — 175 BMW-specific codes (numeric)
//
// To regenerate data.json run: node build-data-json.js

const SITE_URL = 'https://bimmercodes.net';

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSeverityClass(s) {
  if (!s) return 'unknown';
  const v = String(s).toLowerCase();
  if (v === 'high' || v === 'critical') return 'high';
  if (v === 'medium' || v === 'moderate') return 'medium';
  return 'low';
}

function getSeverityLabel(s, lang) {
  const labels = {
    en: { high: 'High', medium: 'Medium', low: 'Low', unknown: 'Unknown' },
    ru: { high: 'Высокий', medium: 'Средний', low: 'Низкий', unknown: 'Неизвестно' },
    ka: { high: 'მაღალი', medium: 'საშუალო', low: 'დაბალი', unknown: 'უცნობი' },
  };
  const l = labels[lang] || labels.en;
  return l[getSeverityClass(s)] || l.unknown;
}

function t(lang) {
  const T = {
    en: {
      homeBtn: 'Home',
      vinBtn: 'VIN',
      forumBtn: 'Forum',
      back: '← Back to Search',
      severity: 'Severity',
      category: 'Category',
      models: 'Applicable Models',
      solutions: 'Solutions',
      software: 'Diagnostic Software',
      notfound: 'Code not found',
      notfoundDesc: 'The requested code was not found in our database.',
      searchBtn: 'Search all codes',
      relatedTitle: 'Frequently Associated Codes',
      engineCodes: 'Engine Types',
      contactUs: 'Contact Us',
    },
    ru: {
      homeBtn: 'Главная',
      vinBtn: 'VIN',
      forumBtn: 'Форум',
      back: '← Назад к поиску',
      severity: 'Серьёзность',
      category: 'Категория',
      models: 'Применимые модели',
      solutions: 'Решения',
      software: 'Диагностический софт',
      notfound: 'Код не найден',
      notfoundDesc: 'Запрошенный код не найден в нашей базе данных.',
      searchBtn: 'Поиск всех кодов',
      relatedTitle: 'Часто связанные коды',
      engineCodes: 'Типы двигателей',
      contactUs: 'Связаться',
    },
    ka: {
      homeBtn: 'მთავარი',
      vinBtn: 'VIN',
      forumBtn: 'ფორუმი',
      back: '← ძიებაზე დაბრუნება',
      severity: 'სიმძიმე',
      category: 'კატეგორია',
      models: 'მოდელები',
      solutions: 'გადაწყვეტილებები',
      software: 'დიაგნოსტიკური პროგრამა',
      notfound: 'კოდი ვერ მოიძებნა',
      notfoundDesc: 'თქვენს მიერ მოთხოვნილი კოდი ჩვენს მონაცემთა ბაზაში ვერ მოიძებნა.',
      searchBtn: 'ყველა კოდის ძიება',
      relatedTitle: 'დაკავშირებული კოდები',
      engineCodes: 'ძრავის ტიპები',
      contactUs: 'კონტაქტი',
    },
  };
  return T[lang] || T.en;
}

function renderPage(code, lang) {
  const tr = t(lang);
  const title = code.title?.[lang] || code.title?.en || code.code;
  const description = code.description?.[lang] || code.description?.en || '';
  const solutions = code.solutions?.[lang] || code.solutions?.en || [];
  const severity = code.severity;
  const sevClass = getSeverityClass(severity);
  const sevLabel = getSeverityLabel(severity, lang);
  const category = code.category || '';
  const models = code.applicableModels || [];
  const engineCodes = code.engineCodes || [];
  const software = code.software || [];
  const codeId = code.code;

  const canonical = `${SITE_URL}/code/${encodeURIComponent(codeId)}`;
  const ogTitle = `BMW ${codeId} — ${esc(title)}`;
  const ogDesc = description.slice(0, 160).replace(/\n/g, ' ');

  const solutionItems = Array.isArray(solutions)
    ? solutions.map(s => `<li>${esc(s)}</li>`).join('')
    : '';

  const modelBadges = models.length
    ? models.map(m => `<span class="badge">${esc(m)}</span>`).join('')
    : '';

  const engineBadges = engineCodes.length
    ? engineCodes.map(e => `<span class="badge engine">${esc(e)}</span>`).join('')
    : '';

  const softwareBadges = software.length
    ? software.map(s => `<span class="badge soft">${esc(s)}</span>`).join('')
    : '';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `BMW Error Code ${codeId}: ${title}`,
    description: ogDesc,
    inLanguage: lang,
    url: canonical,
    author: { '@type': 'Organization', name: 'BimmerCodes' },
    publisher: { '@type': 'Organization', name: 'BimmerCodes', url: SITE_URL },
    about: { '@type': 'Thing', name: `BMW DTC ${codeId}` },
  });

  const langLabel = { en: 'EN', ru: 'RU', ka: 'KA' };
  const nextLang = { en: 'ru', ru: 'ka', ka: 'en' }[lang];
  const langLinks = Object.keys(langLabel).map(l =>
    `<a href="/code/${encodeURIComponent(codeId)}?lang=${l}" class="lang-link${l === lang ? ' active' : ''}">${langLabel[l]}</a>`
  ).join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BMW ${esc(codeId)} — ${esc(title)} | BimmerCodes</title>
  <meta name="description" content="${esc(ogDesc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en" href="${SITE_URL}/code/${encodeURIComponent(codeId)}?lang=en">
  <link rel="alternate" hreflang="ru" href="${SITE_URL}/code/${encodeURIComponent(codeId)}?lang=ru">
  <link rel="alternate" hreflang="ka" href="${SITE_URL}/code/${encodeURIComponent(codeId)}?lang=ka">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(ogDesc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="BimmerCodes">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(ogDesc)}">
  <link rel="shortcut icon" href="/assets/icons/ico.svg" type="image/x-icon">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    #webgl-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1; opacity: 0.6; pointer-events: none; }
    :root {
      --bg: #060e1a; --card: #0d1b2e; --border: rgba(0,102,179,.25);
      --blue: #0066b3; --sky: #4da8ff; --text: #e8edf5; --muted: rgba(232,237,245,.55);
      --radius: 14px; --high: #e74c3c; --medium: #f39c12; --low: #2ecc71;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg); color: var(--text); min-height: 100vh;
      background-image: radial-gradient(ellipse at 20% 20%, rgba(0,102,179,.1) 0%, transparent 60%);
    }
    a { color: var(--sky); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Header */
    header {
      background: rgba(6,14,26,.85); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border); padding: 0 24px;
      display: flex; align-items: center; justify-content: space-between;
      height: 60px; position: sticky; top: 0; z-index: 100;
    }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1rem; color: var(--text); }
    .logo svg { width: 36px; height: 36px; }
    .header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .header-link {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(0,102,179,.12); border: 1px solid var(--border);
      color: var(--sky); border-radius: 8px; padding: 6px 12px;
      font-size: .8rem; font-weight: 600; text-decoration: none; white-space: nowrap;
    }
    .header-link:hover { background: rgba(0,102,179,.22); text-decoration: none; }
    .lang-switcher { display: flex; gap: 6px; }
    .lang-link {
      padding: 4px 10px; border-radius: 6px; font-size: .8rem; font-weight: 600;
      color: var(--muted); border: 1px solid transparent;
      transition: .2s;
    }
    .lang-link.active, .lang-link:hover {
      color: var(--sky); border-color: rgba(0,102,179,.5);
      background: rgba(0,102,179,.12); text-decoration: none;
    }
    .btn-back {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(0,102,179,.15); border: 1px solid var(--border);
      color: var(--sky); border-radius: 8px; padding: 6px 14px;
      font-size: .85rem; transition: .2s;
    }
    .btn-back:hover { background: rgba(0,102,179,.3); text-decoration: none; }

    /* Main */
    main { max-width: 820px; margin: 0 auto; padding: 40px 20px 80px; }

    /* Code hero */
    .code-hero {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 36px;
      margin-bottom: 24px;
      position: relative; overflow: hidden;
    }
    .code-hero::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(0,102,179,.08) 0%, transparent 60%);
      pointer-events: none;
    }
    .code-badge {
      font-family: 'Courier New', monospace; font-size: 2.4rem; font-weight: 900;
      color: var(--sky); letter-spacing: 2px; line-height: 1;
      margin-bottom: 12px;
    }
    .code-title { font-size: 1.25rem; font-weight: 600; color: var(--text); margin-bottom: 16px; line-height: 1.4; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 100px; font-size: .8rem; font-weight: 600;
    }
    .chip-cat { background: rgba(0,102,179,.15); border: 1px solid rgba(0,102,179,.35); color: var(--sky); }
    .chip-sev { border: 1px solid; }
    .chip-sev.high   { background: rgba(231,76,60,.12);   border-color: rgba(231,76,60,.4);   color: #e74c3c; }
    .chip-sev.medium { background: rgba(243,156,18,.12);  border-color: rgba(243,156,18,.4);  color: #f39c12; }
    .chip-sev.low    { background: rgba(46,204,113,.12);  border-color: rgba(46,204,113,.4);  color: #2ecc71; }
    .chip-sev.unknown{ background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.2); color: var(--muted); }
    .description { color: var(--muted); line-height: 1.7; font-size: .95rem; }

    /* Section card */
    .section-card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 28px; margin-bottom: 20px;
    }
    .section-card h2 {
      font-size: 1rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: var(--sky); margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px;
    }
    .section-card h2 i { font-size: .9rem; }

    /* Solutions */
    .solutions-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .solutions-list li {
      display: flex; gap: 12px; align-items: flex-start;
      color: var(--text); font-size: .93rem; line-height: 1.5;
    }
    .solutions-list li::before {
      content: counter(step);
      counter-increment: step;
      min-width: 26px; height: 26px;
      background: rgba(0,102,179,.2); border: 1px solid rgba(0,102,179,.4);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: .75rem; font-weight: 700; color: var(--sky); flex-shrink: 0;
    }
    .solutions-list { counter-reset: step; }

    /* Badges */
    .badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge {
      padding: 4px 12px; border-radius: 6px; font-size: .8rem; font-weight: 600;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
      color: var(--muted);
    }
    .badge.engine { background: rgba(0,102,179,.12); border-color: rgba(0,102,179,.3); color: var(--sky); }
    .badge.soft   { background: rgba(100,200,100,.08); border-color: rgba(100,200,100,.25); color: #6ccf7a; }

    /* Footer */
    footer {
      text-align: center; padding: 32px 20px;
      border-top: 1px solid var(--border); color: var(--muted); font-size: .8rem;
    }
    footer a { color: var(--sky); }

    @media (max-width: 600px) {
      .code-badge { font-size: 1.8rem; }
      .code-title { font-size: 1.05rem; }
      header { padding: 0 16px; }
      .code-hero, .section-card { padding: 20px; }
    }
  </style>
</head>
<body>
  <div id="webgl-container"></div>
  <header>
    <a href="/" class="logo" style="text-decoration:none">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="48" stroke="white" stroke-width="4" fill="black"/>
        <circle cx="50" cy="50" r="35" fill="white"/>
        <path d="M 50,15 A 35,35 0 0,1 85,50 H 50 Z" fill="#1A6FB0"/>
        <path d="M 50,50 H 85 A 35,35 0 0,1 50,85 Z" fill="white"/>
        <path d="M 50,50 V 15 A 35,35 0 0,0 15,50 Z" fill="white"/>
        <path d="M 50,50 H 15 A 35,35 0 0,0 50,85 Z" fill="#1A6FB0"/>
      </svg>
      BimmerCodes
    </a>
    <div class="header-right">
      <a href="/" class="header-link" title="Home"><i class="fas fa-home" aria-hidden="true"></i> ${esc(tr.homeBtn)}</a>
      <a href="/vin.html" class="header-link"><i class="fas fa-fingerprint" aria-hidden="true"></i> ${esc(tr.vinBtn)}</a>
      <a href="/forum" class="header-link"><i class="fas fa-comments" aria-hidden="true"></i> ${esc(tr.forumBtn)}</a>
      <div class="lang-switcher">${langLinks}</div>
      <a href="/?search=${encodeURIComponent(codeId)}" class="btn-back">
        <i class="fas fa-search" aria-hidden="true"></i> ${esc(tr.back)}
      </a>
    </div>
  </header>

  <main>
    <article>
      <div class="code-hero">
        <div class="code-badge">${esc(codeId)}</div>
        <div class="code-title">${esc(title)}</div>
        <div class="meta-row">
          ${category ? `<span class="chip chip-cat"><i class="fas fa-tag"></i> ${esc(category)}</span>` : ''}
          ${severity ? `<span class="chip chip-sev ${sevClass}"><i class="fas fa-exclamation-circle"></i> ${esc(tr.severity)}: ${esc(sevLabel)}</span>` : ''}
        </div>
        <p class="description">${esc(description)}</p>
      </div>

      ${solutionItems ? `
      <div class="section-card">
        <h2><i class="fas fa-wrench"></i> ${esc(tr.solutions)}</h2>
        <ol class="solutions-list">${solutionItems}</ol>
      </div>` : ''}

      ${modelBadges ? `
      <div class="section-card">
        <h2><i class="fas fa-car"></i> ${esc(tr.models)}</h2>
        <div class="badges">${modelBadges}</div>
      </div>` : ''}

      ${engineBadges ? `
      <div class="section-card">
        <h2><i class="fas fa-cogs"></i> ${esc(tr.engineCodes)}</h2>
        <div class="badges">${engineBadges}</div>
      </div>` : ''}

      ${softwareBadges ? `
      <div class="section-card">
        <h2><i class="fas fa-laptop-code"></i> ${esc(tr.software)}</h2>
        <div class="badges">${softwareBadges}</div>
      </div>` : ''}
    </article>
  </main>

  <footer>
    <div style="margin-bottom:8px">
      <a href="/">BimmerCodes</a> ·
      <a href="/vin">${lang === 'ru' ? 'VIN декодер' : lang === 'ka' ? 'VIN შემოწმება' : 'VIN Check'}</a> ·
      <a href="/contact">${esc(tr.contactUs)}</a> ·
      <a href="/terms">${lang === 'ru' ? 'Условия' : lang === 'ka' ? 'პირობები' : 'Terms'}</a>
    </div>
    <div>BMW DTC Bot © ${new Date().getFullYear()} · BimmerCodes.net</div>
  </footer>

  <script>
    const urlLang = new URLSearchParams(location.search).get('lang');
    if (urlLang) localStorage.setItem('language', urlLang);
  </script>
  <script src="/js/ai-chat-loader.js?v=1" defer data-cfasync="false"></script>
</body>
</html>`;
}

function renderNotFound(codeId, lang) {
  const tr = t(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BMW ${esc(codeId)} — ${esc(tr.notfound)} | BimmerCodes</title>
  <meta name="robots" content="noindex">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <style>
    body{font-family:system-ui,sans-serif;background:#060e1a;color:#e8edf5;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
    .box{max-width:480px}
    h1{font-size:1.5rem;margin-bottom:12px;color:#4da8ff}
    p{color:rgba(232,237,245,.6);margin-bottom:28px;line-height:1.6}
    a.btn{display:inline-flex;align-items:center;gap:8px;background:#0066b3;color:#fff;padding:12px 28px;border-radius:10px;font-weight:600;text-decoration:none}
    .code{font-family:monospace;font-size:3rem;font-weight:900;color:#0066b3;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="box">
    <div class="code">${esc(codeId)}</div>
    <h1>${esc(tr.notfound)}</h1>
    <p>${esc(tr.notfoundDesc)}</p>
    <a href="/?search=${encodeURIComponent(codeId)}" class="btn">
      <i class="fas fa-search"></i> ${esc(tr.searchBtn)}
    </a>
  </div>
</body>
</html>`;
}

async function findCode(id, assetsFetch, baseUrl) {
  const upperCode = id.toUpperCase();

  // 1. Try codes.json (standard OBD2 P-codes)
  try {
    const res = await assetsFetch(new Request(`${baseUrl}/data/codes.json`));
    if (res.ok) {
      const { codes } = await res.json();
      const found = codes.find(c => c.code.toUpperCase() === upperCode);
      if (found) return found;
    }
  } catch (_) {}

  // 2. Try data.json (BMW-specific numeric codes)
  try {
    const res = await assetsFetch(new Request(`${baseUrl}/data/data.json`));
    if (res.ok) {
      const { codes } = await res.json();
      const found = codes.find(c => String(c.code).toUpperCase() === upperCode);
      if (found) return found;
    }
  } catch (_) {}

  return null;
}

export async function onRequestGet(context) {
  const { params, request, env } = context;
  const id = params.id || '';

  if (!id || id.length > 24) {
    return new Response('Invalid code', { status: 400 });
  }

  // Determine language: ?lang= query param → cookie → default en
  const url = new URL(request.url);
  const lang = (['en', 'ru', 'ka'].includes(url.searchParams.get('lang')))
    ? url.searchParams.get('lang')
    : 'en';

  const baseUrl = `${url.protocol}//${url.host}`;

  // Fetch code data from static JSON files
  const code = await findCode(id, env.ASSETS.fetch.bind(env.ASSETS), baseUrl);

  const html = code
    ? renderPage(code, lang)
    : renderNotFound(id, lang);

  const status = code ? 200 : 404;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': code
        ? 'public, max-age=3600, stale-while-revalidate=86400'
        : 'no-store',
    },
  });
}
