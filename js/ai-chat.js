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

  const FALLBACK_EN = {
    chatTitle: "BimmerCodes AI Assistant",
    chatStatus: "Free · EN / RU / KA",
    chatPlaceholder: "Ask about a code (P0301, 118001) or symptoms…",
    chatWelcome:
      "Hi! I help with BMW/Mini fault codes and coding. Send a DTC or describe the issue.",
    chatSend: "Send",
    chatClose: "Close",
    chatOpenLabel: "Open AI assistant",
    chatThinking: "Thinking…",
    chatError: "Could not reach the assistant. Try again later.",
    chatLimitReached: "Daily free limit reached. Try again tomorrow.",
    chatLimitHint: "Free messages left today: {n}",
  };

  function t(key) {
    const lang = getLang();
    const T = window.APP_TRANSLATIONS || {};
    return (
      (T[lang] && T[lang][key]) ||
      (T.en && T.en[key]) ||
      FALLBACK_EN[key] ||
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
    try {
      const raw = localStorage.getItem(CLIENT_DAILY_KEY);
      const today = new Date().toISOString().slice(0, 10);
      if (!raw) return CLIENT_DAILY_MAX;
      const data = JSON.parse(raw);
      if (data.date !== today) return CLIENT_DAILY_MAX;
      return Math.max(0, CLIENT_DAILY_MAX - (data.count || 0));
    } catch {
      return CLIENT_DAILY_MAX;
    }
  }

  function bumpClientDaily() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const raw = localStorage.getItem(CLIENT_DAILY_KEY);
      const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
      if (data.date !== today) {
        data.date = today;
        data.count = 0;
      }
      data.count = (data.count || 0) + 1;
      localStorage.setItem(CLIENT_DAILY_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

    const fab = document.getElementById("bc-ai-fab");
    const panel = document.getElementById("bc-ai-panel");
    const closeBtn = document.getElementById("bc-ai-close");
    const messagesEl = document.getElementById("bc-ai-messages");
    const form = document.getElementById("bc-ai-form");
    const input = document.getElementById("bc-ai-input");
    const sendBtn = document.getElementById("bc-ai-send");
    const limitEl = document.getElementById("bc-ai-limit");

    let history = loadHistory();
    let busy = false;

    function updateLimitLabel(remaining) {
      const n = remaining != null ? remaining : clientDailyRemaining();
      limitEl.textContent = t("chatLimitHint").replace("{n}", String(n));
    }

    function renderMessages() {
      messagesEl.innerHTML = "";
      if (!history.length) {
        const welcome = document.createElement("div");
        welcome.className = "bc-ai-msg bc-ai-msg--bot";
        welcome.textContent = t("chatWelcome");
        messagesEl.appendChild(welcome);
      } else {
        for (const m of history) {
          const el = document.createElement("div");
          el.className = "bc-ai-msg bc-ai-msg--" + (m.role === "user" ? "user" : "bot");
          el.textContent = m.content;
          messagesEl.appendChild(el);
        }
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) {
        renderMessages();
        updateLimitLabel();
        input.focus();
      }
    }

    fab.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));
    closeBtn.addEventListener("click", () => setOpen(false));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const text = input.value.trim();
      if (!text) return;

      if (clientDailyRemaining() <= 0) {
        appendBot(t("chatLimitReached"));
        return;
      }

      busy = true;
      sendBtn.disabled = true;
      input.value = "";

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
          const msg =
            data.message ||
            (data.error === "daily_limit" ? t("chatLimitReached") : t("chatError"));
          appendBot(msg);
          if (res.status !== 429) history.pop();
        } else {
          history.push({ role: "assistant", content: data.reply });
          appendBot(data.reply);
          bumpClientDaily();
          updateLimitLabel(data.remaining);
          saveHistory(history);
        }
      } catch {
        typing.remove();
        appendBot(t("chatError"));
        history.pop();
      } finally {
        busy = false;
        sendBtn.disabled = false;
      }
    });

    function appendUser(text) {
      const el = document.createElement("div");
      el.className = "bc-ai-msg bc-ai-msg--user";
      el.textContent = text;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendBot(text, typing) {
      const el = document.createElement("div");
      el.className = "bc-ai-msg bc-ai-msg--bot" + (typing ? " bc-ai-msg--typing" : "");
      el.textContent = text;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    window.updateChatContext = function () {
      const status = document.getElementById("bc-ai-status");
      if (status) status.textContent = t("chatStatus");
      updateLimitLabel();
    };

    renderMessages();
    updateLimitLabel();

    window.addEventListener("languageChanged", () => {
      document.getElementById("bc-ai-title").textContent = t("chatTitle");
      document.getElementById("bc-ai-status").textContent = t("chatStatus");
      input.placeholder = t("chatPlaceholder");
      updateLimitLabel();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWidget);
  } else {
    mountWidget();
  }
})();
