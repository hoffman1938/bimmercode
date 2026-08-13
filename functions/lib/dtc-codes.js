/** DTC codes: D1 primary, static JSON fallback */

export async function getCodeFromDb(db, code) {
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT * FROM dtc_codes WHERE code = ? AND is_published = 1")
      .bind(String(code).toUpperCase())
      .first();
    return row ? rowToPublic(row) : null;
  } catch {
    return null;
  }
}

export function rowToPublic(row) {
  const parseArr = (s) => {
    if (!s) return [];
    try {
      return JSON.parse(s);
    } catch {
      return String(s)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  };
  return {
    code: row.code,
    slug: row.slug || row.code,
    severity: row.severity,
    category: row.category,
    title: { en: row.title_en, ru: row.title_ru, ka: row.title_ka },
    description: {
      en: row.description_en,
      ru: row.description_ru,
      ka: row.description_ka,
    },
    solutions: {
      en: parseArr(row.solutions_en),
      ru: parseArr(row.solutions_ru),
      ka: parseArr(row.solutions_ka),
    },
    applicableModels: parseArr(row.applicable_models),
    relatedCodes: parseArr(row.related_codes),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    media: row.media_json ? JSON.parse(row.media_json) : null,
  };
}

export function jsonEntryToRow(entry) {
  const code = entry.code || entry.id;
  const title = entry.title || {};
  const desc = entry.description || {};
  const sol = entry.solutions || {};
  return {
    code: String(code).toUpperCase(),
    slug: String(code).toLowerCase().replace(/[^a-z0-9]/gi, "-"),
    severity: entry.severity || "medium",
    category: entry.category || null,
    title_en: title.en || title,
    title_ru: title.ru || null,
    title_ka: title.ka || null,
    description_en: desc.en || desc,
    description_ru: desc.ru || null,
    description_ka: desc.ka || null,
    solutions_en: JSON.stringify(sol.en || sol || []),
    solutions_ru: JSON.stringify(sol.ru || []),
    solutions_ka: JSON.stringify(sol.ka || []),
    applicable_models: JSON.stringify(entry.applicableModels || entry.models || []),
    related_codes: (entry.relatedCodes || []).join(","),
    seo_title: entry.seoTitle || null,
    seo_description: entry.seoDescription || null,
    media_json: entry.media ? JSON.stringify(entry.media) : null,
    is_published: entry.is_published !== false ? 1 : 0,
  };
}

export async function importCodesFromJson(db, codesJson) {
  const list = codesJson.codes || codesJson;
  let imported = 0;
  for (const entry of list) {
    const r = jsonEntryToRow(entry);
    await db
      .prepare(
        `INSERT INTO dtc_codes (code, slug, severity, category, title_en, title_ru, title_ka,
          description_en, description_ru, description_ka, solutions_en, solutions_ru, solutions_ka,
          applicable_models, related_codes, seo_title, seo_description, media_json, is_published, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
         ON CONFLICT(code) DO UPDATE SET
          slug=excluded.slug, severity=excluded.severity, category=excluded.category,
          title_en=excluded.title_en, title_ru=excluded.title_ru, title_ka=excluded.title_ka,
          description_en=excluded.description_en, description_ru=excluded.description_ru,
          description_ka=excluded.description_ka,
          solutions_en=excluded.solutions_en, solutions_ru=excluded.solutions_ru,
          solutions_ka=excluded.solutions_ka,
          applicable_models=excluded.applicable_models,
          related_codes=excluded.related_codes, updated_at=CURRENT_TIMESTAMP`
      )
      .bind(
        r.code,
        r.slug,
        r.severity,
        r.category,
        r.title_en,
        r.title_ru,
        r.title_ka,
        r.description_en,
        r.description_ru,
        r.description_ka,
        r.solutions_en,
        r.solutions_ru,
        r.solutions_ka,
        r.applicable_models,
        r.related_codes,
        r.seo_title,
        r.seo_description,
        r.media_json,
        r.is_published
      )
      .run();
    imported++;
  }
  return imported;
}
