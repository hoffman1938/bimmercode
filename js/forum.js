// js/forum.js

// Переводы UI
const forumTranslations = {
  en: {
    allTopics: "All Topics",
    diagnostics: "Diagnostics",
    codingSoft: "Coding & Soft",
    partsRepair: "Parts & Repair",
    offTopic: "Off-Topic",
    searchPlaceholder: "Search topics or codes...",
    newTopic: "New Topic",
    replies: "replies",
    views: "views",
    solved: "Solved",
    by: "by",
    noTopics: "No topics found.",
    loadError: "Failed to load topics.",
    loginToPost: "Join the community to post",
    loginRegister: "Login / Register",
    member: "Member",
    notifications: "Notifications",
    noNotifications: "No notifications",
    likedPost: "liked your post in",
    markedSolution: "marked solution in",
    repliedTo: "replied to",
    createTopic: "Create New Topic",
    publish: "Publish Topic",
    loading: "Loading...",
    translating: "Translating...",
  },
  ru: {
    allTopics: "Все темы",
    diagnostics: "Диагностика",
    codingSoft: "Кодирование",
    partsRepair: "Запчасти",
    offTopic: "Оффтоп",
    searchPlaceholder: "Поиск тем или кодов...",
    newTopic: "Новая тема",
    replies: "ответов",
    views: "просм.",
    solved: "Решено",
    by: "от",
    noTopics: "Темы не найдены.",
    loadError: "Ошибка загрузки.",
    loginToPost: "Войдите, чтобы писать",
    loginRegister: "Вход / Регистрация",
    member: "Участник",
    notifications: "Уведомления",
    noNotifications: "Нет уведомлений",
    likedPost: "лайкнул ваш пост",
    markedSolution: "отметил решение",
    repliedTo: "ответил в",
    createTopic: "Создать тему",
    publish: "Опубликовать",
    loading: "Загрузка...",
    translating: "Перевод...",
  },
  ka: {
    allTopics: "ყველა თემა",
    diagnostics: "დიაგნოსტიკა",
    codingSoft: "კოდირება",
    partsRepair: "ნაწილები",
    offTopic: "სხვა",
    searchPlaceholder: "თემების ძებნა...",
    newTopic: "ახალი თემა",
    replies: "პასუხი",
    views: "ნახვა",
    solved: "გადაწყვეტილი",
    by: "-",
    noTopics: "თემები ვერ მოიძებნა.",
    loadError: "ჩატვირთვის შეცდომა.",
    loginToPost: "შედით საზოგადოებაში",
    loginRegister: "შესვლა / რეგისტრაცია",
    member: "მონაწილე",
    notifications: "შეტყობინებები",
    noNotifications: "შეტყობინებები არ არის",
    likedPost: "მოიწონა თქვენი პოსტი",
    markedSolution: "მონიშნა გადაწყვეტა",
    repliedTo: "უპასუხა",
    createTopic: "თემის შექმნა",
    publish: "გამოქვეყნება",
    loading: "იტვირთება...",
    translating: "ითარგმნება...",
  },
};

let currentForumLang = localStorage.getItem("forumLanguage") || "en";
let currentSearchTerm = "";
let originalTopicsData = [];

// Кэш переводов
let translationCache = JSON.parse(
  localStorage.getItem("translationCache") || "{}",
);

document.addEventListener("DOMContentLoaded", () => {
  fetchTopics();
  updateSidebarUser();
  checkNotifications();
  setupForumSearch();
  updateForumLanguage();

  setInterval(checkNotifications, 15000);
});

// === НОВАЯ ФУНКЦИЯ: ОПРЕДЕЛЕНИЕ ЯЗЫКА ТЕКСТА ===
function detectContentLanguage(text) {
  if (!text) return "en";

  // Проверка на грузинские символы (Unicode range)
  const kaRegex = /[\u10A0-\u10FF]/;
  // Проверка на кириллицу (Русский)
  const ruRegex = /[\u0400-\u04FF]/;

  if (kaRegex.test(text)) return "ka";
  if (ruRegex.test(text)) return "ru";

  return "en"; // По умолчанию
}

// === БЕСПЛАТНЫЙ ПЕРЕВОД ===
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
      const keys = Object.keys(translationCache);
      if (keys.length > 500) {
        for (let i = 0; i < 100; i++) delete translationCache[keys[i]];
      }
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

// === ПОИСК ===
function setupForumSearch() {
  const searchInput = document.getElementById("forum-search");
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearchTerm = e.target.value.trim();
      fetchTopics("all", currentSearchTerm);
    }, 300);
  });
}

// === ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА ===
async function switchForumLanguage() {
  const langs = ["en", "ru", "ka"];
  let idx = langs.indexOf(currentForumLang);
  currentForumLang = langs[(idx + 1) % langs.length];
  localStorage.setItem("forumLanguage", currentForumLang);
  updateForumLanguage();

  // Перерендерим с переводом
  if (originalTopicsData.length > 0) {
    await renderTopicsWithTranslation(originalTopicsData);
  }
}

