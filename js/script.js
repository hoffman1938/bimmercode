// ==========================================
// 1. GLOBAL STATE & DOM ELEMENTS
// ==========================================

// DOM Elements
const searchInput = document.getElementById("search-input");
const resultsContainer = document.getElementById("results-container");
const emptyState = document.getElementById("empty-state");
const noResults = document.getElementById("no-results");
const codeDetail = document.getElementById("code-detail");
const searchContainer = document.getElementById("search-container");
const languageToggle = document.getElementById("language-toggle");

// App State
// Читаем язык из памяти или ставим 'en' по умолчанию
let currentLanguage = localStorage.getItem("forumLanguage") || "en";
let isDarkMode = true;
let bmwCodes = [];
let selectedCode = null;
let chatOpen = false;

// UI Text Translations
const translations = {
  en: {
    savedBtn: "Saved",
    savedTitle: "Saved Codes",
    emptySaved: "You haven't saved any codes yet.",
    forumBtn: "Forum",
    searchPlaceholder: "Enter DTC code (e.g. 102613) or P-code...",
    emptyStateMessage: "BMW Diagnostic Database",
    emptyStateSubMessage: "Search for engine, transmission, and body codes.",
    noResultsMessage: "No codes found",
    description: "System Diagnosis",
    possibleSolutions: "Repair Plan",
    applicableModels: "Models",
    engineCodes: "Engines",
    category: "System",
    footer: "BMW DTC Bot © 2026 • Diagnostic Data",
    partsBtn: "RealOEM (Parts)",
    catalogBtn: "Catalog Search",
    obdLabel: "OBD-II Code:",
    chatTitle: "BMW AI Expert",
    chatStatus: "Connected to Database",
    chatPlaceholder: "Describe issue (e.g. 'smoke', 'misfire')...",
  },
  ru: {
    savedBtn: "Избранное",
    savedTitle: "Избранные коды",
    emptySaved: "Вы еще не сохранили ни одного кода.",
    forumBtn: "Форум",
    searchPlaceholder: "Введите код ошибки (напр. 102613)...",
    emptyStateMessage: "База диагностики BMW",
    emptyStateSubMessage: "Поиск кодов двигателя, трансмиссии и кузова.",
    noResultsMessage: "Код не найден",
    description: "Диагностика системы",
    possibleSolutions: "План ремонта",
    applicableModels: "Модели",
    engineCodes: "Двигатели",
    category: "Система",
    footer: "BMW DTC Bot © 2026 • Диагностика",
    partsBtn: "Запчасти (RealOEM)",
    catalogBtn: "Поиск в каталоге",
    obdLabel: "Код OBD-II:",
    chatTitle: "ИИ Эксперт BMW",
    chatStatus: "Подключено к базе",
    chatPlaceholder: "Опишите проблему (напр. 'дым', 'троит')...",
  },
  ka: {
    savedBtn: "შენახული",
    savedTitle: "შენახული კოდები",
    emptySaved: "თქვენ ჯერ არ შეგინახავთ კოდები.",
    forumBtn: "ფორუმი",
    searchPlaceholder: "შეიყვანეთ კოდი (მაგ. 102613)...",
    emptyStateMessage: "BMW დიაგნოსტიკური ბაზა",
    emptyStateSubMessage: "მოძებნეთ ძრავის და სისტემის კოდები.",
    noResultsMessage: "კოდი ვერ მოიძებნა",
    description: "სისტემის დიაგნოსტიკა",
    possibleSolutions: "შეკეთების გეგმა",
    applicableModels: "მოდელები",
    engineCodes: "ძრავები",
    category: "სისტემა",
    footer: "BMW DTC Bot © 2026 • დიაგნოსტიკის კოდები",
    partsBtn: "ნაწილები (RealOEM)",
    catalogBtn: "კატალოგში ძებნა",
    obdLabel: "OBD-II კოდი:",
    chatTitle: "BMW-ს AI ექსპერტი",
    chatStatus: "დაკავშირებულია ბაზასთან",
    chatPlaceholder: "აღწერეთ პრობლემა (მაგ. 'ბოლი')...",
  },
};

