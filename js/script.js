// ==========================================
// 1. GLOBAL STATE & DOM ELEMENTS
// ==========================================

// DOM Elements (Безопасный выбор)
const searchInput = document.getElementById("search-input");
const resultsContainer = document.getElementById("results-container");
const emptyState = document.getElementById("empty-state");
const noResults = document.getElementById("no-results");
const codeDetail = document.getElementById("code-detail");
const searchContainer = document.getElementById("search-container");
const languageToggle = document.getElementById("language-toggle");

// App State
let currentLanguage = localStorage.getItem('forumLanguage') || 'en';
let bmwCodes = [];
let selectedCode = null;
let chatOpen = false;
const state = {
    user: JSON.parse(localStorage.getItem('user')) || null
};

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
    partsBtn: "RealOEM (Parts)",
    catalogBtn: "Catalog Search",
    obdLabel: "OBD-II Code:",
    chatTitle: "BMW AI Expert",
    chatStatus: "Online • Ready to help",
    chatPlaceholder: "Ask me anything (e.g. 'Is it safe to drive?')...",
    footer: "BMW DTC Bot © 2026 • Diagnostic Data",
    loginBtn: "Login"
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
    partsBtn: "Запчасти (RealOEM)",
    catalogBtn: "Поиск в каталоге",
    obdLabel: "Код OBD-II:",
    chatTitle: "ИИ Эксперт BMW",
    chatStatus: "Онлайн • Готов помочь",
    chatPlaceholder: "Спросите (напр. 'Можно ли ехать?')...",
    footer: "BMW DTC Bot © 2026 • Диагностика",
    loginBtn: "Вход"
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
    partsBtn: "ნაწილები (RealOEM)",
    catalogBtn: "კატალოგში ძებნა",
    obdLabel: "OBD-II კოდი:",
    chatTitle: "BMW-ს AI ექსპერტი",
    chatStatus: "ონლაინ • მზად ვარ დასახმარებლად",
    chatPlaceholder: "იკითხეთ (მაგ. 'საშიშია?')...",
    footer: "BMW DTC Bot © 2026 • დიაგნოსტიკის კოდები",
    loginBtn: "შესვლა"
  },
};

// ==========================================
// 2. MAIN LOGIC (INIT & SEARCH)
// ==========================================

async function init() {
  try {
    // Загружаем базу кодов только если мы на главной (есть поиск)
    if (searchInput) {
        if (typeof getMockData === "function") {
          bmwCodes = getMockData();
        }
        const response = await fetch("../data/codes.json");
        if (response.ok) { const data = await response.json(); bmwCodes = [...bmwCodes, ...data.codes]; }
    }
    updateLanguage();
  } catch (error) {
    console.warn("Init error or no external JSON", error);
    updateLanguage();
  }
}

// === БЕЗОПАСНЫЕ СЛУШАТЕЛИ СОБЫТИЙ (Fix: Cannot read properties of null) ===
if(searchInput) {
    searchInput.addEventListener("input", handleSearch);
}

if(languageToggle) {
    languageToggle.addEventListener("click", () => {
        const langs = ["en", "ru", "ka"];
        let idx = langs.indexOf(currentLanguage);
        currentLanguage = langs[(idx + 1) % langs.length];
        localStorage.setItem('forumLanguage', currentLanguage);

        // Если мы на форуме, перезагрузим страницу для полного обновления UI
        if(window.location.pathname.includes('forum.html')) {
            window.location.reload();
        } else {
            updateLanguage();
            if (selectedCode) displayCodeDetail(selectedCode);
            else if(searchInput) handleSearch();
        }
    });
}

