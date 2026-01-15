// DOM Elements
const searchInput = document.getElementById("search-input");
const resultsContainer = document.getElementById("results-container");
const emptyState = document.getElementById("empty-state");
const noResults = document.getElementById("no-results");
const codeDetail = document.getElementById("code-detail");
const searchContainer = document.getElementById("search-container");
const languageToggle = document.getElementById("language-toggle");

// script.js

function displayCodeDetail(code) {
  selectedCode = code;
  const lang = currentLanguage;
  const t = translations[lang];

  searchContainer.classList.add("hidden");
  codeDetail.classList.remove("hidden");
  window.scrollTo(0, 0);

  // БЕЗОПАСНАЯ ПРОВЕРКА ДАННЫХ (чтобы не было ошибок в консоли)
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
      ? `<div class="alt-code-badge">${t.obdLabel} <span>${pCodes.join(
          ", "
        )}</span></div>`
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
      <div class="info-badge severity-${(
        code.severity || "medium"
      ).toLowerCase()}">
        <i class="fas fa-exclamation-triangle"></i> ${
          code.severity || "Normal"
        } Priority
      </div>
      
      <h3>${t.description}</h3>
      <p class="description-text">${description}</p>
      
      <h3>${t.possibleSolutions}</h3>
      <div class="solutions-section">
        <ul>
          ${solutions.map((s) => `<li>${s}</li>`).join("")}
        </ul>
        <div class="parts-buttons">
            <a href="https://www.google.com/search?q=${encodeURIComponent(
              partsQuery
            )}" target="_blank" class="btn-part">
                <i class="fas fa-cogs"></i> ${t.partsBtn}
            </a>
            <a href="https://www.google.com/search?q=${encodeURIComponent(
              catsQuery
            )}" target="_blank" class="btn-part secondary">
                <i class="fas fa-book-open"></i> ${t.catalogBtn}
            </a>
        </div>
      </div>
      
      <div class="tag-grid">
        <div>
          <h3>${t.applicableModels}</h3>
          <div class="tags">
            ${(code.applicableModels || [])
              .map((m) => `<span class="tag">${m}</span>`)
              .join("")}
          </div>
        </div>
        <div>
          <h3>${t.engineCodes}</h3>
          <div class="tags">
            ${(code.engineCodes || [])
              .map((e) => `<span class="tag">${e}</span>`)
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. Логика Чата
function initWizard() {
  // Добавляем HTML виджета в body, если его нет
  if (!document.getElementById("wizard-widget")) {
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
                <div style="font-weight:bold; color:#fff;">BMW AI Assistant</div>
                <div class="bot-status"><div class="status-dot"></div> Online • v3.0</div>
              </div>
            </div>
            <div style="cursor:pointer;" onclick="toggleChat()"><i class="fas fa-times" style="color:#fff;"></i></div>
          </div>
          
          <div class="chat-body" id="chat-body">
            <div class="typing-indicator" id="typing-indicator">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", wizardHTML);
  }
}

/* --- INTELLIGENT AI DIAGNOSTIC BOT (FULL ACCESS) --- */

let chatOpen = false;

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

// Открытие/Закрытие чата
window.toggleChat = function () {
  const chatWindow = document.getElementById("chat-window");
  const chatBody = document.getElementById("chat-body");
  const input = document.getElementById("chat-input");

  chatOpen = !chatOpen;

  if (chatOpen) {
    chatWindow.classList.add("active");
    input.focus();
    // Приветствие, если чат пустой
    if (chatBody.querySelectorAll(".message").length === 0) {
      sendBotGreeting();
    }
  } else {
    chatWindow.classList.remove("active");
  }
};

// Приветствие
function sendBotGreeting() {
  const lang = currentLanguage;
  const greetings = {
    en: "Hello! I have full access to the diagnostic database. Describe your problem (e.g., 'engine shaking', 'abs light', 'smoke') or enter a code.",
    ru: "Привет! У меня есть доступ ко всей базе ошибок. Опишите проблему (например: 'троит двигатель', 'дым', 'вибрация') или введите код.",
    ka: "გამარჯობა! აღმიწერეთ პრობლემა (მაგ: 'ძრავის ძაგძაგი', 'ბოლი') ან შეიყვანეთ კოდი.",
  };
  addMessage(greetings[lang], "bot");

  // Предлагаем быстрые варианты (Чипы)
  showQuickChips();
}

// Обработка сообщения пользователя
function handleUserMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  // 1. Показываем сообщение пользователя
  addMessage(text, "user");
  input.value = "";

  // 2. Показываем индикатор печати
  const indicator = document.getElementById("typing-indicator");
  const chatBody = document.getElementById("chat-body");
  indicator.style.display = "flex";
  chatBody.scrollTop = chatBody.scrollHeight;

  // 3. Задержка для имитации "мышления"
  setTimeout(() => {
    analyzeRequest(text);
  }, 1000);
}

