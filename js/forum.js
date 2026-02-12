// js/forum.js

// Переводы UI
// Translations are now loaded from js/translations.js
// using APP_TRANSLATIONS global object

let currentForumLang = localStorage.getItem("forumLanguage") || "en";
let currentSearchTerm = "";
let originalTopicsData = [];

// Кэш переводов
let translationCache = JSON.parse(
  localStorage.getItem("translationCache") || "{}"
);

// Load Categories dynamically
async function loadForumCategories() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        
        if (data.success && data.categories) {
            renderSidebarCategories(data.categories);
            renderModalCategories(data.categories);
        }
    } catch (e) {
        console.error("Failed to load categories", e);
    }
}

function renderSidebarCategories(categories) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return; // Guard
    
    // Keep "All Topics"
    let html = `<a href="#" class="nav-item active" onclick="filterTopics('all')"><i class="fas fa-stream"></i> All Topics</a>`;
    
    categories.forEach(cat => {
        html += `<a href="#" class="nav-item" onclick="filterTopics('${cat.slug}')"><i class="${cat.icon || 'fas fa-folder'}"></i> ${cat.title}</a>`;
    });
    
    navMenu.innerHTML = html;
}

function renderModalCategories(categories) {
    const select = document.getElementById('topic-category');
    if (!select) return;
    
    let html = '';
    categories.forEach(cat => {
        html += `<option value="${cat.slug}">${cat.title}</option>`;
    });
    
    select.innerHTML = html;
}


document.addEventListener("DOMContentLoaded", () => {
  loadForumCategories();

  // Only run forum-specific logic if on the main
  const isForumMain = !!document.querySelector(".sidebar");

  if (isForumMain) {
      fetchTopics();
      updateSidebarUser();
      setupForumSearch();
  } else {
      // On profile page, we might just want generic stuff or nothing from here
  }
  
  checkNotifications();

  // Ensure global currentLanguage matches forum language
  if (typeof currentLanguage !== "undefined") {
      currentLanguage = currentForumLang;
  }
  
  updateForumLanguage();
  setupSimilarTopics();
  updateHeaderAuth(); // New function
  
  // Check for pre-fill params from AI Chat
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("new_topic") === "true") {
      const title = urlParams.get("title");
      if (title) {
          setTimeout(() => {
              openNewTopicModal();
              const titleInput = document.getElementById("topic-title");
              if (titleInput) {
                  titleInput.value = title;
                  // Trigger input event to show similar topics
                  titleInput.dispatchEvent(new Event('input'));
              }
          }, 500); // Small delay to ensure translations loaded
      }
  }

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
  
  // SYNC WITH CHATBOT/SCRIPT.JS
  if (typeof currentLanguage !== "undefined") {
    currentLanguage = currentForumLang;
    localStorage.setItem("language", currentForumLang); // Sync persistence
    if (window.updateChatbotUI) window.updateChatbotUI();
  }
  
  updateForumLanguage();

  // Перерендерим с переводом
  if (originalTopicsData.length > 0) {
    await renderTopicsWithTranslation(originalTopicsData);
  }

  // Refresh Mobile Menu with new language
  if (typeof initMobileMenu === 'function') {
      initMobileMenu();
  }
}