function updateLanguage() {
  const t = translations[currentLanguage];
  const langLabels = { en: "EN", ru: "RU", ka: "KA" };
  
  if (languageToggle) languageToggle.querySelector("span").textContent = langLabels[currentLanguage];
  
  // Обновляем тексты (только если элементы есть)
  if(document.getElementById("forum-btn-text")) document.getElementById("forum-btn-text").textContent = t.forumBtn;

  const savedBtn = document.querySelector('[data-i18n="savedBtn"]');
  if (savedBtn) savedBtn.textContent = t.savedBtn;
  
  const savedTitle = document.querySelector('[data-i18n="savedTitle"]');
  if (savedTitle) savedTitle.textContent = t.savedTitle;

  if (searchInput) searchInput.placeholder = t.searchPlaceholder;
  if (emptyState) {
      emptyState.querySelector(".message").textContent = t.emptyStateMessage;
      emptyState.querySelector(".sub-message").textContent = t.emptyStateSubMessage;
  }
  if (noResults) noResults.querySelector(".message").textContent = t.noResultsMessage;
  
  const footerP = document.querySelector("footer p");
  if (footerP) footerP.textContent = t.footer;

  // Обновление Чата
  const chatTitle = document.getElementById("chat-bot-title");
  if (chatTitle) chatTitle.textContent = t.chatTitle;

  const chatStatus = document.getElementById("bot-status-text");
  if (chatStatus) chatStatus.innerHTML = `<div class="status-dot"></div> ${t.chatStatus}`;

  const chatInput = document.getElementById("chat-input");
  if (chatInput) chatInput.placeholder = t.chatPlaceholder;
  
  // Обновление Форума (data-i18n)
  document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if(t[key]) {
          if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = t[key];
          else el.textContent = t[key];
      }
  });
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
      (c.pCodes && c.pCodes.some((p) => p.toLowerCase().includes(term)))
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
  const favorites = JSON.parse(localStorage.getItem('bmwFavorites')) || [];

  codes.forEach((code) => {
    const el = document.createElement("div");
    el.className = "code-item";
    const isFav = favorites.includes(code.code);
    const starClass = isFav ? "active" : "";
    let severityColor = "#f1c40f"; 
    if (code.severity === "High" || code.severity === "Critical") severityColor = "#e74c3c";
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
    el.querySelector('div[style*="flex: 1"]').onclick = () => displayCodeDetail(code);
    resultsContainer.appendChild(el);
  });
}

function displayCodeDetail(code) {
  selectedCode = code;
  const lang = currentLanguage;
  const t = translations[lang];

  searchContainer.classList.add("hidden");
  codeDetail.classList.remove("hidden");
  window.scrollTo(0, 0);

  const engine = code.engineCodes && code.engineCodes.length > 0 ? code.engineCodes[0] : "All";
  const category = code.category || "General";
  const pCodes = code.pCodes || [];
  const solutions = code.solutions && code.solutions[lang] ? code.solutions[lang] : [];
  const description = code.description && code.description[lang] ? code.description[lang] : "No description available";

  const pCodeHtml = pCodes.length > 0 ? `<div class="alt-code-badge">${t.obdLabel} <span>${pCodes.join(", ")}</span></div>` : "";

  codeDetail.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="hideDetail()"> <i class="fas fa-arrow-left"></i> </button>
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
        <ul>${solutions.map((s) => `<li>${s}</li>`).join("")}</ul>
        <div class="parts-buttons">
            <a href="https://www.google.com/search?q=${encodeURIComponent(`BMW ${engine} ${category} parts`)}" target="_blank" class="btn-part">
                <i class="fas fa-cogs"></i> ${t.partsBtn}
            </a>
            <a href="https://www.google.com/search?q=${encodeURIComponent(`BMW ${engine} parts catalog`)}" target="_blank" class="btn-part secondary">
                <i class="fas fa-book-open"></i> ${t.catalogBtn}
            </a>
        </div>
      </div>
    </div>
  `;
}

window.hideDetail = function () {
  const detailEl = document.getElementById("code-detail");
  const searchEl = document.getElementById("search-container");
  if (detailEl) detailEl.classList.add("hidden");
  if (searchEl) searchEl.classList.remove("hidden");
  selectedCode = null;
  window.scrollTo(0, 0);
};

// --- FAVORITES (ГЛОБАЛЬНО) ---
window.toggleFavorite = function(event, codeId) {
    if(event) event.stopPropagation();
    let favorites = JSON.parse(localStorage.getItem('bmwFavorites')) || [];
    if (favorites.includes(codeId)) favorites = favorites.filter(id => id !== codeId);
    else favorites.push(codeId);
    localStorage.setItem('bmwFavorites', JSON.stringify(favorites));
    if(searchInput) handleSearch(); 
    renderFavoritesList();
}

window.toggleFavoritesModal = function() {
    const modal = document.getElementById('favorites-modal');
    if(modal) {
        modal.classList.toggle('active');
        if (modal.classList.contains('active')) renderFavoritesList();
    }
}

function renderFavoritesList() {
    const list = document.getElementById('favorites-list');
    if(!list) return; // Проверка, если мы на странице, где нет этого элемента
    
    const favorites = JSON.parse(localStorage.getItem('bmwFavorites')) || [];
    const t = translations[currentLanguage];
    list.innerHTML = "";
    if (favorites.length === 0) {
        list.innerHTML = `<div class="empty-favs"><i class="far fa-folder-open"></i><p>${t.emptySaved}</p></div>`;
        return;
    }
    const savedCodes = bmwCodes.filter(c => favorites.includes(c.code));
    savedCodes.forEach(code => {
        const div = document.createElement('div');
        div.className = 'code-item';
        div.style.marginBottom = '10px';
        div.innerHTML = `
          <div style="flex: 1;" onclick="toggleFavoritesModal(); displayCodeDetail(selectedCodeRef)">
            <div class="code-header">
              <span class="code-identifier" style="color:#0066b3">${code.code}</span>
              <span class="code-title" style="font-size:14px">${code.title[currentLanguage]}</span>
            </div>
          </div>
          <button class="star-btn active" onclick="toggleFavorite(null, '${code.code}')">
            <i class="fas fa-trash"></i>
          </button>`;
        div.querySelector('div[style*="flex: 1"]').onclick = () => {
            toggleFavoritesModal();
            displayCodeDetail(code);
        };
        list.appendChild(div);
    });
}

// ==========================================
// 3. AUTH & GOOGLE (GLOBAL & FIXED)
// ==========================================

// Открытие модалки входа (Глобально)
window.toggleAuthModal = function() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        } else {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }
}

// Проверка сессии (вызывается при старте)
function checkUserSession() {
    // Обновляем кнопку в Хедере, если она есть
    const authBtn = document.getElementById('auth-btn'); 
    
    if (state.user) {
        if(authBtn) {
            authBtn.onclick = null;
            authBtn.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:14px;">${state.user.username}</span>
                    <img src="${state.user.avatar || './assets/icons/default-avatar.png'}" 
                         style="width:28px; height:28px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
                    <i class="fas fa-sign-out-alt" style="margin-left:5px; font-size:12px; opacity:0.7; cursor:pointer;" onclick="logout()"></i>
                </div>
            `;
        }
    }
}

