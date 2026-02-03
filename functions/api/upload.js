// functions/api/upload.js

export async function onRequest(context) {
  const { request, env } = context;

  // Разрешаем только POST запросы
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    // Проверки
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
      });
    }
    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Only images allowed" }), {
        status: 400,
      });
    }

    // Генерируем имя файла
    const extension = file.name.split(".").pop();
    const filename = crypto.randomUUID() + "." + extension;

    // 1. Сохраняем файл в ваше облачное хранилище R2
    await env.BUCKET.put(filename, file, {
      httpMetadata: { contentType: file.type },
    });

    // 2. Формируем ссылку для браузера
    // Мы будем отдавать файлы через наш собственный API (см. Шаг 2)
    const imageUrl = `/images/${filename}`;

    return new Response(
      JSON.stringify({
        url: imageUrl, // Отправляем эту ссылку на фронтенд
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