function updateForumLanguage() {
  const t = forumTranslations[currentForumLang];
  const langLabels = { en: "EN", ru: "RU", ka: "KA" };

  const langDisplay = document.getElementById("forum-lang-display");
  if (langDisplay) langDisplay.textContent = langLabels[currentForumLang];

  const searchInput = document.getElementById("forum-search");
  if (searchInput) searchInput.placeholder = t.searchPlaceholder;

  const newTopicBtn = document.querySelector(".topics-header .btn");
  if (newTopicBtn)
    newTopicBtn.innerHTML = `<i class="fas fa-plus"></i> ${t.newTopic}`;

  // Навигация
  const navItems = document.querySelectorAll(".nav-item");
  const navTexts = [
    t.allTopics,
    t.diagnostics,
    t.codingSoft,
    t.partsRepair,
    t.offTopic,
  ];
  navItems.forEach((item, i) => {
    if (navTexts[i]) {
      const icon = item.querySelector("i");
      item.innerHTML = "";
      if (icon) item.appendChild(icon);
      item.appendChild(document.createTextNode(" " + navTexts[i]));
    }
  });

  // Сайдбар
  const sidebarInfo = document.getElementById("user-sidebar-info");
  if (sidebarInfo && !localStorage.getItem("user_data")) {
    sidebarInfo.innerHTML = `
      <div style="text-align: center; padding: 20px 0">
        <p style="color: #aaa; margin-bottom: 10px">${t.loginToPost}</p>
        <button class="btn" onclick="toggleAuthModal()" style="width: 100%">${t.loginRegister}</button>
      </div>
    `;
  }

  // Модалка
  const modalTitle = document.querySelector("#new-topic-modal h2");
  if (modalTitle) modalTitle.textContent = t.createTopic;

  const submitBtn = document.querySelector("#create-topic-form .submit-btn");
  if (submitBtn) submitBtn.textContent = t.publish;

  const notifHeader = document.querySelector(".notif-header");
  if (notifHeader) notifHeader.textContent = t.notifications;
}

// === ЗАГРУЗКА ТЕМ ===
async function fetchTopics(category = "all", search = "") {
  const container = document.getElementById("topics-list-container");
  const t = forumTranslations[currentForumLang];
  container.innerHTML = `<div style="padding:40px; text-align:center;"><i class="fas fa-circle-notch fa-spin"></i> ${t.loading}</div>`;
  try {
    let url = `/api/forum/topics?category=${category}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error");
    const topics = await res.json();
    if (topics.length === 0) {
      container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;">${t.noTopics}</div>`;
      return;
    }
    originalTopicsData = topics;
    await renderTopicsWithTranslation(topics);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:#e74c3c; text-align:center; padding:20px;">${t.loadError}</p>`;
  }
}

async function renderTopicsWithTranslation(topics) {
  const container = document.getElementById("topics-list-container");
  const t = forumTranslations[currentForumLang];
  container.innerHTML = `<div style="padding:40px; text-align:center;"><i class="fas fa-language fa-spin"></i> ${t.translating}</div>`;

  const translatedTopics = await Promise.all(
    topics.map(async (topic) => ({
      ...topic,
      translatedTitle: await translateText(topic.title, currentForumLang),
    })),
  );

  container.innerHTML = translatedTopics
    .map(
      (topic) => `
      <div class="topic-row" onclick="window.location.href='topic.html?id=${topic.id}'">
        <div class="topic-status-icon ${topic.is_solved ? "solved" : ""}">
          <i class="fas ${topic.is_solved ? "fa-check-circle" : "fa-comment-alt"}"></i>
        </div>
        <div class="topic-main-content">
          <h3>
            ${escapeHtml(topic.translatedTitle || topic.title)}
            <span class="lang-badge" title="Original language: ${topic.lang || "en"}">
                <i class="fas fa-globe"></i> ${topic.lang ? topic.lang.toUpperCase() : "EN"}
            </span>
          </h3>
          <div class="topic-meta-line">
            ${topic.is_solved ? `<span class="topic-badge" style="color:#2ecc71; border-color:#2ecc71;">${t.solved}</span>` : ""}
            ${topic.related_code ? `<span class="topic-badge topic-code-badge">${topic.related_code}</span>` : ""}
            <span class="topic-badge">${topic.category}</span>
            <span>${t.by} <span style="color:#fff">${topic.username}</span></span>
            <span>${timeAgo(topic.created_at)}</span>
          </div>
        </div>
        <div class="topic-stats">
          <div><span class="stat-number">${topic.reply_count || 0}</span> ${t.replies}</div>
          <div>${topic.views || 0} ${t.views}</div>
        </div>
      </div>
    `,
    )
    .join("");
}

