/**
 * Loads AI chat assets once per page (CSS + widget). Include before </body> on every page.
 */
(function () {
  "use strict";
  if (window.__bcAiChatLoader) return;
  window.__bcAiChatLoader = true;

  const base = document.currentScript?.src?.replace(/\/js\/ai-chat-loader\.js.*$/, "") || "";

  function asset(path) {
    if (base) return base + path;
    return path;
  }

  if (!document.querySelector('link[href*="ai-chat.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = asset("/css/ai-chat.css?v=1");
    document.head.appendChild(link);
  }

  if (!document.querySelector('script[src*="ai-chat.js"]')) {
    const s = document.createElement("script");
    s.src = asset("/js/ai-chat.js?v=1");
    s.defer = true;
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);
  }
})();
