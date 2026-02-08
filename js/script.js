// ==========================================
// 1. GLOBAL STATE & DOM ELEMENTS
// ==========================================

// DOM Elements
let cropperImage = new Image();
let baseScale = 1; // Базовый масштаб (чтобы фото влезло)
let zoomLevel = 1; // Множитель зума (от слайдера)
let cropperOffsetX = 0;
let cropperOffsetY = 0;
let isDragging = false;
let startX, startY;
let isNewImageSelected = false;
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
let debounceTimer;
// UI Text Translations
// Removed local translations object in favor of global APP_TRANSLATIONS in js/translations.js

// ==========================================
// 2. CORE FUNCTIONS
// ==========================================

function displayCodeDetail(code) {
  selectedCode = code;
  const lang = currentLanguage || "en";
  const t = APP_TRANSLATIONS[lang] || APP_TRANSLATIONS["en"];

  // FORUM COMPATIBILITY KEY:
  const forumModal = document.getElementById("code-detail-modal");
  
  if (forumModal) {
      // We are on forum page -> Open modal
      forumModal.classList.add("active");
      const codeDetail = document.getElementById("code-detail");
      if(codeDetail) codeDetail.classList.remove("hidden");
  } else {
      // Main page behavior
      if(searchContainer) searchContainer.classList.add("hidden");
      if(codeDetail) codeDetail.classList.remove("hidden");
      window.scrollTo(0, 0);
  }

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
  const t = APP_TRANSLATIONS[currentLanguage] || APP_TRANSLATIONS["en"];

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
  const forumModal = document.getElementById("code-detail-modal");

  if (forumModal) {
    forumModal.classList.remove("active");
    // Also clear content or reset if needed
  }

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
  const t = APP_TRANSLATIONS[lang];

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

window.updateChatbotUI = function () {
  const lang = currentLanguage || "en";
  const t = APP_TRANSLATIONS[lang] || APP_TRANSLATIONS["en"];

  // Update static elements
  const titleEl = document.getElementById("chat-bot-title");
  if (titleEl) titleEl.textContent = t.chatTitle;

  const inputEl = document.getElementById("chat-input");
  if (inputEl) inputEl.placeholder = t.chatPlaceholder;
  
  // Update status (complex structure)
  const statusEl = document.querySelector(".bot-status");
  if (statusEl) {
      statusEl.innerHTML = `<div class="status-dot"></div> ${t.chatStatus}`;
  }

  // Reset chat history to show greeting in new language
  const chatBody = document.getElementById("chat-body");
  if (chatBody) {
    // Keep typing indicator
    const indicator = document.getElementById("typing-indicator");
    chatBody.innerHTML = ""; 
    if(indicator) chatBody.appendChild(indicator);
    
    // Resend greeting
    sendBotGreeting();
  }
};

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
    chatWindow.classList.remove("active");
  }
};

// Close Chat on Outside Click
document.addEventListener('click', (e) => {
    const chatWindow = document.getElementById('chat-window');
    const fab = document.getElementById('wizard-fab');
    if (chatOpen && chatWindow && !chatWindow.contains(e.target) && !fab.contains(e.target)) {
        toggleChat();
    }
});

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



  // 2. SEARCH (FUSE.JS or MANUAL)
  let matches = [];

  if (typeof Fuse !== "undefined") {
     // === FUSE.JS FUZZY SEARCH ===
     const options = {
        keys: [
          { name: 'code', weight: 1.0 },
          { name: `title.${lang}`, weight: 0.8 },
          { name: `description.${lang}`, weight: 0.4 },
          { name: 'pCodes', weight: 0.9 }
        ],
        threshold: 0.35,
        ignoreLocation: true
     };
     const fuse = new Fuse(bmwCodes, options);
     // Fuse returns { item, score, refIndex }
     const fuseRes = fuse.search(query);
     // Convert to our format. Fuse score: 0 is perfect, 1 is mismatch.
     matches = fuseRes.map(r => ({ code: r.item, score: (1 - r.score) * 100 }));
  } 
  
  // FALLBACK if Fuse missing or no results (Manual Scan)
  if (matches.length === 0) {
      const terms = query.toLowerCase().split(" ").filter((t) => t.length > 2);
      if (terms.length === 0 && query.length > 0) terms.push(query.toLowerCase());

      matches = bmwCodes.map((code) => {
        let score = 0;
        if (code.code.toLowerCase().includes(query.toLowerCase())) score += 100;
        if (code.pCodes && code.pCodes.some((p) => p.toLowerCase().includes(query.toLowerCase()))) score += 100;

        terms.forEach((term) => {
          if (code.title[lang] && code.title[lang].toLowerCase().includes(term)) score += 10;
          if (code.description[lang] && code.description[lang].toLowerCase().includes(term)) score += 5;
          if (code.solutions[lang] && code.solutions[lang].join(" ").toLowerCase().includes(term)) score += 3;
        });
        return { code, score };
      });
  }

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

    // === "ASK COMMUNITY" BUTTON ===
    const askBtn = document.createElement("button");
    askBtn.className = "chat-option-btn";
    askBtn.style.background = "#e74c3c";
    askBtn.style.marginTop = "10px";
    askBtn.innerHTML = `<i class="fas fa-users"></i> Ask Community`;
    askBtn.onclick = () => {
       // Open new topic modal pre-filled
       // We can redirect to forum with params
       window.location.href = `/forum?new_topic=true&title=${encodeURIComponent(query)}`;
    };
    const chatBody = document.getElementById("chat-body");
    chatBody.insertBefore(askBtn, document.getElementById("typing-indicator"));

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
  const t = APP_TRANSLATIONS[currentLanguage];
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
// AUTH SYSTEM (Login & Register)
// ==========================================

