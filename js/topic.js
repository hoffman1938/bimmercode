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
    /** true if the logged-in user muted this thread under notification settings (no reply/reaction notifs) */
    topicNotifMuted: false,
    /** { kind: "topic"|"post", id: string } when editing a post in the reply composer */
    editMode: null,
    /** When set, next reply is linked to this post: { id: string, username: string } */
    replyTarget: null,
    /** Uploaded image URLs for current reply; markdown is built on submit (images first, then text) */
    composerImageUrls: [],
  };

  // Reload user from localStorage
  try { state.user = JSON.parse(localStorage.getItem("user_data") || "null"); } catch {}

  const REACTION_EMOJIS = ["👍", "❤️", "🔥", "🚗", "🔧", "😂", "😮", "🎉"];

  /** Strip markdown image syntax into `urls` in order; return remaining text for the composer textarea. */
  function parseImagesFromMarkdown(md) {
    const urls = [];
    const text = String(md || "").replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_f, _a, href) => {
        const u = (href || "").trim();
        if (u && u !== "uploading" && (u.startsWith("/") || /^https?:\/\//i.test(u))) {
          urls.push(u);
        }
        return "";
      }
    );
    return { text: text.replace(/\n{3,}/g, "\n\n").trim(), urls };
  }

  /** Full markdown: uploaded images (state) first, then textarea. */
  function buildComposerMarkdown() {
    const text = ($("#reply-content")?.value || "").trim();
    const urls = state.composerImageUrls || [];
    const imgBlock = urls.filter(Boolean).map((u) => `![image](${u})`).join("\n");
    if (!imgBlock) return text;
    if (!text) return imgBlock;
    return imgBlock + "\n\n" + text;
  }

  function getComposerCharCount() {
    return buildComposerMarkdown().length;
  }

  function renderComposerThumbnails() {
    const host = $("#composer-image-previews");
    if (!host) return;
    const urls = state.composerImageUrls || [];
    if (!urls.length) {
      host.innerHTML = "";
      host.hidden = true;
    } else {
      host.hidden = false;
      const label = esc(t("composerAttachedImages", "Attached images"));
      const row = urls
        .map(
          (u, i) =>
            `<div class="composer-thumb-wrap">
              <img class="composer-thumb" src="${esc(u)}" alt="" loading="lazy" decoding="async" />
              <button type="button" class="composer-thumb-remove" data-composer-remove="${i}" title="${esc(t("remove", "Remove"))}"><i class="fas fa-times" aria-hidden="true"></i></button>
            </div>`
        )
        .join("");
      host.innerHTML =
        `<div class="composer-image-previews__label">${label}</div><div class="composer-image-previews__row">${row}</div>`;
    }
    const c = $("#reply-count");
    if (c) c.textContent = String(getComposerCharCount());
  }

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

  /** One-line plain text for reply previews (parent post may be stored as markdown). */
  function markdownToPlainExcerpt(md) {
    return String(md || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)]\([^)]*\)/g, (_m, t) => t)
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/(\*\*|__|~~)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function trimReplyExcerpt(s, max = 200) {
    const t = String(s || "").trim();
    if (t.length <= max) return t;
    return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
  }

  /**
   * Replaces native confirm / prompt / alert with themed modals.
   * @typedef {{ type: "confirm", message: string, title?: string, confirmText?: string, cancelText?: string, danger?: boolean }} ForumDialogConfirm
   * @typedef {{ type: "prompt", message: string, title?: string, label?: string, placeholder?: string, confirmText?: string, cancelText?: string, requireNonEmpty?: boolean }} ForumDialogPrompt
   * @typedef {{ type: "alert", message: string, title?: string, okText?: string, variant?: "error"|"info" }} ForumDialogAlert
   */
  const forumAppDialog = (function () {
    let root = null;
    /** @type {{ resolve: (v: any) => void, mode: string, requireNonEmpty: boolean } | null} */
    let st = null;
    /** @type {((e: KeyboardEvent) => void) | null} */
    let onKey = null;

    function ensure() {
      if (root) return root;
      root = document.createElement("div");
      root.id = "forum-app-dialog";
      root.className = "forum-app-dialog";
      root.setAttribute("hidden", "");
      root.innerHTML = `
        <div class="forum-app-dialog__backdrop" data-fd-act="dismiss" aria-hidden="true"></div>
        <div class="forum-app-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="forum-app-dialog-h">
          <button type="button" class="forum-app-dialog__close" data-fd-act="dismiss" aria-label="${esc(t("dialogClose", "Close"))}"><i class="fas fa-times" aria-hidden="true"></i></button>
          <h2 id="forum-app-dialog-h" class="forum-app-dialog__title"></h2>
          <p class="forum-app-dialog__message"></p>
          <p class="forum-app-dialog__err" role="alert" hidden></p>
          <div class="forum-app-dialog__field" hidden>
            <label for="forum-app-dialog-ta" class="forum-app-dialog__label"></label>
            <textarea id="forum-app-dialog-ta" class="forum-app-dialog__textarea" rows="4" autocomplete="off"></textarea>
          </div>
          <div class="forum-app-dialog__actions">
            <button type="button" class="btn btn-ghost" data-fd-act="secondary"></button>
            <button type="button" class="btn btn-primary" data-fd-act="primary"></button>
          </div>
        </div>`;
      document.body.appendChild(root);
      root.addEventListener("click", (e) => {
        const a = (/** @type {HTMLElement} */ (e.target)).closest("[data-fd-act]");
        if (!a) return;
        const act = a.getAttribute("data-fd-act");
        if (act === "dismiss") return finishDismiss();
        if (act === "primary") return clickPrimary();
        if (act === "secondary") return finishDismiss();
      });
      return root;
    }

    function hideErr() {
      const e = document.querySelector(".forum-app-dialog__err");
      if (e) {
        e.setAttribute("hidden", "");
        e.textContent = "";
      }
    }

    function showErr(msg) {
      const e = document.querySelector(".forum-app-dialog__err");
      if (!e) return;
      e.textContent = msg;
      e.removeAttribute("hidden");
    }

    function finishDismiss() {
      if (!st) return;
      const mode = st.mode;
      const r = st.resolve;
      st = null;
      if (onKey) {
        document.removeEventListener("keydown", onKey, true);
        onKey = null;
      }
      if (root) {
        root.setAttribute("hidden", "");
        root.classList.remove("is-open");
        root.classList.remove("forum-app-dialog--danger");
        root.classList.remove("forum-app-dialog--error");
      }
      document.body.classList.remove("forum-app-dialog--open");
      if (mode === "confirm") r(false);
      else if (mode === "prompt") r(null);
      else if (mode === "alert") r(undefined);
    }

    function closeSuccess(val) {
      if (!st) return;
      const r = st.resolve;
      st = null;
      if (onKey) {
        document.removeEventListener("keydown", onKey, true);
        onKey = null;
      }
      if (root) {
        root.setAttribute("hidden", "");
        root.classList.remove("is-open");
        root.classList.remove("forum-app-dialog--danger");
        root.classList.remove("forum-app-dialog--error");
      }
      document.body.classList.remove("forum-app-dialog--open");
      r(val);
    }

    function clickPrimary() {
      if (!st) return;
      if (st.mode === "alert") {
        return closeSuccess(undefined);
      }
      if (st.mode === "confirm") {
        return closeSuccess(true);
      }
      if (st.mode === "prompt") {
        const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById("forum-app-dialog-ta"));
        const v = (ta?.value || "").trim();
        if (st.requireNonEmpty && !v) {
          showErr(t("dialogFieldRequired", "Please enter a description."));
          return;
        }
        hideErr();
        return closeSuccess(v);
      }
    }

    function bindKey() {
      onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finishDismiss();
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && st?.mode === "prompt") {
          e.preventDefault();
          clickPrimary();
        }
      };
      document.addEventListener("keydown", onKey, true);
    }

    /**
     * @param {ForumDialogConfirm | ForumDialogPrompt | ForumDialogAlert} opts
     */
    function open(opts) {
      return new Promise((resolve) => {
        const dlg = ensure();
        const type = opts.type;
        st = {
          resolve,
          mode: type,
          requireNonEmpty: type === "prompt" ? opts.requireNonEmpty !== false : true,
        };
        hideErr();

        dlg.classList.remove("forum-app-dialog--error");
        if (type === "confirm" && opts.danger) {
          dlg.classList.add("forum-app-dialog--danger");
        } else {
          dlg.classList.remove("forum-app-dialog--danger");
        }
        if (type === "alert" && opts.variant === "error") {
          dlg.classList.add("forum-app-dialog--error");
        } else {
          dlg.classList.remove("forum-app-dialog--error");
        }

        const titleEl = dlg.querySelector(".forum-app-dialog__title");
        const msgEl = dlg.querySelector(".forum-app-dialog__message");
        const field = dlg.querySelector(".forum-app-dialog__field");
        const labelEl = dlg.querySelector(".forum-app-dialog__label");
        const secBtn = dlg.querySelector("[data-fd-act=secondary]");
        const okBtn = dlg.querySelector("[data-fd-act=primary]");

        if (titleEl) {
          titleEl.textContent = (opts.title || (type === "alert" ? t("dialogNotice", "Notice") : t("dialogConfirmTitle", "Confirm"))).trim();
        }
        if (msgEl) {
          msgEl.textContent = opts.message || "";
        }

        if (type === "prompt") {
          if (field) field.removeAttribute("hidden");
          if (labelEl) {
            labelEl.textContent = opts.label || t("dialogYourMessage", "Details");
            labelEl.setAttribute("for", "forum-app-dialog-ta");
          }
          const ta = document.getElementById("forum-app-dialog-ta");
          if (ta) {
            ta.value = "";
            ta.placeholder = opts.placeholder || "";
            requestAnimationFrame(() => {
              ta.focus();
            });
          }
        } else {
          if (field) field.setAttribute("hidden", "");
        }

        if (type === "alert") {
          if (secBtn) {
            secBtn.setAttribute("hidden", "");
          }
          if (okBtn) {
            okBtn.removeAttribute("hidden");
            okBtn.textContent = opts.okText || t("dialogOk", "OK");
            okBtn.className = "btn btn-primary" + (opts.variant === "error" ? " forum-app-dialog__btn-ok" : "");
          }
        } else {
          if (secBtn) {
            secBtn.removeAttribute("hidden");
            secBtn.textContent = type === "confirm" ? opts.cancelText || t("dialogCancel", "Cancel") : opts.cancelText || t("dialogCancel", "Cancel");
            secBtn.className = "btn btn-ghost";
          }
          if (okBtn) {
            okBtn.removeAttribute("hidden");
            if (type === "confirm") {
              okBtn.textContent = opts.confirmText || t("dialogOk", "OK");
              okBtn.className = opts.danger ? "btn btn-danger" : "btn btn-primary";
            } else {
              okBtn.textContent = opts.confirmText || t("dialogSend", "Submit");
              okBtn.className = "btn btn-primary";
            }
          }
        }

        dlg.removeAttribute("hidden");
        dlg.classList.add("is-open");
        document.body.classList.add("forum-app-dialog--open");
        bindKey();
        if (type === "alert") {
          if (okBtn) okBtn.focus();
        } else if (type === "confirm") {
          if (secBtn) secBtn.focus();
        }
      });
    }

    return { open };
  })();

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
    if (role === "super_admin_role")
      return { key: "super", icon: "fa-user-shield", label: t("roleSuperAdmin", "Super admin") };
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

  async function refreshNotificationMutes() {
    state.topicNotifMuted = false;
    if (!state.user?.id) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    try {
      const res = await fetch("/api/notifications/mute", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const mutes = data.mutes || [];
      state.topicNotifMuted = mutes.some(
        (m) => m && m.scope === "topic" && String(m.target_id) === String(state.topicId)
      );
    } catch {
      /* ignore */
    }
  }

  async function unmuteTopicNotifications() {
    const token = localStorage.getItem("auth_token");
    if (!state.user || !token || !state.topicId) return;
    try {
      const res = await fetch("/api/notifications/mute", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scope: "topic", target_id: state.topicId }),
      });
      if (!res.ok) return;
      state.topicNotifMuted = false;
      try {
        document.dispatchEvent(new CustomEvent("notification-mutes-changed", { detail: { scope: "topic", target_id: state.topicId } }));
      } catch (_) { /* ignore */ }
      renderTopic();
      if (window.__notifications?.refresh) window.__notifications.refresh();
    } catch (e) {
      console.error(e);
    }
  }

  // ========================================================== Rendering
  function renderTopic() {
    const host = $("#topic-content");
    if (!host) return;
    state.editMode = null;
    state.composerImageUrls = [];
    const { topic, posts } = state;

    const tags = (topic.tags || []).map((tg) => {
      const color = tg.color || "#1C69D4";
      return `<span class="badge badge-tag" style="color:${color};border-color:${color}55;background:${color}14;">#${esc(tg.name)}</span>`;
    }).join("");

    const badges = [];
    if (topic.is_pinned) badges.push(`<span class="badge badge-pinned"><i class="fas fa-thumbtack"></i> ${esc(t("pinned","Pinned"))}</span>`);
    if (topic.is_solved) badges.push(`<span class="badge badge-solved"><i class="fas fa-check"></i> ${esc(t("solved","Solved"))}</span>`);
    if (topic.is_locked) badges.push(`<span class="badge badge-locked"><i class="fas fa-lock"></i> ${esc(t("locked","Locked"))}</span>`);
    if (topic.related_code) badges.push(
      `<button type="button" class="badge badge-code badge-code-link" ` +
      `data-code="${esc(topic.related_code)}" ` +
      `title="${esc(t("viewCodeDetails","View code details"))}">` +
      `<i class="fas fa-code" aria-hidden="true"></i> ${esc(topic.related_code)}` +
      `</button>`
    );

    const mutedBanner = state.topicNotifMuted
      ? `<div class="topic-notif-muted-banner" role="status">
          <i class="fas fa-bell-slash" aria-hidden="true"></i>
          <div class="topic-notif-muted-banner__text">
            <span>${esc(t("topicNotifMutedBanner", "You muted notifications for this thread. Replies and reactions will not create alerts until you turn them back on."))}</span>
          </div>
          <button type="button" class="btn btn-sm topic-notif-muted-banner__btn" data-action="unmute-topic-notif">
            ${esc(t("unmuteTopicNotifs", "Turn on notifications"))}
          </button>
        </div>`
      : "";

    host.innerHTML = `
      ${mutedBanner}
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
          ${isStaff() ? staffPinTopicButton(topic) : ""}
        </div>
      </article>

      <div class="posts-stream" id="posts-stream">
        ${renderPostCard(topic, { isOriginal: true })}
        ${posts.map((p) => renderPostCard(p)).join("")}
      </div>

      ${renderComposer()}
    `;

    // Re-bind: avoid duplicate listeners on repeated render
    host.removeEventListener("click", onStreamClick);
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
    enhancePostTextImages(host);
    ensurePostImageLightbox(host);
  }

  /** Marked may emit <p> with <img> and <br> between; only element children are IMG and/or BR */
  function isImageOrBreaksOnlyParagraph(p) {
    if (!p || p.tagName !== "P") return false;
    let imgCount = 0;
    for (const c of p.children) {
      if (c.tagName === "IMG") imgCount++;
      else if (c.tagName !== "BR") return false;
    }
    return imgCount >= 1;
  }

  function trimImageParagraphBreaks(p) {
    p.querySelectorAll("br").forEach((br) => br.remove());
  }

  /** p whose direct children are only <img> (one or more), after <br> removal */
  function isImageOnlyParagraph(p) {
    if (!p || p.tagName !== "P") return false;
    if (p.children.length < 1) return false;
    for (const c of p.children) {
      if (c.tagName !== "IMG") return false;
    }
    return true;
  }

  function isMultiImageParagraph(p) {
    return isImageOnlyParagraph(p) && p.children.length > 1;
  }

  function isSingleImageParagraph(p) {
    return isImageOnlyParagraph(p) && p.children.length === 1;
  }

  function initPostTextImageRails(root) {
    if (!root) return;
    root.querySelectorAll(".post-text-images-rail").forEach((rail) => {
      if (rail.dataset.railInit === "1") return;
      const row = rail.querySelector(".post-text-images-row");
      if (!row) return;
      rail.dataset.railInit = "1";

      const prev = document.createElement("button");
      const next = document.createElement("button");
      prev.type = "button";
      next.type = "button";
      prev.className = "post-text-images-rail__btn post-text-images-rail__btn--prev";
      next.className = "post-text-images-rail__btn post-text-images-rail__btn--next";
      prev.setAttribute("aria-label", t("imageRowPrev", "Previous images"));
      next.setAttribute("aria-label", t("imageRowNext", "Next images"));
      prev.innerHTML = "<i class=\"fas fa-chevron-left\" aria-hidden=\"true\"></i>";
      next.innerHTML = "<i class=\"fas fa-chevron-right\" aria-hidden=\"true\"></i>";
      rail.appendChild(prev);
      rail.appendChild(next);

      const step = () => Math.max(120, row.clientWidth * 0.75);
      prev.addEventListener("click", (e) => {
        e.preventDefault();
        row.scrollBy({ left: -step(), behavior: "smooth" });
      });
      next.addEventListener("click", (e) => {
        e.preventDefault();
        row.scrollBy({ left: step(), behavior: "smooth" });
      });

      const update = () => {
        const scrollable = row.scrollWidth > row.clientWidth + 2;
        rail.classList.toggle("post-text-images-rail--scrollable", scrollable);
        const sl = row.scrollLeft;
        const maxSl = row.scrollWidth - row.clientWidth;
        prev.disabled = !scrollable || sl <= 1;
        next.disabled = !scrollable || sl >= maxSl - 1;
      };
      row.addEventListener("scroll", update, { passive: true });
      if (typeof ResizeObserver === "function") {
        new ResizeObserver(update).observe(row);
      } else {
        globalThis.addEventListener?.("resize", update);
      }
      row.querySelectorAll("img").forEach((im) => {
        if (!im.complete) im.addEventListener("load", update, { once: true });
      });
      update();
    });
  }

  /**
   * - One <p> with several images (incl. <br> from Markdown) → horizontal row + scroll rail.
   * - Consecutive <p> with one <img> each — merge into .post-image-gallery (grid, wrap).
   */
  function enhancePostTextImages(container) {
    if (!container) return;
    container.querySelectorAll(".post-text").forEach((block) => {
      const kids = Array.from(block.children);
      let i = 0;
      while (i < kids.length) {
        const node = kids[i];
        if (node.tagName === "P" && isImageOrBreaksOnlyParagraph(node)) {
          trimImageParagraphBreaks(node);
        }
        if (isMultiImageParagraph(node)) {
          const rail = document.createElement("div");
          rail.className = "post-text-images-rail";
          block.insertBefore(rail, node);
          node.classList.add("post-text-images-row");
          rail.appendChild(node);
          i++;
          continue;
        }
        if (isSingleImageParagraph(node)) {
          const group = [node];
          let j = i + 1;
          while (j < kids.length && isSingleImageParagraph(kids[j])) {
            group.push(kids[j]);
            j++;
          }
          const gallery = document.createElement("div");
          gallery.className = "post-image-gallery";
          const ref = group[0];
          block.insertBefore(gallery, ref);
          group.forEach((p) => {
            p.classList.add("post-image-gallery__item");
            gallery.appendChild(p);
          });
          i = j;
          continue;
        }
        i++;
      }
    });
    container.querySelectorAll(".post-text img").forEach((im) => {
      im.classList.add("post-text-img--zoomable");
      im.setAttribute("tabindex", "0");
      im.setAttribute("role", "button");
    });
    initPostTextImageRails(container);
  }

  function ensurePostImageLightbox(host) {
    if (!host || host.dataset.imgLightbox === "1") return;
    host.dataset.imgLightbox = "1";
    host.addEventListener("click", (e) => {
      const im = e.target.closest("img.post-text-img--zoomable");
      if (!im) return;
      e.preventDefault();
      const postText = im.closest(".post-text");
      const list = postText
        ? Array.from(postText.querySelectorAll("img.post-text-img--zoomable"))
        : [im];
      const hrefs = list.map((x) => x.currentSrc || x.src);
      const ix = Math.max(0, list.indexOf(im));
      if (typeof globalThis.openForumImageLightbox === "function") {
        globalThis.openForumImageLightbox(hrefs, ix);
      }
    });
    host.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const im = e.target.closest("img.post-text-img--zoomable");
      if (!im) return;
      e.preventDefault();
      im.click();
    });
  }

  /** Accessible one-line summary (aria-label) */
  function formatReactionTooltip(emoji, reaction) {
    const n = reaction?.count ?? 0;
    const users = Array.isArray(reaction?.users) ? reaction.users.filter(Boolean) : [];
    if (!users.length) {
      return `${emoji}  ${n}`;
    }
    const max = 12;
    const head = users.slice(0, max);
    const more = users.length - max;
    const names = more > 0
      ? head.join(", ") + ` — +${more} ${t("reactionNamesMore", "more")}`
      : head.join(", ");
    return `${emoji}  ${names}`;
  }

  /** Markup: chip + styled popover with user list (no native title — CSS hover) */
  function renderReactionPill(p, r, activeClass) {
    const tip = formatReactionTooltip(r.emoji, r);
    const users = Array.isArray(r.users) ? r.users.filter(Boolean) : [];
    const listHtml =
      users.length > 0
        ? `<ul class="reaction-names-popover__ul">${users
            .slice(0, 24)
            .map((u) => `<li class="reaction-names-popover__li">${esc(u)}</li>`)
            .join("")}${
            users.length > 24
              ? `<li class="reaction-names-popover__more" role="presentation">+${users.length - 24} ${esc(
                  t("reactionNamesMore", "more")
                )}</li>`
              : ""
          }</ul>`
        : "";

    const popover =
      users.length > 0
        ? `<span class="reaction-names-popover" role="tooltip">
        <span class="reaction-names-popover__header">
          <span class="reaction-names-popover__emoji" aria-hidden="true">${r.emoji}</span>
          <span class="reaction-names-popover__meta">${esc(t("reactionWho", "Reacted"))} · <strong>${r.count}</strong></span>
        </span>
        ${listHtml}
      </span>`
        : "";

    return `<span class="reaction-pill-wrap${users.length ? " has-popover" : ""}">
      <button type="button" class="reaction-pill${activeClass}" data-react-post="${esc(p.id)}" data-emoji="${esc(
      r.emoji
    )}" aria-label="${esc(tip)}">
        <span class="reaction-emoji" aria-hidden="true">${r.emoji}</span><span class="reaction-count">${r.count}</span>
      </button>${popover}
    </span>`;
  }

  function renderPostCard(p, { isOriginal = false } = {}) {
    if (p.is_hidden) {
      const postId = isOriginal ? `op` : `post-${esc(p.id)}`;
      const kindClass = isOriginal ? " post-card--original" : " post-card--reply";
      return `
      <article class="post-card post-card--hidden${kindClass}" id="${postId}">
        <div class="post-body post-body--hidden">
          <p class="post-hidden-msg"><i class="fas fa-user-slash" aria-hidden="true"></i> ${esc(
            t("postHiddenBlockedUser", "This comment is hidden because you have blocked this user.")
          )}</p>
        </div>
      </article>`;
    }
    const solved = !!(p.is_solution);
    const pinned = !!(p.is_pinned);
    const avatar = p.author_avatar
      ? `<img class="avatar" src="${esc(p.author_avatar)}" alt="" loading="lazy" onerror="this.src='./assets/icons/ico.svg'">`
      : `<div class="avatar" style="display:flex;align-items:center;justify-content:center;font-weight:700;font-size:28px;">${esc((p.username||'?')[0]?.toUpperCase())}</div>`;
    const isOP = isOriginal;
    const rep = p.author_reputation || 0;

    // Reactions row (no shared .react-btn with toolbar — avoids heavy borders on emoji)
    const reactions = (p.reactions || []);
    const mine = new Set(p.my_reactions || []);
    const reactionsHtml = reactions.length
      ? reactions.map((r) => {
          const active = mine.has(r.emoji) ? " is-active" : "";
          return renderReactionPill(p, r, active);
        }).join("")
      : "";

    const body = renderMarkdown(p.content || "");

    const postId = isOriginal ? `op` : `post-${esc(p.id)}`;
    const kindClass = isOP ? " post-card--original" : " post-card--reply";
    const profileUrl = p.user_id ? `/profile?id=${encodeURIComponent(p.user_id)}` : "";
    const authorBlock = `${avatar}
          <div class="username">${esc(p.username)}</div>
          ${repBadgeHtml(rep, p.author_role)}
          ${isOP ? `<div class="rep-score">${esc(t("opLabel","Original poster"))}</div>` : `<div class="rep-score">${rep} rep</div>`}`;

    const authorCol = profileUrl
      ? `<a class="post-author-link" href="${profileUrl}" title="${esc(t("viewUserProfile", "View profile"))}">${authorBlock}</a>`
      : `<div class="post-author-static">${authorBlock}</div>`;

    return `
      <article class="post-card${kindClass}${solved ? " is-solution" : ""}${pinned ? " is-pinned" : ""}" id="${postId}">
        ${isOP ? `<div class="post-card-ribbon" aria-hidden="true"><span class="post-card-ribbon__text"><i class="fas fa-bolt"></i> ${esc(t("topicOpeningPost", "Topic"))}</span></div>` : ""}
        <div class="post-author">
          ${authorCol}
        </div>
        <div class="post-body">
          <div class="post-meta">
            <a class="permalink" href="#${postId}"><i class="fas fa-link"></i> ${esc(timeAgo(p.created_at))}</a>
            ${pinned ? `<span class="badge badge-pinned"><i class="fas fa-thumbtack"></i> ${esc(t("pinned","Pinned"))}</span>` : ""}
            ${solved ? `<span class="badge badge-solved"><i class="fas fa-check"></i> ${esc(t("solution","Solution"))}</span>` : ""}
            ${!isOP ? `<span class="post-kind-badge" data-kind="reply"><i class="fas fa-reply"></i> ${esc(t("replyPostLabel", "Comment"))}</span>` : ""}
          </div>
          ${postReplyingToLine(p)}
          <div class="post-text">${body}</div>
          <div class="post-actions">
            <div class="post-actions-reactions" role="group" aria-label="Reactions">
            <button type="button" class="reaction-adder" data-react-open="${esc(p.id)}" aria-label="Add reaction">
              <i class="far fa-smile"></i>
            </button>
            ${reactionsHtml}
            </div>
            <div class="post-actions-tools">
            ${state.user && !state.topic?.is_locked ? `<button type="button" class="post-action-link" data-action="reply" data-post="${esc(p.id)}" data-reply-author="${esc(p.username || "")}"><i class="fas fa-reply"></i> ${esc(t("reply", "Reply"))}</button>` : ""}
            ${!isOP && canMarkSolution() && !solved ? `<button type="button" class="post-action-link" data-action="solve" data-post="${esc(p.id)}"><i class="fas fa-check"></i> ${esc(t("markSolution","Mark as solution"))}</button>` : ""}
            ${!isOP && canMarkSolution() && solved ? `<button type="button" class="post-action-link post-action-link--warn" data-action="unsolve" data-post="${esc(p.id)}"><i class="fas fa-times"></i> ${esc(t("unmarkSolution","Remove solution"))}</button>` : ""}
            ${canEdit(p) ? `<button type="button" class="post-action-link" data-action="edit" data-post="${esc(p.id)}"><i class="fas fa-edit"></i> ${esc(t("edit","Edit"))}</button>` : ""}
            ${canDelete(p) ? `<button type="button" class="post-action-link post-action-link--danger" data-action="delete" data-post="${esc(p.id)}"><i class="fas fa-trash"></i> ${esc(t("delete","Delete"))}</button>` : ""}
            ${isStaff() ? staffPinPostButton(p, isOP) : ""}
            ${state.user && !isOP ? `<button type="button" class="post-action-link" data-action="report" data-post="${esc(p.id)}"><i class="fas fa-flag"></i> ${esc(t("report","Report"))}</button>` : ""}
            </div>
          </div>
        </div>
      </article>`;
  }

  const STAFF_ROLES = new Set([
    "super_admin_role",
    "admin_role",
    "senior_moderator_role",
    "moderator_role",
  ]);

  function isStaff() {
    const r = state.user?.role_id || state.user?.role;
    return !!r && STAFF_ROLES.has(r);
  }

  function staffPinTopicButton(topic) {
    const pinned = !!topic.is_pinned;
    const label = pinned ? t("unpinTopic", "Unpin topic") : t("pinTopic", "Pin topic");
    return `<button type="button" class="post-action-link topic-header-pin" data-action="${pinned ? "unpin-topic" : "pin-topic"}" title="${esc(label)}"><i class="fas fa-thumbtack"></i> ${esc(label)}</button>`;
  }

  function staffPinPostButton(p, isOP) {
    const pinned = isOP ? !!state.topic?.is_pinned : !!p.is_pinned;
    const label = pinned ? t("unpinPost", "Unpin comment") : t("pinPost", "Pin comment");
    const action = pinned ? "unpin-post" : "pin-post";
    return `<button type="button" class="post-action-link" data-action="${action}" data-post="${esc(p.id)}" title="${esc(label)}"><i class="fas fa-thumbtack"></i> ${esc(label)}</button>`;
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
    const r = state.user.role_id || state.user.role;
    return STAFF_ROLES.has(r);
  }

  function excerptForReplyFromPost(postId) {
    const openId = state.topic?.id;
    const domId = String(postId) === String(openId) ? "op" : `post-${postId}`;
    const card = document.getElementById(domId);
    const textEl = card?.querySelector(".post-text");
    if (!textEl) return "";
    return trimReplyExcerpt(markdownToPlainExcerpt(textEl.textContent || ""), 220);
  }

  /** In-thread context: who you replied to + optional quote from the parent. */
  function postReplyingToLine(p) {
    if (!p.reply_to_post_id || !p.reply_to_username) return "";
    if (p.is_hidden) return "";
    const openId = state.topic?.id;
    const toId = String(p.reply_to_post_id);
    const href =
      openId && toId === String(openId) ? "#op" : `#post-${esc(p.reply_to_post_id)}`;
    const who = esc(p.reply_to_username);
    const exRaw = p.reply_to_excerpt || "";
    const exPlain = exRaw
      ? trimReplyExcerpt(markdownToPlainExcerpt(exRaw), 220)
      : "";
    const exEsc = exPlain ? esc(exPlain) : "";
    const jumpLabel = esc(t("replyContextJump", "Show comment"));
    const headLabel = esc(t("replyContextHead", "In reply to"));
    const aria = esc(
      `${t("replyContextHead", "In reply to")} @${p.reply_to_username}. ${t("replyContextJump", "Show comment")}.`
    );
    return `<div class="post-reply-context">
      <a class="post-reply-context__link" href="${href}" aria-label="${aria}">
        <div class="post-reply-context__head">
          <span class="post-reply-context__icon" aria-hidden="true"><i class="fas fa-reply"></i></span>
          <div class="post-reply-context__meta">
            <div class="post-reply-context__title">
              <span class="post-reply-context__label">${headLabel}</span>
              <strong class="post-reply-context__user">@${who}</strong>
            </div>
            <span class="post-reply-context__action">${jumpLabel} <i class="fas fa-chevron-up" aria-hidden="true"></i></span>
          </div>
        </div>
        ${
          exEsc
            ? `<blockquote class="post-reply-context__quote" cite="${href}">${exEsc}</blockquote>`
            : ""
        }
      </a>
    </div>`;
  }

  function clearReplyTarget() {
    state.replyTarget = null;
    const bar = $("#composer-reply-bar");
    if (bar) bar.hidden = true;
    const txt = $("#composer-reply-text");
    if (txt) txt.textContent = "";
    const q = $("#composer-reply-quote");
    if (q) {
      q.textContent = "";
      q.hidden = true;
    }
  }

  function paintComposerReplyBar() {
    const bar = $("#composer-reply-bar");
    const txt = $("#composer-reply-text");
    const q = $("#composer-reply-quote");
    if (!bar || !txt) return;
    if (!state.replyTarget) {
      bar.hidden = true;
      txt.textContent = "";
      if (q) {
        q.textContent = "";
        q.hidden = true;
      }
      return;
    }
    bar.hidden = false;
    const u = (state.replyTarget.username || "").trim() || "?";
    const headLabel = t("replyContextHead", "In reply to");
    txt.textContent = `${headLabel} @${u}`;
    if (q) {
      const ex = (state.replyTarget.excerpt || "").trim();
      if (ex) {
        q.textContent = ex;
        q.hidden = false;
      } else {
        q.textContent = "";
        q.hidden = true;
      }
    }
  }

  function beginReplyTo(postId, username) {
    if (!state.user || !postId) return;
    if (state.topic?.is_locked) return;
    if (state.editMode) cancelPostEdit();
    const excerpt = excerptForReplyFromPost(postId);
    state.replyTarget = {
      id: String(postId),
      username: String(username || "").trim() || "?",
      excerpt: excerpt || "",
    };
    paintComposerReplyBar();
    const ta = $("#reply-content");
    document.getElementById("composer-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => ta?.focus(), 200);
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
        <div id="composer-edit-bar" class="composer-edit-bar" hidden>
          <div class="composer-edit-bar__inner">
            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
            <span id="composer-edit-hint"></span>
            <button type="button" class="btn btn-ghost btn-sm" id="cancel-post-edit">${esc(t("cancel", "Cancel"))}</button>
          </div>
        </div>
        <div id="composer-reply-bar" class="composer-reply-bar" hidden>
          <div class="composer-reply-bar__head">
            <span class="composer-reply-bar__icon" aria-hidden="true"><i class="fas fa-reply"></i></span>
            <div class="composer-reply-bar__titles">
              <span id="composer-reply-text" class="composer-reply-bar__line"></span>
              <div id="composer-reply-quote" class="composer-reply-bar__quote" hidden></div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="composer-reply-cancel">${esc(t("cancel", "Cancel"))}</button>
          </div>
        </div>
        <div class="composer-tabs">
          <button type="button" class="active" data-tab="write" data-i18n="writeTab">Write</button>
          <button type="button" data-tab="preview" data-i18n="preview">Preview</button>
        </div>
        <div id="composer-write">
          <div id="composer-image-previews" class="composer-image-previews" hidden></div>
          <textarea id="reply-content" placeholder="${esc(t("writeReplyTextBody","Type your message. Images you add show as small previews above."))}"></textarea>
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

    $("#cancel-post-edit")?.addEventListener("click", () => cancelPostEdit());
    $("#composer-reply-cancel")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      clearReplyTarget();
    });
    if (!state.editMode) {
      const bar = $("#composer-edit-bar");
      if (bar) bar.hidden = true;
    }

    textarea?.addEventListener("input", () => {
      if (count) count.textContent = String(getComposerCharCount());
    });

    form.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-composer-remove]");
      if (!removeBtn) return;
      const idx = parseInt(removeBtn.getAttribute("data-composer-remove"), 10);
      if (Number.isNaN(idx) || !state.composerImageUrls) return;
      state.composerImageUrls.splice(idx, 1);
      renderComposerThumbnails();
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
          const md = buildComposerMarkdown() || "";
          prevHost.innerHTML = renderMarkdown(md);
          prevHost.hidden = false;
          writeHost.hidden = true;
          enhancePostTextImages($("#composer-form"));
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
    resetComposerSubmitButton();
    renderComposerThumbnails();
    ensurePostImageLightbox($("#composer-form"));
    paintComposerReplyBar();
  }

  function resetComposerSubmitButton() {
    const submit = $("#submit-reply");
    if (submit) {
      submit.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${esc(t("reply", "Reply"))}</span>`;
    }
  }

  function applyEditModeToComposer() {
    const m = state.editMode;
    if (!m) return;
    const hint = $("#composer-edit-hint");
    const bar = $("#composer-edit-bar");
    const submit = $("#submit-reply");
    if (bar) bar.hidden = false;
    if (hint) {
      hint.textContent = m.kind === "topic" ? t("editingOpeningPost", "Editing the opening post") : t("editingReply", "Editing your reply");
    }
    if (submit) {
      submit.innerHTML = `<i class="fas fa-check"></i> <span>${esc(t("saveChanges", "Save changes"))}</span>`;
    }
  }

  function cancelPostEdit() {
    state.editMode = null;
    state.composerImageUrls = [];
    const ta = $("#reply-content");
    if (ta) {
      ta.value = "";
      ta.dispatchEvent(new Event("input"));
    }
    renderComposerThumbnails();
    const bar = $("#composer-edit-bar");
    if (bar) bar.hidden = true;
    const err = $("#reply-error");
    if (err) err.textContent = "";
    resetComposerSubmitButton();
  }

  function beginPostEdit(postId) {
    const isTopic = String(postId) === String(state.topic?.id);
    const post = isTopic ? state.topic : state.posts.find((p) => String(p.id) === String(postId));
    if (!post || !state.user) return;
    if (String(state.user.id) !== String(post.user_id)) return;

    clearReplyTarget();
    state.editMode = { kind: isTopic ? "topic" : "post", id: String(postId) };
    const parsed = parseImagesFromMarkdown(post.content || "");
    state.composerImageUrls = parsed.urls;
    const ta = $("#reply-content");
    if (ta) {
      ta.value = parsed.text;
      ta.dispatchEvent(new Event("input"));
    }
    renderComposerThumbnails();
    applyEditModeToComposer();
    document.getElementById("composer-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => ta?.focus(), 200);
  }

  function uploadErrorMessage(err) {
    const m = (err && err.message) || "";
    if (m === "not_image") return t("uploadNotImage", "Please choose an image file.");
    if (m === "svg_not_supported") return t("uploadNoSvg", "SVG files are not supported. Use PNG or JPEG.");
    if (m === "load_failed") return t("uploadReadError", "Could not read this image. Try another file.");
    if (m === "webp_encode_failed" || m === "image_too_large") {
      return t("uploadTooLargeAfterCompress", "Image is still too large after compression. Try a smaller file.");
    }
    return m || t("uploadError", "Error uploading image");
  }

  async function uploadAndInsert(file) {
    if (!file) return;
    const textarea = $("#reply-content");
    const error = $("#reply-error");
    if (error) error.textContent = t("uploadOptimizing", "Optimizing image…");

    try {
      let toSend = file;
      if (typeof globalThis.convertImageToWebP === "function") {
        toSend = await globalThis.convertImageToWebP(file, {
          maxLongEdge: 2560,
          quality: 0.82,
        });
      }
      const fd = new FormData();
      fd.append("file", toSend);
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "upload failed");
      if (!Array.isArray(state.composerImageUrls)) state.composerImageUrls = [];
      state.composerImageUrls.push(data.url);
      renderComposerThumbnails();
      if (error) error.textContent = "";
    } catch (err) {
      if (error) error.textContent = uploadErrorMessage(err);
    }
    textarea?.dispatchEvent(new Event("input"));
  }

  async function onReplySubmit(e) {
    e.preventDefault();
    const user = state.user;
    if (!user) { toggleAuthModal(); return; }
    const content = buildComposerMarkdown().trim();
    const btn = $("#submit-reply");
    const err = $("#reply-error");
    if (err) err.textContent = "";
    if (content.length < 2) return;
    if (content.length > 8000) {
      if (err) err.textContent = t("replyTooLong", "Message is too long (max 8000 characters).");
      return;
    }
    if (state.editMode) {
      return savePostEdit(content, btn, err);
    }
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;
    try {
      const token = localStorage.getItem("auth_token");
      const body = {
        topic_id: state.topicId,
        user_id: user.id,
        username: user.username,
        content,
        lang: (/[\u10A0-\u10FF]/.test(content) ? "ka" : /[\u0400-\u04FF]/.test(content) ? "ru" : "en"),
      };
      if (state.replyTarget?.id) {
        body.reply_to_post_id = state.replyTarget.id;
      }
      const res = await fetch("/api/forum/topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.reason || "failed");
      clearReplyTarget();
      await loadTopicData();
      if (window.__notifications?.refresh) window.__notifications.refresh();
      const newPost = document.getElementById(`post-${data.postId}`);
      if (newPost) newPost.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      if (err) err.textContent = error.message || t("errorSending", "Error sending reply");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>${esc(t("reply", "Reply"))}</span>`;
    }
  }

  async function savePostEdit(content, btn, err) {
    const m = state.editMode;
    if (!m || !state.user) return;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;
    const token = localStorage.getItem("auth_token");
    const body = {
      type: m.kind,
      id: m.id,
      user_id: state.user.id,
      content,
    };
    try {
      const res = await fetch("/api/forum/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      cancelPostEdit();
      await loadTopicData();
    } catch (error) {
      if (err) err.textContent = error.message || t("errorEdit", "Could not save changes");
    } finally {
      btn.disabled = false;
      if (state.editMode) {
        btn.innerHTML = `<i class="fas fa-check"></i> <span>${esc(t("saveChanges", "Save changes"))}</span>`;
      } else {
        resetComposerSubmitButton();
      }
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

    if (action === "unmute-topic-notif") {
      e.preventDefault();
      void unmuteTopicNotifications();
      return;
    }
    if (action === "reply") {
      beginReplyTo(postId, target.dataset.replyAuthor);
      return;
    }
    if (action === "solve") return toggleSolution(postId, false);
    if (action === "unsolve") return toggleSolution(postId, true);
    if (action === "delete") return deletePost(postId);
    if (action === "edit")   return beginPostEdit(postId);
    if (action === "report") return reportPost(postId);
    if (action === "pin-topic") return togglePin("topic", state.topicId, true);
    if (action === "unpin-topic") return togglePin("topic", state.topicId, false);
    if (action === "pin-post" && postId) return togglePin("post", postId, true);
    if (action === "unpin-post" && postId) return togglePin("post", postId, false);
  }

  async function togglePin(type, id, pin) {
    if (!state.user || !isStaff()) return;
    const token = localStorage.getItem("auth_token");
    const errBox = $("#reply-error");
    try {
      const res = await fetch("/api/forum/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, id, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (errBox) errBox.textContent = "";
      await loadTopicData();
    } catch (e) {
      console.error("pin:", e);
      if (errBox) errBox.textContent = e.message || t("errorSending", "Error");
    }
  }

  function openReactionPicker(anchorEl) {
    if (!state.user) { toggleAuthModal(); return; }
    const existing = document.getElementById("reaction-picker");
    if (existing) { existing.remove(); return; }

    const picker = document.createElement("div");
    picker.id = "reaction-picker";
    picker.setAttribute("role", "listbox");
    picker.innerHTML = REACTION_EMOJIS.map(
      (em) =>
        `<button type="button" class="reaction-picker-emoji" data-react-post="${esc(anchorEl.dataset.reactOpen)}" data-emoji="${esc(em)}" aria-label="${esc(em)}">${em}</button>`
    ).join("");
    picker.className = "reaction-picker-popover";
    document.body.appendChild(picker);
    const place = () => {
      const rect = anchorEl.getBoundingClientRect();
      const w = picker.offsetWidth;
      const h = picker.offsetHeight;
      let left = rect.left;
      let top = rect.top - h - 8;
      if (top < 8) top = rect.bottom + 8;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      picker.style.left = `${Math.max(8, left)}px`;
      picker.style.top = `${top}px`;
    };
    place();
    requestAnimationFrame(place);
    // Picker is on document.body; stream delegation is on #topic-content only — handle emoji taps on the picker itself
    const onDoc = (evt) => {
      if (!picker.isConnected) return;
      if (!picker.contains(evt.target) && evt.target !== anchorEl) {
        picker.remove();
        document.removeEventListener("click", onDoc, true);
      }
    };
    setTimeout(() => document.addEventListener("click", onDoc, true), 0);

    picker.addEventListener("click", (e) => {
      const btn = e.target.closest(".reaction-picker-emoji");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const pid = btn.dataset.reactPost;
      const emoji = btn.dataset.emoji;
      document.removeEventListener("click", onDoc, true);
      picker.remove();
      void toggleReaction(pid, emoji);
    });
  }

  async function toggleReaction(postId, emoji) {
    if (!state.user) return toggleAuthModal();
    const token = localStorage.getItem("auth_token");
    const errBox = $("#reply-error");
    try {
      const res = await fetch("/api/forum/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ post_id: postId, emoji }),
      });
      if (res.status === 401) {
        toggleAuthModal();
        if (errBox) errBox.textContent = t("loginToReply", "Please login to reply.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = d.error || `Reactions: HTTP ${res.status}`;
        console.error(msg);
        if (errBox) errBox.textContent = msg;
        return;
      }
      if (errBox) errBox.textContent = "";
      await loadTopicData();
      if (window.__notifications?.refresh) window.__notifications.refresh();
    } catch (e) {
      console.error(e);
      if (errBox) errBox.textContent = e.message || t("errorSending", "Error");
    }
  }

  async function toggleSolution(postId, isUnmark) {
    const q = isUnmark
      ? t("confirmUnmarkSolution", "Remove the solution mark from this post?")
      : t("confirmSolution", "Mark this post as a solution?");
    const ok = await forumAppDialog.open({
      type: "confirm",
      title: isUnmark ? t("unmarkSolution", "Remove solution mark") : t("markSolution", "Mark as solution"),
      message: q,
      confirmText: t("dialogConfirm", "OK"),
      cancelText: t("dialogCancel", "Cancel"),
    });
    if (!ok) return;
    const token = localStorage.getItem("auth_token");
    const errBox = $("#reply-error");
    try {
      const res = await fetch("/api/forum/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic_id: state.topicId,
          post_id: postId,
          user_id: state.user.id,
          set_solution: isUnmark ? false : true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (errBox) errBox.textContent = "";
        await loadTopicData();
        return;
      }
      if (errBox) errBox.textContent = data.error || `HTTP ${res.status}`;
    } catch (e) {
      console.error(e);
      if (errBox) errBox.textContent = e.message || t("errorSending", "Error");
    }
  }

  async function deletePost(postId) {
    const ok = await forumAppDialog.open({
      type: "confirm",
      title: t("delete", "Delete"),
      message: t("confirmDelete", "Delete this post?"),
      confirmText: t("delete", "Delete"),
      cancelText: t("dialogCancel", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/forum/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ type: "post", id: postId, user_id: state.user.id }),
    });
    if (res.ok) {
      // Deleting the opening post (id === topic id) removes the whole thread on the server
      if (String(postId) === String(state.topicId)) {
        window.location.href = "/forum";
        return;
      }
      await loadTopicData();
      return;
    }
    let msg = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      if (d.error) msg = d.error;
    } catch (_) { /* ignore */ }
    console.error("delete post:", msg);
    await forumAppDialog.open({
      type: "alert",
      variant: "error",
      title: t("deleteFailedTitle", "Could not delete"),
      message: msg,
      okText: t("dialogOk", "OK"),
    });
  }

  async function reportPost(postId) {
    const reason = await forumAppDialog.open({
      type: "prompt",
      title: t("report", "Report"),
      message: t("reportPromptBody", "Describe what is wrong with this post. Our moderators will review your report."),
      label: t("reportReasonLabel", "Reason"),
      placeholder: t("reportPlaceholder", "E.g. spam, offensive content, offtopic..."),
      confirmText: t("report", "Report"),
      cancelText: t("dialogCancel", "Cancel"),
    });
    if (reason == null) return;
    const reasonTrim = String(reason).trim();
    if (!reasonTrim) return;
    const token = localStorage.getItem("auth_token");
    try {
      const res = await fetch("/api/forum/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          entity_type: "post",
          entity_id: postId,
          reason: "other",
          details: reasonTrim,
        }),
      });
      if (res.ok) {
        await forumAppDialog.open({
          type: "alert",
          title: t("report", "Report"),
          message: t("reportThanks", "Thanks — our moderators will review it."),
          okText: t("dialogOk", "OK"),
        });
        return;
      }
      const d = await res.json().catch(() => ({}));
      await forumAppDialog.open({
        type: "alert",
        variant: "error",
        title: t("errorReportSend", "Could not send report"),
        message: d.error || `HTTP ${res.status}`,
        okText: t("dialogOk", "OK"),
      });
    } catch (e) {
      console.error(e);
      await forumAppDialog.open({
        type: "alert",
        variant: "error",
        title: t("errorReportSend", "Could not send report"),
        message: e.message || "Network error",
        okText: t("dialogOk", "OK"),
      });
    }
  }

  // ========================================================== Data
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.bumpView] - only `true` on first page open; reactions/edits call without it so `views` is not incremented
   */
  async function loadTopicData({ bumpView = false } = {}) {
    const userId = state.user?.id || "";
    try {
      const q = new URLSearchParams();
      q.set("id", state.topicId);
      q.set("user_id", userId);
      if (bumpView) q.set("count_view", "1");
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/forum/topic?${q.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        const msg = d.error || t("topicBlockedAuthor", "This topic is not available to you because you have blocked the author.");
        $("#topic-content").innerHTML = `<div class="error-state"><i class="fas fa-user-slash"></i> ${esc(msg)}<p style="margin-top:12px;"><a class="btn btn-primary" href="/forum">${esc(t("backToForum", "Back to forum"))}</a></p></div>`;
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      state.topic = data.topic;
      state.posts = data.posts || [];
      await refreshNotificationMutes();
      renderTopic();
    } catch (err) {
      console.error(err);
      $("#topic-content").innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i> ${esc(t("errorLoading","Error loading topic"))}: ${esc(err.message)}</div>`;
    }
  }

  // ========================================================== i18n
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

  window.switchForumLanguage = async function () {
    const order = ["en", "ru", "ka"];
    state.lang = order[(order.indexOf(state.lang) + 1) % order.length];
    localStorage.setItem("forumLanguage", state.lang);
    localStorage.setItem("language", state.lang);
    if (typeof window.__forumSyncLang === "function") await window.__forumSyncLang();
    else applyI18n();
    if (state.topic) renderTopic();
    applyI18n();
    try {
      document.dispatchEvent(
        new CustomEvent("languageChanged", { detail: { lang: state.lang } }),
      );
    } catch (_) {
      /* ignore */
    }
  };

  window.toggleAuthModal = function () {
    document.getElementById("auth-modal")?.classList.toggle("active");
  };

  // Sync local user state when auth changes (login/logout) so the composer
  // and post-action buttons refresh without a page reload.
  window.addEventListener("auth:changed", (e) => {
    const next = e?.detail?.user ?? (() => {
      try { return JSON.parse(localStorage.getItem("user_data") || "null"); }
      catch { return null; }
    })();
    state.user = next;
    if (state.topic) renderTopic();
    if (typeof window.__forumRenderMobileMenu === "function") window.__forumRenderMobileMenu();
  });

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
    if (typeof window.__forumRenderMobileMenu === "function") window.__forumRenderMobileMenu();
    loadTopicData({ bumpView: true });
  });
})();
