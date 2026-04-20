// js/topic.js — Topic view v2
// Markdown rendering, emoji reactions, reputation badges, JSON-LD update,
// reply composer with preview + drag-and-drop images.

(function () {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    lang: localStorage.getItem("forumLanguage") || localStorage.getItem("language") || "en",
    topicId: new URLSearchParams(window.location.search).get("id"),
    topic: null,
    posts: [],
    user: null,
  };

  // Reload user from localStorage
  try { state.user = JSON.parse(localStorage.getItem("user_data") || "null"); } catch {}

  const REACTION_EMOJIS = ["👍", "❤️", "🔥", "🚗", "🔧", "😂", "😮", "🎉"];

  // ========================================================== Helpers
  function t(k, fb) {
    return window.APP_TRANSLATIONS?.[state.lang]?.[k]
        || window.APP_TRANSLATIONS?.en?.[k]
        || fb || k;
  }

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
  }

  function timeAgo(dateString) {
    if (!dateString) return "";
    const clean = dateString.endsWith("Z") ? dateString : dateString + "Z";
    const sec = Math.max(0, Math.floor((Date.now() - new Date(clean).getTime()) / 1000));
    if (sec < 45) return t("justNow", "just now");
    if (sec < 3600) return `${Math.floor(sec / 60)}${t("minShort", "m")}`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}${t("hourShort", "h")}`;
    if (sec < 2592000) return `${Math.floor(sec / 86400)}${t("dayShort", "d")}`;
    return new Date(clean).toLocaleDateString(state.lang);
  }

  function reputationLevel(rep = 0, role = "user_role") {
    if (role === "admin_role")      return { key: "admin",   icon: "fa-crown",       label: t("roleAdmin", "Admin") };
    if (role === "moderator_role")  return { key: "mod",     icon: "fa-shield-alt",  label: t("roleMod", "Moderator") };
    if (rep >= 3000)                return { key: "master",  icon: "fa-star",        label: t("lvlMaster", "Master") };
    if (rep >= 1000)                return { key: "expert",  icon: "fa-award",       label: t("lvlExpert", "Expert") };
    if (rep >= 250)                 return { key: "regular", icon: "fa-user-check",  label: t("lvlRegular", "Regular") };
    if (rep >= 50)                  return { key: "member",  icon: "fa-user",        label: t("lvlMember", "Member") };
    return                            { key: "newcomer", icon: "fa-seedling",    label: t("lvlNewcomer", "Newcomer") };
  }

  function repBadgeHtml(rep, role) {
    const lvl = reputationLevel(rep || 0, role || "user_role");
    return `<span class="rep-badge rep-${lvl.key}"><i class="fas ${lvl.icon}"></i> ${esc(lvl.label)}</span>`;
  }

  function renderMarkdown(src) {
    try {
      if (window.marked) {
        window.marked.setOptions({ breaks: true, gfm: true });
        // Basic sanitizer — disallow raw HTML tags we don't want.
        const html = window.marked.parse(String(src || ""));
        return html.replace(/<script[\s\S]*?<\/script>/gi, "")
                   .replace(/ on\w+="[^"]*"/gi, "");
      }
    } catch (e) { console.warn("marked error:", e); }
    return esc(src).replace(/\n/g, "<br>");
  }

  // ========================================================== JSON-LD
  function updateJsonLd(topic, posts) {
    const el = document.getElementById("topic-jsonld");
    if (!el) return;
    try {
      const data = {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        "headline": topic.title,
        "articleBody": (topic.content || "").slice(0, 4000),
        "dateCreated": topic.created_at?.endsWith("Z") ? topic.created_at : (topic.created_at || "") + "Z",
        "inLanguage": topic.lang || "en",
        "author": { "@type": "Person", "name": topic.username || "Anonymous" },
        "interactionStatistic": [
          { "@type": "InteractionCounter", "interactionType": "https://schema.org/ViewAction", "userInteractionCount": topic.views || 0 },
          { "@type": "InteractionCounter", "interactionType": "https://schema.org/ReplyAction", "userInteractionCount": topic.reply_count || (posts?.length || 0) },
        ],
        "url": window.location.href,
        "commentCount": posts?.length || 0,
        "comment": (posts || []).slice(0, 10).map((p) => ({
          "@type": "Comment",
          "text": (p.content || "").slice(0, 1000),
          "author": { "@type": "Person", "name": p.username || "Anonymous" },
          "dateCreated": p.created_at,
        })),
      };
      el.textContent = JSON.stringify(data);
    } catch (e) { console.warn("jsonld error:", e); }
  }

  // ========================================================== Rendering
  function renderTopic() {
    const host = $("#topic-content");
    if (!host) return;
    const { topic, posts } = state;

    const tags = (topic.tags || []).map((tg) => {
      const color = tg.color || "#1C69D4";
      return `<span class="badge badge-tag" style="color:${color};border-color:${color}55;background:${color}14;">#${esc(tg.name)}</span>`;
    }).join("");

    const badges = [];
    if (topic.is_pinned) badges.push(`<span class="badge badge-pinned"><i class="fas fa-thumbtack"></i> ${esc(t("pinned","Pinned"))}</span>`);
    if (topic.is_solved) badges.push(`<span class="badge badge-solved"><i class="fas fa-check"></i> ${esc(t("solved","Solved"))}</span>`);
    if (topic.is_locked) badges.push(`<span class="badge badge-locked"><i class="fas fa-lock"></i> ${esc(t("locked","Locked"))}</span>`);
    if (topic.related_code) badges.push(`<span class="badge badge-code"><i class="fas fa-code"></i> ${esc(topic.related_code)}</span>`);

    host.innerHTML = `
      <article class="topic-header-card">
        <div class="topic-meta" style="margin-bottom:var(--space-sm);">
          ${badges.join("")}
          ${tags}
        </div>
        <h1>${esc(topic.title)}</h1>
        <div class="topic-header-meta">
          <span>${esc(t("by","by"))} <strong>${esc(topic.username)}</strong></span>
          ${repBadgeHtml(topic.author_reputation, topic.author_role)}
          <span class="sep" aria-hidden="true"></span>
          <span>${esc(timeAgo(topic.created_at))}</span>
          <span class="sep" aria-hidden="true"></span>
          <span><i class="fas fa-eye"></i> ${topic.views || 0}</span>
          <span class="sep" aria-hidden="true"></span>
          <span><i class="fas fa-reply"></i> ${posts.length}</span>
        </div>
      </article>

      <div class="posts-stream" id="posts-stream">
        ${renderPostCard(topic, { isOriginal: true })}
        ${posts.map((p) => renderPostCard(p)).join("")}
      </div>

      ${renderComposer()}
    `;

    // Bind reactions delegation
    host.addEventListener("click", onStreamClick);

    // Sidebar info
    const sideHost = $("#topic-info-body");
    const sideCard = $("#topic-info-card");
    if (sideHost && sideCard) {
      sideCard.hidden = false;
      sideHost.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:var(--space-sm);color:var(--color-text-secondary);font-size:var(--font-size-sm);">
          <div><i class="fas fa-eye" style="width:18px;"></i> ${topic.views || 0} ${esc(t("views","views"))}</div>
          <div><i class="fas fa-reply" style="width:18px;"></i> ${posts.length} ${esc(t("replies","replies"))}</div>
          <div><i class="fas fa-globe" style="width:18px;"></i> ${esc((topic.lang || "en").toUpperCase())}</div>
          <div><i class="fas fa-calendar" style="width:18px;"></i> ${esc(new Date((topic.created_at || "").replace(/Z?$/,"Z")).toLocaleDateString(state.lang))}</div>
        </div>
      `;
    }

    setupComposer();
    updateJsonLd(topic, posts);
    document.title = `${topic.title} — BimmerCodes Forum`;
  }

  function renderPostCard(p, { isOriginal = false } = {}) {
    const solved = p.is_solution || p.id === state.topic?.solution_post_id;
    const avatar = p.author_avatar
      ? `<img class="avatar" src="${esc(p.author_avatar)}" alt="" loading="lazy" onerror="this.src='./assets/icons/ico.svg'">`
      : `<div class="avatar" style="display:flex;align-items:center;justify-content:center;font-weight:700;font-size:28px;">${esc((p.username||'?')[0]?.toUpperCase())}</div>`;
    const isOP = isOriginal;
    const rep = p.author_reputation || 0;

    // Reactions row
    const reactions = (p.reactions || []);
    const mine = new Set(p.my_reactions || []);
    const reactionsHtml = reactions.length
      ? reactions.map((r) => {
          const active = mine.has(r.emoji) ? " active" : "";
          return `<button class="react-btn${active}" data-react-post="${esc(p.id)}" data-emoji="${esc(r.emoji)}">${r.emoji} ${r.count}</button>`;
        }).join("")
      : "";

    const body = renderMarkdown(p.content || "");

    const postId = isOriginal ? `op` : `post-${esc(p.id)}`;

    return `
      <article class="post-card${solved ? " is-solution" : ""}" id="${postId}">
        <div class="post-author">
          ${avatar}
          <div class="username">${esc(p.username)}</div>
          ${repBadgeHtml(rep, p.author_role)}
          ${isOP ? `<div class="rep-score">${esc(t("opLabel","Original poster"))}</div>` : `<div class="rep-score">${rep} rep</div>`}
        </div>
        <div class="post-body">
          <div class="post-meta">
            <a class="permalink" href="#${postId}"><i class="fas fa-link"></i> ${esc(timeAgo(p.created_at))}</a>
            ${solved ? `<span class="badge badge-solved"><i class="fas fa-check"></i> ${esc(t("solution","Solution"))}</span>` : ""}
          </div>
          <div class="post-text">${body}</div>
          <div class="post-actions">
            <button class="react-btn" data-react-open="${esc(p.id)}" aria-label="React">
              <i class="far fa-smile"></i>
            </button>
            ${reactionsHtml}
            <span style="flex:1"></span>
            ${!isOP && canMarkSolution() && !state.topic?.is_solved ? `<button class="react-btn" data-action="solve" data-post="${esc(p.id)}"><i class="fas fa-check"></i> ${esc(t("markSolution","Mark as solution"))}</button>` : ""}
            ${canEdit(p) ? `<button class="react-btn" data-action="edit" data-post="${esc(p.id)}"><i class="fas fa-edit"></i> ${esc(t("edit","Edit"))}</button>` : ""}
            ${canDelete(p) ? `<button class="react-btn" data-action="delete" data-post="${esc(p.id)}"><i class="fas fa-trash"></i> ${esc(t("delete","Delete"))}</button>` : ""}
            ${state.user && !isOP ? `<button class="react-btn" data-action="report" data-post="${esc(p.id)}"><i class="fas fa-flag"></i> ${esc(t("report","Report"))}</button>` : ""}
          </div>
        </div>
      </article>`;
  }

  function canMarkSolution() {
    return state.user && state.topic && String(state.user.id) === String(state.topic.user_id);
  }
  function canEdit(post) {
    return state.user && String(state.user.id) === String(post.user_id);
  }
  function canDelete(post) {
    if (!state.user) return false;
    if (String(state.user.id) === String(post.user_id)) return true;
    return state.user.role === "admin_role" || state.user.role === "moderator_role";
  }

  function renderComposer() {
    if (state.topic?.is_locked) {
      return `<div class="composer" style="text-align:center;color:var(--color-text-muted);">
        <i class="fas fa-lock"></i> ${esc(t("topicLocked","This topic is locked. No new replies."))}
      </div>`;
    }
    if (!state.user) {
      return `<div class="composer" style="text-align:center;">
        <p style="color:var(--color-text-muted);">${esc(t("loginToReply","Please login to reply."))}</p>
        <button class="btn btn-primary" onclick="toggleAuthModal()">${esc(t("loginBtn","Login"))}</button>
      </div>`;
    }
    return `
      <form class="composer" id="composer-form">
        <div class="composer-tabs">
          <button type="button" class="active" data-tab="write" data-i18n="edit">Write</button>
          <button type="button" data-tab="preview" data-i18n="preview">Preview</button>
        </div>
        <div id="composer-write">
          <textarea id="reply-content" placeholder="${esc(t("writeReply","Write a reply..."))}" required minlength="2" maxlength="8000"></textarea>
        </div>
        <div id="composer-preview" class="composer-preview post-text" hidden></div>
        <div class="composer-toolbar">
          <button type="button" class="btn btn-ghost btn-icon" id="attach-btn" title="${esc(t("uploadImage","Upload image"))}"><i class="fas fa-image"></i></button>
          <input type="file" id="image-input" accept="image/*" hidden>
          <button type="button" class="btn btn-ghost" id="md-bold" title="Bold (Ctrl+B)"><i class="fas fa-bold"></i></button>
          <button type="button" class="btn btn-ghost" id="md-code" title="Code"><i class="fas fa-code"></i></button>
          <button type="button" class="btn btn-ghost" id="md-quote" title="Quote"><i class="fas fa-quote-right"></i></button>
          <span class="spacer"></span>
          <span class="char-count"><span id="reply-count">0</span> / 8000</span>
          <button type="submit" class="btn btn-primary" id="submit-reply">
            <i class="fas fa-paper-plane"></i> <span>${esc(t("reply","Reply"))}</span>
          </button>
        </div>
        <div class="field-error" id="reply-error"></div>
      </form>
    `;
  }

  // ========================================================== Composer behaviour
  function setupComposer() {
    const form = $("#composer-form");
    if (!form) return;
    const textarea = $("#reply-content");
    const count = $("#reply-count");

    textarea?.addEventListener("input", () => {
      if (count) count.textContent = textarea.value.length;
    });

    // Tabs
    $$("#composer-form .composer-tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#composer-form .composer-tabs button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        const writeHost = $("#composer-write");
        const prevHost = $("#composer-preview");
        if (tab === "preview") {
          prevHost.innerHTML = renderMarkdown(textarea.value);
          prevHost.hidden = false;
          writeHost.hidden = true;
        } else {
          prevHost.hidden = true;
          writeHost.hidden = false;
        }
      });
    });

    // Markdown helpers
    function wrap(prefix, suffix = prefix) {
      const ta = textarea;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const sel = ta.value.slice(s, e);
      ta.value = ta.value.slice(0, s) + prefix + sel + suffix + ta.value.slice(e);
      ta.focus();
      ta.selectionStart = s + prefix.length;
      ta.selectionEnd = e + prefix.length;
      ta.dispatchEvent(new Event("input"));
    }

    $("#md-bold")?.addEventListener("click", () => wrap("**"));
    $("#md-code")?.addEventListener("click", () => wrap("`"));
    $("#md-quote")?.addEventListener("click", () => {
      const ta = textarea;
      const s = ta.selectionStart;
      const before = ta.value.slice(0, s).replace(/[^\n]*$/, "");
      const after = ta.value.slice(s);
      ta.value = before + "> " + after;
      ta.dispatchEvent(new Event("input"));
    });

    textarea?.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); wrap("**"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { form.requestSubmit(); }
    });

    // Image upload
    $("#attach-btn")?.addEventListener("click", () => $("#image-input")?.click());
    $("#image-input")?.addEventListener("change", (e) => uploadAndInsert(e.target.files?.[0]));
    ["dragover","dragenter"].forEach((ev) =>
      textarea?.addEventListener(ev, (e) => { e.preventDefault(); textarea.style.borderColor = "var(--color-primary)"; })
    );
    ["dragleave","drop"].forEach((ev) =>
      textarea?.addEventListener(ev, (e) => { e.preventDefault(); textarea.style.borderColor = ""; })
    );
    textarea?.addEventListener("drop", (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (f) uploadAndInsert(f);
    });

    form.addEventListener("submit", onReplySubmit);
  }

  async function uploadAndInsert(file) {
    if (!file) return;
    const textarea = $("#reply-content");
    const error = $("#reply-error");
    if (error) error.textContent = "";

    const placeholder = `\n![${t("uploading","Uploading image...")}](uploading)\n`;
    const start = textarea.selectionStart;
    textarea.value = textarea.value.slice(0, start) + placeholder + textarea.value.slice(start);
    textarea.dispatchEvent(new Event("input"));

    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "upload failed");
      textarea.value = textarea.value.replace(placeholder, `\n![image](${data.url})\n`);
    } catch (err) {
      textarea.value = textarea.value.replace(placeholder, "");
      if (error) error.textContent = err.message || t("uploadError","Error uploading image");
    }
    textarea.dispatchEvent(new Event("input"));
  }

  async function onReplySubmit(e) {
    e.preventDefault();
    const user = state.user;
    if (!user) { toggleAuthModal(); return; }
    const content = $("#reply-content").value.trim();
    if (content.length < 2) return;
    const btn = $("#submit-reply");
    const err = $("#reply-error");
    if (err) err.textContent = "";
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/forum/topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic_id: state.topicId,
          user_id: user.id,
          username: user.username,
          content,
          lang: (/[\u10A0-\u10FF]/.test(content) ? "ka" : /[\u0400-\u04FF]/.test(content) ? "ru" : "en"),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.reason || "failed");
      // Reload topic
      await loadTopicData();
      // Scroll to new post
      const newPost = document.getElementById(`post-${data.postId}`);
      if (newPost) newPost.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      if (err) err.textContent = error.message || t("errorSending","Error sending reply");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${esc(t("reply","Reply"))}</span>`;
    }
  }

  // ========================================================== Click delegation
  async function onStreamClick(e) {
    const target = e.target.closest("[data-action], [data-react-post], [data-react-open]");
    if (!target) return;

    if (target.dataset.reactOpen) {
      openReactionPicker(target);
      return;
    }

    if (target.dataset.reactPost) {
      await toggleReaction(target.dataset.reactPost, target.dataset.emoji);
      return;
    }

    const action = target.dataset.action;
    const postId = target.dataset.post;

    if (action === "solve") return markSolution(postId);
    if (action === "delete") return deletePost(postId);
    if (action === "edit")   return editPost(postId);
    if (action === "report") return reportPost(postId);
  }

  function openReactionPicker(anchorEl) {
    const existing = document.getElementById("reaction-picker");
    if (existing) { existing.remove(); return; }

    const picker = document.createElement("div");
    picker.id = "reaction-picker";
    picker.style.cssText = `
      position: absolute; z-index: 50;
      background: var(--color-surface-2); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 6px;
      display: flex; gap: 4px; box-shadow: var(--shadow-md);`;
    picker.innerHTML = REACTION_EMOJIS.map((em) =>
      `<button class="react-btn" data-react-post="${esc(anchorEl.dataset.reactOpen)}" data-emoji="${esc(em)}" style="padding:4px 8px;font-size:18px;">${em}</button>`
    ).join("");
    document.body.appendChild(picker);
    const rect = anchorEl.getBoundingClientRect();
    picker.style.left = `${rect.left + window.scrollX}px`;
    picker.style.top = `${rect.top + window.scrollY - picker.offsetHeight - 6}px`;
    setTimeout(() => {
      const onDoc = (evt) => {
        if (!picker.contains(evt.target) && evt.target !== anchorEl) {
          picker.remove();
          document.removeEventListener("click", onDoc);
        }
      };
      document.addEventListener("click", onDoc);
    }, 0);
  }

  async function toggleReaction(postId, emoji) {
    if (!state.user) return toggleAuthModal();
    const token = localStorage.getItem("auth_token");
    try {
      const res = await fetch("/api/forum/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ post_id: postId, emoji }),
      });
      if (!res.ok) throw new Error("reaction failed");
      await loadTopicData();
    } catch (e) { console.error(e); }
  }

  async function markSolution(postId) {
    if (!confirm(t("confirmSolution","Mark this post as the solution?"))) return;
    const token = localStorage.getItem("auth_token");
    try {
      const res = await fetch("/api/forum/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ topic_id: state.topicId, post_id: postId, user_id: state.user.id }),
      });
      if (res.ok) await loadTopicData();
    } catch (e) { console.error(e); }
  }

  async function deletePost(postId) {
    if (!confirm(t("confirmDelete","Delete this post?"))) return;
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/forum/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ post_id: postId, user_id: state.user.id }),
    });
    if (res.ok) await loadTopicData();
  }

  async function editPost(postId) {
    const post = state.posts.find((p) => p.id === postId);
    if (!post) return;
    const newContent = prompt(t("edit","Edit"), post.content);
    if (!newContent || newContent.trim() === post.content) return;
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/forum/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ post_id: postId, content: newContent.trim(), user_id: state.user.id }),
    });
    if (res.ok) await loadTopicData();
  }

  async function reportPost(postId) {
    const reason = prompt(t("report","Report") + ":");
    if (!reason) return;
    const token = localStorage.getItem("auth_token");
    try {
      await fetch("/api/forum/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ post_id: postId, reason, user_id: state.user.id }),
      });
      alert(t("reportThanks","Thanks — our moderators will review it."));
    } catch (e) { console.error(e); }
  }

  // ========================================================== Data
  async function loadTopicData() {
    const userId = state.user?.id || "";
    try {
      const res = await fetch(`/api/forum/topic?id=${encodeURIComponent(state.topicId)}&user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      state.topic = data.topic;
      state.posts = data.posts || [];
      renderTopic();
    } catch (err) {
      console.error(err);
      $("#topic-content").innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> ${esc(t("errorLoading","Error loading topic"))}: ${esc(err.message)}</div>`;
    }
  }

  // ========================================================== i18n
  function applyI18n() {
    const dict = window.APP_TRANSLATIONS?.[state.lang] || {};
    $$("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });
    const disp = $("#forum-lang-display");
    if (disp) disp.textContent = { en: "EN", ru: "RU", ka: "GE" }[state.lang] || "EN";
  }

  window.switchForumLanguage = function () {
    const order = ["en", "ru", "ka"];
    state.lang = order[(order.indexOf(state.lang) + 1) % order.length];
    localStorage.setItem("forumLanguage", state.lang);
    localStorage.setItem("language", state.lang);
    applyI18n();
    if (state.topic) renderTopic();
  };

  window.toggleAuthModal = function () {
    document.getElementById("auth-modal")?.classList.toggle("active");
  };

  window.toggleMobileMenu = function () {
    document.querySelector(".mobile-menu-overlay")?.classList.toggle("active");
    document.querySelector(".mobile-offcanvas")?.classList.toggle("active");
  };

  // ========================================================== Boot
  document.addEventListener("DOMContentLoaded", () => {
    if (!state.topicId) {
      window.location.href = "/forum";
      return;
    }
    applyI18n();
    loadTopicData();
  });
})();