// 1. Управление Модальным окном
function toggleAuthModal() {
  const modal = document.getElementById("auth-modal");
  modal.classList.toggle("active");
}

function switchAuthTab(tab) {
  // Переключение вкладок (Login / Register)
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".auth-form")
    .forEach((form) => form.classList.remove("active"));

  if (tab === "login") {
    document.querySelectorAll(".tab-btn")[0].classList.add("active");
    document.getElementById("login-form").classList.add("active");
  } else {
    document.querySelectorAll(".tab-btn")[1].classList.add("active");
    document.getElementById("register-form").classList.add("active");
  }
}

// 2. Логика Регистрации
// 2. Логика Регистрации

// --- Recovery Logic (Global Scope) ---
window.showRecoveryModal = function() {
  toggleAuthModal(); // Close auth modal
  const modal = document.getElementById("recovery-modal");
  if(modal) {
      modal.classList.add("active");
      document.getElementById("recovery-step-1").classList.add("active");
      document.getElementById("recovery-step-2").classList.remove("active");
      const msg = document.getElementById("rec-msg-1");
      if(msg) msg.textContent = "";
      document.getElementById("rec-email").value = "";
  }
};

window.closeRecoveryModal = function() {
  const modal = document.getElementById("recovery-modal");
  if(modal) modal.classList.remove("active");
};

function setupRegisterForm() {
  const regForm = document.getElementById("register-form");

  // Recovery Event Listeners (Ensure they attach even if regForm is missing)
  const step1 = document.getElementById("recovery-step-1");
  if (step1) {
      step1.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("rec-email").value;
        const msg = document.getElementById("rec-msg-1");
        const btn = e.target.querySelector("button");
        
        try {
            btn.textContent = "Checking...";
            msg.textContent = "";
            
            const res = await fetch("/api/auth/password-recovery/init", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ identifier: email }) // Updated payload key
            });
            
            const data = await res.json();
            
            if(res.ok) {
                // Store recovery token for next step
                window.recoveryToken = data.recovery_token;
                
                document.getElementById("recovery-step-1").classList.remove("active");
                document.getElementById("recovery-step-2").classList.add("active");
                
                const qMap = {
                    "first_pet": "What was your first pet's name?",
                    "mother_maiden": "What is your mother's maiden name?",
                    "first_car": "What was your first car model?",
                    "city_born": "In which city were you born?"
                };
                const qText = qMap[data.security_question] || data.security_question;
                const display = document.getElementById("rec-question-display");
                if(display) display.textContent = qText;
                
            } else {
                msg.textContent = data.error || "User not found";
                msg.style.color = "#e74c3c";
            }
        } catch(err) {
            console.error(err);
            msg.textContent = "Connection error";
        } finally {
            btn.textContent = "Continue";
        }
      });
  }

  const step2 = document.getElementById("recovery-step-2");
  if (step2) {
      step2.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("rec-email").value;
        const answer = document.getElementById("rec-answer").value;
        const newPassword = document.getElementById("rec-new-password").value;
        const msg = document.getElementById("rec-msg-2");
        const btn = e.target.querySelector("button");

        try {
            btn.textContent = "Resetting...";
            msg.textContent = "";
            
            // 1. Verify Answer -> Get Reset Token
            const verifyRes = await fetch("/api/auth/password-recovery/verify", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ 
                    recovery_token: window.recoveryToken,
                    security_answer: answer 
                })
            });
            
            const verifyData = await verifyRes.json();
            
            if (!verifyRes.ok) throw new Error(verifyData.error || "Incorrect answer");
            
            // 2. Reset Password using Reset Token
            const resetRes = await fetch("/api/auth/password-recovery/reset", {
                 method: "POST",
                 headers: {"Content-Type": "application/json"},
                 body: JSON.stringify({
                     reset_token: verifyData.reset_token,
                     new_password: newPassword
                 })
            });
            
            const resetData = await resetRes.json();
            
            if(resetRes.ok) {
                msg.textContent = "Success! Login now.";
                msg.style.color = "#2ecc71";
                // Clear token
                window.recoveryToken = null;
                
                setTimeout(() => {
                    closeRecoveryModal();
                    toggleAuthModal();
                }, 2000);
            } else {
                throw new Error(resetData.error || "Failed to reset password");
            }
        } catch(err) {
            console.error(err);
            msg.textContent = err.message || "Connection error";
            msg.style.color = "#e74c3c";
        } finally {
            btn.textContent = "Reset Password";
        }
      });
  }

  if (!regForm) return;

