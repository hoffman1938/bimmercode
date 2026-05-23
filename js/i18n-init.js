/**
 * i18n-init.js — Lightweight language initializer for static pages
 * (contact, privacy, terms). Reads forumLanguage from localStorage
 * and applies translations from APP_TRANSLATIONS.
 *
 * Pages that have their own full script.js (index, vin) or forum.js
 * do NOT need this file — they handle language internally.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "forumLanguage";
  const LANGS = ["en", "ru", "ka"];
  const LANG_LABELS = { en: "EN", ru: "RU", ka: "GE" };

  let currentLang = localStorage.getItem(STORAGE_KEY) || "en";
  if (!LANGS.includes(currentLang)) currentLang = "en";

  /* ── Apply translations to DOM ── */
  function applyTranslations() {
    const T =
      (window.APP_TRANSLATIONS && window.APP_TRANSLATIONS[currentLang]) ||
      (window.APP_TRANSLATIONS && window.APP_TRANSLATIONS["en"]) ||
      {};

    // Set <html lang>
    document.documentElement.setAttribute("lang", currentLang);

    // data-i18n  → textContent
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (T[key] != null) el.textContent = T[key];
    });

    // data-i18n-html  → innerHTML (for rich legal sections)
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-html");
      if (T[key] != null) el.innerHTML = T[key];
    });

    // data-i18n-placeholder  → placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (T[key] != null) el.placeholder = T[key];
    });

    // Update language toggle button label
    var btn = document.getElementById("language-toggle");
    if (btn) {
      var span = btn.querySelector("span");
      if (span) span.textContent = LANG_LABELS[currentLang] || "EN";
    }
  }

  /* ── Toggle language (cycles en → ru → ka → en) ── */
  function toggleLanguage() {
    var idx = LANGS.indexOf(currentLang);
    currentLang = LANGS[(idx + 1) % LANGS.length];
    localStorage.setItem(STORAGE_KEY, currentLang);
    applyTranslations();
    window.dispatchEvent(
      new CustomEvent("languageChanged", { detail: { lang: currentLang } })
    );
    if (typeof window.updateChatContext === "function") {
      window.updateChatContext();
    }
  }

  // Expose for inline onclick or external use
  window.togglePageLanguage = toggleLanguage;
  window.t = function(key) {
    const T = (window.APP_TRANSLATIONS && window.APP_TRANSLATIONS[currentLang]) ||
              (window.APP_TRANSLATIONS && window.APP_TRANSLATIONS["en"]) || {};
    return T[key] || key;
  };

  /* ── Wire up language button ── */
  var langBtn = document.getElementById("language-toggle");
  if (langBtn) {
    langBtn.addEventListener("click", toggleLanguage);
  }

  /* ── Apply on load ── */
  applyTranslations();
})();