// --- МОЗГ БОТА (Анализ базы данных) ---
function analyzeRequest(query) {
  const indicator = document.getElementById("typing-indicator");
  indicator.style.display = "none";
  const lang = currentLanguage;

  // Нормализация запроса
  const terms = query
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length > 2); // Игнорируем короткие слова

  if (terms.length === 0 && query.length > 0) {
    // Если ввел короткое слово или цифры
    terms.push(query.toLowerCase());
  }

  // Поиск совпадений в массиве bmwCodes (глобальная переменная из script.js)
  let matches = bmwCodes.map((code) => {
    let score = 0;
    const codeString = JSON.stringify(code).toLowerCase();

    // 1. Прямое совпадение кода
    if (code.code.toLowerCase().includes(query.toLowerCase())) score += 100;

    // 2. Совпадение P-code
    if (
      code.pCodes &&
      code.pCodes.some((p) => p.toLowerCase().includes(query.toLowerCase()))
    )
      score += 100;

    // 3. Поиск слов в описании и заголовке (на текущем языке)
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
      // Английский как запасной вариант
      if (code.title.en.toLowerCase().includes(term)) score += 2;
    });

    return { code, score };
  });

  // Фильтрация и сортировка
  const results = matches
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Топ 3 результата

  // Формирование ответа
  if (results.length > 0) {
    const phrases = {
      en: `I found ${results.length} relevant entries in the database based on "${query}":`,
      ru: `Я нашел несколько записей в базе по запросу "${query}":`,
      ka: `ვიპოვე რამოდენიმე ჩანაწერი "${query}"-ზე:`,
    };
    addMessage(phrases[lang], "bot");

    // Создаем кнопки-результаты
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
      // При клике открываем детальную карточку
      btn.onclick = () => {
        // Закрываем чат (опционально, можно оставить открытым)
        toggleChat();
        // Открываем детали
        displayCodeDetail(item.code);
      };
      resultsDiv.appendChild(btn);
    });

    chatBody.insertBefore(
      resultsDiv,
      document.getElementById("typing-indicator")
    );
  } else {
    // Ничего не найдено
    const notFound = {
      en: "I couldn't find exact matches in my database. Try using keywords like 'Turbo', 'Misfire', 'Sensor' or a specific code.",
      ru: "Я не нашел точных совпадений. Попробуйте общие слова: 'Турбина', 'Пропуски', 'Датчик' или код ошибки.",
      ka: "ვერ ვიპოვე. სცადეთ სიტყვები: 'ტურბინა', 'სენსორი' ან კოდი.",
    };
    addMessage(notFound[lang], "bot");
    showQuickChips(); // Показать подсказки снова
  }

  // Скролл вниз
  const chatBody = document.getElementById("chat-body");
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Функция добавления сообщения (визуальная часть)
function addMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");
  const indicator = document.getElementById("typing-indicator");

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  msgDiv.innerHTML = text;

  chatBody.insertBefore(msgDiv, indicator);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Быстрые подсказки (Chips)
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
      // Удаляем кнопки после клика
      chipsDiv.remove();
      // Отправляем как сообщение от пользователя
      const input = document.getElementById("chat-input");
      input.value = chip.label[lang]; // Визуально ставим текст
      handleUserMessage(); // Запускаем обработку, но искать будем по query
    };
    chipsDiv.appendChild(btn);
  });

  chatBody.insertBefore(chipsDiv, indicator);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function updateChatUI() {
  const t = translations[currentLanguage];

  // ИСПРАВЛЕНИЕ: Ищем элемент по ID, а не по селектору div:first-child
  const titleEl = document.getElementById("chat-bot-title");

  const statusEl = document.querySelector("#chat-window .bot-status");
  const inputEl = document.getElementById("chat-input");

  if (titleEl) titleEl.innerText = t.chatTitle;
  if (statusEl)
    statusEl.innerHTML = `<div class="status-dot"></div> ${t.chatStatus}`;
  if (inputEl) inputEl.placeholder = t.chatPlaceholder;

  // Мягкая перезагрузка чата
  const chatBody = document.getElementById("chat-body");
  if (chatBody) {
    chatBody.innerHTML = `
      <div class="typing-indicator" id="typing-indicator">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>`;
    if (chatOpen) sendBotGreeting();
  }
}
// App State
let currentLanguage = "en";
let isDarkMode = true;
let bmwCodes = [];
let selectedCode = null;

