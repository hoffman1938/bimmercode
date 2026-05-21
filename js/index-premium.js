// js/index-premium.js — interactions for the redesigned homepage.
// Self-contained, no dependencies. Defers gracefully if elements aren't found.

(function () {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------- Mobile sheet ---------------- */
  const burger = $("#bc3-burger");
  const sheet  = $("#bc3-sheet");
  function openSheet() {
    if (!sheet) return;
    sheet.classList.add("open");
    burger?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove("open");
    burger?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  burger?.addEventListener("click", openSheet);
  sheet?.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet();
  });
  $$("[data-bc3-sheet-close]").forEach((el) =>
    el.addEventListener("click", closeSheet)
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheet?.classList.contains("open")) closeSheet();
  });

  /* ---------------- Quick-search chips ----------------
     Sets the value of #search-input and dispatches an `input` event so
     the existing debounced handler in js/script.js renders results. */
  const searchInput = $("#search-input");
  $$("[data-bc3-search]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-bc3-search") || "";
      if (!searchInput) return;
      searchInput.value = q;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.focus({ preventScroll: true });
      const target = document.getElementById("search");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* ---------------- ⌘K / Ctrl+K focus search ---------------- */
  document.addEventListener("keydown", (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && (e.key === "k" || e.key === "K")) {
      const el = $("#search-input");
      if (!el) return;
      e.preventDefault();
      el.focus({ preventScroll: false });
      el.select();
    }
    if (e.key === "/" && document.activeElement === document.body) {
      const el = $("#search-input");
      if (!el) return;
      e.preventDefault();
      el.focus();
    }
  });

  /* ---------------- Scroll reveal ----------------
     Adds `.is-in` to .bc3-reveal elements as they enter the viewport.
     Opt-in: only after JS adds .bc3-anim to body do the reveals get the
     initial opacity:0 / transform — so no-JS visitors always see content. */
  const reveals = $$(".bc3-reveal");
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReducedMotion && "IntersectionObserver" in window && reveals.length) {
    document.body.classList.add("bc3-anim");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -5% 0px" }
    );
    reveals.forEach((el) => io.observe(el));

    // Safety net: if the observer hasn't revealed an item within 3 seconds
    // (e.g. tab was backgrounded), force-reveal everything still pending.
    setTimeout(() => {
      reveals.forEach((el) => el.classList.add("is-in"));
    }, 3000);
  }

  /* ---------------- FAQ: keep only one open ---------------- */
  const faqItems = $$(".bc3-faq__item");
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* ---------------- Scroll-into-view: results ----------------
     When the user starts typing and #results-container becomes visible,
     scroll the results into view so they don't sit below the fold. */
  const resultsEl = $("#results-container");
  if (resultsEl && "MutationObserver" in window) {
    let scrollScheduled = false;
    const mo = new MutationObserver(() => {
      const visible =
        !resultsEl.classList.contains("hidden") && resultsEl.children.length > 0;
      if (!visible || scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(() => {
        scrollScheduled = false;
        const top = resultsEl.getBoundingClientRect().top + window.scrollY - 100;
        if (window.scrollY < top - 50) {
          window.scrollTo({ top, behavior: "smooth" });
        }
      });
    });
    mo.observe(resultsEl, { attributes: true, childList: true, attributeFilter: ["class"] });
  }

  /* ---------------- Scroll-into-view: code detail ----------------
     When the user clicks a search result (or types an exact code),
     #code-detail's `.hidden` class is removed by script.js. Watch for it,
     add `viewing-detail` to <body> (hides marketing sections via CSS), and
     smoothly scroll the detail card into view. */
  const detailEl = $("#code-detail");
  if (detailEl && "MutationObserver" in window) {
    const setViewingDetail = (on) => {
      document.body.classList.toggle("viewing-detail", on);
    };
    const moDetail = new MutationObserver(() => {
      const visible = !detailEl.classList.contains("hidden");
      setViewingDetail(visible);
      if (visible) {
        // Wait one frame so the layout settles after the section toggle.
        requestAnimationFrame(() => {
          const headerH = document.querySelector("header")?.offsetHeight || 0;
          const top = detailEl.getBoundingClientRect().top + window.scrollY - (headerH + 16);
          window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        });
      }
    });
    moDetail.observe(detailEl, { attributes: true, attributeFilter: ["class"] });
    // Sync initial state in case of deep-link / SSR
    setViewingDetail(!detailEl.classList.contains("hidden"));
  }

  /* ---------------- Auto-open exact code match while typing ----------------
     If the user types a complete code that matches exactly one record in
     window.bmwCodes, open the detail view + scroll there immediately
     instead of waiting for them to click the result. */
  function tryExactMatch(value) {
    const term = (value || "").trim().toUpperCase();
    if (term.length < 4) return null;
    const lookup = window.__bmwCodeLookup;
    if (lookup?.byCode || lookup?.byPCode) {
      return lookup.byCode.get(term) || lookup.byPCode.get(term) || null;
    }
    const codes = window.bmwCodes || [];
    if (!codes.length) return null;
    return (
      codes.find(
        (c) =>
          (c.code || "").toUpperCase() === term ||
          (c.pCodes || []).some((p) => (p || "").toUpperCase() === term),
      ) || null
    );
  }

  let lastAutoOpened = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const value = searchInput.value || "";
      // Reset memo when input changes substantially
      if (!value.length) lastAutoOpened = null;
      // Debounce: wait a beat so partial typing doesn't open the wrong code.
      clearTimeout(searchInput._bcxAutoOpenTimer);
      searchInput._bcxAutoOpenTimer = setTimeout(() => {
        const match = tryExactMatch(value);
        if (match && match.code !== lastAutoOpened &&
            typeof window.displayCodeDetail === "function") {
          lastAutoOpened = match.code;
          window.displayCodeDetail(match);
        }
      }, 450);
    });
  }

  /* ---------------- Subtle parallax glow under hero command ----------------
     Cheap (transform only). Only on pointer-fine devices. */
  if (matchMedia("(pointer: fine)").matches) {
    const command = $(".bc3-command");
    if (command) {
      const halo = command.querySelector(".bc3-command__halo");
      command.addEventListener("mousemove", (e) => {
        const r = command.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * 12;
        const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
        if (halo) halo.style.transform = `translate(${x}px, ${y}px)`;
      });
      command.addEventListener("mouseleave", () => {
        if (halo) halo.style.transform = "";
      });
    }
  }
})();
