// js/forum.js — Forum v2 client
// Cursor-based pagination, infinite scroll, sort & filter tabs, skeleton UI,
// i18n-aware rendering, Turnstile-safe form submission.

(function () {
  "use strict";

  // ============================================================ State
  const state = {
    lang: localStorage.getItem("forumLanguage") || localStorage.getItem("language") || "en",
    category: "all",
    tab: "all",
    sort: "newest",
    search: "",
    /** Slug of tag to filter (API `tag=`), from popular chips — not the same as text `search` */
    tag: null,
    cursor: null,
    hasMore: true,
    loading: false,
    categories: [],
    topics: [],
  };

  const PAGE_SIZE = 20;

  // ============================================================ Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function t(key, fallback) {
    try {
      return (window.APP_TRANSLATIONS?.[state.lang]?.[key]) ||
             (window.APP_TRANSLATIONS?.en?.[key]) ||
             fallback || key;
    } catch { return fallback || key; }
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function timeAgo(dateString) {
    if (!dateString) return "";
    const clean = dateString.endsWith("Z") ? dateString : dateString + "Z";
    const then = new Date(clean).getTime();
    const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (sec < 45)  return t("justNow", "Just now");
    if (sec < 3600) return `${Math.floor(sec / 60)}${t("minShort", "m")}`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}${t("hourShort", "h")}`;
    if (sec < 2592000) return `${Math.floor(sec / 86400)}${t("dayShort", "d")}`;
    if (sec < 31536000) return `${Math.floor(sec / 2592000)}${t("monthShort", "mo")}`;
    return `${Math.floor(sec / 31536000)}${t("yearShort", "y")}`;
  }

  function debounce(fn, ms = 300) {
    let h;
    return (...args) => {
      clearTimeout(h);
      h = setTimeout(() => fn(...args), ms);
    };
  }

  function detectContentLanguage(text) {
    if (!text) return "en";
    if (/[\u10A0-\u10FF]/.test(text)) return "ka";
    if (/[\u0400-\u04FF]/.test(text)) return "ru";
    return "en";
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem("user_data") || "null"); }
    catch { return null; }
  }

  // ============================================================ Reputation badge
  function reputationLevel(rep = 0, role = "user_role") {
    if (role === "super_admin_role")
      return { key: "super", icon: "fa-user-shield", label: t("roleSuperAdmin", "Super admin") };
    if (role === "admin_role") return { key: "admin", icon: "fa-crown", label: t("roleAdmin", "Admin") };
    if (role === "moderator_role") return { key: "mod", icon: "fa-shield-alt", label: t("roleMod", "Moderator") };
    if (rep >= 3000) return { key: "master",  icon: "fa-star",        label: t("lvlMaster",  "Master") };
    if (rep >= 1000) return { key: "expert",  icon: "fa-award",       label: t("lvlExpert",  "Expert") };
    if (rep >= 250)  return { key: "regular", icon: "fa-user-check",  label: t("lvlRegular", "Regular") };
    if (rep >= 50)   return { key: "member",  icon: "fa-user",        label: t("lvlMember",  "Member") };
    return               { key: "newcomer", icon: "fa-seedling",    label: t("lvlNewcomer", "Newcomer") };
  }

  function repBadgeHtml(rep, role) {
    const lvl = reputationLevel(rep || 0, role || "user_role");
    return `<span class="rep-badge rep-${lvl.key}" title="${escapeHtml(lvl.label)}"><i class="fas ${lvl.icon}"></i> ${escapeHtml(lvl.label)}</span>`;
  }

  // ============================================================ Skeleton
  function renderSkeleton(n = 5) {
    const host = $("#topics-list-container");
    if (!host) return;
    host.setAttribute("aria-busy", "true");
    host.innerHTML = Array.from({ length: n }).map(() => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton circle" style="width:44px;height:44px;"></div>
        <div>
          <div class="skeleton skeleton-line long" style="margin-bottom:8px;"></div>
          <div class="skeleton skeleton-line medium"></div>
        </div>
        <div class="skeleton skeleton-line short" style="height:10px;"></div>
      </div>
    `).join("");
  }

  // ============================================================ Empty / error states
  function renderEmpty() {
    $("#topics-list-container").innerHTML = `
      <div class="empty-state">
        <i class="far fa-comments empty-icon" aria-hidden="true"></i>
        <h3>${escapeHtml(t("noTopicsTitle", "No topics here yet"))}</h3>
        <p>${escapeHtml(t("noTopicsSubtitle", "Be the first to start a discussion."))}</p>
        <button class="btn btn-primary" onclick="openNewTopicModal()">
          <i class="fas fa-plus"></i> ${escapeHtml(t("newTopic", "New Topic"))}
        </button>
      </div>`;
  }

  function renderError(msg) {
    const host = $("#topics-list-container");
    if (!host) return;
    host.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        ${escapeHtml(msg || t("loadError", "Failed to load topics."))}
      </div>`;
  }

  // ============================================================ Topic card
  function renderTopicCard(topic) {
    const solved = topic.is_solved;
    const pinned = topic.is_pinned;
    const locked = topic.is_locked;

    const classes = ["topic-card"];
    if (pinned) classes.push("pinned");
    if (locked) classes.push("locked");

    const iconClass = solved ? "fa-check-circle" :
                      locked ? "fa-lock" :
                      pinned ? "fa-thumbtack" :
                               "fa-comment-alt";

    const iconTone = solved ? "solved" : pinned ? "pinned" : locked ? "locked" : "";

    const badges = [];
    if (pinned) badges.push(`<span class="badge badge-pinned"><i class="fas fa-thumbtack"></i> ${escapeHtml(t("pinned", "Pinned"))}</span>`);
    if (solved) badges.push(`<span class="badge badge-solved"><i class="fas fa-check"></i> ${escapeHtml(t("solved", "Solved"))}</span>`);
    if (locked) badges.push(`<span class="badge badge-locked"><i class="fas fa-lock"></i> ${escapeHtml(t("locked", "Locked"))}</span>`);

    if (topic.related_code) {
      badges.push(
        `<button type="button" class="badge badge-code badge-code-link" ` +
        `data-code="${escapeHtml(topic.related_code)}" ` +
        `title="${escapeHtml(t("viewCodeDetails", "View code details"))}">` +
        `<i class="fas fa-code" aria-hidden="true"></i> ${escapeHtml(topic.related_code)}` +
        `</button>`
      );
    }
    if (topic.lang) {
      badges.push(`<span class="badge badge-lang" title="${escapeHtml(topic.lang)}">${escapeHtml(topic.lang.toUpperCase())}</span>`);
    }
    (topic.tags || []).slice(0, 3).forEach((tag) => {
      const color = tag.color ? `style="--color-primary-alpha-10: ${tag.color}22; color: ${tag.color}; border-color: ${tag.color}55;"` : "";
      badges.push(`<span class="badge badge-tag" ${color}>#${escapeHtml(tag.name)}</span>`);
    });

    const cat = state.categories.find((c) => c.slug === topic.category);
    const accentHex = cat?.color && /^#[0-9A-Fa-f]{6}$/.test(cat.color) ? cat.color : "#1C69D4";
    const accentColor = accentHex;

    // Hotness indicator — many replies in the last ~24h
    const isHot =
      (topic.reply_count || 0) >= 5 &&
      topic.last_reply_at &&
      (Date.now() - new Date(topic.last_reply_at + "Z").getTime()) < 2 * 24 * 3600 * 1000;
    if (isHot) {
      badges.push(`<span class="hot-indicator"><i class="fas fa-fire"></i> ${escapeHtml(t("hot", "Hot"))}</span>`);
    }

    const authorAvatar = topic.author_avatar
      ? `<img src="${escapeHtml(topic.author_avatar)}" alt="" loading="lazy" onerror="this.remove()">`
      : "";

    const lastReply = topic.last_reply_username
      ? `<span>${escapeHtml(t("by", "by"))} ${escapeHtml(topic.last_reply_username)} · ${escapeHtml(timeAgo(topic.last_reply_at))}</span>`
      : `<span>${escapeHtml(timeAgo(topic.created_at))}</span>`;

    return `
      <a class="${classes.join(" ")}" href="/topic?id=${encodeURIComponent(topic.id)}" data-topic-id="${escapeHtml(topic.id)}" style="--topic-accent: ${accentColor};">
        <div class="topic-icon ${iconTone}" style="${iconTone ? '' : `background: ${accentColor}22; color: ${accentColor};`}"><i class="fas ${iconClass}" aria-hidden="true"></i></div>
        <div class="topic-body">
          <h3 class="topic-title">
            <span class="title-text">${escapeHtml(topic.title)}</span>
          </h3>
          <div class="topic-meta">
            ${badges.join("")}
            <span class="author">${authorAvatar} ${escapeHtml(topic.username)}</span>
            <span class="sep" aria-hidden="true"></span>
            ${lastReply}
          </div>
        </div>
        <div class="topic-stats">
          <div class="stat"><span class="stat-number">${topic.reply_count || 0}</span><span class="stat-label">${escapeHtml(t("replies", "replies"))}</span></div>
          <div class="stat"><span class="stat-number">${topic.views || 0}</span><span class="stat-label">${escapeHtml(t("views", "views"))}</span></div>
        </div>
      </a>
    `;
  }

  function appendTopics(topics) {
    const host = $("#topics-list-container");
    if (!host) return;
    host.removeAttribute("aria-busy");
    const existing = host.querySelectorAll(".skeleton-card");
    existing.forEach((el) => el.remove());
    const frag = document.createElement("div");
    frag.innerHTML = topics.map(renderTopicCard).join("");
    for (const el of Array.from(frag.children)) host.appendChild(el);
  }

  function clearTopics() {
    const host = $("#topics-list-container");
    if (host) host.innerHTML = "";
  }

  /** Rebuild topic cards from `state` so labels (Solved, replies, views, …) use current `t()` / language. */
  function rerenderVisibleTopics() {
    const host = $("#topics-list-container");
    if (!host) return;
    if (state.loading) return;
    if (host.querySelector(".skeleton-card")) return;
    if (state.topics && state.topics.length > 0) {
      const frag = document.createElement("div");
      frag.innerHTML = state.topics.map(renderTopicCard).join("");
      host.innerHTML = "";
      for (const el of Array.from(frag.children)) host.appendChild(el);
      return;
    }
    if (host.querySelector(".empty-state")) {
      renderEmpty();
    }
  }

  // ============================================================ Data fetching
  async function fetchTopics({ reset = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    $("#load-more-status")?.removeAttribute("hidden");

    if (reset) {
      state.cursor = null;
      state.hasMore = true;
      state.topics = [];
      renderSkeleton();
    }

    // Do not send `lang`: that filters topics by *content* language (t.lang), not UI language.
    // forumLanguage (state.lang) is only for translatable chrome; all topics should list regardless.
    const params = new URLSearchParams({
      category: state.category,
      tab: state.tab,
      sort: state.sort,
      limit: String(PAGE_SIZE),
    });
    if (state.search) params.set("search", state.search);
    if (state.tag) params.set("tag", state.tag);
    if (state.cursor) params.set("cursor", state.cursor);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/forum/topics?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const topics = Array.isArray(data.topics) ? data.topics : [];

      if (reset) {
        clearTopics();
        if (topics.length === 0) {
          renderEmpty();
          state.hasMore = false;
          return;
        }
      }

      state.topics = state.topics.concat(topics);
      appendTopics(topics);

      state.cursor = data.nextCursor || null;
      state.hasMore = !!data.hasMore;
    } catch (err) {
      console.error("fetchTopics error:", err);
      if (reset) renderError(err.message);
    } finally {
      state.loading = false;
      $("#load-more-status")?.setAttribute("hidden", "");
    }
  }

  // ============================================================ Infinite scroll
  function setupInfiniteScroll() {
    const sentinel = $("#infinite-sentinel");
    if (!sentinel || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && state.hasMore && !state.loading) {
            fetchTopics({ reset: false });
          }
        }
      },
      { rootMargin: "400px 0px" }
    );
    obs.observe(sentinel);
  }

  // ============================================================ Categories sidebar
  async function loadCategories() {
    try {
      const res = await fetch(`/api/categories?lang=${encodeURIComponent(state.lang)}`);
      const data = await res.json();
      if (!data.success) return;
      state.categories = data.categories || [];
      renderCategoriesNav();
      renderCategoryOptions();
      renderHeroStats();
    } catch (e) { console.error("loadCategories error:", e); }
  }

  function renderCategoriesNav() {
    const nav = $("#categories-nav");
    if (!nav) return;
    const active = state.category;
    const allClass = active === "all" ? "nav-item active" : "nav-item";
    let html = `
      <a href="#" class="${allClass}" data-category="all" onclick="event.preventDefault(); __forum.setCategory('all');">
        <i class="fas fa-stream nav-icon" aria-hidden="true"></i>
        <span>${escapeHtml(t("allTopics", "All Topics"))}</span>
      </a>
    `;
    for (const cat of state.categories) {
      const cls = active === cat.slug ? "nav-item active" : "nav-item";
      const count = cat.topics_count
        ? `<span class="nav-count">${cat.topics_count}</span>`
        : "";
      const color = cat.color || "var(--color-primary)";
      html += `
        <a href="#" class="${cls}" data-category="${escapeHtml(cat.slug)}" style="--cat-color:${escapeHtml(color)};"
           onclick="event.preventDefault(); __forum.setCategory('${escapeHtml(cat.slug)}');">
          <span class="nav-dot" aria-hidden="true"></span>
          <i class="${escapeHtml(cat.icon)} nav-icon" style="color:${escapeHtml(color)};" aria-hidden="true"></i>
          <span>${escapeHtml(cat.title)}</span>
          ${count}
        </a>
      `;
    }
    nav.innerHTML = html;

    // Mirror into mobile offcanvas
    const mobile = $("#mobile-menu-content");
    if (mobile) {
      mobile.innerHTML = `
        <div class="sidebar-card">
          <h3 class="sidebar-title">${escapeHtml(t("categoriesTitle", "Categories"))}</h3>
          <nav class="nav-menu">${html}</nav>
        </div>
      `;
    }
  }

  function renderCategoryOptions() {
    const select = $("#topic-category");
    if (!select) return;
    const optLabel = t("categoryDefault", "— Optional —");
    select.innerHTML =
      `<option value="">${escapeHtml(optLabel)}</option>` +
      state.categories
        .map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.title)}</option>`)
        .join("");
  }

  // ============================================================ Tags sidebar (popular)
  async function loadPopularTags() {
    try {
      const res = await fetch("/api/forum/tags?limit=12");
      const data = await res.json();
      if (!data.success || !data.tags?.length) return;
      const card = $("#popular-tags-card");
      const host = $("#popular-tags");
      if (!card || !host) return;
      card.hidden = false;
      host.innerHTML = data.tags
        .map((tag) =>
          `<button class="chip" data-tag="${escapeHtml(tag.name)}" onclick="__forum.setTag('${escapeHtml(tag.name)}')">
            #${escapeHtml(tag.name)} <span style="color:var(--color-text-muted);">${tag.usage_count || 0}</span>
          </button>`
        )
        .join("");
    } catch (e) { console.error("loadPopularTags error:", e); }
  }

  // ============================================================ Hero stats
  function renderHeroStats() {
    const host = $("#hero-stats");
    if (!host) return;
    const totalTopics = state.categories.reduce(
      (sum, c) => sum + (c.topics_count || 0), 0
    );
    const chips = [
      { value: totalTopics,               label: t("statTopics", "topics") },
      { value: state.categories.length,   label: t("statCategories", "categories") },
      { value: "3",                       label: t("statLangs", "langs") },
    ];
    host.innerHTML = chips
      .map((c) => `
        <div class="stat-chip">
          <span class="stat-value">${c.value}</span>
          <span class="stat-label">${escapeHtml(c.label)}</span>
        </div>
      `).join("");
  }

  // ============================================================ FAB scroll-to-top
  function setupScrollToTop() {
    const fab = $("#fab-scroll-top");
    if (!fab) return;
    const threshold = 420;
    const onScroll = () => {
      if (window.scrollY > threshold) fab.classList.add("visible");
      else fab.classList.remove("visible");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ============================================================ Sidebar user card
  function renderUserCard() {
    const user = getUser();
    const host = $("#user-sidebar-card");
    if (!host) return;
    if (!user) {
      host.innerHTML = `
        <div class="guest-card">
          <p>${escapeHtml(t("loginToPost", "Join the community to post"))}</p>
          <button class="btn btn-primary" onclick="toggleAuthModal()">${escapeHtml(t("loginRegister", "Login / Register"))}</button>
        </div>`;
      return;
    }
    const avatar = user.avatar_url
      ? `<img class="avatar" src="${escapeHtml(user.avatar_url)}" alt="" onerror="this.src='./assets/icons/ico.svg'">`
      : `<div class="avatar" style="display:flex;align-items:center;justify-content:center;font-weight:700;">${escapeHtml((user.username || '?')[0]?.toUpperCase())}</div>`;

    host.innerHTML = `
      <div class="user-card">
        ${avatar}
        <div class="username">${escapeHtml(user.username)}</div>
        ${repBadgeHtml(user.reputation, user.role_id || user.role)}
        <div class="actions">
          <a href="/profile" class="btn btn-ghost user-card-profile-link"><i class="fas fa-user-circle" aria-hidden="true"></i> ${escapeHtml(t("profile", "Profile"))}</a>
          <button class="btn btn-danger" onclick="logout && logout()"><i class="fas fa-sign-out-alt"></i> ${escapeHtml(t("logout", "Logout"))}</button>
        </div>
      </div>`;
  }

  // Make renderUserCard callable from script.js on login/logout,
  // and listen for auth:changed events that script.js dispatches.
  window.updateSidebarUser = function updateSidebarUser() {
    renderUserCard();
    renderHeaderAuth();
  };
  window.addEventListener("auth:changed", () => {
    renderUserCard();
    renderHeaderAuth();
  });

  function renderHeaderAuth() {
    const user = getUser();
    const btn = $("#auth-btn");
    if (!btn) return;
    if (user) {
      btn.classList.add("auth-btn--logged");
      btn.innerHTML = user.avatar_url
        ? `<img src="${escapeHtml(user.avatar_url)}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;margin-right:8px;border:1px solid rgba(255,255,255,0.2);"> <span>${escapeHtml(user.username)}</span>`
        : `<i class="fas fa-user" aria-hidden="true"></i> <span>${escapeHtml(user.username)}</span>`;
      btn.setAttribute("href", "/profile");
      btn.removeAttribute("onclick");
      btn.onclick = null;
    } else {
      btn.classList.remove("auth-btn--logged");
      btn.innerHTML = `<i class="fas fa-user" aria-hidden="true"></i> <span>${escapeHtml(t("loginBtn", "Login"))}</span>`;
      btn.setAttribute("href", "#");
      btn.removeAttribute("onclick");
      btn.onclick = (e) => { e.preventDefault(); toggleAuthModal(); };
    }
  }

  // ============================================================ Filter/sort controls
  function bindFilters() {
    $$("#filter-chips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#filter-chips .chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.tab = chip.dataset.filter || "all";
        fetchTopics({ reset: true });
      });
    });

    const sort = $("#sort-select");
    if (sort) {
      sort.addEventListener("change", () => {
        state.sort = sort.value;
        fetchTopics({ reset: true });
      });
    }

    const search = $("#forum-search");
    if (search) {
      const onSearch = debounce(() => {
        const v = (search.value || "").trim();
        state.search = v;
        state.tag = null; // free-text search overrides tag filter from chips
        fetchTopics({ reset: true });
      }, 350);
      search.addEventListener("input", onSearch);
    }

    // "/" keyboard shortcut focuses search
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/i.test(document.activeElement?.tagName || "")) {
        e.preventDefault();
        search?.focus();
      }
    });
  }

  // ============================================================ Language toggle
  function applyI18n() {
    document.documentElement.setAttribute("lang", state.lang);
    const dict = window.APP_TRANSLATIONS?.[state.lang] || {};
    const fall = window.APP_TRANSLATIONS?.en || {};
    $$("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const val = dict[key] ?? fall[key];
      if (val !== undefined) el.textContent = val;
    });
    $$("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      const val = dict[key] ?? fall[key];
      if (val !== undefined) el.placeholder = val;
    });
    const disp = $("#forum-lang-display");
    if (disp) disp.textContent = { en: "EN", ru: "RU", ka: "GE" }[state.lang] || "EN";
  }

  window.switchForumLanguage = function switchForumLanguage() {
    const order = ["en", "ru", "ka"];
    state.lang = order[(order.indexOf(state.lang) + 1) % order.length];
    localStorage.setItem("forumLanguage", state.lang);
    localStorage.setItem("language", state.lang);
    applyI18n();
    renderUserCard();
    void loadCategories(); // category titles + hero stats
    renderHeaderAuth();
    rerenderVisibleTopics();
    try {
      document.dispatchEvent(
        new CustomEvent("languageChanged", { detail: { lang: state.lang } }),
      );
    } catch (_) {
      /* ignore */
    }
  };

  // ============================================================ Public: filter/category/tag setters
  window.__forum = {
    setCategory(slug) {
      state.category = slug;
      renderCategoriesNav();
      fetchTopics({ reset: true });
    },
    setTag(tag) {
      const slug = String(tag || "")
        .trim()
        .replace(/^#/, "");
      state.tag = slug || null;
      state.search = "";
      const input = $("#forum-search");
      if (input) input.value = slug ? `#${slug}` : "";
      fetchTopics({ reset: true });
    },
  };

  window.filterTopicsByCategory = (slug) => window.__forum.setCategory(slug);

  /** Call after changing `forumLanguage` outside forum.js (e.g. topic page). */
  window.__forumSyncLang = function __forumSyncLang() {
    state.lang =
      localStorage.getItem("forumLanguage") ||
      localStorage.getItem("language") ||
      state.lang;
    applyI18n();
    renderHeaderAuth();
    renderUserCard();
    if ($("#hero-stats")) void loadCategories();
    rerenderVisibleTopics();
  };

  // ============================================================ New topic modal
  window.openNewTopicModal = function openNewTopicModal() {
    if (!localStorage.getItem("auth_token")) {
      toggleAuthModal();
      return;
    }
    openModal("new-topic-modal");
  };

  window.openModal = function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  };
  window.closeModal = function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  };

  function setupTopicForm() {
    const form = $("#create-topic-form");
    const textarea = $("#topic-content");
    const counter = $("#topic-content-count");
    const publish = $("#publish-btn");
    if (!form) return;

    textarea?.addEventListener("input", () => {
      if (counter) counter.textContent = String(textarea.value.length);
    });

    const codeInput = $("#topic-code");
    const codeFeedback = $("#topic-code-feedback");
    const lookup = (val) => (window.bmwCodes || []).find((c) => c.code && c.code.toLowerCase() === val);
    const renderCodeFeedback = () => {
      if (!codeInput) return;
      const val = codeInput.value.trim().toLowerCase();
      if (!val) {
        if (codeFeedback) codeFeedback.innerHTML = "";
        codeInput.style.borderColor = "";
        return;
      }
      const found = lookup(val);
      if (found) {
        codeInput.style.borderColor = "var(--color-success)";
        if (codeFeedback) {
          codeFeedback.innerHTML =
            `<i class="fas fa-check-circle" style="color:var(--color-success)"></i> ` +
            `${escapeHtml(found.code)} — ` +
            `${escapeHtml((found.title?.[state.lang]) || found.title?.en || "")}`;
        }
      } else {
        // NOT a blocker — allow user to publish any code even if not in our DB.
        codeInput.style.borderColor = "var(--color-warning, #f59e0b)";
        if (codeFeedback) {
          codeFeedback.innerHTML =
            `<i class="fas fa-circle-info" style="color:var(--color-warning, #f59e0b)"></i> ` +
            escapeHtml(t("codeNotInDb", "Code is not in our public database — you can still publish it."));
        }
      }
    };
    codeInput?.addEventListener("input", renderCodeFeedback);
    // Re-run once codes.json finishes loading (it may arrive after form render).
    window.addEventListener("bmwCodes:ready", renderCodeFeedback);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = getUser();
      if (!user) { toggleAuthModal(); return; }

      const title = $("#topic-title").value.trim();
      const content = $("#topic-content").value.trim();
      const relatedCode = $("#topic-code").value.trim();
      const tagsRaw = $("#topic-tags").value.trim();
      const category = ($("#topic-category")?.value || "").trim();

      // Related code is OPTIONAL and NEVER a blocker. We just normalize case.
      $("#topic-title-error").textContent = "";

      const body = {
        user_id: user.id,
        username: user.username,
        category: category || undefined,
        title,
        content,
        related_code: relatedCode ? relatedCode.toUpperCase() : null,
        lang: detectContentLanguage(title + " " + content),
        tags: tagsRaw ? tagsRaw.split(",").map((x) => x.trim()).filter(Boolean) : [],
      };

      // Turnstile — best-effort. `getResponse` throws if the widget was never
      // rendered (e.g. no TURNSTILE_SITE_KEY in dev), so we swallow the error.
      try {
        const tsEl = document.querySelector("#turnstile-topic");
        if (tsEl?.dataset.rendered === "1" && window.turnstile?.getResponse) {
          const turnstileToken = window.turnstile.getResponse(tsEl);
          if (turnstileToken) body.turnstile_token = turnstileToken;
        }
      } catch (_) { /* no widget registered — skip */ }

      publish.disabled = true;
      publish.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${escapeHtml(t("publishing", "Publishing…"))}`;

      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/forum/topics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || data.reason || `HTTP ${res.status}`);
        }
        window.location.href = `/topic?id=${data.topicId}`;
      } catch (err) {
        $("#topic-title-error").textContent = err.message || t("publishError", "Failed to publish");
        publish.disabled = false;
        publish.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${escapeHtml(t("publish", "Publish"))}</span>`;
      }
    });
  }

  // ============================================================ Auth modal helpers (shared w/ script.js)
  window.toggleAuthModal = function toggleAuthModal() {
    document.getElementById("auth-modal")?.classList.toggle("active");
  };

  window.switchAuthTab = function switchAuthTab(tab) {
    $("#tab-login")?.classList.toggle("active", tab === "login");
    $("#tab-register")?.classList.toggle("active", tab === "register");
    $("#tab-login")?.setAttribute("aria-selected", tab === "login" ? "true" : "false");
    $("#tab-register")?.setAttribute("aria-selected", tab === "register" ? "true" : "false");
    const tabs = document.querySelector(".auth-tabs");
    if (tabs) tabs.setAttribute("data-active", tab);
    const login = $("#login-form");
    const reg = $("#register-form");
    if (login) login.style.display = tab === "login" ? "" : "none";
    if (reg) reg.style.display = tab === "register" ? "" : "none";
    // Update subtitle
    const subtitle = $("#auth-subtitle");
    const title = $("#auth-title");
    if (tab === "register") {
      if (title) title.textContent = t("createAccountTitle", "Join the community");
      if (subtitle) subtitle.textContent = t("authSubtitleRegister", "Create your account — it takes 30 seconds.");
    } else {
      if (title) title.textContent = t("welcomeBack", "Welcome back");
      if (subtitle) subtitle.textContent = t("authSubtitleLogin", "Sign in to post, react, and save answers.");
    }
    // Focus first input
    setTimeout(() => {
      (tab === "register" ? reg : login)?.querySelector("input")?.focus();
    }, 220);
  };

  // ============================================================ Password eye-toggle
  document.addEventListener("click", (e) => {
    const eye = e.target.closest(".input-eye");
    if (!eye) return;
    e.preventDefault();
    const id = eye.dataset.target;
    const input = document.getElementById(id);
    if (!input) return;
    const icon = eye.querySelector("i");
    if (input.type === "password") {
      input.type = "text";
      icon?.classList.replace("fa-eye", "fa-eye-slash");
      eye.setAttribute("aria-label", "Hide password");
    } else {
      input.type = "password";
      icon?.classList.replace("fa-eye-slash", "fa-eye");
      eye.setAttribute("aria-label", "Show password");
    }
  });

  // ============================================================ Password strength meter
  function passwordScore(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
    return Math.min(4, score);
  }
  document.addEventListener("input", (e) => {
    if (e.target?.id !== "reg-password") return;
    const meter = document.querySelector(".pw-strength");
    if (meter) meter.setAttribute("data-strength", String(passwordScore(e.target.value)));
  });

  // ============================================================ Recovery step indicator
  // When recovery-step-2 becomes active, update step indicator visuals
  const recObserver = new MutationObserver(() => {
    const step2 = document.getElementById("recovery-step-2");
    const ind1 = document.getElementById("rec-step-ind-1");
    const ind2 = document.getElementById("rec-step-ind-2");
    if (!step2 || !ind1 || !ind2) return;
    if (step2.classList.contains("active")) {
      ind1.classList.remove("active");
      ind2.classList.add("active");
    } else {
      ind1.classList.add("active");
      ind2.classList.remove("active");
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const step2 = document.getElementById("recovery-step-2");
    if (step2) recObserver.observe(step2, { attributes: true, attributeFilter: ["class"] });
  });

  // Compatibility with script.js — alias for old `filterTopics` signature
  window.filterTopics = (slug) => window.__forum.setCategory(slug);

  // ============================================================ Mobile menu stub
  window.toggleMobileMenu = function toggleMobileMenu() {
    document.querySelector(".mobile-menu-overlay")?.classList.toggle("active");
    document.querySelector(".mobile-offcanvas")?.classList.toggle("active");
  };

  // Notifications: live.js only injects the bell for logged-in users; guests have no control.
  window.toggleNotifications = function toggleNotifications() {
    if (window.__notifications?.toggle) return window.__notifications.toggle();
  };

  // ============================================================ Boot
  document.addEventListener("DOMContentLoaded", async () => {
    // forum.js is also loaded on non-forum pages (profile, topic, admin)
    // for shared auth/header helpers. In that case, only wire header/sidebar
    // and bail out before running forum-specific code that assumes DOM nodes
    // that don't exist on those pages.
    applyI18n();
    renderHeaderAuth();
    renderUserCard();

    const isForumPage = !!document.getElementById("topics-list-container");
    if (!isForumPage) return;

    document.body.classList.add("forum-page");
    bindFilters();
    setupTopicForm();
    setupInfiniteScroll();
    setupScrollToTop();

    await loadCategories();
    loadPopularTags();
    fetchTopics({ reset: true });
  });
})();
