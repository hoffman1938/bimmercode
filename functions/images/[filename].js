// functions/images/[filename].js

export async function onRequestGet(context) {
  const { env, params } = context;
  const filename = params.filename;

  if (!filename) {
    return new Response("Filename missing", { status: 400 });
  }

  try {
    // Стучимся в ваш R2 бакет за файлом
    const object = await env.BUCKET.get(filename);

    if (!object) {
      return new Response("Image not found", { status: 404 });
    }

    // Настраиваем заголовки, чтобы браузер понял, что это картинка
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    // Кэшируем картинку на 1 год (для скорости)
    headers.set("Cache-Control", "public, max-age=31536000");

    // Отдаем файл
    return new Response(object.body, {
      headers,
    });
  } catch (e) {
    return new Response("Error fetching image: " + e.message, { status: 500 });
  }
}