// UI Text Translations
const translations = {
  en: {
    searchPlaceholder: "Enter DTC code (e.g. 102613) or P-code...",
    emptyStateMessage: "BMW Diagnostic Database",
    emptyStateSubMessage: "Search for engine, transmission, and body codes.",
    noResultsMessage: "No codes found",
    description: "System Diagnosis",
    possibleSolutions: "Repair Plan",
    applicableModels: "Models",
    engineCodes: "Engines",
    category: "System",
    footer: "BMW DTC Bot © 2026 • Professional Diagnostic Data",
    // Новые ключи для кнопок
    partsBtn: "RealOEM (Parts)",
    catalogBtn: "Catalog Search",
    obdLabel: "OBD-II Code:",
    chatTitle: "BMW AI Expert",
    chatStatus: "Connected to Database",
    chatPlaceholder: "Describe issue (e.g. 'smoke', 'misfire')...",
  },
  ru: {
    searchPlaceholder: "Введите код ошибки (напр. 102613)...",
    emptyStateMessage: "База диагностики BMW",
    emptyStateSubMessage: "Поиск кодов двигателя, трансмиссии и кузова.",
    noResultsMessage: "Код не найден",
    description: "Диагностика системы",
    possibleSolutions: "План ремонта",
    applicableModels: "Модели",
    engineCodes: "Двигатели",
    category: "Система",
    footer: "BMW DTC Bot © 2026 • Профессиональная диагностика",
    partsBtn: "Запчасти (RealOEM)",
    catalogBtn: "Поиск в каталоге",
    obdLabel: "Код OBD-II:",
    chatTitle: "ИИ Эксперт BMW",
    chatStatus: "Подключено к базе",
    chatPlaceholder: "Опишите проблему (напр. 'дым', 'троит')...",
  },
  ka: {
    searchPlaceholder: "შეიყვანეთ კოდი (მაგ. 102613)...",
    emptyStateMessage: "BMW დიაგნოსტიკური ბაზა",
    emptyStateSubMessage: "მოძებნეთ ძრავის და სისტემის კოდები.",
    noResultsMessage: "კოდი ვერ მოიძებნა",
    description: "სისტემის დიაგნოსტიკა",
    possibleSolutions: "შეკეთების გეგმა",
    applicableModels: "მოდელები",
    engineCodes: "ძრავები",
    category: "სისტემა",
    footer: "BMW DTC Bot © 2026 • პროფესიონალური მონაცემები",
    partsBtn: "ნაწილები (RealOEM)",
    catalogBtn: "კატალოგში ძებნა",
    obdLabel: "OBD-II კოდი:",
    chatTitle: "BMW-ს იი ექსპერტი",
    chatStatus: "დაკავშირებულია ბაზასთან",
    chatPlaceholder: "აღწერეთ პრობლემა (მაგ. 'ბოლი')...",
  },
};

// Initialize the application

async function init() {
  try {
    // 1. Сначала берем локальные данные из data.js
    if (typeof getMockData === "function") {
      bmwCodes = getMockData();
    }

    // 2. Пытаемся подгрузить JSON
    const response = await fetch("codes.json");
    if (response.ok) {
      const data = await response.json();
      // Объединяем списки
      bmwCodes = [...bmwCodes, ...data.codes];
    }

    setupEventListeners();
    updateLanguage();
  } catch (error) {
    console.warn("JSON loading failed, using data.js only", error);
    setupEventListeners();
    updateLanguage();
  }
}

// Set up event listeners
function setupEventListeners() {
  searchInput.addEventListener("input", handleSearch);

  languageToggle.addEventListener("click", () => {
    const langs = ["en", "ru", "ka"];
    let idx = langs.indexOf(currentLanguage);
    currentLanguage = langs[(idx + 1) % langs.length];

    // Кнопка языка
    const langLabels = { en: "EN", ru: "RU", ka: "KA" };
    const span = languageToggle.querySelector("span");
    if (span) span.textContent = langLabels[currentLanguage];

    // Обновляем основной интерфейс
    updateLanguage();

    // Обновляем детали ошибки (если открыта)
    if (selectedCode) displayCodeDetail(selectedCode);
    else handleSearch();

    // --- ГЛАВНОЕ: ОБНОВЛЯЕМ ЧАТ ---
    updateChatUI();
  });
}

