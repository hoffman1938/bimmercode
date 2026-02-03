// js/topic.js

// === ПЕРЕВОДЫ ИНТЕРФЕЙСА ===
const topicTranslations = {
  en: {
    backToTopics: "Back to topics",
    topicInfo: "Topic Info",
    views: "Views",
    created: "Created",
    status: "Status",
    open: "Open",
    solved: "Solved",
    solution: "Solution",
    markSolution: "Mark Solution",
    writeReply: "Write a reply... (Drag & drop images or click 📎)",
    loginToReply: "Please login to reply.",
    login: "login",
    member: "Member",
    op: "Created", // ИЗМЕНЕНО
    confirmSolution: "Mark this post as the solution?",
    errorLoading: "Error loading topic",
    errorSending: "Error sending reply",
    translating: "Translating...",
    uploading: "Processing & Uploading...",
    uploadError: "Error uploading image",
  },
  ru: {
    backToTopics: "Назад к темам",
    topicInfo: "Информация",
    views: "Просмотры",
    created: "Создано",
    status: "Статус",
    open: "Открыто",
    solved: "Решено",
    solution: "Решение",
    markSolution: "Отметить как решение",
    writeReply: "Напишите ответ... (Перетащите фото или нажмите 📎)",
    loginToReply: "Войдите, чтобы ответить.",
    login: "войти",
    member: "Участник",
    op: "Создано", // ИЗМЕНЕНО
    confirmSolution: "Отметить этот пост как решение?",
    errorLoading: "Ошибка загрузки темы",
    errorSending: "Ошибка отправки ответа",
    translating: "Перевод...",
    uploading: "Обработка и загрузка...",
    uploadError: "Ошибка загрузки фото",
  },
  ka: {
    backToTopics: "თემებზე დაბრუნება",
    topicInfo: "ინფორმაცია",
    views: "ნახვები",
    created: "შექმნილია",
    status: "სტატუსი",
    open: "ღია",
    solved: "გადაწყვეტილი",
    solution: "გადაწყვეტა",
    markSolution: "მონიშვნა გადაწყვეტად",
    writeReply: "დაწერეთ პასუხი... (ჩააგდეთ ფოტო ან დააჭირეთ 📎)",
    loginToReply: "შედით პასუხის დასაწერად.",
    login: "შესვლა",
    member: "მონაწილე",
    op: "დაწერილია", // ИЗМЕНЕНО
    confirmSolution: "მონიშნოთ ეს პოსტი როგორც გადაწყვეტა?",
    errorLoading: "თემის ჩატვირთვის შეცდომა",
    errorSending: "პასუხის გაგზავნის შეცდომა",
    translating: "ითარგმნება...",
    uploading: "მუშავდება და იტვირთება...",
    uploadError: "ფოტოს ატვირთვის შეცდომა",
  },
};

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
const params = new URLSearchParams(window.location.search);
const topicId = params.get("id");
const user = JSON.parse(localStorage.getItem("user_data"));
let currentTopicLang = localStorage.getItem("forumLanguage") || "en";
let translationCache = JSON.parse(
  localStorage.getItem("translationCache") || "{}",
);
let originalTopicData = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener("DOMContentLoaded", () => {
  if (!topicId) {
    window.location.href = "forum.html";
    return;
  }

  loadTopicData();
  setupReplyForm();
  updateTopicPageLanguage();

  // Запускаем живое обновление темы каждые 15 сек
  setInterval(checkLiveTopicUpdates, 15000);

  // Управление видимостью формы ответа
  if (user) {
    if (document.getElementById("reply-form"))
      document.getElementById("reply-form").style.display = "flex";
    if (document.getElementById("login-to-reply"))
      document.getElementById("login-to-reply").style.display = "none";
  } else {
    if (document.getElementById("reply-form"))
      document.getElementById("reply-form").style.display = "none";
    if (document.getElementById("login-to-reply"))
      document.getElementById("login-to-reply").style.display = "block";
  }
});