function updateForumLanguage() {
  if (!APP_TRANSLATIONS) return;
  const t = APP_TRANSLATIONS[currentForumLang] || APP_TRANSLATIONS["en"];
  if (!t) return;
  
  const langLabels = { en: "EN", ru: "RU", ka: "GE" };

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
    // Use modulo to handle duplicated menus (desktop + mobile) if they exist
    const text = navTexts[i % navTexts.length];
    if (text) {
      const icon = item.querySelector("i");
      item.innerHTML = "";
      if (icon) item.appendChild(icon);
      item.appendChild(document.createTextNode(" " + text));
    }
  });

  // Re-render user sidebar if logged in (this updates Profile/Logout buttons)
  if (typeof updateSidebarUser === 'function' && localStorage.getItem("user_data")) {
      updateSidebarUser();
  }

  // Сайдбар - для незалогиненных users
  const sidebarInfo = document.getElementById("user-sidebar-info");
  if (sidebarInfo && !localStorage.getItem("user_data")) {
    sidebarInfo.innerHTML = `
      <div style="text-align: center; padding: 20px 0">
        <p style="color: #aaa; margin-bottom: 10px">${t.loginToPost}</p>
        <button class="submit-btn" onclick="toggleAuthModal()">${t.loginRegister}</button>
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
  
  // Generic data-i18n support
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });

  // Generic data-i18n-placeholder support
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[key]) el.placeholder = t[key];
  });

  // REAL-TIME VALIDATION FOR CODE INPUT
  const codeInput = document.getElementById("topic-code");
  if (codeInput) {
      // Remove any existing feedback to prevent duplicates
      const existing = document.getElementById("code-validation-feedback");
      if (existing) existing.remove();

      // Create feedback element
      const feedback = document.createElement("div");
      feedback.id = "code-validation-feedback";
      feedback.style.fontSize = "12px";
      feedback.style.marginTop = "5px";
      feedback.style.height = "20px"; // Reserve space
      feedback.style.transition = "all 0.3s ease";
      codeInput.parentNode.appendChild(feedback);

      codeInput.addEventListener("input", (e) => {
           const val = e.target.value.trim().toLowerCase();
           if (!val) {
               codeInput.style.borderColor = "";
               feedback.textContent = "";
               return;
           }

           const found = bmwCodes && bmwCodes.find(c => c.code.toLowerCase() === val);
           
           if (found) {
               codeInput.style.borderColor = "#2ecc71";
               feedback.style.color = "#2ecc71";
               feedback.innerHTML = `<i class="fas fa-check-circle"></i> ${found.code} - ${found.title[currentForumLang] || found.title['en']}`;
           } else {
               codeInput.style.borderColor = "#e74c3c";
               feedback.style.color = "#e74c3c";
               feedback.textContent = APP_TRANSLATIONS[currentForumLang].invalidCodeError || "Code not found in database";
           }
      });
  }


}

// === ЗАГРУЗКА ТЕМ ===
// === ЗАГРУЗКА ТЕМ ===
let currentForumPage = 1;
const FORUM_ITEMS_PER_PAGE = 20;

async function fetchTopics(category = "all", search = "", page = 1) {
  currentForumPage = page;
  const container = document.getElementById("topics-list-container");
  const t = APP_TRANSLATIONS[currentForumLang];
  
  // SKELETON LOADING
  container.innerHTML = Array(5).fill(0).map(() => `
    <div class="skeleton-row">
      <div class="skeleton-icon"></div>
      <div class="skeleton-content">
        <div class="skeleton-line long"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `).join('');

  try {
    let url = `/api/forum/topics?category=${category}&page=${page}&limit=${FORUM_ITEMS_PER_PAGE}`;
    if (search) {
        url += `&search=${encodeURIComponent(search)}`;
    }
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error");
    const data = await res.json();
    
    // Handle new response structure
    // Handle new response structure
    let topics = data.topics;
    if (!Array.isArray(topics)) {
        // Fallback or empty if invalid
        topics = []; 
    }
    const total = data.total || 0;
    const totalPages = data.totalPages || 1;

    if (topics.length === 0) {
      container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;">${t.noTopics}</div>`;
      return;
    }

    originalTopicsData = topics;
    await renderTopicsWithTranslation(topics);
    renderPagination(totalPages, page, category, search);

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:#e74c3c; text-align:center; padding:20px;">${t.loadError}</p>`;
  }
}

function renderPagination(totalPages, currentPage, category, search) {
    const container = document.getElementById("topics-list-container");
    
    if (totalPages <= 1) return;

    const nav = document.createElement("div");
    nav.className = "pagination-controls";
    nav.style.display = "flex";
    nav.style.justifyContent = "center";
    nav.style.gap = "10px";
    nav.style.marginTop = "20px";
    nav.style.marginBottom = "20px";

    // Prev
    if (currentPage > 1) {
        const prev = document.createElement("button");
        prev.className = "btn secondary";
        prev.innerHTML = "<i class='fas fa-chevron-left'></i>";
        prev.onclick = () => fetchTopics(category, search, currentPage - 1);
        nav.appendChild(prev);
    }

    // Info
    const info = document.createElement("span");
    info.style.alignSelf = "center";
    info.style.color = "#888";
    info.textContent = `Page ${currentPage} of ${totalPages}`;
    nav.appendChild(info);

    // Next
    if (currentPage < totalPages) {
        const next = document.createElement("button");
        next.className = "btn secondary";
        next.innerHTML = "<i class='fas fa-chevron-right'></i>";
        next.onclick = () => fetchTopics(category, search, currentPage + 1);
        nav.appendChild(next);
    }

    container.appendChild(nav);
}