window.logout = function() {
    localStorage.removeItem('user');
    window.location.reload();
}

// Инициализация Google Auth
function initGoogleAuth() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.warn("Google script not loaded yet");
        return;
    }
    
    try {
        google.accounts.id.initialize({
            client_id: "855371837949-nsnfceo82efbfb5hmdks9ifrs0ra07vv.apps.googleusercontent.com",
            callback: window.handleGoogleCredentialResponse
        });
        
        // Рендер кнопки, если контейнер существует
        const btnContainer = document.querySelector(".g_id_signin");
        if (btnContainer) {
            google.accounts.id.renderButton(
                btnContainer,
                { theme: "filled_blue", size: "large", width: "100%" }
            );
        }
    } catch (e) {
        console.error("Google Init Error:", e);
    }
}

// Глобальный Callback для Google
window.handleGoogleCredentialResponse = function(response) {
    console.log("Google Token Received");
    try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);

        const user = {
            id: payload.sub,
            username: payload.name,
            email: payload.email,
            avatar: payload.picture
        };

        localStorage.setItem('user', JSON.stringify(user));
        
        const modal = document.getElementById('auth-modal');
        if(modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        
        window.location.reload(); 

    } catch (e) {
        console.error("Auth process error", e);
        alert("Google Auth Failed");
    }
};

// ==========================================
// 4. AI CHAT EXPERT (SMART SCROLL & CLEANUP)
// ==========================================

// ... (Весь код чата оставлен БЕЗ ИЗМЕНЕНИЙ, он работает) ...
// Я вставлю его сюда, чтобы файл был полным.