// ==========================================
// 2. CORE FUNCTIONS
// ==========================================

function displayCodeDetail(code) {
  selectedCode = code;
  const lang = currentLanguage;
  const t = translations[lang];

  searchContainer.classList.add("hidden");
  codeDetail.classList.remove("hidden");
  window.scrollTo(0, 0);

  // Безопасная проверка данных
  const engine =
    code.engineCodes && code.engineCodes.length > 0
      ? code.engineCodes[0]
      : "All";
  const category = code.category || "General";
  const pCodes = code.pCodes || [];
  const solutions =
    code.solutions && code.solutions[lang] ? code.solutions[lang] : [];
  const description =
    code.description && code.description[lang]
      ? code.description[lang]
      : "No description available";

  const partsQuery = `BMW ${engine} ${category} parts RealOEM`;
  const catsQuery = `BMW ${engine} запчасти`;

  const pCodeHtml =
    pCodes.length > 0
      ? `<div class="alt-code-badge">${t.obdLabel} <span>${pCodes.join(", ")}</span></div>`
      : "";

  codeDetail.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="hideDetail()">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="header-title-wrapper">
        <h2>${code.code}</h2>
        ${pCodeHtml}
      </div>
    </div>
    
    <div class="detail-content">
      <div class="info-badge severity-${(code.severity || "medium").toLowerCase()}">
        <i class="fas fa-exclamation-triangle"></i> ${code.severity || "Normal"} Priority
      </div>
      
      <h3>${t.description}</h3>
      <p class="description-text">${description}</p>
      
      <h3>${t.possibleSolutions}</h3>
      <div class="solutions-section">
        <ul>
          ${solutions.map((s) => `<li>${s}</li>`).join("")}
        </ul>
        <div class="parts-buttons">
            <a href="https://www.google.com/search?q=${encodeURIComponent(partsQuery)}" target="_blank" class="btn-part">
                <i class="fas fa-cogs"></i> ${t.partsBtn}
            </a>
            <a href="https://www.google.com/search?q=${encodeURIComponent(catsQuery)}" target="_blank" class="btn-part secondary">
                <i class="fas fa-book-open"></i> ${t.catalogBtn}
            </a>
        </div>
      </div>
      
      <div class="tag-grid">
        <div>
          <h3>${t.applicableModels}</h3>
          <div class="tags">
            ${(code.applicableModels || []).map((m) => `<span class="tag">${m}</span>`).join("")}
          </div>
        </div>
        <div>
          <h3>${t.engineCodes}</h3>
          <div class="tags">
            ${(code.engineCodes || []).map((e) => `<span class="tag">${e}</span>`).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- FAVORITES LOGIC ---

// Переключить состояние (Сохранить/Удалить)
window.toggleFavorite = function (event, codeId) {
  if (event) event.stopPropagation(); // Чтобы не открывалась детальная страница

  let favorites = JSON.parse(localStorage.getItem("bmwFavorites")) || [];

  if (favorites.includes(codeId)) {
    favorites = favorites.filter((id) => id !== codeId); // Удалить
  } else {
    favorites.push(codeId); // Добавить
  }

  localStorage.setItem("bmwFavorites", JSON.stringify(favorites));

  // Перерисовать результаты поиска, чтобы обновить звездочки
  handleSearch();
  // Если открыто модальное окно избранного, обновить его тоже
  renderFavoritesList();
};

// Открыть/Закрыть модальное окно
window.toggleFavoritesModal = function () {
  const modal = document.getElementById("favorites-modal");
  modal.classList.toggle("active");

  if (modal.classList.contains("active")) {
    renderFavoritesList();
  }
};

// Отрисовка списка внутри модального окна
function renderFavoritesList() {
  const list = document.getElementById("favorites-list");
  const favorites = JSON.parse(localStorage.getItem("bmwFavorites")) || [];
  const t = translations[currentLanguage];

  list.innerHTML = "";

  if (favorites.length === 0) {
    list.innerHTML = `
            <div class="empty-favs">
                <i class="far fa-folder-open"></i>
                <p>${t.emptySaved}</p>
            </div>`;
    return;
  }

  // Находим полные объекты кодов по ID
  const savedCodes = bmwCodes.filter((c) => favorites.includes(c.code));

  savedCodes.forEach((code) => {
    const div = document.createElement("div");
    div.className = "code-item"; // Используем те же стили, что и в поиске
    div.style.marginBottom = "10px";

    div.innerHTML = `
          <div style="flex: 1;" onclick="toggleFavoritesModal(); displayCodeDetail(selectedCodeRef)">
            <div class="code-header">
              <span class="code-identifier" style="color:#0066b3">${code.code}</span>
              <span class="code-title" style="font-size:14px">${code.title[currentLanguage]}</span>
            </div>
          </div>
          <button class="star-btn active" onclick="toggleFavorite(null, '${code.code}')">
            <i class="fas fa-trash"></i>
          </button>
        `;

    // Хак для клика
    div.querySelector('div[style*="flex: 1"]').onclick = () => {
      toggleFavoritesModal();
      displayCodeDetail(code);
    };

    list.appendChild(div);
  });
}

/* --- GLOBAL CLOSE FUNCTION --- */
window.hideDetail = function () {
  const detailEl = document.getElementById("code-detail");
  const searchEl = document.getElementById("search-container");

  if (detailEl) detailEl.classList.add("hidden");
  if (searchEl) searchEl.classList.remove("hidden");

  if (typeof selectedCode !== "undefined") {
    selectedCode = null;
  }
  window.scrollTo(0, 0);
};

// ==========================================
// 3. AI WIZARD & CHAT
// ==========================================

function initWizard() {
  if (document.getElementById("wizard-widget")) return;

  const lang = currentLanguage;
  const t = translations[lang];

  const wizardHTML = `
    <div id="wizard-widget">
      <div class="wizard-fab" id="wizard-fab" onclick="toggleChat()">
        <i class="fas fa-robot"></i>
      </div>
      
      <div class="chat-window" id="chat-window">
        <div class="chat-header">
          <div class="bot-info">
            <div class="bot-avatar"><i class="fas fa-microchip"></i></div>
            <div>
              <div id="chat-bot-title" style="font-weight:bold; color:#fff;">${t.chatTitle}</div>
              <div class="bot-status"><div class="status-dot"></div> ${t.chatStatus}</div>
            </div>
          </div>
          <div style="cursor:pointer;" onclick="toggleChat()"><i class="fas fa-times" style="color:#fff;"></i></div>
        </div>
        
        <div class="chat-body" id="chat-body">
          <div class="typing-indicator" id="typing-indicator">
            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
          </div>
        </div>

        <div class="chat-footer">
          <input type="text" id="chat-input" class="chat-input" placeholder="${t.chatPlaceholder}" autocomplete="off">
          <button class="chat-send-btn" onclick="handleUserMessage()">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", wizardHTML);

  document
    .getElementById("chat-input")
    .addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleUserMessage();
      }
    });
}

window.toggleChat = function () {
  const chatWindow = document.getElementById("chat-window");
  const chatBody = document.getElementById("chat-body");
  const input = document.getElementById("chat-input");

  chatOpen = !chatOpen;

  if (chatOpen) {
    chatWindow.classList.add("active");
    input.focus();
    if (chatBody.querySelectorAll(".message").length === 0) {
      sendBotGreeting();
    }
  } else {
    chatWindow.classList.remove("active");
  }
};

function sendBotGreeting() {
  const lang = currentLanguage;
  const greetings = {
    en: "Hello! I have full access to the diagnostic database. Describe your problem (e.g., 'engine shaking', 'abs light', 'smoke') or enter a code.",
    ru: "Привет! У меня есть доступ ко всей базе ошибок. Опишите проблему (например: 'троит двигатель', 'дым', 'вибрация') или введите код.",
    ka: "გამარჯობა! აღმიწერეთ პრობლემა (მაგ: 'ძრავის ძაგძაგი', 'ბოლი') ან შეიყვანეთ კოდი.",
  };
  addMessage(greetings[lang], "bot");
  showQuickChips();
}

window.handleUserMessage = function () {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  const indicator = document.getElementById("typing-indicator");
  const chatBody = document.getElementById("chat-body");
  indicator.style.display = "flex";
  chatBody.scrollTop = chatBody.scrollHeight;

  setTimeout(() => {
    analyzeRequest(text);
  }, 1000);
};

function analyzeRequest(query) {
  const indicator = document.getElementById("typing-indicator");
  indicator.style.display = "none";
  const lang = currentLanguage;

  const terms = query
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length > 2);
  if (terms.length === 0 && query.length > 0) terms.push(query.toLowerCase());

  let matches = bmwCodes.map((code) => {
    let score = 0;
    if (code.code.toLowerCase().includes(query.toLowerCase())) score += 100;
    if (
      code.pCodes &&
      code.pCodes.some((p) => p.toLowerCase().includes(query.toLowerCase()))
    )
      score += 100;

    terms.forEach((term) => {
      if (code.title[lang] && code.title[lang].toLowerCase().includes(term))
        score += 10;
      if (
        code.description[lang] &&
        code.description[lang].toLowerCase().includes(term)
      )
        score += 5;
      if (
        code.solutions[lang] &&
        code.solutions[lang].join(" ").toLowerCase().includes(term)
      )
        score += 3;
      if (code.title.en.toLowerCase().includes(term)) score += 2;
    });
    return { code, score };
  });

  const results = matches
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (results.length > 0) {
    const phrases = {
      en: `I found ${results.length} relevant entries in the database based on "${query}":`,
      ru: `Я нашел несколько записей в базе по запросу "${query}":`,
      ka: `ვიპოვე რამოდენიმე ჩანაწერი "${query}"-ზე:`,
    };
    addMessage(phrases[lang], "bot");

    const chatBody = document.getElementById("chat-body");
    const resultsDiv = document.createElement("div");
    resultsDiv.style.display = "flex";
    resultsDiv.style.flexDirection = "column";
    resultsDiv.style.gap = "5px";
    resultsDiv.style.marginBottom = "10px";

    results.forEach((item) => {
      const btn = document.createElement("div");
      btn.className = "chat-result-link";
      btn.innerHTML = `
                <div style="flex:1;">
                    <div class="chat-result-code">${item.code.code}</div>
                    <div style="font-size:12px; line-height:1.2;">${item.code.title[lang]}</div>
                </div>
                <i class="fas fa-chevron-right"></i>
            `;
      btn.onclick = () => {
        toggleChat();
        displayCodeDetail(item.code);
      };
      resultsDiv.appendChild(btn);
    });
    chatBody.insertBefore(
      resultsDiv,
      document.getElementById("typing-indicator"),
    );
  } else {
    const notFound = {
      en: "I couldn't find exact matches in my database. Try using keywords like 'Turbo', 'Misfire', 'Sensor' or a specific code.",
      ru: "Я не нашел точных совпадений. Попробуйте общие слова: 'Турбина', 'Пропуски', 'Датчик' или код ошибки.",
      ka: "ვერ ვიპოვე. სცადეთ სიტყვები: 'ტურბინა', 'სენსორი' ან კოდი.",
    };
    addMessage(notFound[lang], "bot");
    showQuickChips();
  }
  const chatBody = document.getElementById("chat-body");
  chatBody.scrollTop = chatBody.scrollHeight;
}

function addMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");
  const indicator = document.getElementById("typing-indicator");
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  msgDiv.innerHTML = text;
  chatBody.insertBefore(msgDiv, indicator);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function showQuickChips() {
  const chatBody = document.getElementById("chat-body");
  const indicator = document.getElementById("typing-indicator");
  const lang = currentLanguage;

  const chipsData = [
    {
      label: { en: "Engine Misfire", ru: "Троит мотор", ka: "ძრავის ძაგძაგი" },
      query: "misfire",
    },
    {
      label: { en: "Boost Pressure", ru: "Нет наддува", ka: "ტურბო წნევა" },
      query: "boost pressure",
    },
    {
      label: { en: "Battery", ru: "Аккумулятор", ka: "აკუმულატორი" },
      query: "battery",
    },
  ];

  const chipsDiv = document.createElement("div");
  chipsDiv.className = "chat-options";

  chipsData.forEach((chip) => {
    const btn = document.createElement("button");
    btn.className = "chat-option-btn";
    btn.textContent = chip.label[lang];
    btn.onclick = () => {
      chipsDiv.remove();
      const input = document.getElementById("chat-input");
      input.value = chip.label[lang];
      handleUserMessage();
    };
    chipsDiv.appendChild(btn);
  });
  chatBody.insertBefore(chipsDiv, indicator);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function updateChatUI() {
  const t = translations[currentLanguage];
  const titleEl = document.getElementById("chat-bot-title");
  const statusEl = document.querySelector("#chat-window .bot-status");
  const inputEl = document.getElementById("chat-input");

  if (titleEl) titleEl.innerText = t.chatTitle;
  if (statusEl)
    statusEl.innerHTML = `<div class="status-dot"></div> ${t.chatStatus}`;
  if (inputEl) inputEl.placeholder = t.chatPlaceholder;

  const chatBody = document.getElementById("chat-body");
  if (chatBody) {
    chatBody.innerHTML = `
      <div class="typing-indicator" id="typing-indicator">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>`;
    if (chatOpen) sendBotGreeting();
  }
}

// ==========================================
// GOOGLE OAUTH & AUTHENTICATION
// ==========================================

// Инициализируй Google Identity Services
function initializeGoogleAuth() {
  google.accounts.id.initialize({
    client_id:
      "855371837949-nsnfceo82efbfb5hmdks9ifrs0ra07vv.apps.googleusercontent.com", // ЗАМЕНИ НА ТВОЙ CLIENT ID
    callback: handleGoogleCallback,
  });
}

// Обработчик для кнопки Google Sign In
function handleGoogleSignIn() {
  console.log("Google Sign In clicked");

  if (typeof google === "undefined") {
    alert("Google Sign-In is not available");
    return;
  }

  try {
    google.accounts.id.prompt((notification) => {
      console.log("Prompt:", notification);
    });
  } catch (e) {
    console.error("Error:", e);
  }
}

// Callback от Google с ID token
async function handleGoogleCallback(response) {
  const loadingMsg =
    document.getElementById("login-message") ||
    document.getElementById("reg-message");

  if (loadingMsg) {
    loadingMsg.textContent = "Signing in...";
    loadingMsg.style.color = "#6f9bd1";
  }

  try {
    // Отправляем ID token на наш backend
    const res = await fetch("/api/auth/google-callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credential: response.credential,
        language: currentLanguage,
      }),
    });

    const data = await res.json();

    if (data.success && data.token) {
      // Сохраняем токен и данные пользователя
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (loadingMsg) {
        loadingMsg.textContent = "Login successful! Redirecting...";
        loadingMsg.style.color = "#2ecc71";
      }

      // Перенаправляем на форум через 500ms
      setTimeout(() => {
        location.reload();
      }, 500);
    } else {
      if (loadingMsg) {
        loadingMsg.textContent = data.error || "Authentication failed";
        loadingMsg.style.color = "#e74c3c";
      }
    }
  } catch (error) {
    console.error("Google auth error:", error);
    if (loadingMsg) {
      loadingMsg.textContent = "Authentication error: " + error.message;
      loadingMsg.style.color = "#e74c3c";
    }
  }
}

// ОБРАБОТЧИКИ ФОРМ ЛОГИНА И РЕГИСТРАЦИИ
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const messageDiv = document.getElementById("login-message");

  messageDiv.textContent = "Logging in...";
  messageDiv.style.color = "#6f9bd1";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, language: currentLanguage }),
    });

    const data = await res.json();

    if (data.success && data.token) {
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      messageDiv.textContent = "Login successful! Redirecting...";
      messageDiv.style.color = "#2ecc71";

      setTimeout(() => {
        location.reload();
      }, 500);
    } else {
      messageDiv.textContent = data.error || "Login failed";
      messageDiv.style.color = "#e74c3c";
    }
  } catch (error) {
    console.error("Login error:", error);
    messageDiv.textContent = "Error: " + error.message;
    messageDiv.style.color = "#e74c3c";
  }
});

document
  .getElementById("registerForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("reg-username").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const messageDiv = document.getElementById("reg-message");

    // Простая валидация пароля
    if (password.length < 8) {
      messageDiv.textContent = "Password must be at least 8 characters";
      messageDiv.style.color = "#e74c3c";
      return;
    }

    messageDiv.textContent = "Creating account...";
    messageDiv.style.color = "#6f9bd1";

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          username,
          language: currentLanguage,
        }),
      });

      const data = await res.json();

      if (data.success) {
        messageDiv.textContent =
          "Registration successful! Check your email to verify your account.";
        messageDiv.style.color = "#2ecc71";
        document.getElementById("registerForm").reset();

        // Автоматически переключаемся на логин
        setTimeout(() => {
          switchTab("login");
        }, 2000);
      } else {
        messageDiv.textContent = data.error || "Registration failed";
        messageDiv.style.color = "#e74c3c";
      }
    } catch (error) {
      console.error("Register error:", error);
      messageDiv.textContent = "Error: " + error.message;
      messageDiv.style.color = "#e74c3c";
    }
  });

// ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
function checkAuthOnLoad() {
  const token = localStorage.getItem("authToken");
  const user = localStorage.getItem("user");

  if (token && user) {
    // Пользователь авторизован, скрываем форму, показываем форум
    const authSection = document.getElementById("auth-section");
    const forumContent = document.getElementById("forum-content");

    if (authSection) authSection.classList.add("hidden");
    if (forumContent) forumContent.classList.remove("hidden");

    const userData = JSON.parse(user);
    document.getElementById("sidebar-username").textContent =
      userData.username || "User";

    // Загружаем данные форума
    loadForumTopics();
    loadNotifications();
  }
}

// LOGOUT ФУНКЦИЯ
function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    location.reload();
  }
}

// PROTECT API ЗАПРОСЫ - добавь Authorization header
async function protectedFetch(endpoint, options = {}) {
  const token = localStorage.getItem("authToken");

  if (!token) {
    window.location.href = window.location.pathname + "?logout=true";
    return null;
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  // Если токен истёк (401), логаутим
  if (response.status === 401) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    window.location.reload();
    return null;
  }

  return response;
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener("DOMContentLoaded", () => {
  initializeGoogleAuth();
  checkAuthOnLoad();

  // Обновляем текст кнопок Google в зависимости от языка
  updateGoogleButtonText();
});

// ЛОКАЛИЗАЦИЯ GOOGLE КНОПОК
function updateGoogleButtonText() {
  const googleSignInText = document.getElementById("googleSignInText");
  const googleSignUpText = document.getElementById("googleSignUpText");

  const translations = {
    en: { signIn: "Sign in with Google", signUp: "Sign up with Google" },
    ru: {
      signIn: "Войти через Google",
      signUp: "Зарегистрироваться через Google",
    },
    ka: {
      signIn: "შესვლა Google-ის მეშვეობით",
      signUp: "რეგისტრაცია Google-ის მეშვეობით",
    },
  };

  const text = translations[currentLanguage];
  if (googleSignInText) googleSignInText.textContent = text.signIn;
  if (googleSignUpText) googleSignUpText.textContent = text.signUp;
}

// Когда меняется язык, обновляем текст Google кнопок
const originalToggleLanguage = window.toggleLanguage;
window.toggleLanguage = function () {
  if (originalToggleLanguage) originalToggleLanguage();
  updateGoogleButtonText();
};

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: отправка запросов к API с токеном
async function apiCall(method, endpoint, body = null) {
  const token = localStorage.getItem("authToken");

  const options = {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(endpoint, options);

  if (response.status === 401) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    window.location.reload();
    return null;
  }

  return response.json();
}

// ==========================================
// 4. MAIN LOGIC (INIT & SEARCH)
// ==========================================

async function init() {
  try {
    // 1. Сначала берем локальные данные из data.js
    if (typeof getMockData === "function") {
      bmwCodes = getMockData();
    }
    // 2. Пытаемся подгрузить JSON (если есть)
    const response = await fetch("../data/codes.json");
    if (response.ok) {
      const data = await response.json();
      bmwCodes = [...bmwCodes, ...data.codes];
    }

    setupEventListeners();
    updateLanguage();
  } catch (error) {
    console.warn("Init error", error);
    setupEventListeners();
    updateLanguage();
  }
}

function setupEventListeners() {
  searchInput.addEventListener("input", handleSearch);

  languageToggle.addEventListener("click", () => {
    const langs = ["en", "ru", "ka"];
    let idx = langs.indexOf(currentLanguage);
    currentLanguage = langs[(idx + 1) % langs.length];

    localStorage.setItem("forumLanguage", currentLanguage);

    updateLanguage();

    if (selectedCode) displayCodeDetail(selectedCode);
    else handleSearch();

    updateChatUI();
  });
}

function updateLanguage() {
  const langLabels = { en: "EN", ru: "РУ", ka: "ქა" };
  const span = languageToggle.querySelector("span");
  if (span) span.textContent = langLabels[currentLanguage];

  const text = translations[currentLanguage];
  const forumBtn = document.getElementById("forum-btn-text");
  if (forumBtn) forumBtn.textContent = text.forumBtn;

  searchInput.placeholder = text.searchPlaceholder;

  document.querySelector("#empty-state .message").textContent =
    text.emptyStateMessage;
  document.querySelector("#empty-state .sub-message").textContent =
    text.emptyStateSubMessage;
  document.querySelector("#no-results .message").textContent =
    text.noResultsMessage;
  document.querySelector("footer p").textContent = text.footer;
}

function handleSearch() {
  const term = searchInput.value.trim().toLowerCase();

  if (term === "") {
    resultsContainer.classList.add("hidden");
    emptyState.classList.remove("hidden");
    noResults.classList.add("hidden");
    return;
  }

  const filtered = bmwCodes.filter(
    (c) =>
      c.code.toLowerCase().includes(term) ||
      c.title[currentLanguage].toLowerCase().includes(term) ||
      (c.pCodes && c.pCodes.some((p) => p.toLowerCase().includes(term))),
  );

  if (filtered.length === 0) {
    resultsContainer.classList.add("hidden");
    emptyState.classList.add("hidden");
    noResults.classList.remove("hidden");
  } else {
    renderResults(filtered);
    resultsContainer.classList.remove("hidden");
    emptyState.classList.add("hidden");
    noResults.classList.add("hidden");
  }
}

function renderResults(codes) {
  resultsContainer.innerHTML = "";
  // Получаем список сохраненных ID
  const favorites = JSON.parse(localStorage.getItem("bmwFavorites")) || [];

  codes.forEach((code) => {
    const el = document.createElement("div");
    el.className = "code-item";

    // Проверяем, сохранен ли код
    const isFav = favorites.includes(code.code);
    const starClass = isFav ? "active" : "";

    let severityColor = "#f1c40f";
    if (code.severity === "High" || code.severity === "Critical")
      severityColor = "#e74c3c";
    if (code.severity === "Low") severityColor = "#2ecc71";

    el.innerHTML = `
      <div style="display:flex; align-items:center; width:100%;">
          <div style="flex: 1;" onclick="displayCodeDetail(selectedCodeRef)">
            <div class="code-header">
              <span class="code-identifier" style="color:${severityColor}">${code.code}</span>
              <span class="code-title">${code.title[currentLanguage]}</span>
            </div>
            <div class="code-meta">
              <i class="fas fa-microchip"></i> ${code.category} &nbsp;•&nbsp; 
              <span style="color:${severityColor}">${code.severity}</span>
            </div>
          </div>
          
          <button class="star-btn ${starClass}" onclick="toggleFavorite(event, '${code.code}')">
            <i class="fas fa-star"></i>
          </button>
          
          <i class="fas fa-chevron-right" style="margin-left:10px; opacity:0.5;"></i>
      </div>
    `;

    // Хак, чтобы передать объект code в onclick
    el.querySelector('div[style*="flex: 1"]').onclick = () =>
      displayCodeDetail(code);

    resultsContainer.appendChild(el);
  });
}

// ==========================================
// 5. 3D BACKGROUND & ANIMATIONS
// ==========================================

function init3DBackground() {
  const container = document.getElementById("webgl-container");
  if (!container) return;
  container.innerHTML = "";

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050507, 0.002);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 1200;
  const posArray = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 80;
  }

  particlesGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(posArray, 3),
  );
  const material = new THREE.PointsMaterial({
    size: 0.15,
    color: 0x0066b3,
    transparent: true,
    opacity: 0.8,
  });
  const particlesMesh = new THREE.Points(particlesGeometry, material);
  scene.add(particlesMesh);

  let mouseX = 0;
  let mouseY = 0;
  document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX / window.innerWidth - 0.5;
    mouseY = event.clientY / window.innerHeight - 0.5;
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    particlesMesh.rotation.y = elapsedTime * 0.05;
    particlesMesh.rotation.x = mouseY * 0.5;
    particlesMesh.rotation.y += mouseX * 0.05;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  init3DBackground();
  initWizard();

  // Микроанимации кнопок
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("mousedown", () => {
      btn.style.transform = "scale(0.95)";
    });
    btn.addEventListener("mouseup", () => {
      btn.style.transform = "scale(1)";
    });
  });

  // Анимация при скролле
  window.addEventListener("scroll", () => {
    document.querySelectorAll(".code-item").forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.8) {
        item.style.transform = `translateY(${Math.sin(rect.top / 50) * 5}px)`;
      }
    });
  });
});
// Настройка слушателей для форм
function setupLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const messageDiv = document.getElementById("login-message");

    if (messageDiv) messageDiv.textContent = "Logging in...";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          language: currentLanguage || "en",
        }),
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        if (messageDiv) messageDiv.textContent = "Login successful!";
        setTimeout(() => location.reload(), 1000);
      } else {
        if (messageDiv) messageDiv.textContent = data.error || "Login failed";
      }
    } catch (error) {
      if (messageDiv) messageDiv.textContent = "Error: " + error.message;
    }
  });
}

function setupRegisterForm() {
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("reg-username").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const messageDiv = document.getElementById("reg-message");

    if (password.length < 8) {
      if (messageDiv) messageDiv.textContent = "Password must be 8+ chars";
      return;
    }

    if (messageDiv) messageDiv.textContent = "Creating account...";

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          username,
          language: currentLanguage || "en",
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (messageDiv) messageDiv.textContent = "Check your email!";
        registerForm.reset();
      } else {
        if (messageDiv)
          messageDiv.textContent = data.error || "Registration failed";
      }
    } catch (error) {
      if (messageDiv) messageDiv.textContent = "Error: " + error.message;
    }
  });
}

function initAuthSystem() {
  console.log("Initializing auth...");

  if (typeof google !== "undefined") {
    google.accounts.id.initialize({
      client_id:
        "855371837949-nsnfceo82efbfb5hmdks9ifrs0ra07vv.apps.googleusercontent.com",
      callback: handleGoogleCallback,
    });
  }

  setupLoginForm();
  setupRegisterForm();
  checkAuthOnLoad();
}

// Запусти при загрузке
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthSystem);
} else {
  initAuthSystem();
}
// Запускаем
init();
