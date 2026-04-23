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
    /** { kind: "topic"|"post", id: string } when editing a post in the reply composer */
    editMode: null,
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

  function renderPostCard(p, { isOriginal = false } = {}) {
    const solved = !!(p.is_solution);
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
          return `<button type="button" class="reaction-pill${active}" data-react-post="${esc(p.id)}" data-emoji="${esc(r.emoji)}" title="${esc(r.emoji)} ${r.count}"><span class="reaction-emoji" aria-hidden="true">${r.emoji}</span><span class="reaction-count">${r.count}</span></button>`;
        }).join("")
      : "";

    const body = renderMarkdown(p.content || "");

    const postId = isOriginal ? `op` : `post-${esc(p.id)}`;
    const kindClass = isOP ? " post-card--original" : " post-card--reply";

    return `
      <article class="post-card${kindClass}${solved ? " is-solution" : ""}" id="${postId}">
        ${isOP ? `<div class="post-card-ribbon" aria-hidden="true"><span class="post-card-ribbon__text"><i class="fas fa-bolt"></i> ${esc(t("topicOpeningPost", "Topic"))}</span></div>` : ""}
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
            ${!isOP ? `<span class="post-kind-badge" data-kind="reply"><i class="fas fa-reply"></i> ${esc(t("replyPostLabel", "Comment"))}</span>` : ""}
          </div>
          <div class="post-text">${body}</div>
          <div class="post-actions">
            <div class="post-actions-reactions" role="group" aria-label="Reactions">
            <button type="button" class="reaction-adder" data-react-open="${esc(p.id)}" aria-label="Add reaction">
              <i class="far fa-smile"></i>
            </button>
            ${reactionsHtml}
            </div>
            <div class="post-actions-tools">
            ${!isOP && canMarkSolution() && !solved ? `<button type="button" class="post-action-link" data-action="solve" data-post="${esc(p.id)}"><i class="fas fa-check"></i> ${esc(t("markSolution","Mark as solution"))}</button>` : ""}
            ${!isOP && canMarkSolution() && solved ? `<button type="button" class="post-action-link post-action-link--warn" data-action="unsolve" data-post="${esc(p.id)}"><i class="fas fa-times"></i> ${esc(t("unmarkSolution","Remove solution"))}</button>` : ""}
            ${canEdit(p) ? `<button type="button" class="post-action-link" data-action="edit" data-post="${esc(p.id)}"><i class="fas fa-edit"></i> ${esc(t("edit","Edit"))}</button>` : ""}
            ${canDelete(p) ? `<button type="button" class="post-action-link post-action-link--danger" data-action="delete" data-post="${esc(p.id)}"><i class="fas fa-trash"></i> ${esc(t("delete","Delete"))}</button>` : ""}
            ${state.user && !isOP ? `<button type="button" class="post-action-link" data-action="report" data-post="${esc(p.id)}"><i class="fas fa-flag"></i> ${esc(t("report","Report"))}</button>` : ""}
            </div>
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
        <div id="composer-edit-bar" class="composer-edit-bar" hidden>
          <div class="composer-edit-bar__inner">
            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
            <span id="composer-edit-hint"></span>
            <button type="button" class="btn btn-ghost btn-sm" id="cancel-post-edit">${esc(t("cancel", "Cancel"))}</button>
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
      await loadTopicData();
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

    if (action === "solve") return toggleSolution(postId, false);
    if (action === "unsolve") return toggleSolution(postId, true);
    if (action === "delete") return deletePost(postId);
    if (action === "edit")   return beginPostEdit(postId);
    if (action === "report") return reportPost(postId);
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
    } catch (e) {
      console.error(e);
      if (errBox) errBox.textContent = e.message || t("errorSending", "Error");
    }
  }

  async function toggleSolution(postId, isUnmark) {
    const q = isUnmark
      ? t("confirmUnmarkSolution", "Remove the solution mark from this post?")
      : t("confirmSolution", "Mark this post as a solution?");
    if (!confirm(q)) return;
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
    if (!confirm(t("confirmDelete","Delete this post?"))) return;
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/forum/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ type: "post", id: postId, user_id: state.user.id }),
    });
    if (res.ok) {
      await loadTopicData();
      return;
    }
    let msg = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      if (d.error) msg = d.error;
    } catch (_) { /* ignore */ }
    console.error("delete post:", msg);
    alert(msg);
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
      const res = await fetch(`/api/forum/topic?${q.toString()}`);
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

  window.switchForumLanguage = function () {
    const order = ["en", "ru", "ka"];
    state.lang = order[(order.indexOf(state.lang) + 1) % order.length];
    localStorage.setItem("forumLanguage", state.lang);
    localStorage.setItem("language", state.lang);
    if (typeof window.__forumSyncLang === "function") window.__forumSyncLang();
    else applyI18n();
    if (state.topic) renderTopic();
    // Second pass: composer tabs use data-i18n in freshly inserted HTML; shell uses static data-i18n
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
    loadTopicData({ bumpView: true });
  });
})();