// Listeners moved to global scope setup
// ...

  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("reg-username").value;
    const firstName = document.getElementById("reg-first-name").value;
    const lastName = document.getElementById("reg-last-name").value;
    const age = parseInt(document.getElementById("reg-age").value);
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const question = document.getElementById("reg-question").value;
    const answer = document.getElementById("reg-answer").value;
    const msg = document.getElementById("reg-msg");

    if(!question || !answer) {
        msg.textContent = "Please select a security question and answer.";
        msg.style.color = "#e74c3c";
        return;
    }
    
    // Validate age
    if (age < 13 || age > 120) {
        msg.textContent = "Age must be between 13 and 120";
        msg.style.color = "#e74c3c";
        return;
    }

    msg.style.color = "#aaa";
    msg.textContent = "Processing...";
    const payload = {
          username,
          first_name: firstName,
          last_name: lastName,
          age,
          email,
          password,
          language: (typeof currentLanguage !== 'undefined') ? currentLanguage : "en",
          security_question: question,
          security_answer: answer
    };
    console.log("Sending Registration:", payload);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // currentLanguage берем из вашей переменной в script.js
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        msg.style.color = "#2ecc71";
        msg.textContent = "Success! Please login.";
        setTimeout(() => switchAuthTab("login"), 1500);
      } else {
        msg.style.color = "#e74c3c";
        msg.textContent = data.error || "Registration failed";
      }
    } catch (err) {
      msg.textContent = "Error: " + err.message;
    }
  });
}

// 3. Логика Входа
// 3. Логика Входа (ИСПРАВЛЕННАЯ)
function setupLoginForm() {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const msg = document.getElementById("login-msg");

    msg.textContent = "Signing in...";
    msg.style.color = "#aaa";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("user_data", JSON.stringify(data.user));
        await refreshUserData();
        checkAuthStatus();

        // Если мы на странице форума — обновляем сайдбар
        if (typeof updateSidebarUser === "function") {
          updateSidebarUser();
        }

        // Если мы внутри темы — показываем форму ответа
        const replyForm = document.getElementById("reply-form");
        const loginMsg = document.getElementById("login-to-reply");
        if (replyForm) replyForm.style.display = "flex";
        if (loginMsg) loginMsg.style.display = "none";

        // 3. Показываем успех и закрываем окно
        msg.style.color = "#2ecc71";
        msg.textContent = "Welcome!";

        setTimeout(() => {
          toggleAuthModal(); // Закрываем модалку
          // Очищаем форму
          document.getElementById("login-email").value = "";
          document.getElementById("login-password").value = "";
          msg.textContent = "";
        }, 1000);
      } else {
        msg.style.color = "#e74c3c";
        msg.textContent = data.error || "Invalid credentials";
      }
    } catch (err) {
      console.error(err);
      msg.textContent = "Connection error";
    }
  });
}

// 4. Проверка статуса (Обновление UI)
// 4. Проверка статуса (Обновление UI)
function checkAuthStatus() {
  const token = localStorage.getItem("auth_token");
  const user = JSON.parse(localStorage.getItem("user_data"));
  const authBtn = document.getElementById("auth-btn");

  if (!authBtn) return;

  // СБРОС КНОПКИ (Важно для корректного переключения без перезагрузки)
  // Мы возвращаем её в исходное состояние, а потом заполняем данными
  authBtn.innerHTML =
    '<i class="fas fa-user-circle"></i> <span id="btn-login-text">Login</span>';
  const btnText = document.getElementById("btn-login-text");

  if (token && user) {
    // Если вошли
    btnText.textContent = user.username;

    // Ставим аватарку
    if (user.avatar_url) {
      const icon = authBtn.querySelector("i");
      if (icon) {
        icon.outerHTML = `<img src="${user.avatar_url}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; margin-right:8px; border:1px solid rgba(255,255,255,0.2);">`;
      }
    }

    authBtn.onclick = (e) => {
      e.preventDefault();
      toggleProfileModal();
    };
  } else {
    // Если вышли
    if (btnText) btnText.textContent = "Login";
    authBtn.onclick = toggleAuthModal;
  }
}

