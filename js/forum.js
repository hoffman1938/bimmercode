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
    $("#topics-list-container").innerHTML = `
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
      badges.push(`<span class="badge badge-code" title="${escapeHtml(t("relatedCode", "Related code"))}"><i class="fas fa-code"></i> ${escapeHtml(topic.related_code)}</span>`);
    }
    if (topic.lang) {
      badges.push(`<span class="badge badge-lang" title="${escapeHtml(topic.lang)}">${escapeHtml(topic.lang.toUpperCase())}</span>`);
    }
    (topic.tags || []).slice(0, 3).forEach((tag) => {
      const color = tag.color ? `style="--color-primary-alpha-10: ${tag.color}22; color: ${tag.color}; border-color: ${tag.color}55;"` : "";
      badges.push(`<span class="badge badge-tag" ${color}>#${escapeHtml(tag.name)}</span>`);
    });

    const authorAvatar = topic.author_avatar
      ? `<img src="${escapeHtml(topic.author_avatar)}" alt="" loading="lazy" onerror="this.remove()">`
      : "";

    const lastReply = topic.last_reply_username
      ? `<span>${escapeHtml(t("by", "by"))} ${escapeHtml(topic.last_reply_username)} · ${escapeHtml(timeAgo(topic.last_reply_at))}</span>`
      : `<span>${escapeHtml(timeAgo(topic.created_at))}</span>`;

    return `
      <a class="${classes.join(" ")}" href="/topic?id=${encodeURIComponent(topic.id)}" data-topic-id="${escapeHtml(topic.id)}">
        <div class="topic-icon ${iconTone}"><i class="fas ${iconClass}" aria-hidden="true"></i></div>
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
    $("#topics-list-container").innerHTML = "";
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

    const params = new URLSearchParams({
      category: state.category,
      tab: state.tab,
      sort: state.sort,
      limit: String(PAGE_SIZE),
      lang: state.lang,
    });
    if (state.search) params.set("search", state.search);
    if (state.cursor) params.set("cursor", state.cursor);

    try {
      const res = await fetch(`/api/forum/topics?${params.toString()}`);
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
      html += `
        <a href="#" class="${cls}" data-category="${escapeHtml(cat.slug)}"
           onclick="event.preventDefault(); __forum.setCategory('${escapeHtml(cat.slug)}');">
          <i class="${escapeHtml(cat.icon)} nav-icon" style="color:${escapeHtml(cat.color || '')};" aria-hidden="true"></i>
          <span>${escapeHtml(cat.title)}</span>
          ${count}
        </a>
      `;
    }
    nav.innerHTML = html;
  }

  function renderCategoryOptions() {
    const select = $("#topic-category");
    if (!select) return;
    select.innerHTML = state.categories
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
          <a href="/profile" class="btn btn-ghost"><i class="fas fa-user-circle"></i> ${escapeHtml(t("profile", "Profile"))}</a>
          <button class="btn btn-danger" onclick="logout && logout()"><i class="fas fa-sign-out-alt"></i> ${escapeHtml(t("logout", "Logout"))}</button>
        </div>
      </div>`;
  }

  function renderHeaderAuth() {
    const user = getUser();
    const btn = $("#auth-btn");
    if (!btn) return;
    if (user) {
      btn.innerHTML = user.avatar_url
        ? `<img src="${escapeHtml(user.avatar_url)}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;"> <span>${escapeHtml(user.username)}</span>`
        : `<i class="fas fa-user"></i> <span>${escapeHtml(user.username)}</span>`;
      btn.onclick = () => (window.location.href = "/profile");
      btn.setAttribute("href", "/profile");
    } else {
      btn.innerHTML = `<i class="fas fa-user"></i> <span>${escapeHtml(t("loginBtn", "Login"))}</span>`;
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
        state.search = (search.value || "").trim();
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
    const dict = window.APP_TRANSLATIONS?.[state.lang] || {};
    $$("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });
    $$("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key]) el.placeholder = dict[key];
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
    loadCategories(); // Reload category i18n titles
    renderHeaderAuth();
  };

  // ============================================================ Public: filter/category/tag setters
  window.__forum = {
    setCategory(slug) {
      state.category = slug;
      renderCategoriesNav();
      fetchTopics({ reset: true });
    },
    setTag(tag) {
      state.search = `#${tag}`;
      const input = $("#forum-search");
      if (input) input.value = state.search;
      fetchTopics({ reset: true });
    },
  };

  window.filterTopicsByCategory = (slug) => window.__forum.setCategory(slug);

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
    codeInput?.addEventListener("input", () => {
      const val = codeInput.value.trim().toLowerCase();
      if (!val) { if (codeFeedback) codeFeedback.textContent = ""; codeInput.style.borderColor = ""; return; }
      const found = window.bmwCodes && window.bmwCodes.find((c) => c.code.toLowerCase() === val);
      if (found) {
        codeInput.style.borderColor = "var(--color-success)";
        if (codeFeedback) {
          codeFeedback.innerHTML = `<i class="fas fa-check-circle" style="color:var(--color-success)"></i> ${escapeHtml(found.code)} — ${escapeHtml((found.title?.[state.lang]) || found.title?.en || "")}`;
        }
      } else {
        codeInput.style.borderColor = "var(--color-danger)";
        if (codeFeedback) codeFeedback.textContent = t("invalidCodeError", "Code not found in database");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = getUser();
      if (!user) { toggleAuthModal(); return; }

      const title = $("#topic-title").value.trim();
      const content = $("#topic-content").value.trim();
      const relatedCode = $("#topic-code").value.trim();
      const tagsRaw = $("#topic-tags").value.trim();
      const category = $("#topic-category").value;

      if (relatedCode) {
        const exists = window.bmwCodes?.some((c) => c.code.toLowerCase() === relatedCode.toLowerCase());
        if (!exists) {
          $("#topic-title-error").textContent = t("invalidCodeError", "Invalid error code — leave empty or use a valid one.");
          return;
        }
      }
      $("#topic-title-error").textContent = "";

      const body = {
        user_id: user.id,
        username: user.username,
        category,
        title,
        content,
        related_code: relatedCode || null,
        lang: detectContentLanguage(title + " " + content),
        tags: tagsRaw ? tagsRaw.split(",").map((x) => x.trim()).filter(Boolean) : [],
      };

      // Turnstile
      const turnstileToken = window.turnstile?.getResponse?.(document.querySelector("#turnstile-topic"));
      if (turnstileToken) body.turnstile_token = turnstileToken;

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
    const login = $("#login-form");
    const reg = $("#register-form");
    if (login) login.style.display = tab === "login" ? "" : "none";
    if (reg) reg.style.display = tab === "register" ? "" : "none";
  };

  // Compatibility with script.js — alias for old `filterTopics` signature
  window.filterTopics = (slug) => window.__forum.setCategory(slug);

  // ============================================================ Mobile menu stub
  window.toggleMobileMenu = function toggleMobileMenu() {
    document.querySelector(".mobile-menu-overlay")?.classList.toggle("active");
    document.querySelector(".mobile-offcanvas")?.classList.toggle("active");
  };

  // Notifications bell (delegated to live.js if available)
  window.toggleNotifications = function toggleNotifications() {
    if (window.__notifications?.toggle) return window.__notifications.toggle();
    alert(t("notifsComingSoon", "Notifications coming soon"));
  };

  // ============================================================ Boot
  document.addEventListener("DOMContentLoaded", async () => {
    document.body.classList.add("forum-page");
    applyI18n();
    renderHeaderAuth();
    renderUserCard();
    bindFilters();
    setupTopicForm();
    setupInfiniteScroll();

    await loadCategories();
    loadPopularTags();
    fetchTopics({ reset: true });
  });
})();
