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
    op: "Author",
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
    op: "Автор",
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
    op: "ავტორი",
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

  // Живое обновление темы (новые ответы)
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

// === ФУНКЦИЯ ОПРЕДЕЛЕНИЯ ЯЗЫКА ТЕКСТА ===
function detectContentLanguage(text) {
  if (!text) return "en";
  const kaRegex = /[\u10A0-\u10FF]/;
  const ruRegex = /[\u0400-\u04FF]/;
  if (kaRegex.test(text)) return "ka";
  if (ruRegex.test(text)) return "ru";
  return "en";
}

// === ЗАГРУЗКА ДАННЫХ ===
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
  if (!container.hasChildNodes()) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;"><i class="fas fa-language fa-spin"></i> ${t.translating}</div>`;
  }

  // Перевод
  const [translatedTitle, translatedContent] = await Promise.all([
    translateText(topic.title, currentTopicLang),
    translateText(topic.content, currentTopicLang),
  ]);

  const translatedPosts = await Promise.all(
    data.posts.map(async (post) => ({
      ...post,
      translatedContent: await translateText(post.content, currentTopicLang),
    })),
  );

  document.title = `${translatedTitle} | BimmerCodes`;

  // Хедер темы
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

  // Сайдбар
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

  // Рендер Главного поста
  // Рендер Главного поста
  let html = renderPostHTML(
    {
      id: topic.id, // <-- ВАЖНО: Передаем реальный ID темы, а не "topic-main"
      user_id: topic.user_id,
      username: topic.username,
      content: translatedContent,
      created_at: topic.created_at,
      is_solution: false,
      likes_count: 0,
      is_liked: false,
      lang: topic.lang,
      author_avatar: topic.author_avatar,
    },
    true, // isMain = true
    topic.user_id,
  );

  // Рендер Ответов
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

// === ГЕНЕРАЦИЯ HTML ПОСТА (ИСПРАВЛЕННАЯ) ===
function renderPostHTML(post, isMain, topicAuthorId) {
  const t = topicTranslations[currentTopicLang];
  const isTopicOwner = user && String(topicAuthorId) === String(user.id);

  // Проверка: автор ли это?
  const isMyPost = user && String(post.user_id) === String(user.id);

  // Язык
  const originLang = post.lang ? post.lang.toUpperCase() : "EN";

  // === АВАТАРКА ===
  let avatarHTML;
  // Берем author_avatar с сервера, либо user.avatar_url если это текущий пользователь
  const currentUser = JSON.parse(localStorage.getItem("user_data"));
  const avatarUrl =
    post.author_avatar ||
    (isMyPost && currentUser ? currentUser.avatar_url : null);

  if (avatarUrl) {
    avatarHTML = `<img src="${avatarUrl}" class="post-user-avatar" style="object-fit:cover;">`;
  } else {
    avatarHTML = `<div class="post-user-avatar">${post.username ? post.username[0].toUpperCase() : "?"}</div>`;
  }

  return `
    <div class="post-card ${post.is_solution ? "solution" : ""}" id="post-${post.id}">
      <div class="post-user-panel">
        ${avatarHTML}
        <div class="post-username">${escapeHtml(post.username || "User")}</div>
        <div class="user-role-badge">${t.member}</div>
      </div>
      
      <div class="post-content-panel">
        <div class="post-header-meta">
          <div style="display:flex; align-items:center; gap:10px;">
              <span><i class="far fa-clock"></i> ${formatDate(post.created_at)}</span>
              <span class="lang-badge" title="Original language"><i class="fas fa-language"></i> ${originLang}</span>
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
            isMyPost
              ? `
            <button class="btn-action btn-edit" onclick="editItem('${isMain ? "topic" : "post"}', '${post.id}')" title="Edit">
                <i class="fas fa-pen"></i>
            </button>

            <button class="btn-action btn-delete" onclick="deleteItem('${isMain ? "topic" : "post"}', '${post.id}')" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
          `
              : '<div style="margin-right:auto;"></div>'
          }

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
      if (e.target.files.length > 0) processAndUpload(e.target.files[0]);
    });
  }

  textarea.addEventListener("paste", handlePasteImage);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = textarea.value;
    if (!content.trim()) return;

    const btn = form.querySelector("button[type='submit']");
    btn.disabled = true;

    // Авто-определение языка
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
          lang: detectedLang,
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

async function handlePasteImage(e) {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === "file" && item.type.includes("image/")) {
      processAndUpload(item.getAsFile());
    }
  }
}

async function processAndUpload(file) {
  const textarea = document.getElementById("reply-content");
  const t = topicTranslations[currentTopicLang];

  const cursor = textarea.selectionStart;
  const loadingTag = `\n![${t.uploading}...]`;
  textarea.value =
    textarea.value.slice(0, cursor) + loadingTag + textarea.value.slice(cursor);

  try {
    const webpFile = await convertToWebP(file);
    const formData = new FormData();
    formData.append("file", webpFile);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();

    if (data.url) {
      textarea.value = textarea.value.replace(
        loadingTag,
        `\n![image](${data.url})`,
      );
    } else {
      textarea.value = textarea.value.replace(
        loadingTag,
        `\n[${t.uploadError}]`,
      );
    }
  } catch (err) {
    console.error(err);
    textarea.value = textarea.value.replace(
      loadingTag,
      `\n[Error: ${err.message}]`,
    );
  }
}

function convertToWebP(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1920;
        const scale = Math.min(1, MAX_WIDTH / img.width);

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Canvas conversion failed"));
            const fileName = file.name.split(".")[0] + ".webp";
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

// === ЛАЙКИ, РЕШЕНИЯ, УДАЛЕНИЕ ===
async function likePost(postId) {
  if (!user) return toggleAuthModal();

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

  try {
    await fetch("/api/forum/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, user_id: user.id }),
    });
  } catch (e) {}
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

async function deleteItem(type, id) {
  if (!confirm("Are you sure you want to delete this?")) return;
  try {
    const res = await fetch("/api/forum/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, user_id: user.id }),
    });
    if (res.ok) {
      if (type === "topic") window.location.href = "forum.html";
      else loadTopicData();
    } else {
      alert("Error deleting item");
    }
  } catch (e) {
    console.error(e);
  }
}

async function checkLiveTopicUpdates() {
  if (!originalTopicData) return;
  const currentPostCount = document.querySelectorAll(".post-card").length;
  const currentReplyCount = currentPostCount > 0 ? currentPostCount - 1 : 0;
  try {
    const userIdParam = user ? `&user_id=${user.id}` : "";
    const res = await fetch(`/api/forum/topic?id=${topicId}${userIdParam}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.posts.length > currentReplyCount) {
      originalTopicData = data;
      renderTopicWithTranslation(data);
    }
  } catch (e) {}
}