// === НОВАЯ ФУНКЦИЯ: ОПРЕДЕЛЕНИЕ ЯЗЫКА ===
function detectContentLanguage(text) {
  if (!text) return "en";
  const kaRegex = /[\u10A0-\u10FF]/;
  const ruRegex = /[\u0400-\u04FF]/;
  if (kaRegex.test(text)) return "ka";
  if (ruRegex.test(text)) return "ru";
  return "en";
}

// === ОСНОВНАЯ ЛОГИКА ЗАГРУЗКИ ===
async function loadTopicData() {
  const t = topicTranslations[currentTopicLang];

  try {
    const userIdParam = user ? `&user_id=${user.id}` : "";
    const res = await fetch(`/api/forum/topic?id=${topicId}${userIdParam}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    originalTopicData = data;
    await renderTopicWithTranslation(data);
  } catch (err) {
    console.error(err);
    document.getElementById("posts-container").innerHTML =
      `<p style="color:red; text-align:center; margin-top:20px;">${t.errorLoading}: ${err.message}</p>`;
  }
}

// === РЕНДЕРИНГ И ПЕРЕВОД ===
async function renderTopicWithTranslation(data) {
  const t = topicTranslations[currentTopicLang];
  const topic = data.topic;

  const container = document.getElementById("posts-container");
  // Если контейнер пуст, показываем лоадер, иначе просто обновляем (чтобы не моргало при live update)
  if (!container.hasChildNodes()) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;"><i class="fas fa-language fa-spin"></i> ${t.translating}</div>`;
  }

  // Переводим заголовок и контент темы
  const [translatedTitle, translatedContent] = await Promise.all([
    translateText(topic.title, currentTopicLang),
    translateText(topic.content, currentTopicLang),
  ]);

  // Переводим посты параллельно
  const translatedPosts = await Promise.all(
    data.posts.map(async (post) => ({
      ...post,
      translatedContent: await translateText(post.content, currentTopicLang),
    })),
  );

  document.title = `${translatedTitle} | BimmerCodes`;

  // Рендер Шапки Темы
  const headerContainer = document.getElementById("topic-header-container");
  if (headerContainer) {
    headerContainer.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
          <span class="topic-badge">${topic.category}</span>
          ${topic.is_solved ? `<span class="topic-badge badge-solved"><i class="fas fa-check"></i> ${t.solved}</span>` : ""}
          ${topic.related_code ? `<a href="index.html?code=${topic.related_code}" class="topic-badge topic-code-badge"><i class="fas fa-search"></i> ${topic.related_code}</a>` : ""}
        </div>
        <h1 style="color:white; margin:10px 0;">${escapeHtml(translatedTitle)}</h1>
      `;
  }

  // Рендер Сайдбара
  const sidebarCard = document.querySelector(".sidebar-card");
  if (sidebarCard) {
    sidebarCard.innerHTML = `
      <div style="padding:20px;">
        <h3 style="color: white; margin-bottom: 15px; font-family:'Exo 2'">${t.topicInfo}</h3>
        <div style="color: #aaa; font-size: 14px; line-height: 2">
            <div><i class="fas fa-eye" style="width:20px; text-align:center; color:#0066b3"></i> ${t.views}: <span style="color:white; font-weight:bold">${topic.views}</span></div>
            <div><i class="fas fa-calendar" style="width:20px; text-align:center; color:#0066b3"></i> ${t.created}: <span style="color:white">${formatDate(topic.created_at)}</span></div>
            <div><i class="fas fa-check-circle" style="width:20px; text-align:center; color:#0066b3"></i> ${t.status}: <span style="color:${topic.is_solved ? "#2ecc71" : "white"}">${topic.is_solved ? t.solved : t.open}</span></div>
        </div>
      </div>
    `;
  }

  // Рендер Списка Постов
  let html = renderPostHTML(
    {
      id: "topic-main",
      username: topic.username,
      content: translatedContent,
      created_at: topic.created_at,
      is_solution: false,
      likes_count: 0,
      is_liked: false,
      lang: topic.lang,
    },
    true,
    topic.user_id,
  );

  html += translatedPosts
    .map((post) =>
      renderPostHTML(
        { ...post, content: post.translatedContent },
        false,
        topic.user_id,
      ),
    )
    .join("");

  container.innerHTML = html;
}

// Генерация HTML одного поста
// Внутри js/topic.js

function renderPostHTML(post, isMain, topicAuthorId) {
  const t = topicTranslations[currentTopicLang];
  const isTopicOwner = user && String(topicAuthorId) === String(user.id);

  // Определяем язык (по умолчанию EN, если в базе нет)
  const originLang = post.lang ? post.lang.toUpperCase() : "EN";

  return `
    <div class="post-card ${post.is_solution ? "solution" : ""}" id="post-${post.id}">
      <div class="post-user-panel">
        <div class="post-user-avatar">${post.username ? post.username[0].toUpperCase() : "?"}</div>
        <div class="post-username">${escapeHtml(post.username || "User")}</div>
        <div class="user-role-badge">${t.member}</div>
      </div>
      
      <div class="post-content-panel">
        <div class="post-header-meta">
          <div style="display:flex; align-items:center; gap:10px;">
              <span><i class="far fa-clock"></i> ${formatDate(post.created_at)}</span>
              
              <span class="lang-badge" title="Original language">
                <i class="fas fa-language"></i> ${originLang}
              </span>
          </div>

          ${
            post.is_solution
              ? `<span style="color:#2ecc71; font-weight:bold;"><i class="fas fa-check"></i> ${t.solution}</span>`
              : isMain
                ? `<span style="opacity:0.5; border:1px solid #555; padding:1px 5px; border-radius:4px; font-size:10px;">${t.op}</span>`
                : `<span style="opacity:0.5">#${post.id.slice(0, 4)}</span>`
          }
        </div>
        
        <div class="post-text-body">
          ${parseMarkdown(post.content)}
        </div>

        <div class="post-footer-actions">
          ${
            !isMain
              ? `
            <button class="btn-action ${post.is_liked ? "liked" : ""}" onclick="likePost('${post.id}')">
              <i class="${post.is_liked ? "fas" : "far"} fa-heart"></i> 
              <span id="likes-${post.id}">${post.likes_count || 0}</span>
            </button>
            ${
              isTopicOwner && !post.is_solution
                ? `
              <button class="btn-action" onclick="markSolution('${post.id}')" style="color:#2ecc71; border-color:rgba(46,204,113,0.3);">
                <i class="fas fa-check"></i> ${t.markSolution}
              </button>
            `
                : ""
            }
          `
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

// === ФОРМА ОТВЕТА И ЗАГРУЗКА ФОТО (WebP) ===
function setupReplyForm() {
  const form = document.getElementById("reply-form");
  const textarea = document.getElementById("reply-content");
  const attachBtn = document.getElementById("attach-btn");
  const fileInput = document.getElementById("file-input");

  if (!form || !textarea) return;

  if (attachBtn && fileInput) {
    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        processAndUpload(e.target.files[0]);
      }
    });
  }

  textarea.addEventListener("paste", handlePasteImage);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = textarea.value;
    if (!content.trim()) return;

    const btn = form.querySelector("button[type='submit']");
    btn.disabled = true;

    // ОПРЕДЕЛЯЕМ ЯЗЫК КОММЕНТАРИЯ
    const detectedLang = detectContentLanguage(content);

    try {
      const res = await fetch("/api/forum/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: topicId,
          user_id: user.id,
          username: user.username,
          content: content,
          lang: detectedLang, // Используем определенный язык
        }),
      });

      if (res.ok) {
        textarea.value = "";
        loadTopicData();
      } else {
        throw new Error("Failed to post");
      }
    } catch (err) {
      alert(topicTranslations[currentTopicLang].errorSending);
    }
    btn.disabled = false;
  });
}