async function checkNotifications() {
  const user = JSON.parse(localStorage.getItem("user_data"));
  if (!user) return;

  try {
    const res = await fetch(`/api/notifications?user_id=${user.id}`);
    if (!res.ok) return;

    const notifs = await res.json();
    const unreadCount = notifs.filter((n) => !n.is_read).length;

    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = unreadCount;
      if (unreadCount > 0) badge.classList.add("visible");
      else badge.classList.remove("visible");
    }

    const list = document.getElementById("notif-list");
    const t = forumTranslations[currentForumLang];

    if (list && notifs.length > 0) {
      list.innerHTML = notifs
        .map(
          (n) => `
          <div class="notif-item ${!n.is_read ? "unread" : ""}" onclick="window.location.href='topic.html?id=${n.topic_id}'">
            <div class="notif-icon"><i class="fas ${getNotifIcon(n.type)}"></i></div>
            <div>
              <div style="font-weight:bold;">${n.sender_name}</div>
              <div>${getNotifText(n.type, t)} "${escapeHtml(n.topic_title)}"</div>
            </div>
          </div>
        `,
        )
        .join("");
    }
  } catch (e) {}
}

function toggleNotifications() {
  document.getElementById("notifications-dropdown").classList.toggle("active");
}

function getNotifIcon(type) {
  return type === "like"
    ? "fa-heart"
    : type === "solve"
      ? "fa-check"
      : "fa-reply";
}

function getNotifText(type, t) {
  return type === "like"
    ? t.likedPost
    : type === "solve"
      ? t.markedSolution
      : t.repliedTo;
}

// Создание темы
document
  .getElementById("create-topic-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem("user_data"));
    if (!user) {
      alert("Please login first");
      return;
    }

    const btn = e.target.querySelector("button");
    btn.textContent = "Publishing...";
    btn.disabled = true;

    // Берем данные
    const title = document.getElementById("topic-title").value;
    const content = document.getElementById("topic-content").value;

    // ОПРЕДЕЛЯЕМ ЯЗЫК НА ОСНОВЕ ТОГО, ЧТО НАПИСАЛ ЮЗЕР
    const detectedLang = detectContentLanguage(title + " " + content);

    try {
      const res = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          username: user.username,
          category: document.getElementById("topic-category").value,
          title: title,
          content: content,
          related_code: document.getElementById("topic-code").value,
          lang: detectedLang, // Используем определенный язык!
        }),
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = `topic.html?id=${data.topicId}`;
      } else {
        alert("Error: " + data.error);
        btn.textContent = forumTranslations[currentForumLang].publish;
        btn.disabled = false;
      }
    } catch (err) {
      alert("Connection error");
    }
  });

function openNewTopicModal() {
  if (!localStorage.getItem("auth_token")) {
    toggleAuthModal();
    return;
  }
  document.getElementById("new-topic-modal").classList.add("active");
}

function filterTopics(cat) {
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  event.currentTarget.classList.add("active");
  fetchTopics(cat, currentSearchTerm);
}

// Внутри js/forum.js

function updateSidebarUser() {
  const user = JSON.parse(localStorage.getItem("user_data"));
  const container = document.getElementById("user-sidebar-info");
  const t = forumTranslations[currentForumLang];

  if (user && container) {
    // Проверяем, есть ли ссылка на фото
    let avatarHTML;
    if (user.avatar_url) {
      avatarHTML = `<img src="${user.avatar_url}" class="user-avatar-large" style="object-fit:cover;">`;
    } else {
      avatarHTML = `<div class="user-avatar-large">${user.username[0].toUpperCase()}</div>`;
    }

    container.innerHTML = `
      <div class="user-mini-profile">
        ${avatarHTML}
        <h3 style="color:white; margin-bottom:5px;">${user.username}</h3>
        <p style="color:#aaa; font-size:12px;">${t.member}</p>
      </div>
    `;
  }
}

function timeAgo(dateString) {
  const cleanDate = dateString.endsWith("Z") ? dateString : dateString + "Z";
  const date = new Date(cleanDate);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  let unit = "sec";
  let value = seconds;
  if (seconds < 60) return "Just now";
  const intervals = {
    year: 31536000,
    month: 2592000,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  if (seconds >= intervals.year) {
    value = Math.floor(seconds / intervals.year);
    unit = "y";
  } else if (seconds >= intervals.month) {
    value = Math.floor(seconds / intervals.month);
    unit = "mo";
  } else if (seconds >= intervals.day) {
    value = Math.floor(seconds / intervals.day);
    unit = "d";
  } else if (seconds >= intervals.hour) {
    value = Math.floor(seconds / intervals.hour);
    unit = "h";
  } else {
    value = Math.floor(seconds / intervals.minute);
    unit = "m";
  }
  return `${value}${unit} ago`;
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