// Глобальная функция выхода
window.logout = function () {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user_data");
  location.reload();
};

// ==========================================
// 4. MAIN LOGIC (INIT & SEARCH)
// ==========================================

// ==========================================
// 4. MAIN LOGIC (INIT & SEARCH)
// ==========================================

async function init() {
  try {
    await refreshUserData();
    // 1. Инициализация (как было)
    if (typeof getMockData === "function") bmwCodes = getMockData();
    const response = await fetch("/data/codes.json");
    if (response.ok) {
      const data = await response.json();
      bmwCodes = [...bmwCodes, ...data.codes];
    }
    setupRegisterForm();
    setupLoginForm();
    checkAuthStatus();
    setupEventListeners();
    updateLanguage();
    init3DBackground();
    initWizard();

    // 2. ЛОГИКА РЕДАКТОРА ФОТО (ИСПРАВЛЕННАЯ)
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");

    if (codeFromUrl) {
      const input = document.getElementById("search-input");
      if (input) {
        input.value = codeFromUrl; // Вставляем код в поле
        handleSearch(); // Запускаем поиск

        // Очищаем URL, чтобы при обновлении страницы поиск не сбрасывался (опционально)
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }
    const avatarInput = document.getElementById("avatar-upload");
    const canvas = document.getElementById("avatar-canvas");
    const ctx = canvas ? canvas.getContext("2d") : null;
    const slider = document.getElementById("zoom-slider");
    const previewContainer = document.getElementById("current-avatar-view");
    const canvasContainer = document.getElementById("canvas-container");
    const profileForm = document.getElementById("profile-form");

    // Функция: Сброс и расчет масштаба (ЧТОБЫ НЕ БЫЛО "СЛИШКОМ БЛИЗКО")
    function resetEditor() {
      if (!canvas || !cropperImage.width) return;

      // Считаем масштаб, чтобы картинка полностью покрыла круг (object-fit: cover)
      const scaleX = canvas.width / cropperImage.width;
      const scaleY = canvas.height / cropperImage.height;
      // Берем больший масштаб, чтобы не было пустых краев
      baseScale = Math.max(scaleX, scaleY);

      // Сброс позиций в центр
      zoomLevel = 1;
      if (slider) slider.value = 1;
      cropperOffsetX = 0;
      cropperOffsetY = 0;

      drawEditor();
    }

    // Initialize Mobile Menu
    initMobileMenu();



    // Функция: Отрисовка
    function drawEditor() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Маска круга
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2,
        0,
        Math.PI * 2,
        true,
      );
      ctx.closePath();
      ctx.clip();

      // Итоговый размер = Базовый (чтобы влезло) * Зум (от слайдера)
      const currentScale = baseScale * zoomLevel;

      const imgWidth = cropperImage.width * currentScale;
      const imgHeight = cropperImage.height * currentScale;

      // Центрирование (0,0 - это центр канваса) + Сдвиг пользователя
      const centerX = (canvas.width - imgWidth) / 2 + cropperOffsetX;
      const centerY = (canvas.height - imgHeight) / 2 + cropperOffsetY;

      ctx.drawImage(cropperImage, centerX, centerY, imgWidth, imgHeight);
      ctx.restore();
    }

    // Загрузка файла
    if (avatarInput) {
      avatarInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          cropperImage = new Image();
          cropperImage.src = evt.target.result;
          cropperImage.onload = () => {
            isNewImageSelected = true;
            if (previewContainer) previewContainer.style.display = "none";
            if (canvasContainer) canvasContainer.style.display = "block";
            resetEditor(); // <-- ВАЖНО: Считаем правильный масштаб
          };
        };
        reader.readAsDataURL(file);
      });
    }

    // Зум слайдер
    if (slider) {
      slider.addEventListener("input", (e) => {
        zoomLevel = parseFloat(e.target.value); // Теперь это множитель (1x ... 3x)
        drawEditor();
      });
    }

    // Перетаскивание
    if (canvas) {
      canvas.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
      });
      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        cropperOffsetX += e.clientX - startX;
        cropperOffsetY += e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;
        drawEditor();
      });
      window.addEventListener("mouseup", () => {
        isDragging = false;
      });
    }

    // Сохранение
    if (profileForm) {
      profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.querySelector(
          "#profile-form button[type='submit']",
        );
        const originalText = btn.textContent;
        btn.textContent = "Saving...";
        btn.disabled = true;

        const user = JSON.parse(localStorage.getItem("user_data"));
        
        // Get all form values
        const username = document.getElementById("profile-username")?.value;
        const email = document.getElementById("profile-email")?.value;
        const firstName = document.getElementById("profile-first-name")?.value;
        const lastName = document.getElementById("profile-last-name")?.value;
        const age = parseInt(document.getElementById("profile-age")?.value) || null;
        
        const city = document.getElementById("profile-city")?.value;
        const country = document.getElementById("profile-country")?.value;
        
        const carModel = document.getElementById("profile-car")?.value;
        const bmwYear = parseInt(document.getElementById("profile-year")?.value) || null;
        const bmwBody = document.getElementById("profile-body")?.value;
        const bmwEngine = document.getElementById("profile-engine")?.value;
        
        const bio = document.getElementById("profile-bio")?.value;
        const currentPassword = document.getElementById("profile-password-confirm")?.value;
        
        console.log("DEBUG FORM VALUES:", {
          username,
          email,
          firstName,
          lastName,
          age,
          carModel,
          bio,
          currentPassword: currentPassword ? "***" : "(empty)"
        });
        
        // Validate password is provided
        if (!currentPassword) {
          alert("Please enter your current password to save changes");
          btn.textContent = originalText;
          btn.disabled = false;
          return;
        }
        
        // Validate age
        if (age && (age < 13 || age > 120)) {
          alert("Age must be between 13 and 120");
          btn.textContent = originalText;
          btn.disabled = false;
          return;
        }

        let finalAvatarUrl = user.avatar_url;

        try {
          // Если есть новое фото -> сохраняем
          if (isNewImageSelected && canvas) {
            const blob = await new Promise((resolve) =>
              canvas.toBlob(resolve, "image/webp", 0.8),
            );
            const formData = new FormData();
            formData.append("file", blob, "avatar.webp");

            const upRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });
            const upData = await upRes.json();
            if (upData.url) finalAvatarUrl = upData.url;
          }

          // Обновляем профиль с подтверждением пароля
          const updateRes = await fetch("/api/user/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: user.id,
              current_password: currentPassword,
              username,
              email,
              first_name: firstName,
              last_name: lastName,
              age,
              city,
              country,
              avatar_url: finalAvatarUrl,
              car_model: carModel,
              bmw_year: bmwYear,
              bmw_body: bmwBody,
              bmw_engine: bmwEngine,
              bio,
            }),
          });

          const updateData = await updateRes.json();
          
          if (updateRes.ok && updateData.success) {
            // Clear password field
            document.getElementById("profile-password-confirm").value = "";
            
            // Refresh user data
            await refreshUserData();
            
            alert("Profile updated successfully!");
            
            // Reload if username changed (affects display everywhere)
            if (username !== user.username) {
              location.reload();
            } else {
              // Just close modal and update UI
              toggleProfileModal();
              checkAuthStatus();
            }
          } else {
            alert("Error: " + (updateData.error || "Update failed"));
          }
        } catch (err) {
          console.error(err);
          alert("Error saving profile");
        } finally {
          btn.textContent = originalText;
          btn.disabled = false;
        }
      });
    }
  } catch (error) {
    console.warn("Init error", error);
    // Даже при ошибке загрузки JSON запускаем основные функции
    setupEventListeners();
    updateLanguage();
  }
}