// Обработка вставки из буфера обмена
async function handlePasteImage(e) {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === "file" && item.type.includes("image/")) {
      processAndUpload(item.getAsFile());
    }
  }
}

// Главная функция: Конвертация + Загрузка
// Внутри js/topic.js

// Функция отправки (с конвертацией)
async function processAndUpload(file) {
  const textarea = document.getElementById("reply-content");
  const loadingTag = `\n![Uploading...]`;

  // Вставляем текст загрузки
  const cursor = textarea.selectionStart;
  textarea.value =
    textarea.value.slice(0, cursor) + loadingTag + textarea.value.slice(cursor);

  try {
    console.log("Original file:", file.name, file.type, file.size);

    // 1. КОНВЕРТАЦИЯ (Client-side)
    // Если это уже webp, можно не конвертировать, но для сжатия лучше прогнать
    const webpFile = await convertToWebP(file);

    console.log("Converted file:", webpFile.name, webpFile.type, webpFile.size);

    // 2. ЗАГРУЗКА
    const formData = new FormData();
    formData.append("file", webpFile); // Отправляем уже WebP!

    const res = await fetch("/api/upload", { method: "POST", body: formData });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.url) {
      textarea.value = textarea.value.replace(
        loadingTag,
        `\n![image](${data.url})`,
      );
    } else {
      throw new Error("No URL returned");
    }
  } catch (err) {
    console.error(err);
    textarea.value = textarea.value.replace(
      loadingTag,
      `\n[Error: ${err.message}]`,
    );
    alert("Upload error: " + err.message);
  }
}

