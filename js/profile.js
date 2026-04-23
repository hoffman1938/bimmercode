/* BimmerCodes Forum — Profile page (2026).
 *
 * Agents applied:
 *   - UI/UX Designer    : hero with cover + conic progress ring, tabs, chips, share
 *   - Content Writer    : humanized dates, localized copy
 *   - SEO / Growth      : schema.org Person, OG tags, canonical
 *   - Text Content Filter: all user-supplied strings escaped before injection
 *   - Forum Moderator AI: role badges, report button wiring, reputation level
 */

(() => {
  "use strict";

  // -------- Utils ---------------------------------------------------------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const escapeHtml = (text) => {
    if (text === null || text === undefined) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const tr = (key, fallback) => {
    const dict = (typeof APP_TRANSLATIONS !== "undefined")
      ? (APP_TRANSLATIONS[(typeof currentLanguage !== "undefined" && currentLanguage) || "en"] || APP_TRANSLATIONS.en)
      : {};
    return dict[key] || fallback || key;
  };

  const parseDate = (raw) => {
    if (!raw) return null;
    const s = String(raw);
    return new Date(s.endsWith("Z") ? s : s + "Z");
  };

  const humanizeSince = (date) => {
    if (!date || Number.isNaN(+date)) return "—";
    const now = Date.now();
    const diff = Math.max(0, now - date.getTime());
    const day  = 86400000;
    const days = Math.floor(diff / day);
    if (days < 1)   return tr("today", "today");
    if (days < 30)  return `${days} ${tr("daysAgo", "d ago")}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} ${tr("monthsAgo", "mo ago")}`;
    const years = Math.floor(days / 365);
    return `${years} ${tr("yearsAgo", "y ago")}`;
  };

  const fmtDateShort = (date) => {
    if (!date || Number.isNaN(+date)) return "—";
    return date.toLocaleDateString((typeof currentLanguage !== "undefined" ? currentLanguage : "en"), {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  // -------- Reputation -> level / progress --------------------------------
  // Mirrors a common tier system: Novice 0, Apprentice 50, Contributor 200,
  // Expert 500, Master 1000, Legend 2500.
  const TIERS = [
    { name: "Novice",      min: 0,    icon: "fa-seedling" },
    { name: "Apprentice",  min: 50,   icon: "fa-screwdriver-wrench" },
    { name: "Contributor", min: 200,  icon: "fa-wrench" },
    { name: "Expert",      min: 500,  icon: "fa-gears" },
    { name: "Master",      min: 1000, icon: "fa-crown" },
    { name: "Legend",      min: 2500, icon: "fa-trophy" },
  ];
  const levelInfo = (rep) => {
    const r = Math.max(0, Number(rep) || 0);
    let cur = TIERS[0], nxt = TIERS[1];
    for (let i = 0; i < TIERS.length; i++) {
      if (r >= TIERS[i].min) { cur = TIERS[i]; nxt = TIERS[i + 1] || null; }
    }
    const base = cur.min;
    const top  = nxt ? nxt.min : cur.min + 1;
    const pct  = nxt ? Math.min(1, (r - base) / (top - base)) : 1;
    return { cur, nxt, pct };
  };

  // -------- Entry --------------------------------------------------------
  let currentProfileUser = null;

  document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get("id");

    // No id: redirect to own profile, or forum if unauthenticated
    if (!profileId) {
      try {
        const me = JSON.parse(localStorage.getItem("user_data") || "null");
        if (me && me.id) {
          window.location.replace(`/profile?id=${encodeURIComponent(me.id)}`);
          return;
        }
      } catch (_) {}
      window.location.href = "/forum";
      return;
    }

    // Sync language
    const currentForumLang = localStorage.getItem("forumLanguage") || "en";
    if (typeof window.currentLanguage !== "undefined") window.currentLanguage = currentForumLang;
    if (typeof updateLanguage === "function") updateLanguage();

    await loadProfile(profileId);
  });

  // -------- Load ---------------------------------------------------------
  async function loadProfile(profileId) {
    try {
      const res = await fetch(`/api/user/get?id=${encodeURIComponent(profileId)}`);
      if (!res.ok) throw new Error("not_found");
      const user = await res.json();
      currentProfileUser = user;

      $("#profile-skeleton")?.setAttribute("hidden", "");
      $("#profile-hero")?.removeAttribute("hidden");
      $("#profile-stats")?.removeAttribute("hidden");
      $("#profile-achievements")?.removeAttribute("hidden");
      $("#profile-activity")?.removeAttribute("hidden");

      renderHero(user);
      renderStats(user);
      renderAchievements(user);
      renderAbout(user);
      renderRecent(user);
      updateSeo(user);
      bindShare(user);
      bindTabs();
      checkOwnership(user);

      loadUserTopics(user.id);
    } catch (err) {
      console.error("[Profile] load failed", err);
      $("#profile-skeleton")?.setAttribute("hidden", "");
      $("#profile-error")?.removeAttribute("hidden");
    }
  }

  // -------- HERO ---------------------------------------------------------
  function renderHero(user) {
    const name = user.username || "User";
    $("#profile-username").textContent = name;
    document.title = `${name} — BimmerCodes Profile`;

    // Bio
    const bio = $("#profile-bio");
    if (user.bio && String(user.bio).trim()) {
      bio.textContent = user.bio;
      bio.classList.remove("empty");
    } else {
      bio.textContent = tr("noBioYet", "This user hasn't written a bio yet.");
      bio.classList.add("empty");
    }

    // Avatar
    const ava = $("#profile-avatar");
    if (user.avatar_url) {
      ava.innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(name)}" onerror="this.outerHTML='<i class=&quot;fas fa-user&quot;></i>'">`;
    } else {
      ava.innerHTML = `<span style="font-size:48px;font-weight:700;color:#fff;">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    }

    // Level + progress ring
    const { cur, nxt, pct } = levelInfo(user.reputation);
    const ring = $("#profile-avatar-ring");
    if (ring) ring.style.setProperty("--progress", `${Math.round(pct * 360)}deg`);
    const chip = $("#profile-level-chip");
    if (chip) {
      chip.innerHTML = `<i class="fas ${cur.icon}" aria-hidden="true"></i><span>${escapeHtml(cur.name)}</span>`;
      chip.title = nxt
        ? `${cur.name} — ${user.reputation || 0}/${nxt.min} to ${nxt.name}`
        : `${cur.name} (max)`;
    }

    // Role badge
    const role = (user.role || "").toLowerCase();
    const roleBadge = $("#profile-role-badge");
    if (role && role !== "user" && roleBadge) {
      const cls =
        role === "admin" ? "admin" :
        role === "moderator" ? "mod" :
        role === "verified" ? "verified" : "";
      roleBadge.className = `role-badge ${cls}`;
      roleBadge.textContent = role.toUpperCase();
      roleBadge.hidden = false;
    }

    // Chips (ride, location, joined, lang)
    const chipsHost = $("#profile-chips");
    const chips = [];
    if (user.car_model) chips.push({ i: "fa-car",         t: user.car_model });
    if (user.bmw_year)  chips.push({ i: "fa-calendar",    t: user.bmw_year });
    if (user.bmw_engine)chips.push({ i: "fa-gears",       t: user.bmw_engine });
    if (user.bmw_body)  chips.push({ i: "fa-car-side",    t: user.bmw_body });
    const place = [user.city, user.country].filter(Boolean).join(", ");
    if (place)          chips.push({ i: "fa-location-dot", t: place });
    if (user.preferred_lang) chips.push({ i: "fa-globe", t: String(user.preferred_lang).toUpperCase() });
    const joined = parseDate(user.created_at);
    if (joined)         chips.push({ i: "fa-calendar-check", t: `${tr("memberFor", "Member for")} ${humanizeSince(joined)}` });
    chipsHost.innerHTML = chips.map(({ i, t }) =>
      `<span class="p-chip"><i class="fas ${i}" aria-hidden="true"></i> ${escapeHtml(t)}</span>`).join("");
  }

  // -------- STATS --------------------------------------------------------
  function renderStats(user) {
    const s = user.stats || {};
    $("#stat-reputation").textContent = user.reputation || 0;
    $("#stat-topics").textContent     = s.topics_count || 0;
    $("#stat-posts").textContent      = s.posts_count  || 0;
    $("#stat-solved").textContent     = s.solved_count || 0;
    const joined = parseDate(user.created_at);
    $("#stat-joined").textContent     = joined ? fmtDateShort(joined) : "—";

    const cntTopics = $("#tab-count-topics");
    if (cntTopics) cntTopics.textContent = s.topics_count || 0;
  }

  // -------- ACHIEVEMENTS -------------------------------------------------
  function renderAchievements(user) {
    const s = user.stats || {};
    const rep = Number(user.reputation || 0);
    const joined = parseDate(user.created_at);
    const daysOnPlatform = joined ? Math.floor((Date.now() - joined.getTime()) / 86400000) : 0;

    const items = [
      { id: "first-topic",  name: tr("achFirstTopic",  "First topic"),  icon: "fa-pen-nib",      unlocked: (s.topics_count || 0) >= 1 },
      { id: "first-solved", name: tr("achFirstSolved", "First solved"), icon: "fa-circle-check", unlocked: (s.solved_count || 0) >= 1 },
      { id: "helper",       name: tr("achHelper",      "Helper"),       icon: "fa-handshake",    unlocked: (s.posts_count || 0) >= 10 },
      { id: "rep-100",      name: tr("ach100Rep",      "100 Rep"),      icon: "fa-star",         unlocked: rep >= 100 },
      { id: "rep-500",      name: tr("ach500Rep",      "500 Rep"),      icon: "fa-award",        unlocked: rep >= 500 },
      { id: "veteran",      name: tr("achVeteran",     "Veteran"),      icon: "fa-shield-halved", unlocked: daysOnPlatform >= 180 },
      { id: "legend",       name: tr("achLegend",      "Legend"),       icon: "fa-trophy",        unlocked: rep >= 2500 },
    ];

    $("#achievements-grid").innerHTML = items.map((a) => `
      <div class="achievement ${a.unlocked ? "" : "locked"}" title="${escapeHtml(a.name)}">
        <div class="ach-icon"><i class="fas ${a.icon}" aria-hidden="true"></i></div>
        <div class="ach-name">${escapeHtml(a.name)}</div>
      </div>`).join("");
  }

  // -------- ABOUT --------------------------------------------------------
  function renderAbout(user) {
    const joined = parseDate(user.created_at);
    const cards = [
      { label: tr("aboutCar",      "Car"),          icon: "fa-car",           value: user.car_model },
      { label: tr("aboutYear",     "Year"),         icon: "fa-calendar",      value: user.bmw_year },
      { label: tr("aboutEngine",   "Engine"),       icon: "fa-gears",         value: user.bmw_engine },
      { label: tr("aboutBody",     "Body"),         icon: "fa-car-side",      value: user.bmw_body },
      { label: tr("aboutCity",     "City"),         icon: "fa-location-dot",  value: [user.city, user.country].filter(Boolean).join(", ") },
      { label: tr("aboutLanguage", "Language"),     icon: "fa-globe",         value: user.preferred_lang ? String(user.preferred_lang).toUpperCase() : null },
      { label: tr("aboutJoined",   "Joined"),       icon: "fa-calendar-check", value: joined ? fmtDateShort(joined) : null },
      { label: tr("aboutLevel",    "Level"),        icon: "fa-bolt",          value: levelInfo(user.reputation).cur.name },
    ];

    $("#profile-about-container").innerHTML = cards.map((c) => `
      <div class="about-card">
        <div class="about-label"><i class="fas ${c.icon}" aria-hidden="true"></i> ${escapeHtml(c.label)}</div>
        <div class="about-value ${c.value ? "" : "empty"}">${
          c.value ? escapeHtml(c.value) : escapeHtml(tr("notSpecified", "Not specified"))
        }</div>
      </div>`).join("");
  }

  // -------- RECENT (from user.recent_topics) ------------------------------
  function renderRecent(user) {
    const host = $("#profile-recent-container");
    const recent = user.recent_topics || [];
    if (!recent.length) {
      host.innerHTML = emptyHtml("fa-clock-rotate-left", tr("noRecentActivity", "No recent activity yet."));
      return;
    }
    host.innerHTML = recent.map((t) => topicRowHtml(t)).join("");
    $$(".topic-row", host).forEach((row) => {
      row.addEventListener("click", () => {
        window.location.href = `/topic?id=${encodeURIComponent(row.dataset.id)}`;
      });
    });
  }

  // -------- TOPICS TAB ---------------------------------------------------
  const ITEMS_PER_PAGE = 10;
  let currentProfilePage = 1;

  async function loadUserTopics(userId, page = 1) {
    currentProfilePage = page;
    const container = $("#profile-topics-container");
    container.innerHTML = `
      <div class="skeleton-row"><div class="skeleton-content"><div class="skeleton-line long"></div></div></div>
      <div class="skeleton-row"><div class="skeleton-content"><div class="skeleton-line long"></div></div></div>`;

    try {
      const res = await fetch(`/api/forum/topics?user_id=${encodeURIComponent(userId)}&page=${page}&limit=${ITEMS_PER_PAGE}`);
      const data = await res.json().catch(() => ({}));
      const topics = data.topics || [];
      const total = data.total || topics.length || 0;
      const totalPages = data.totalPages || Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

      const cntTopics = $("#tab-count-topics");
      if (cntTopics) cntTopics.textContent = total;

      if (!topics.length) {
        container.innerHTML = emptyHtml("fa-file-lines", tr("noTopicsYet", "No topics created yet."));
        return;
      }

      container.innerHTML = topics.map(topicRowHtml).join("");
      $$(".topic-row", container).forEach((row) => {
        row.addEventListener("click", () => {
          window.location.href = `/topic?id=${encodeURIComponent(row.dataset.id)}`;
        });
      });

      if (totalPages > 1) {
        const pagination = document.createElement("div");
        pagination.className = "pagination-controls";
        pagination.innerHTML = `
          ${page > 1  ? `<button class="btn btn-ghost" data-dir="prev"><i class="fas fa-chevron-left"></i> ${escapeHtml(tr("prev","Prev"))}</button>` : ""}
          <span>${escapeHtml(tr("pageN", "Page"))} ${page} / ${totalPages}</span>
          ${page < totalPages ? `<button class="btn btn-ghost" data-dir="next">${escapeHtml(tr("next","Next"))} <i class="fas fa-chevron-right"></i></button>` : ""}`;
        container.appendChild(pagination);
        pagination.querySelector('[data-dir="prev"]')?.addEventListener("click", () => loadUserTopics(userId, page - 1));
        pagination.querySelector('[data-dir="next"]')?.addEventListener("click", () => loadUserTopics(userId, page + 1));
      }
    } catch (err) {
      console.error("[Profile] topics failed", err);
      container.innerHTML = emptyHtml("fa-triangle-exclamation", tr("failedToLoad", "Failed to load topics."));
    }
  }

  function topicRowHtml(topic) {
    const date = parseDate(topic.created_at);
    const dateStr = date ? fmtDateShort(date) : "";
    const solved = !!topic.is_solved;
    const pinned = !!topic.is_pinned;
    return `
      <div class="topic-row" data-id="${escapeHtml(topic.id)}">
        <div class="topic-status-icon ${solved ? "solved" : ""}" aria-hidden="true">
          <i class="fas ${solved ? "fa-check" : pinned ? "fa-thumbtack" : "fa-comment-alt"}"></i>
        </div>
        <div class="topic-main-content">
          <h3>${escapeHtml(topic.title || "(untitled)")}</h3>
          <div class="topic-meta-line">
            ${topic.category ? `<span><i class="fas fa-folder-open"></i> ${escapeHtml(topic.category)}</span>` : ""}
            <span><i class="fas fa-clock"></i> ${escapeHtml(dateStr)}</span>
          </div>
        </div>
        <div class="topic-trailing">
          <span><i class="fas fa-comment"></i>${Number(topic.reply_count) || 0}</span>
        </div>
      </div>`;
  }

  function emptyHtml(icon, text) {
    return `
      <div class="profile-empty">
        <i class="fas ${icon}" aria-hidden="true"></i>
        <div>${escapeHtml(text)}</div>
      </div>`;
  }

  // -------- TABS ---------------------------------------------------------
  function bindTabs() {
    const tabs = $$(".profile-tab");
    const panels = $$(".profile-panel");
    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        tabs.forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
        t.classList.add("active"); t.setAttribute("aria-selected", "true");
        panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === t.dataset.tab));
      });
    });
  }

  // -------- SHARE --------------------------------------------------------
  function bindShare(user) {
    const btn = $("#btn-share-profile");
    const toast = $("#share-toast");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const url = `${location.origin}/profile?id=${encodeURIComponent(user.id)}`;
      const title = `${user.username} — BimmerCodes`;
      try {
        if (navigator.share) {
          await navigator.share({ title, url });
        } else {
          await navigator.clipboard.writeText(url);
          if (toast) {
            toast.hidden = false;
            requestAnimationFrame(() => toast.classList.add("visible"));
            setTimeout(() => {
              toast.classList.remove("visible");
              setTimeout(() => (toast.hidden = true), 260);
            }, 1800);
          }
        }
      } catch (_) { /* user cancelled */ }
    });
  }

  // -------- OWNERSHIP + ACTIONS ------------------------------------------
  function checkOwnership(user) {
    let me = null;
    try { me = JSON.parse(localStorage.getItem("user_data") || "null"); } catch (_) {}
    const editBtn   = $("#btn-edit-profile");
    const reportBtn = $("#btn-report-profile");

    if (me && String(me.id) === String(user.id)) {
      if (editBtn) editBtn.hidden = false;
      // prefill edit modal
      $("#edit-bio").value     = user.bio || "";
      $("#edit-car").value     = user.car_model || "";
      const cityEl = $("#edit-city"); if (cityEl) cityEl.value = user.city || "";
      $("#edit-avatar").value  = user.avatar_url || "";
    } else if (me) {
      if (reportBtn) reportBtn.hidden = false;
    }
  }

  // -------- SEO / schema.org ---------------------------------------------
  function updateSeo(user) {
    const url = `${location.origin}/profile?id=${encodeURIComponent(user.id)}`;
    const name = user.username || "User";
    const desc = user.bio
      ? `${name} — ${user.bio.slice(0, 140)}`
      : `${name} — BMW enthusiast on BimmerCodes. Reputation: ${user.reputation || 0}.`;

    document.title = `${name} — BimmerCodes Profile`;
    $("#meta-description")?.setAttribute("content", desc);
    $("#og-title")?.setAttribute("content", `${name} — BimmerCodes`);
    $("#og-description")?.setAttribute("content", desc);
    if (user.avatar_url) $("#og-image")?.setAttribute("content", user.avatar_url);
    $("#canonical-link")?.setAttribute("href", url);

    const schema = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "mainEntity": {
        "@type": "Person",
        "name": name,
        "url": url,
        "image": user.avatar_url || undefined,
        "description": user.bio || undefined,
      },
    };
    const node = $("#schema-person");
    if (node) node.textContent = JSON.stringify(schema);
  }

  // -------- EDIT PROFILE --------------------------------------------------
  window.openEditProfileModal = function () {
    const modal = $("#edit-profile-modal");
    modal?.classList.add("active");

    const preview = $("#avatar-preview-edit");
    const delBtn  = $("#btn-delete-avatar");
    const src = currentProfileUser?.avatar_url
      || (() => { try { return JSON.parse(localStorage.getItem("user_data") || "null")?.avatar_url; } catch (_) { return null; } })();
    if (src && preview) {
      preview.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
      if (delBtn) delBtn.style.display = "inline-flex";
    } else if (preview) {
      preview.innerHTML = `<i class="fas fa-user"></i>`;
      if (delBtn) delBtn.style.display = "none";
    }
  };

  window.closeEditProfileModal = function () {
    $("#edit-profile-modal")?.classList.remove("active");
  };

  window.handleProfileUpdate = async function (e) {
    e.preventDefault();
    let me = null;
    try { me = JSON.parse(localStorage.getItem("user_data") || "null"); } catch (_) {}
    if (!me) return;

    const body = {
      id: me.id,
      bio: ($("#edit-bio")?.value || "").trim().slice(0, 300),
      car_model: ($("#edit-car")?.value || "").trim().slice(0, 60),
      city: ($("#edit-city")?.value || "").trim().slice(0, 60),
      avatar_url: ($("#edit-avatar")?.value || "").trim(),
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const old = btn ? btn.innerHTML : "";
    if (btn) { btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(tr("saving","Saving…"))}`; btn.disabled = true; }

    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("update_failed");
      const fresh = await fetch(`/api/user/get?id=${encodeURIComponent(me.id)}`).then((r) => r.json());
      localStorage.setItem("user_data", JSON.stringify(fresh));
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: { user: fresh } }));
      closeEditProfileModal();
      await loadProfile(me.id);
    } catch (err) {
      console.error("[Profile] update failed", err);
      alert(tr("updateFailed", "Update failed"));
    } finally {
      if (btn) { btn.innerHTML = old; btn.disabled = false; }
    }
  };

  // -------- AVATAR -------------------------------------------------------
  window.triggerAvatarUpload = function () {
    $("#avatar-file-input")?.click();
  };

  window.handleAvatarUpload = async function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert(tr("pleaseSelectImage","Please select an image file")); return; }
    if (file.size > 5 * 1024 * 1024)     { alert(tr("imageTooLarge","Image size must be less than 5MB")); return; }

    const uploadBtn = $(".btn-upload-avatar");
    const original  = uploadBtn ? uploadBtn.innerHTML : "";

    try {
      if (uploadBtn) uploadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(tr("uploading","Uploading…"))}`;
      const conv = typeof globalThis.convertImageToWebP === "function"
        ? globalThis.convertImageToWebP
        : null;
      const webp = conv
        ? await conv(file, { maxLongEdge: 800, quality: 0.85 })
        : await legacyConvertToWebP(file);
      const fd = new FormData();
      fd.append("file", webp);
      const token = localStorage.getItem("auth_token");
      if (!token) {
        alert(tr("loginRequiredUpload", "Please log in to upload an avatar."));
        throw new Error("no_token");
      }
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("unauthorized");
      if (!res.ok || !data.url) throw new Error(data.error || "no_url");

      const preview = $("#avatar-preview-edit");
      if (preview) preview.innerHTML = `<img src="${escapeHtml(data.url)}" alt="">`;
      $("#edit-avatar").value = data.url;
      const delBtn = $("#btn-delete-avatar"); if (delBtn) delBtn.style.display = "inline-flex";
    } catch (err) {
      console.error("[Profile] avatar upload failed", err);
      alert(tr("avatarUploadError","Error uploading image. Please try again."));
    } finally {
      if (uploadBtn) uploadBtn.innerHTML = original;
      event.target.value = "";
    }
  };

  window.deleteAvatar = function () {
    const preview = $("#avatar-preview-edit");
    if (preview) preview.innerHTML = `<i class="fas fa-user"></i>`;
    $("#edit-avatar").value = "";
    const delBtn = $("#btn-delete-avatar"); if (delBtn) delBtn.style.display = "none";
  };

  /** Fallback if image-to-webp.js failed to load */
  function legacyConvertToWebP(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 800;
          const scale = Math.min(1, MAX / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("canvas_blob_failed"));
              resolve(new File([blob], `${file.name.split(".")[0]}.webp`, { type: "image/webp" }));
            },
            "image/webp", 0.85
          );
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // -------- Report --------------------------------------------------------
  window.triggerUserReport = function () {
    if (!currentProfileUser) return;
    if (typeof openReportModal === "function") {
      openReportModal("user", currentProfileUser.id, currentProfileUser.id);
    }
  };

  // -------- React to external auth change --------------------------------
  window.addEventListener("auth:changed", () => {
    if (currentProfileUser) checkOwnership(currentProfileUser);
  });
})();