// Запускаем
document.addEventListener("DOMContentLoaded", init);

function setupEventListeners() {
  // 1. Поиск (только если есть input)
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleSearch(e.target.value), 300);
    });
  }

  // 2. VIN Input (только если есть)
  const vinInput = document.getElementById("vin-input");
  if (vinInput) {
    vinInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleVinSearch();
    });
  }

  // 3. Переключатель языка (ВАЖНО: Добавлена проверка if)
  if (languageToggle) {
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
}

function updateLanguage() {
  const langLabels = { en: "EN", ru: "RU", ka: "KA" };

  // 1. Обновляем кнопку языка (если она есть)
  if (languageToggle) {
    const span = languageToggle.querySelector("span");
    if (span) span.textContent = langLabels[currentLanguage];
  }

  const text = APP_TRANSLATIONS[currentLanguage];

  // 2. Обновляем поиск (если он есть)
  if (searchInput) {
    searchInput.placeholder = text.searchPlaceholder;
  }

  // 3. Безопасное обновление текстовых элементов
  // Эта мини-функция проверяет, существует ли элемент, прежде чем менять текст
  const safeSetText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  safeSetText("#empty-state .message", text.emptyStateMessage);
  safeSetText("#empty-state .sub-message", text.emptyStateSubMessage);
  safeSetText("#no-results .message", text.noResultsMessage);
  safeSetText("footer p", text.footer);

  // Обновляем чат
  updateChatUI();
  
  // Re-render mobile menu with new language
  if (typeof initMobileMenu === 'function') {
      initMobileMenu();
  }
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
  if (typeof THREE === "undefined") {
    // Retry initialization if library is not ready
    setTimeout(init3DBackground, 100);
    return;
  }
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

// === В КОНЕЦ ФАЙЛА script.js ===

// Глобальная функция открытия/закрытия профиля
window.toggleProfileModal = async function () {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  modal.classList.toggle("active");

  if (modal.classList.contains("active")) {
    // СНАЧАЛА подтягиваем свежие данные из базы
    await refreshUserData();

    // ПОТОМ читаем уже обновлённые данные
    const user = JSON.parse(localStorage.getItem("user_data"));

    if (user) {
      // Заполняем все поля
      const usernameInput = document.getElementById("profile-username");
      const emailInput = document.getElementById("profile-email");
      const firstNameInput = document.getElementById("profile-first-name");
      const lastNameInput = document.getElementById("profile-last-name");
      const ageInput = document.getElementById("profile-age");
      const carInput = document.getElementById("profile-car");
      const bioInput = document.getElementById("profile-bio");
      
      if (usernameInput) usernameInput.value = user.username || "";
      if (emailInput) emailInput.value = user.email || "";
      if (firstNameInput) firstNameInput.value = user.first_name || "";
      if (lastNameInput) lastNameInput.value = user.last_name || "";
      if (ageInput) ageInput.value = user.age || "";
      if (carInput) carInput.value = user.car_model || "";
      if (bioInput) bioInput.value = user.bio || "";
      
      // New Fields
      const cityInput = document.getElementById("profile-city");
      const countryInput = document.getElementById("profile-country");
      const yearInput = document.getElementById("profile-year");
      const bodyInput = document.getElementById("profile-body");
      const engineInput = document.getElementById("profile-engine");
      
      if (cityInput) cityInput.value = user.city || "";
      if (countryInput) countryInput.value = user.country || "";
      if (yearInput) yearInput.value = user.bmw_year || "";
      if (bodyInput) bodyInput.value = user.bmw_body || "";
      if (engineInput) engineInput.value = user.bmw_engine || "";
      
      // Clear password field
      const passwordInput = document.getElementById("profile-password-confirm");
      if (passwordInput) passwordInput.value = "";

      // Сбрасываем редактор фото в начальное состояние
      const previewContainer = document.getElementById("current-avatar-view");
      const canvasContainer = document.getElementById("canvas-container");
      const previewImg = document.getElementById("profile-preview-img");

      // Сброс глобальных переменных редактора
      isNewImageSelected = false;

      if (previewContainer) previewContainer.style.display = "block";
      if (canvasContainer) canvasContainer.style.display = "none";

      // Показываем текущую аватарку
      if (previewImg) {
        if (user.avatar_url) {
          previewImg.src = user.avatar_url;
        } else {
          // Генерация буквы, если нет фото
          previewImg.src = `https://ui-avatars.com/api/?name=${user.username}&background=random&color=fff`;
        }
      }
    }
  }
};

// Функция синхронизации данных профиля
// === В КОНЕЦ ФАЙЛА script.js ===

async function refreshUserData() {
  const user = JSON.parse(localStorage.getItem("user_data"));
  if (!user) return; // Если не залогинен - выходим

  try {
    // Check and fix bad avatar URL in local cache immediately
    if (user.avatar_url && user.avatar_url.includes('avatar-placeholder.png')) {
        user.avatar_url = './assets/icons/ico.svg';
        localStorage.setItem("user_data", JSON.stringify(user));
    }

    // Запрашиваем свежие данные из базы (с anti-cache)
    const res = await fetch(`/api/user/get?id=${user.id}&t=${Date.now()}`);
    
    if (res.status === 404) {
        console.warn("User ID not found in DB (stale session). Logging out.");
        logout(); // Assumes logout() is globally available or defined in script.js
        return;
    }

    if (res.ok) {
      const freshUser = await res.json();

      // Сравниваем только важные поля, чтобы избежать перезагрузки из-за таймстампов
      const importantKeys = ['username', 'avatar_url', 'reputation', 'role', 'email'];
      const hasChanges = importantKeys.some(key => freshUser[key] !== user[key]);

      if (hasChanges) {
        console.log("Updating user profile cache...");
        // Сохраняем полный объект, но триггерим UI только при важных изменениях
        localStorage.setItem("user_data", JSON.stringify(freshUser));

        // Обновляем шапку сайта сразу же
        checkAuthStatus();
        // Если мы на странице форума - обновляем сайдбар и хедер
        if (typeof updateSidebarUser === "function") updateSidebarUser();
        if (typeof updateHeaderAuth === "function") updateHeaderAuth();
      } else {
        // Если изменились только таймстампы, просто тихо обновляем сторадж
        if (JSON.stringify(freshUser) !== JSON.stringify(user)) {
             localStorage.setItem("user_data", JSON.stringify(freshUser));
        }
      }
    }
  } catch (e) {
    console.warn("Failed to refresh user data", e);
  }
}

// === SERVICE WORKER REGISTRATION (PWA) ===
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered");
      })
      .catch((err) => {
        console.log("SW registration failed: ", err);
      });
  });
}

