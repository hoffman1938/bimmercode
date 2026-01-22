// functions/api/upload.js

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
    }

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
        return new Response(JSON.stringify({ error: "Only images allowed" }), { status: 400 });
    }

    // Генерируем уникальное имя файла
    const filename = crypto.randomUUID() + '-' + file.name;

    // Сохраняем в R2
    await env.BUCKET.put(filename, file, {
      httpMetadata: { contentType: file.type }
    });

    // ВАЖНО: Замените эту ссылку на вашу Public Access URL из шага 1!
    // Если забыли, ее можно найти в настройках бакета R2.
    // Пример: https://pub-123456789.r2.dev
    const publicUrl = "https://pub-14d07d579fbe46c5bccba825a4c3be50.r2.dev"; 

    return new Response(JSON.stringify({ 
      url: `${publicUrl}/${filename}` 
    }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}