// === УТИЛИТЫ ===
function formatDate(dateString) {
  if (!dateString) return "";
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

// === LIGHTBOX LOGIC (ОТКРЫТИЕ ФОТО) ===
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("lightbox-modal");
  const modalImg = document.getElementById("lightbox-img");
  const closeBtn = document.querySelector(".close-lightbox");

  if (!modal || !modalImg) return;

  document.addEventListener("click", (e) => {
    if (e.target.tagName === "IMG" && e.target.closest(".post-text-body")) {
      modalImg.src = e.target.src;
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  });

  window.closeLightbox = function (e) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
    setTimeout(() => {
      modalImg.src = "";
    }, 300);
  };

  if (closeBtn) closeBtn.addEventListener("click", window.closeLightbox);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) window.closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      window.closeLightbox();
    }
  });
});

let originalContentCache = {};

function editItem(type, id) {
  // Находим карточку поста
  const postCard = document.getElementById(
    type === "topic" ? "post-" + id : "post-" + id,
  );
  // Если id главной темы совпадает с id топика, ищем по id.
  // (В renderPostHTML мы передали реальный ID, так что id будет корректным)

  // Но renderPostHTML ставит id="post-{id}".
  const card = document.getElementById(`post-${id}`);
  if (!card) return;

  const textBody = card.querySelector(".post-text-body");

  // Сохраняем текущий HTML (или лучше исходный текст, если бы он был доступен)
  // Сейчас мы берем текст и пытаемся превратить <br> обратно в \n для удобства
  const currentHTML = textBody.innerHTML;
  originalContentCache[id] = currentHTML;

  // Конвертируем HTML обратно в простой текст для редактора (очень упрощенно)
  let textForEdit = currentHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<b>(.*?)<\/b>/g, "**$1**")
    .replace(/<img src="(.*?)" alt="(.*?)".*?>/g, "![$2]($1)")
    .replace(/<code.*?>(.*?)<\/code>/g, "`$1`")
    // Убираем HTML-экранирование для редактирования
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  // Очищаем лишние пробелы по краям
  textForEdit = textForEdit.trim();

  // Заменяем содержимое на форму
  textBody.innerHTML = `
        <div class="edit-mode-container">
            <textarea id="edit-area-${id}" class="edit-textarea">${textForEdit}</textarea>
            <div class="edit-actions">
                <button class="btn-cancel-edit" onclick="cancelEdit('${id}')">Cancel</button>
                <button class="btn-save-edit" onclick="saveEdit('${type}', '${id}')">Save Changes</button>
            </div>
        </div>
    `;
}

function cancelEdit(id) {
  const card = document.getElementById(`post-${id}`);
  if (card && originalContentCache[id]) {
    card.querySelector(".post-text-body").innerHTML = originalContentCache[id];
    delete originalContentCache[id];
  }
}

async function saveEdit(type, id) {
  const textarea = document.getElementById(`edit-area-${id}`);
  const newContent = textarea.value;
  const user = JSON.parse(localStorage.getItem("user_data"));

  if (!newContent.trim()) {
    alert("Content cannot be empty");
    return;
  }

  try {
    const res = await fetch("/api/forum/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: type, // 'topic' или 'post'
        id: id,
        user_id: user.id,
        content: newContent,
      }),
    });

    if (res.ok) {
      // Если успешно - обновляем UI
      // Используем функцию parseMarkdown для красивого отображения
      const card = document.getElementById(`post-${id}`);
      card.querySelector(".post-text-body").innerHTML =
        parseMarkdown(newContent);
      delete originalContentCache[id];

      // Если это был перевод - сбрасываем кэш, так как текст изменился
      // (Это сложно сделать точечно, но пользователь увидит новый оригинальный текст)
    } else {
      alert("Error saving changes");
    }
  } catch (e) {
    console.error(e);
    alert("Connection error");
  }
}