async function renderTopicsWithTranslation(topics) {
  const container = document.getElementById("topics-list-container");
  const t = APP_TRANSLATIONS[currentForumLang];
  
  if (!Array.isArray(topics)) {
      console.error("renderTopicsWithTranslation: topics is not an array", topics);
      topics = [];
  }

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
      <div class="topic-row" onclick="window.location.href='/topic?id=${topic.id}'">
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
            ${topic.related_code ? `<a href="/?code=${topic.related_code}" class="topic-badge topic-code-badge" style="text-decoration:none; color:inherit;"><i class="fas fa-search"></i> ${topic.related_code}</a>` : ""}
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

// Notification logic is handled by js/live.js
async function checkNotifications() {
  // Deprecated in favor of live.js
  return;
}

// Duplicate toggleNotifications removed (handled by live.js)


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
    const relatedCode = document.getElementById("topic-code").value.trim();

    // VALIDATION: Check if code exists in bmwCodes
    if (relatedCode) {
         // Using global bmwCodes from script.js
         const exists = bmwCodes && bmwCodes.some(c => c.code.toLowerCase() === relatedCode.toLowerCase());
         if (!exists) {
             alert(APP_TRANSLATIONS[currentForumLang].invalidCodeError || "Invalid error code. Please enter a valid code from our database or leave it empty.");
             btn.disabled = false;
             btn.textContent = APP_TRANSLATIONS[currentForumLang].publish;
             return; 
         }
    }

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
          related_code: relatedCode || null,
          lang: detectedLang, // Используем определенный язык!
        }),
      });

      const data = await res.json();
      if (data.success) {
        window.location.href = `/topic?id=${data.topicId}`;
      } else {
        alert("Error: " + data.error);
        btn.textContent = APP_TRANSLATIONS[currentForumLang].publish;
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
  const t = APP_TRANSLATIONS[currentForumLang];

  if (user && container) {
    // Проверяем, есть ли ссылка на фото
    let avatarHTML;
    if (user.avatar_url) {
      avatarHTML = `<img src="${user.avatar_url}" onerror="this.onerror=null; this.src='./assets/icons/ico.svg'" class="user-avatar-large" style="object-fit:cover;">`;
    } else {
      avatarHTML = `<div class="user-avatar-large">${user.username[0].toUpperCase()}</div>`;
    }

    // Determine role badge
    let roleBadge = "";
    if (typeof getReputationBadge === "function") {
      roleBadge = getReputationBadge(user.reputation, user.role);
    } else {
      roleBadge = `<span class="user-badge badge-newcomer" style="margin-top:5px; display:inline-block;"><i class="fas fa-user"></i> ${t.member}</span>`;
      if (user.role === 'admin_role') roleBadge = '<span class="user-badge badge-admin" style="margin-top:5px; display:inline-block;"><i class="fas fa-shield-alt"></i> Admin</span>';
    }

    container.innerHTML = `
      <div class="user-mini-profile">
        ${avatarHTML}
        <h3 style="color:white; margin:10px 0 5px;">${escapeHtml(user.username)}</h3>
        ${roleBadge}
        
        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
            <a href="/profile" class="btn" style="padding: 8px; font-size: 13px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1); color: #ddd;">
                <i class="fas fa-user-circle"></i> ${t.profile || 'Profile'}
            </a>
            <button onclick="logout()" class="btn" style="padding: 8px; font-size: 13px; background: rgba(231, 76, 60, 0.2); border: 1px solid rgba(231, 76, 60, 0.3); color: #e74c3c;">
                <i class="fas fa-sign-out-alt"></i> ${t.logout || 'Logout'}
            </button>
        </div>
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

// === SIMILAR TOPICS SUGGESTIONS ===
function setupSimilarTopics() {
  const titleInput = document.getElementById("topic-title");
  if (!titleInput) return;

  // Create suggestions container
  let similarContainer = document.getElementById("similar-topics-suggestions");
  if (!similarContainer) {
    similarContainer = document.createElement("div");
    similarContainer.id = "similar-topics-suggestions";
    similarContainer.style.cssText =
      "max-height:0; overflow:hidden; transition:max-height 0.3s; margin-top:5px;";
    titleInput.parentNode.appendChild(similarContainer);
  }

  titleInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 3) {
      similarContainer.style.maxHeight = "0";
      return;
    }

    // Search in originalTopicsData
    const matches = originalTopicsData
      .filter((t) => t.title.toLowerCase().includes(query))
      .slice(0, 3);

    if (matches.length > 0) {
      similarContainer.innerHTML = `
                <div style="font-size:12px; color:#aaa; margin-bottom:5px;">Similar topics found:</div>
                ${matches
                  .map(
                    (m) => `
                    <div style="background:rgba(255,255,255,0.05); padding:8px; margin-bottom:5px; border-radius:4px; font-size:13px;">
                        <a href="/topic?id=${m.id}" target="_blank" style="color:white; text-decoration:none; display:block; display:flex; align-items:center; gap:5px;">
                            <i class="fas fa-external-link-alt" style="font-size:10px; color:#0066b3;"></i> 
                            <span>${escapeHtml(m.title)}</span>
                        </a>
                    </div>
                `,
                  )
                  .join("")}
            `;
      similarContainer.style.maxHeight = "300px";
    } else {
      similarContainer.style.maxHeight = "0";
    }
  });
}

function updateHeaderAuth() {
  const user = JSON.parse(localStorage.getItem("user_data"));
  const authBtn = document.getElementById("auth-btn");
  if (!authBtn) return;

  if (user) {
    let avatarIcon = '<i class="fas fa-user"></i>';
    if (user.avatar_url) {
        avatarIcon = `<img src="${user.avatar_url}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">`;
    }

    authBtn.innerHTML = `${avatarIcon} <span style="font-size:12px; margin-left:5px;">${user.username}</span>`;
    authBtn.onclick = (e) => {
        // Redirect to profile
        window.location.href = "profile.html"; 
    };
    authBtn.href = "profile.html";
    authBtn.title = "Go to Profile";
  } else {
    // Guest
    const loginText = APP_TRANSLATIONS[currentForumLang]?.loginBtn || "Login";
    authBtn.innerHTML = `<i class="fas fa-user-circle"></i> <span data-i18n="loginBtn">${loginText}</span>`;
    authBtn.onclick = toggleAuthModal;
    authBtn.href = "#";
    authBtn.title = "Login / Register";
  }
}