// === AUTO-REFRESH USER DATA ===
// Custom Alert & Confirm Implementation
function createCustomModal(type) {
    let overlay = document.querySelector('.custom-alert-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay'; // Reuses existing styles
        document.body.appendChild(overlay);
    }
    
    // Reset content for new usage
    overlay.innerHTML = `
        <div class="custom-alert-box">
            <div class="custom-alert-icon"><i class="fas"></i></div>
            <div class="custom-alert-message"></div>
            <div class="custom-alert-actions"></div>
        </div>
    `;
    
    const icon = overlay.querySelector('.custom-alert-icon i');
    if (type === 'error') {
        icon.className = 'fas fa-exclamation-circle';
        icon.style.color = '#e74c3c';
    } else if (type === 'success') {
        icon.className = 'fas fa-check-circle';
        icon.style.color = '#2ecc71';
    } else if (type === 'confirm') {
        icon.className = 'fas fa-question-circle';
        icon.style.color = '#f1c40f';
    } else {
        icon.className = 'fas fa-info-circle';
        icon.style.color = '#0066b3';
    }
    
    return overlay;
}

function showCustomAlert(message, type = 'info') {
    return new Promise((resolve) => {
        const overlay = createCustomModal(type);
        overlay.querySelector('.custom-alert-message').textContent = message;
        
        const btn = document.createElement('button');
        btn.className = 'custom-alert-btn';
        btn.textContent = 'OK';
        btn.onclick = () => {
            closeCustomModal();
            resolve();
        };
        
        overlay.querySelector('.custom-alert-actions').appendChild(btn);
        
        // Show
        setTimeout(() => overlay.classList.add('active'), 10);
    });
}

