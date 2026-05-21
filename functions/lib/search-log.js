export async function logSearchQuery(env, query, resultCount = 0, path = "/") {
  if (!env?.DB || !query || String(query).length < 2) return;
  const q = String(query).trim().slice(0, 200);
  try {
    await env.DB.prepare(
      `INSERT INTO search_queries (id, query, result_count, path) VALUES (?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), q, resultCount, path)
      .run();
  } catch {
    /* table may not exist yet */
  }
}