function initWizard() {
  if (document.getElementById("wizard-widget")) return;
  const t = translations[currentLanguage];
  const wizardHTML = `
    <div id="wizard-widget">
      <div class="wizard-fab" id="wizard-fab" onclick="toggleChat()">
        <i class="fas fa-robot"></i><div class="chat-badge-new">1</div>
      </div>
      <div class="chat-window" id="chat-window">
        <div class="chat-header">
          <div class="bot-info">
            <div class="bot-avatar"><i class="fas fa-microchip"></i></div>
            <div>
              <div id="chat-bot-title" style="font-weight:bold; color:#fff;">${t.chatTitle}</div>
              <div class="bot-status" id="bot-status-text"><div class="status-dot"></div> ${t.chatStatus}</div>
            </div>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="chat-close-mobile" onclick="clearChat()" style="background:none; border:none; color:white; font-size:18px; opacity:0.7;" title="Clear Chat"><i class="fas fa-trash-alt"></i></button>
            <button class="chat-close-mobile" onclick="toggleChat()" style="background:none; border:none; color:white; font-size:20px;"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <div class="chat-body" id="chat-body"><div class="typing-indicator" id="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>
        <div class="chat-footer"><input type="text" id="chat-input" class="chat-input" placeholder="${t.chatPlaceholder}" autocomplete="off"><button class="chat-send-btn" onclick="handleUserMessage()"><i class="fas fa-paper-plane"></i></button></div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", wizardHTML);
  document.getElementById("chat-input").addEventListener("keypress", function (event) { if (event.key === "Enter") { event.preventDefault(); handleUserMessage(); } });
}

window.clearChat = function() {
    const chatBody = document.getElementById("chat-body");
    const messages = chatBody.querySelectorAll('.message, .chat-options, .chat-result-link');
    messages.forEach(el => el.remove());
    sendBotGreeting();
}

window.toggleChat = function () {
  const chatWindow = document.getElementById("chat-window"); const badge = document.querySelector(".chat-badge-new"); chatOpen = !chatOpen;
  if (chatOpen) {
    chatWindow.classList.add("active"); if(badge) badge.style.display = 'none'; document.getElementById("chat-input").focus();
    if (document.getElementById("chat-body").querySelectorAll(".message").length === 0) sendBotGreeting();
  } else { chatWindow.classList.remove("active"); }
};

function sendBotGreeting() {
  const lang = currentLanguage;
  let contextMsg = "";
  if (window.currentCarContext) {
      chatState.car = window.currentCarContext;
      const msgs = {
          en: `I see you are working on a <b>${chatState.car.model}</b>.`,
          ru: `Вижу, мы работаем с <b>${chatState.car.model}</b>.`,
          ka: `ვხედავ, მუშაობთ <b>${chatState.car.model}</b>-ზე.`
      };
      contextMsg = msgs[lang] + "<br>";
  }
  const greetings = {
    en: `${contextMsg}Hello! I'm your AI Diagnostic Assistant.`,
    ru: `${contextMsg}Привет! Я ИИ-диагност.`,
    ka: `${contextMsg}გამარჯობა! მე ვარ AI დიაგნოსტი.`
  };
  addMessage(greetings[lang], "bot");
  showQuickChips(); 
}

window.updateChatContext = function() {
    if(chatOpen && window.currentCarContext) {
        const lang = currentLanguage;
        const msg = { en: `Context updated: ${window.currentCarContext.model}`, ru: `Контекст обновлен: ${window.currentCarContext.model}`, ka: `კონტექსტი განახლდა` };
        addMessage(msg[lang], "bot");
        chatState.car = window.currentCarContext;
    }
}

window.handleUserMessage = function(overrideText = null) {
  const input = document.getElementById("chat-input"); 
  const text = overrideText || input.value.trim(); 
  if (!text) return;
  
  const oldChips = document.querySelectorAll('.chat-options');
  oldChips.forEach(chip => chip.remove());

  addMessage(text, "user"); 
  input.value = ""; 
  showTyping(true); 
  
  setTimeout(() => processSmartLogic(text), 800);
}

// === BRAINS (Simple Version for recovery) ===
function processSmartLogic(text) {
    const lowerText = text.toLowerCase();
    const lang = currentLanguage;

    const codeRegex = /\b([P|p][0-9A-Fa-f]{4}|[0-9A-Fa-f]{4,6})\b/;
    const codeMatch = text.match(codeRegex);

    if (codeMatch) {
        const detectedCode = codeMatch[0].toUpperCase();
        addMessage(`Code: <b>${detectedCode}</b>...`, "bot");
        setTimeout(() => performDatabaseSearch(detectedCode), 1000);
        return;
    }

    // Simple NLP
    if (lowerText.match(/hi|hello|привет/)) { addMessage(lang=='ru'?"Привет!":"Hello!", "bot"); return; }
    if (lowerText.match(/smoke|дым/)) { 
        addMessage(lang=='ru'?"Дым? Какого цвета? (Синий/Белый/Черный)":"Smoke color? (Blue/White/Black)", "bot");
        return; 
    }

    performDatabaseSearch(text);
}