// Утилита конвертации
function convertToWebP(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Ограничение размера (Full HD)
        const MAX_WIDTH = 1920;
        const scale = Math.min(1, MAX_WIDTH / img.width);

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Конвертация в blob image/webp с качеством 0.8
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Canvas conversion failed"));

            // Меняем имя файла на .webp
            const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const newFile = new File([blob], fileName, { type: "image/webp" });

            resolve(newFile);
          },
          "image/webp",
          0.8,
        );
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}

// === ВЗАИМОДЕЙСТВИЯ ===
async function likePost(postId) {
  if (!user) return toggleAuthModal();

  // Оптимистичное обновление UI
  const countSpan = document.getElementById(`likes-${postId}`);
  const btn = countSpan.parentElement;
  const icon = btn.querySelector("i");

  let count = parseInt(countSpan.textContent);

  if (btn.classList.contains("liked")) {
    count--;
    btn.classList.remove("liked");
    icon.classList.remove("fas");
    icon.classList.add("far");
  } else {
    count++;
    btn.classList.add("liked");
    icon.classList.remove("far");
    icon.classList.add("fas");
  }
  countSpan.textContent = count;

  // Отправка на сервер
  try {
    await fetch("/api/forum/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, user_id: user.id }),
    });
  } catch (e) {
    console.error("Like failed", e);
  }
}

async function markSolution(postId) {
  if (!confirm(topicTranslations[currentTopicLang].confirmSolution)) return;

  await fetch("/api/forum/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic_id: topicId,
      post_id: postId,
      user_id: user.id,
    }),
  });
  loadTopicData();
}

