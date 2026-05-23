/**
 * BimmerCodes AI assistant widget — calls /api/ai/chat (hybrid cascade on the edge).
 */
(function () {
  "use strict";

  const STORAGE_KEY = "bc_ai_chat_history";
  const LANG_KEY = "forumLanguage";
  const CLIENT_DAILY_KEY = "bc_ai_daily";
  const CLIENT_DAILY_MAX = 40;

  function getLang() {
    const l = localStorage.getItem(LANG_KEY) || localStorage.getItem("language") || "en";
    return ["en", "ru", "ka"].includes(l) ? l : "en";
  }

  const FALLBACK = {
    en: {
      chatTitle: "BimmerCodes AI Assistant",
      chatStatus: "Free · EN / RU / KA · fault codes & coding",
      chatPlaceholder: "Ask about a code (P0301, 118001) or symptoms…",
      chatWelcome:
        "Hi! I help with BMW/Mini fault codes, symptoms, and BimmerCode topics. Send a DTC or describe the issue — I'll reply in your language.",
      chatSend: "Send",
      chatClose: "Close chat",
      chatOpenLabel: "Open AI assistant",
      chatThinking: "Thinking…",
      chatError: "Could not reach the assistant. Please try again in a moment.",
      chatLimitReached: "Daily free limit reached. Try again tomorrow.",
      chatLimitHint: "Free messages left today: {n}",
      chatLimitModalTitle: "Free AI messages used up",
      chatLimitModalBody:
        "You've reached today's limit for the assistant. Ask the community on the forum — real owners and techs share diagnostics, coding tips, and fixes from experience.",
      chatLimitModalForumBtn: "Ask on the forum",
      chatLimitModalLaterBtn: "Maybe later",
    },
    ru: {
      chatTitle: "AI-ассистент BimmerCodes",
      chatStatus: "Бесплатно · RU / EN / KA · коды и кодирование",
      chatPlaceholder: "Спросите про код (P0301, 118001) или симптомы…",
      chatWelcome:
        "Привет! Помогу с кодами ошибок BMW/Mini, симптомами и BimmerCode. Пришлите DTC или опишите проблему — отвечу на вашем языке.",
      chatSend: "Отправить",
      chatClose: "Закрыть чат",
      chatOpenLabel: "Открыть AI-ассистента",
      chatThinking: "Думаю…",
      chatError: "Не удалось связаться с ассистентом. Попробуйте чуть позже.",
      chatLimitReached: "Дневной бесплатный лимит исчерпан. Зайдите завтра.",
      chatLimitHint: "Бесплатных сообщений сегодня: {n}",
      chatLimitModalTitle: "Бесплатные сообщения ассистенту закончились",
      chatLimitModalBody:
        "На сегодня лимит исчерпан. Задайте вопрос на форуме — участники подскажут по диагностике, кодированию и реальным случаям из практики.",
      chatLimitModalForumBtn: "Спросить на форуме",
      chatLimitModalLaterBtn: "Позже",
    },
    ka: {
      chatTitle: "BimmerCodes AI ასისტენტი",
      chatStatus: "უფასო · KA / RU / EN · კოდები და კოდირება",
      chatPlaceholder: "კოდი ან სიმპტომი (P0301, 118001)…",
      chatWelcome:
        "გამარჯობა! დაგეხმარებით BMW/Mini შეცდომის კოდებში, სიმპტომებსა და BimmerCode-ში. გამოგიგზავნეთ DTC ან აღწერეთ პრობლემა — ვუპასუხებთ თქვენს ენაზე.",
      chatSend: "გაგზავნა",
      chatClose: "ჩატის დახურვა",
      chatOpenLabel: "AI ასისტენტის გახსნა",
      chatThinking: "ვფიქრობ…",
      chatError: "ასისტენტთან კავშირი ვერ მოხერხდა. სცადეთ მოგვიანებით.",
      chatLimitReached: "დღიური უფასო ლიმიტი ამოიწურა. ხვალ სცადეთ.",
      chatLimitHint: "დღეს დარჩენილი უფასო შეტყობინება: {n}",
      chatLimitModalTitle: "უფასო შეტყობინებების ლიმიტი ამოიწურა",
      chatLimitModalBody:
        "დღევანდელი ლიმიტი ამოიწურა. დასვით კითხვა ფორუმზე — მონაწილეები დაგეხმარებიან დიაგნოსტიკასა და კოდირებაში პრაქტიკული გამოცდილებით.",
      chatLimitModalForumBtn: "ფორუმზე კითხვა",
      chatLimitModalLaterBtn: "მოგვიანებით",
    },
  };

  const FORUM_NEW_TOPIC_URL = "/forum.html?new=1";

  function t(key) {
    const lang = getLang();
    const T = window.APP_TRANSLATIONS || {};
    return (
      (T[lang] && T[lang][key]) ||
      (T.en && T.en[key]) ||
      (FALLBACK[lang] && FALLBACK[lang][key]) ||
      FALLBACK.en[key] ||
      key
    );
  }

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(messages) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch (_) {}
  }

  function clientDailyRemaining() {
    const data = readClientUsage();
    return Math.max(0, CLIENT_DAILY_MAX - data.count);
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function readClientUsage() {
    try {
      const raw = localStorage.getItem(CLIENT_DAILY_KEY);
      const today = todayKey();
      if (!raw) return { date: today, count: 0 };
      const data = JSON.parse(raw);
      if (data.date !== today) return { date: today, count: 0 };
      return { date: today, count: Math.max(0, Number(data.count) || 0) };
    } catch {
      return { date: todayKey(), count: 0 };
    }
  }

  function writeClientUsage(count) {
    try {
      localStorage.setItem(
        CLIENT_DAILY_KEY,
        JSON.stringify({ date: todayKey(), count: Math.max(0, count) })
      );
    } catch (_) {}
  }

  function bumpClientDaily() {
    const data = readClientUsage();
    writeClientUsage(data.count + 1);
  }

  function syncClientUsageFromServer(used) {
    if (typeof used !== "number" || used < 0) return;
    writeClientUsage(used);
  }

  function reconcileClientUsageFromHistory() {
    const userMsgs = history.filter((m) => m.role === "user").length;
    const data = readClientUsage();
    writeClientUsage(Math.max(data.count, userMsgs));
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** Shared refs after mount — used by updateChatContext */
  let ui = null;
  let limitModal = null;
  let history = [];
  let busy = false;

  function isDailyLimitExhausted() {
    return clientDailyRemaining() <= 0;
  }

  function setChatInputLocked(locked) {
    if (!ui) return;
    ui.input.disabled = locked;
    ui.sendBtn.disabled = locked || busy;
    if (locked) ui.sendBtn.classList.add("bc-ai-send--locked");
    else ui.sendBtn.classList.remove("bc-ai-send--locked");
  }

  function mountLimitModal() {
    if (document.getElementById("bc-ai-limit-modal")) return;

    const el = document.createElement("div");
    el.id = "bc-ai-limit-modal";
    el.className = "bc-ai-limit-modal";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "bc-ai-limit-modal-title");
    el.innerHTML = `
      <div class="bc-ai-limit-modal__backdrop" data-bc-ai-limit-dismiss></div>
      <div class="bc-ai-limit-modal__card">
        <button type="button" class="bc-ai-limit-modal__close" data-bc-ai-limit-dismiss aria-label="${escHtml(t("chatClose"))}">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
        <div class="bc-ai-limit-modal__icon" aria-hidden="true">
          <i class="fas fa-users"></i>
        </div>
        <h2 class="bc-ai-limit-modal__title" id="bc-ai-limit-modal-title"></h2>
        <p class="bc-ai-limit-modal__body" id="bc-ai-limit-modal-body"></p>
        <div class="bc-ai-limit-modal__actions">
          <a class="bc-ai-limit-modal__cta" id="bc-ai-limit-forum-link" href="${FORUM_NEW_TOPIC_URL}">
            <i class="fas fa-comments" aria-hidden="true"></i>
            <span id="bc-ai-limit-forum-label"></span>
          </a>
          <button type="button" class="bc-ai-limit-modal__ghost" id="bc-ai-limit-later"></button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    limitModal = {
      root: el,
      title: document.getElementById("bc-ai-limit-modal-title"),
      body: document.getElementById("bc-ai-limit-modal-body"),
      forumLabel: document.getElementById("bc-ai-limit-forum-label"),
      laterBtn: document.getElementById("bc-ai-limit-later"),
      forumLink: document.getElementById("bc-ai-limit-forum-link"),
    };

    el.querySelectorAll("[data-bc-ai-limit-dismiss]").forEach((node) => {
      node.addEventListener("click", hideLimitModal);
    });
    limitModal.laterBtn.addEventListener("click", hideLimitModal);

    limitModal.forumLink.addEventListener("click", (e) => {
      if (window.location.pathname.replace(/\/$/, "").endsWith("/forum.html")) {
        e.preventDefault();
        hideLimitModal();
        if (typeof window.openNewTopicModal === "function") {
          window.openNewTopicModal();
        }
      }
    });

    window.hideBcAiLimitModal = hideLimitModal;
  }

  function applyLimitModalLocale() {
    if (!limitModal) return;
    limitModal.title.textContent = t("chatLimitModalTitle");
    limitModal.body.textContent = t("chatLimitModalBody");
    limitModal.forumLabel.textContent = t("chatLimitModalForumBtn");
    limitModal.laterBtn.textContent = t("chatLimitModalLaterBtn");
    limitModal.forumLink.setAttribute("href", FORUM_NEW_TOPIC_URL);
  }

  function showLimitModal() {
    if (!limitModal) mountLimitModal();
    applyLimitModalLocale();
    limitModal.root.classList.add("is-visible");
    document.body.style.overflow = "hidden";
    limitModal.laterBtn.focus();
  }

  function hideLimitModal() {
    if (!limitModal) return;
    limitModal.root.classList.remove("is-visible");
    document.body.style.overflow = "";
  }

  function handleDailyLimitHit() {
    setChatInputLocked(true);
    updateLimitLabel(0);
    appendBot(t("chatLimitReached"));
    showLimitModal();
  }

  function mountWidget() {
    if (document.getElementById("bc-ai-root")) return;

    const root = document.createElement("div");
    root.id = "bc-ai-root";
    root.innerHTML = `
      <button type="button" class="bc-ai-fab" id="bc-ai-fab" aria-label="${escHtml(t("chatOpenLabel"))}">
        <i class="fas fa-robot" aria-hidden="true"></i>
      </button>
      <div class="bc-ai-panel" id="bc-ai-panel" role="dialog" aria-labelledby="bc-ai-title" aria-hidden="true">
        <div class="bc-ai-panel__head">
          <div>
            <p class="bc-ai-panel__title" id="bc-ai-title">${escHtml(t("chatTitle"))}</p>
            <p class="bc-ai-panel__status" id="bc-ai-status">${escHtml(t("chatStatus"))}</p>
          </div>
          <button type="button" class="bc-ai-panel__close" id="bc-ai-close" aria-label="${escHtml(t("chatClose"))}">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <div class="bc-ai-messages" id="bc-ai-messages"></div>
        <p class="bc-ai-limit" id="bc-ai-limit"></p>
        <form class="bc-ai-form" id="bc-ai-form">
          <textarea class="bc-ai-input" id="bc-ai-input" rows="1" maxlength="2000"
            placeholder="${escHtml(t("chatPlaceholder"))}"></textarea>
          <button type="submit" class="bc-ai-send" id="bc-ai-send" aria-label="${escHtml(t("chatSend"))}">
            <i class="fas fa-paper-plane" aria-hidden="true"></i>
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(root);

    history = loadHistory();
    reconcileClientUsageFromHistory();

    ui = {
      fab: document.getElementById("bc-ai-fab"),
      panel: document.getElementById("bc-ai-panel"),
      closeBtn: document.getElementById("bc-ai-close"),
      title: document.getElementById("bc-ai-title"),
      status: document.getElementById("bc-ai-status"),
      messagesEl: document.getElementById("bc-ai-messages"),
      form: document.getElementById("bc-ai-form"),
      input: document.getElementById("bc-ai-input"),
      sendBtn: document.getElementById("bc-ai-send"),
      limitEl: document.getElementById("bc-ai-limit"),
    };

    ui.fab.addEventListener("click", () => setOpen(!ui.panel.classList.contains("is-open")));
    ui.closeBtn.addEventListener("click", () => setOpen(false));

    ui.form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });

    // Enter — отправить, Shift+Enter — новая строка
    ui.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (typeof ui.form.requestSubmit === "function") {
          ui.form.requestSubmit();
        } else {
          sendMessage();
        }
      }
    });

    mountLimitModal();

    window.updateChatContext = applyChatLocale;

    window.addEventListener("languageChanged", applyChatLocale);
    window.addEventListener("storage", (e) => {
      if (e.key === LANG_KEY || e.key === "language") applyChatLocale();
    });

    applyChatLocale();
    renderMessages();
    updateLimitLabel();
    refreshUsageFromServer();
    if (isDailyLimitExhausted()) setChatInputLocked(true);
  }

  function applyChatLocale() {
    if (!ui) return;
    ui.title.textContent = t("chatTitle");
    ui.status.textContent = t("chatStatus");
    ui.input.placeholder = t("chatPlaceholder");
    ui.fab.setAttribute("aria-label", t("chatOpenLabel"));
    ui.closeBtn.setAttribute("aria-label", t("chatClose"));
    ui.sendBtn.setAttribute("aria-label", t("chatSend"));
    applyLimitModalLocale();
    updateLimitLabel();
    if (!history.length) renderMessages();
  }

  function updateLimitLabel(remaining) {
    if (!ui) return;
    const n =
      typeof remaining === "number" && remaining >= 0
        ? remaining
        : clientDailyRemaining();
    ui.limitEl.textContent = t("chatLimitHint").replace("{n}", String(n));
    if (n <= 0) setChatInputLocked(true);
  }

  async function refreshUsageFromServer() {
    try {
      const res = await fetch("/api/ai/chat", { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.used === "number") syncClientUsageFromServer(data.used);
      updateLimitLabel(
        typeof data.remaining === "number" ? data.remaining : clientDailyRemaining()
      );
    } catch (_) {
      updateLimitLabel();
    }
  }

  function renderMessages() {
    if (!ui) return;
    ui.messagesEl.innerHTML = "";
    if (!history.length) {
      const welcome = document.createElement("div");
      welcome.className = "bc-ai-msg bc-ai-msg--bot";
      welcome.textContent = t("chatWelcome");
      ui.messagesEl.appendChild(welcome);
    } else {
      for (const m of history) {
        const el = document.createElement("div");
        el.className = "bc-ai-msg bc-ai-msg--" + (m.role === "user" ? "user" : "bot");
        el.textContent = m.content;
        ui.messagesEl.appendChild(el);
      }
    }
    ui.messagesEl.scrollTop = ui.messagesEl.scrollHeight;
  }

  function setOpen(open) {
    ui.panel.classList.toggle("is-open", open);
    ui.panel.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("bc-ai-chat-open", open);
    if (open) {
      applyChatLocale();
      renderMessages();
      refreshUsageFromServer();
      if (isDailyLimitExhausted()) {
        setChatInputLocked(true);
      } else {
        setChatInputLocked(false);
        ui.input.focus();
      }
    } else {
      document.body.classList.remove("bc-ai-chat-open");
    }
  }

  async function sendMessage() {
    if (!ui || busy) return;
    const text = ui.input.value.trim();
    if (!text) return;

    if (isDailyLimitExhausted()) {
      handleDailyLimitHit();
      return;
    }

    busy = true;
    ui.sendBtn.disabled = true;
    ui.input.value = "";

    history.push({ role: "user", content: text });
    appendUser(text);
    const typing = appendBot(t("chatThinking"), true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, lang: getLang() }),
      });
      const data = await res.json().catch(() => ({}));

      typing.remove();

      if (!res.ok) {
        if (data.error === "daily_limit" || res.status === 429) {
          history.pop();
          handleDailyLimitHit();
        } else {
          const msg = data.message || t("chatError");
          appendBot(msg);
          history.pop();
        }
      } else {
        history.push({ role: "assistant", content: data.reply });
        appendBot(data.reply);
        if (typeof data.used === "number") {
          syncClientUsageFromServer(data.used);
        } else {
          bumpClientDaily();
        }
        const left =
          typeof data.remaining === "number" ? data.remaining : clientDailyRemaining();
        updateLimitLabel(left);
        saveHistory(history);
        if (left <= 0) {
          showLimitModal();
        }
      }
    } catch {
      typing.remove();
      appendBot(t("chatError"));
      history.pop();
    } finally {
      busy = false;
      if (!isDailyLimitExhausted()) {
        setChatInputLocked(false);
      }
    }
  }

  function appendUser(text) {
    const el = document.createElement("div");
    el.className = "bc-ai-msg bc-ai-msg--user";
    el.textContent = text;
    ui.messagesEl.appendChild(el);
    ui.messagesEl.scrollTop = ui.messagesEl.scrollHeight;
  }

  function appendBot(text, typing) {
    const el = document.createElement("div");
    el.className = "bc-ai-msg bc-ai-msg--bot" + (typing ? " bc-ai-msg--typing" : "");
    el.textContent = text;
    ui.messagesEl.appendChild(el);
    ui.messagesEl.scrollTop = ui.messagesEl.scrollHeight;
    return el;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWidget);
  } else {
    mountWidget();
  }
})();