function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const overlay = createCustomModal('confirm');
        overlay.querySelector('.custom-alert-message').textContent = message;
        
        const actions = overlay.querySelector('.custom-alert-actions');
        
        const btnCancel = document.createElement('button');
        btnCancel.className = 'custom-alert-btn cancel';
        btnCancel.textContent = 'Cancel';
        btnCancel.onclick = () => {
            closeCustomModal();
            resolve(false);
        };
        
        const btnOk = document.createElement('button');
        btnOk.className = 'custom-alert-btn';
        btnOk.textContent = 'Confirm';
        btnOk.onclick = () => {
            closeCustomModal();
            resolve(true);
        };
        
        actions.appendChild(btnCancel);
        actions.appendChild(btnOk);
        
        setTimeout(() => overlay.classList.add('active'), 10);
    });
}

function closeCustomModal() {
    const overlay = document.querySelector('.custom-alert-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
    }
}

// Override native alert
window.alert = function(msg) {
    showCustomAlert(msg);
};

// Start of original script
document.addEventListener("DOMContentLoaded", () => {
  if (typeof refreshUserData === "function") {
    refreshUserData();
  }


  // Check for search params
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get("code");
  if (codeParam && searchInput) {
      searchInput.value = codeParam;
      
      // Poll until bmwCodes is populated
      const checkData = setInterval(() => {
          if (bmwCodes && bmwCodes.length > 0) {
              clearInterval(checkData);
              if (typeof handleSearch === "function") handleSearch();
          }
      }, 100);
      
      // Safety timeout to stop polling
      setTimeout(() => clearInterval(checkData), 5000);
  }
});