// Update UI language
function updateLanguage() {
  const text = translations[currentLanguage];

  // Update placeholder
  searchInput.placeholder = text.searchPlaceholder;

  // Update empty state
  document.querySelector("#empty-state .message").textContent =
    text.emptyStateMessage;
  document.querySelector("#empty-state .sub-message").textContent =
    text.emptyStateSubMessage;

  // Update no results message
  document.querySelector("#no-results .message").textContent =
    text.noResultsMessage;

  // Update footer
  document.querySelector("footer p").textContent = text.footer;
}

// Handle search input
function handleSearch() {
  const term = searchInput.value.trim().toLowerCase();

  if (term === "") {
    resultsContainer.classList.add("hidden");
    emptyState.classList.remove("hidden");
    noResults.classList.add("hidden");
    return;
  }

  // Обновленная логика фильтрации
  const filtered = bmwCodes.filter(
    (c) =>
      c.code.toLowerCase().includes(term) || // Поиск по BMW коду
      c.title[currentLanguage].toLowerCase().includes(term) || // Поиск по названию
      (c.pCodes && c.pCodes.some((p) => p.toLowerCase().includes(term))) // <-- НОВОЕ: Поиск по P-кодам
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

// Render search results
function renderSearchResults(codes) {
  resultsContainer.innerHTML = "";

  codes.forEach((code) => {
    const codeItem = document.createElement("div");
    codeItem.className = "code-item";

    let severityClass = "severity-medium";
    if (code.severity === "High") {
      severityClass = "severity-high";
    } else if (code.severity === "Low") {
      severityClass = "severity-low";
    }

    codeItem.innerHTML = `
            <div>
                <div class="code-header">
                    <span class="code-identifier ${severityClass}">${
      code.code
    }</span>
                    <span class="code-title">${
                      code.title[currentLanguage]
                    }</span>
                </div>
                <div class="code-meta">
                    ${translations[currentLanguage].category}: ${
      code.category
    } • 
                    ${
                      translations[currentLanguage].applicableModels
                    }: ${code.applicableModels.join(", ")}
                </div>
            </div>
            <i class="fas fa-chevron-right"></i>
        `;

    codeItem.addEventListener("click", () => {
      showCodeDetail(code);
    });

    resultsContainer.appendChild(codeItem);
  });
}

// Show code detail
function showCodeDetail(code) {
  selectedCode = code;

  // Hide search container
  searchContainer.classList.add("hidden");

  // Show detail container
  codeDetail.classList.remove("hidden");

  let severityClass = "severity-medium";
  if (code.severity === "High") {
    severityClass = "severity-high";
  } else if (code.severity === "Low") {
    severityClass = "severity-low";
  }

  const text = translations[currentLanguage];

  codeDetail.innerHTML = `
        <div class="detail-header">
            <div class="detail-title">
                <span class="code-identifier ${severityClass}">${
    code.code
  }</span>
                <span>${code.title[currentLanguage]}</span>
            </div>
            <button class="close-button" id="close-detail">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="detail-content">
            <div class="detail-section">
                <h3>${text.description}</h3>
                <p>${code.description[currentLanguage]}</p>
            </div>
            
            <div class="detail-section">
                <h3>${text.possibleSolutions}</h3>
                <ul>
                    ${code.solutions[currentLanguage]
                      .map((solution) => `<li>${solution}</li>`)
                      .join("")}
                </ul>
            </div>
            
            <div class="tag-grid">
                <div class="tag-container">
                    <h4>${text.applicableModels}</h4>
                    <div class="tags">
                        ${code.applicableModels
                          .map((model) => `<span class="tag">${model}</span>`)
                          .join("")}
                    </div>
                </div>
                
                <div class="tag-container">
                    <h4>${text.engineCodes}</h4>
                    <div class="tags">
                        ${code.engineCodes
                          .map((engine) => `<span class="tag">${engine}</span>`)
                          .join("")}
                    </div>
                </div>
            </div>
        </div>
    `;

  // Add event listener to close button
  document.getElementById("close-detail").addEventListener("click", () => {
    // Hide detail container
    codeDetail.classList.add("hidden");

    // Show search container
    searchContainer.classList.remove("hidden");

    selectedCode = null;
  });
}

// Инициализация 3D фона
function init3DBackground() {
  const container = document.getElementById("webgl-container");

  // Очищаем контейнер, если там что-то было
  container.innerHTML = "";

  const scene = new THREE.Scene();
  // Легкий туман для глубины (под цвет фона из CSS)
  scene.fog = new THREE.FogExp2(0x050507, 0.002);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // --- Создаем частицы (Data Points) ---
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 1200; // Количество точек
  const posArray = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount * 3; i++) {
    // Распределяем точки в пространстве
    posArray[i] = (Math.random() - 0.5) * 80;
  }

  particlesGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(posArray, 3)
  );

  const material = new THREE.PointsMaterial({
    size: 0.15,
    color: 0x0066b3, // BMW Blue
    transparent: true,
    opacity: 0.8,
  });

  const particlesMesh = new THREE.Points(particlesGeometry, material);
  scene.add(particlesMesh);

  // --- Интерактивность (Мышь) ---
  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX / window.innerWidth - 0.5;
    mouseY = event.clientY / window.innerHeight - 0.5;
  });

  // --- Анимация ---
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Вращение всей системы частиц
    particlesMesh.rotation.y = elapsedTime * 0.05;
    // Реакция на мышь
    particlesMesh.rotation.x = mouseY * 0.5;
    particlesMesh.rotation.y += mouseX * 0.05;

    renderer.render(scene, camera);
  }

  animate();

  // Ресайз окна
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Загрузочный экран
window.addEventListener("load", () => {
  setTimeout(() => {
    setTimeout(() => {}, 500);
  }, 1500);
});

