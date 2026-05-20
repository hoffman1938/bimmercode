// functions/api/forum/edit.js

import { ensureFtsSyncTriggersDropped, withFtsBypass } from "../../lib/fts-bypass.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { type, id, user_id, content } = await request.json();

    if (!content || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "Content cannot be empty" }),
        { status: 400 },
      );
    }

    await ensureFtsSyncTriggersDropped(db);

    let result = await withFtsBypass(db, async () => {
      if (type === "topic") {
        const topicResult = await db
          .prepare("UPDATE topics SET content = ? WHERE id = ? AND user_id = ?")
          .bind(content, id, user_id)
          .run();
        if (topicResult.meta.changes > 0) {
          await db
            .prepare("UPDATE posts SET content = ? WHERE id = ? AND user_id = ?")
            .bind(content, id, user_id)
            .run();
        }
        return topicResult;
      }
      return db
        .prepare("UPDATE posts SET content = ? WHERE id = ? AND user_id = ?")
        .bind(content, id, user_id)
        .run();
    });

    if (result.meta.changes > 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      return new Response(
        JSON.stringify({ error: "Update failed or access denied" }),
        { status: 403 },
      );
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