// ==========================================
// 5. BADGE SYSTEM
// ==========================================
window.getReputationBadge = function(reputation, role) {
    if (role === 'admin_role') {
        return '<span class="user-badge badge-admin"><i class="fas fa-shield-alt"></i> Admin</span>';
    }
    
    const rep = parseInt(reputation) || 0;
    
    if (rep >= 50) {
        return '<span class="user-badge badge-expert"><i class="fas fa-star"></i> Expert</span>';
    } else if (rep >= 10) {
        return '<span class="user-badge badge-pro"><i class="fas fa-wrench"></i> Pro</span>';
    } else {
        return '<span class="user-badge badge-newcomer"><i class="fas fa-user"></i> Member</span>';
    }
};

// ==========================================
// 6. MOBILE MENU LOGIC
// ==========================================
window.toggleMobileMenu = function() {
    const offcanvas = document.querySelector('.mobile-offcanvas');
    const overlay = document.querySelector('.mobile-menu-overlay');
    if (offcanvas && overlay) {
        offcanvas.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = offcanvas.classList.contains('active') ? 'hidden' : '';
    }
};

window.initMobileMenu = function() {
    const menuContent = document.getElementById('mobile-menu-content');
    if (!menuContent) return;
    
    // Clear previous usage if needed
    menuContent.innerHTML = '';
    
    // 0. Manual Navigation Links (Fallback if no sidebar)
    const topicPageNav = document.querySelector('.mobile-offcanvas .nav-item');
    if (topicPageNav) {
         menuContent.appendChild(topicPageNav); // Keep the back button if it was there
    }

    // Clear existing content to allow re-rendering
    menuContent.innerHTML = '';

    // 1. Clone Navigation items from Sidebar (if exists)
    const sidebarNav = document.querySelector('.sidebar .nav-menu');
    if (sidebarNav) {
        const navClone = sidebarNav.cloneNode(true);
        navClone.style.marginTop = "0";
        navClone.style.flexDirection = "column";
        
        // Remove 'active' class duplication issues if needed
        navClone.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function(e) {
                 // Close menu on click
                 toggleMobileMenu();
            });
        });
        
        menuContent.appendChild(navClone);
    }

    // 2. Clone User Info / Auth Buttons
    const authContainer = document.createElement('div');
    authContainer.style.marginTop = '20px';
    authContainer.style.paddingTop = '20px';
    authContainer.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    
    // Safely get user data
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem("user_data"));
    } catch(e) {}

    const t = (typeof APP_TRANSLATIONS !== 'undefined' && APP_TRANSLATIONS[currentLanguage]) 
        ? APP_TRANSLATIONS[currentLanguage] 
        : {
            loginRegister: "Login / Register",
            profile: "Profile",
            logout: "Logout"
        };


    if (user) {
         authContainer.innerHTML = `
             <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
                 <img src="${user.avatar_url || ''}" onerror="this.onerror=null; this.src='./assets/icons/ico.svg'" style="width:40px; height:40px; border-radius:50%; background:#333; object-fit:cover;">
                 <div>
                     <div style="font-weight:bold; color:white;">${user.username}</div>
                     <div style="font-size:12px; color:#aaa;">${user.email}</div>
                 </div>
             </div>
             <a href="/profile" class="btn" style="width:100%; justify-content:center; margin-bottom:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1); display:flex;">
                <i class="fas fa-user-circle"></i> ${t.profile}
             </a>
             <button onclick="logout()" class="btn" style="width:100%; justify-content:center; background:rgba(231, 76, 60, 0.2); color:#e74c3c; border:1px solid rgba(231, 76, 60, 0.3); display:flex;">
                <i class="fas fa-sign-out-alt"></i> ${t.logout}
             </button>
         `;
    } else {
         authContainer.innerHTML = `
             <button class="btn" onclick="toggleMobileMenu(); toggleAuthModal()" style="width:100%; justify-content:center; background:var(--bmw-blue); border:none; display:flex;">
                 <i class="fas fa-sign-in-alt"></i> ${t.loginRegister}
             </button>
         `;
    }
    
    menuContent.appendChild(authContainer);
    
    // 3. Clone Language Toggle
    const langToggle = document.getElementById('forum-language-toggle');
    const topicLangToggle = document.getElementById('topic-language-toggle');
    const targetToggle = langToggle || topicLangToggle;
    
    if(targetToggle) {
        const langClone = targetToggle.cloneNode(true);
        langClone.onclick = () => {
             if (typeof switchForumLanguage === 'function') switchForumLanguage();
             else if (typeof switchTopicLanguage === 'function') switchTopicLanguage();
        };
        langClone.style.marginTop = "20px";
        langClone.style.width = "100%";
        langClone.style.display = "flex";
        authContainer.appendChild(langClone);
    }
};