function performDatabaseSearch(query) {
    const lang = currentLanguage;
    const lowerQuery = query.toLowerCase();
    
    let matches = bmwCodes.map((code) => {
        let score = 0;
        if (code.code.toLowerCase() === lowerQuery) score += 100;
        else if (code.code.toLowerCase().includes(lowerQuery)) score += 50;
        if (code.title[lang] && code.title[lang].toLowerCase().includes(lowerQuery)) score += 30;
        return { code, score };
    });

    const results = matches.filter((m) => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    showTyping(false);

    if (results.length > 0) {
        addMessage(lang=='ru'?"Нашел:":"Found:", "bot");
        const chatBody = document.getElementById("chat-body");
        const resultsDiv = document.createElement("div");
        resultsDiv.style.display = "flex"; resultsDiv.style.flexDirection = "column"; resultsDiv.style.gap = "8px";
        results.forEach((item) => {
            const btn = document.createElement("div");
            btn.className = "chat-result-link";
            btn.innerHTML = `<div style="flex:1;"><div class="chat-result-code">${item.code.code}</div><div style="font-size:12px;color:#ccc;">${item.code.title[lang]}</div></div><i class="fas fa-chevron-right"></i>`;
            btn.onclick = () => { toggleChat(); displayCodeDetail(item.code); };
            resultsDiv.appendChild(btn);
        });
        chatBody.appendChild(resultsDiv);
        scrollToBottom();
    } else {
        addMessage(lang=='ru'?"Не нашел.":"Not found.", "bot");
        setTimeout(showQuickChips, 1000);
    }
}

function addMessage(html, type) {
    const div = document.createElement("div"); div.className = `message ${type}`; div.innerHTML = html;
    const ind = document.getElementById("typing-indicator");
    if(ind) document.getElementById("chat-body").insertBefore(div, ind); else document.getElementById("chat-body").appendChild(div);
    scrollToBottom();
}
function showTyping(show) { const el = document.getElementById("typing-indicator"); if(el) el.style.display = show ? "flex" : "none"; scrollToBottom(); }
function scrollToBottom() { const b = document.getElementById("chat-body"); setTimeout(() => { b.scrollTop = b.scrollHeight; }, 50); }
function showQuickChips() {
    const lang = currentLanguage;
    const chips = [ {l:{en:"Smoke",ru:"Дым",ka:"ბოლი"},a:"smoke"}, {l:{en:"Vibration",ru:"Вибрация",ka:"ვიბრაცია"},a:"vibration"} ];
    const div = document.createElement("div"); div.className = "chat-options";
    chips.forEach(c => {
        const btn = document.createElement("button"); btn.className = "chat-option-btn"; btn.innerText = c.l[lang];
        btn.onclick = () => { div.remove(); addMessage(c.l[lang], "user"); showTyping(true); setTimeout(() => processSmartLogic(c.a), 600); };
        div.appendChild(btn);
    });
    const ind = document.getElementById("typing-indicator"); if(ind) document.getElementById("chat-body").insertBefore(div, ind);
    scrollToBottom();
}

// ==========================================
// 5. 3D BACKGROUND (Safe Init)
// ==========================================
function init3DBackground() {
  const container = document.getElementById("webgl-container");
  if (!container) return;
  
  // Очистка на случай перезагрузки
  container.innerHTML = "";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 1200;
  const posArray = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount * 3; i++) { posArray[i] = (Math.random() - 0.5) * 80; }
  
  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
  const material = new THREE.PointsMaterial({ size: 0.15, color: 0x0066b3, transparent: true, opacity: 0.8 });
  const particlesMesh = new THREE.Points(particlesGeometry, material);
  scene.add(particlesMesh);

  let mouseX = 0, mouseY = 0;
  window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX / window.innerWidth - 0.5;
    mouseY = event.clientY / window.innerHeight - 0.5;
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    particlesMesh.rotation.y = t * 0.05 + mouseX * 0.1;
    particlesMesh.rotation.x = mouseY * 0.5;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ЗАПУСК ВСЕГО
document.addEventListener("DOMContentLoaded", () => {
  init();
  initWizard();
  init3DBackground();
  
  // Инициализация Google, если скрипт уже загрузился
  if (typeof google !== 'undefined') {
      initGoogleAuth();
  }
});