function renderResults(codes) {
  resultsContainer.innerHTML = "";

  codes.forEach((code) => {
    const el = document.createElement("div");
    // Используем новый класс code-item из нового CSS
    el.className = "code-item";

    // Определяем цвет для важности (Severity)
    let severityColor = "#f1c40f"; // Желтый (Medium)
    if (code.severity === "High" || code.severity === "Critical")
      severityColor = "#e74c3c"; // Красный
    if (code.severity === "Low") severityColor = "#2ecc71"; // Зеленый

    // Новый HTML для элемента списка
    el.innerHTML = `
      <div style="flex: 1;">
        <div class="code-header">
          <span class="code-identifier" style="color:${severityColor}">${code.code}</span>
          <span class="code-title">${code.title[currentLanguage]}</span>
        </div>
        <div class="code-meta">
          <i class="fas fa-microchip"></i> ${code.category} &nbsp;•&nbsp; 
          <span style="color:${severityColor}">${code.severity}</span>
        </div>
      </div>
      <i class="fas fa-chevron-right"></i>
    `;

    // Важно: здесь вызываем твою функцию отображения деталей
    el.addEventListener("click", () => displayCodeDetail(code));
    resultsContainer.appendChild(el);
  });
}

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
  init3DBackground();
  initWizard();
  // Микроанимации для кнопок
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
    document.querySelectorAll(".code-item").forEach((item, i) => {
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.8) {
        item.style.transform = `translateY(${Math.sin(rect.top / 50) * 5}px)`;
      }
    });
  });
});
// Инициализация сложных 3D элементов
let scene, camera, renderer, carModel, particles;
const particleCount = 5000;

async function initAdvanced3D() {
  // Инициализация сцены
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("webgl-container").appendChild(renderer.domElement);

  // Система частиц
  const particleGeometry = new THREE.BufferGeometry();
  const positions = [];

  for (let i = 0; i < particleCount; i++) {
    positions.push(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
  }

  particleGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x0066b3,
    size: 0.02,
    transparent: true,
  });

  particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // Анимация
  function animate() {
    requestAnimationFrame(animate);
    particles.rotation.x += 0.001;
    particles.rotation.y += 0.001;
    shaderMaterial.uniforms.time.value += 0.01;
    renderer.render(scene, camera);
  }
  animate();
}

/* --- GLOBAL CLOSE FUNCTION (FIXED) --- */
window.hideDetail = function () {
  // Ищем элементы заново при каждом клике (самый надежный способ)
  const detailEl = document.getElementById("code-detail");
  const searchEl = document.getElementById("search-container");

  if (detailEl) detailEl.classList.add("hidden");
  if (searchEl) searchEl.classList.remove("hidden");

  // Сбрасываем выбранный код, если переменная существует
  if (typeof selectedCode !== "undefined") {
    selectedCode = null;
  }

  // Очищаем историю браузера
  history.pushState(
    "",
    document.title,
    window.location.pathname + window.location.search
  );

  // Прокручиваем страницу наверх
  window.scrollTo(0, 0);
};

// Initialize the app
init();