// === ЖИВОЕ ОБНОВЛЕНИЕ ТЕМЫ ===
async function checkLiveTopicUpdates() {
  if (!originalTopicData) return;

  // Считаем сколько сейчас постов
  const currentPostCount = document.querySelectorAll(".post-card").length;
  // -1 потому что первый элемент это сама тема (main post)
  const currentReplyCount = currentPostCount > 0 ? currentPostCount - 1 : 0;

  try {
    const userIdParam = user ? `&user_id=${user.id}` : "";
    const res = await fetch(`/api/forum/topic?id=${topicId}${userIdParam}`);
    if (!res.ok) return;

    const data = await res.json();

    // Если на сервере больше постов, перезагружаем данные
    if (data.posts.length > currentReplyCount) {
      console.log("New posts detected, refreshing...");
      originalTopicData = data;
      renderTopicWithTranslation(data);
    }
  } catch (e) {
    console.error(e);
  }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function formatDate(dateString) {
  if (!dateString) return "";
  // Добавляем Z, если дата без таймзоны (для D1), чтобы браузер понял что это UTC
  const safeDate = dateString.endsWith("Z") ? dateString : dateString + "Z";
  return new Date(safeDate).toLocaleString();
}

function parseMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  html = html.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%; border-radius:8px; margin:10px 0; border:1px solid #333;">',
  );
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-family:monospace;">$1</code>',
  );
  html = html.replace(/\n/g, "<br>");
  return html;
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// === GOOGLE TRANSLATE API ===
async function translateText(text, targetLang) {
  if (!text || text.trim().length < 2) return text;
  const cacheKey = `${text.substring(0, 100)}_${targetLang}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    let translated = "";
    if (data && data[0]) {
      for (let i = 0; i < data[0].length; i++) {
        if (data[0][i][0]) translated += data[0][i][0];
      }
    }
    if (translated && translated !== text) {
      translationCache[cacheKey] = translated;
      localStorage.setItem(
        "translationCache",
        JSON.stringify(translationCache),
      );
      return translated;
    }
    return text;
  } catch (error) {
    return text;
  }
}

// Обновление языка темы
async function switchTopicLanguage() {
  const langs = ["en", "ru", "ka"];
  let idx = langs.indexOf(currentTopicLang);
  currentTopicLang = langs[(idx + 1) % langs.length];
  localStorage.setItem("forumLanguage", currentTopicLang);
  updateTopicPageLanguage();
  if (originalTopicData) await renderTopicWithTranslation(originalTopicData);
}

function updateTopicPageLanguage() {
  const t = topicTranslations[currentTopicLang];
  const langLabels = { en: "EN", ru: "RU", ka: "KA" };
  const langDisplay = document.getElementById("topic-lang-display");
  if (langDisplay) langDisplay.textContent = langLabels[currentTopicLang];

  const backLink = document.querySelector(".back-link");
  if (backLink)
    backLink.innerHTML = `<i class="fas fa-chevron-left"></i> ${t.backToTopics}`;

  const replyContent = document.getElementById("reply-content");
  if (replyContent) replyContent.placeholder = t.writeReply;
}

// === LIGHTBOX LOGIC ===

// 1. Делегирование событий: ловим клик по картинке внутри постов
document.addEventListener("click", function (e) {
  // Если кликнули по IMG внутри контейнера поста
  if (e.target.tagName === "IMG" && e.target.closest(".post-text-body")) {
    openLightbox(e.target.src);
  }
});

function openLightbox(src) {
  const modal = document.getElementById("lightbox-modal");
  const img = document.getElementById("lightbox-img");

  if (modal && img) {
    img.src = src;
    modal.classList.add("active"); // Показываем модалку
    document.body.style.overflow = "hidden"; // Блокируем скролл страницы
  }
}

// Эта функция должна быть глобальной (window), так как вызывается из onclick в HTML
window.closeLightbox = function (e) {
  // Закрываем, если кликнули по фону, по крестику или по самой картинке
  if (
    e.target.id === "lightbox-modal" ||
    e.target.classList.contains("close-lightbox") ||
    e.target.classList.contains("lightbox-content")
  ) {
    const modal = document.getElementById("lightbox-modal");
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = ""; // Разблокируем скролл
      setTimeout(() => {
        document.getElementById("lightbox-img").src = "";
      }, 300);
    }
  }
};

// Закрытие по клавише Esc
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    const modal = document.getElementById("lightbox-modal");
    if (modal && modal.classList.contains("active")) {
      window.closeLightbox({ target: modal });
    }
  }
});
