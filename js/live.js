// js/live.js - Notification System 2.0
// Bell + dropdown are only created for authenticated users (no guest UI).

const NOTIFICATION_POLL_INTERVAL = 15000; // 15 seconds

let pollTimer = null;
let currentNotifications = [];
/** Server-reported unread count; used when re-rendering after filter change */
let lastServerUnreadCount = 0;
/** 'all' | 'unread' */
let notifListFilter = "all";

function isNotificationUnread(n) {
    if (!n) return false;
    const v = n.is_read;
    return v !== 1 && v !== true && v !== "1";
}

function notifIconClasses(raw) {
    if (!raw || !String(raw).trim()) return "fas fa-bell";
    const s = String(raw).trim();
    if (/^(fas|far|fab)\s+fa-/.test(s)) return s;
    if (s.startsWith("fa-")) return "fas " + s;
    return "fas " + s;
}

/** Safe class attribute for Font Awesome icon <i> */
function safeNotifIconClassAttr(s) {
    const c = notifIconClasses(s);
    return c.replace(/[<>"'&]/g, "").trim() || "fas fa-bell";
}

function getNotifyUser() {
    try {
        const u = JSON.parse(localStorage.getItem("user_data") || "null");
        return u && u.id ? u : null;
    } catch {
        return null;
    }
}

function authHeaders() {
    const t = localStorage.getItem("auth_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(loadNotifications, NOTIFICATION_POLL_INTERVAL);
}

/** Remove old static bell nodes (cached HTML) and the dropdown UI. */
function teardownNotificationUI() {
    stopPolling();
    currentNotifications = [];
    lastServerUnreadCount = 0;
    document.getElementById("notif-bell")?.remove();
    document.getElementById("notif-btn")?.remove();
    document.getElementById("notif-dot")?.remove();
    const wrapper = document.getElementById("notif-btn-wrapper");
    if (wrapper) wrapper.remove();
    const dd = document.getElementById("notifications-dropdown");
    if (dd) dd.classList.remove("active");
}

function removeLegacyNotifNodes() {
    document.getElementById("notif-bell")?.remove();
    document.getElementById("notif-btn")?.remove();
}

/**
 * Bell + filter row + list must mount even if /api/notifications fails (404/401/offline);
 * otherwise logged-in users never get a header bell.
 */
function paintNotificationShell() {
    if (!getNotifyUser()) return;
    injectBellIconIfNeeded();
    ensureNotifFilterBar();
    syncNotifFilterTabs();
    updateNotificationUI(lastServerUnreadCount);
}

/**
 * Call when user is logged in: mount bell, load list, start polling.
 */
function setupNotificationsForUser() {
    const user = getNotifyUser();
    if (!user) {
        teardownNotificationUI();
        return;
    }
    removeLegacyNotifNodes();
    paintNotificationShell();
    loadNotifications();
    startPolling();
}

function initNotifications() {
    if (getNotifyUser()) {
        setupNotificationsForUser();
    } else {
        teardownNotificationUI();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    bindNotifPanelDelegation();
    initNotifications();
});

window.addEventListener("auth:changed", () => {
    if (getNotifyUser()) {
        setupNotificationsForUser();
    } else {
        teardownNotificationUI();
    }
});

window.addEventListener("pageshow", () => {
    if (getNotifyUser()) loadNotifications();
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && getNotifyUser()) loadNotifications();
});

function escNotif(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function loadNotifications() {
    const user = getNotifyUser();
    if (!user) return;

    try {
        const res = await fetch(
            `/api/notifications?user_id=${encodeURIComponent(user.id)}&limit=100&_=${Date.now()}`,
            { headers: { ...authHeaders() } }
        );
        if (!res.ok) {
            paintNotificationShell();
            return;
        }

        const data = await res.json();
        currentNotifications = data.notifications || [];
        const unreadCount = data.unread_count || 0;
        lastServerUnreadCount = unreadCount;

        updateNotificationUI(unreadCount);
        await loadMutesPanel();
    } catch (e) {
        // ERR_CONNECTION_REFUSED / offline → TypeError: Failed to fetch (not an application bug)
        const msg = (e && e.message) || String(e);
        const network =
            (e && e.name === "TypeError" && /fetch|Failed to fetch|NetworkError|LOAD_FAILED/i.test(msg)) ||
            /ERR_CONNECTION|ECONNREFUSED|network.*offline/i.test(msg);
        if (network) {
            console.warn("Notifications: server unreachable (start dev, or check URL/port).", msg);
        } else {
            console.error("Failed to load notifications", e);
        }
        paintNotificationShell();
    }
}

/** Muted users/topics management (GET /api/notifications/mute + DELETE unmute) */
async function loadMutesPanel() {
    const user = getNotifyUser();
    if (!user) return;
    const t = getTranslations();
    const dd = document.getElementById("notifications-dropdown");
    const list = document.getElementById("notif-list");
    if (!dd || !list) return;
    let section = document.getElementById("notif-mutes-section");
    if (!section) {
        section = document.createElement("div");
        section.id = "notif-mutes-section";
        section.className = "notif-mutes-section";
        dd.insertBefore(section, list);
    }
    try {
        const res = await fetch("/api/notifications/mute", { headers: { ...authHeaders() } });
        if (!res.ok) {
            section.innerHTML = "";
            section.hidden = true;
            return;
        }
        const data = await res.json();
        const mutes = data.mutes || [];
        if (mutes.length === 0) {
            section.innerHTML = "";
            section.hidden = true;
            return;
        }
        const userIds = mutes.filter((m) => m && m.scope === "user").map((m) => m.target_id);
        const uniqueUser = [...new Set(userIds.map(String))];
        const nameMap = new Map();
        await Promise.all(
            uniqueUser.map(async (id) => {
                try {
                    const r = await fetch(`/api/user/get?id=${encodeURIComponent(id)}`);
                    if (r.ok) {
                        const u = await r.json();
                        if (u && u.username) nameMap.set(id, u.username);
                    }
                } catch {
                    /* ignore */
                }
            })
        );
        const topicIds = mutes.filter((m) => m && m.scope === "topic").map((m) => m.target_id);
        const titleMap = new Map();
        await Promise.all(
            [...new Set(topicIds.map(String))].map(async (id) => {
                try {
                    const r = await fetch(`/api/forum/topic?id=${encodeURIComponent(id)}&user_id=`);
                    if (r.ok) {
                        const d = await r.json();
                        if (d.topic && d.topic.title) titleMap.set(id, d.topic.title);
                    }
                } catch {
                    /* ignore */
                }
            })
        );
        const rows = mutes.map((m) => {
            if (!m) return "";
            const scope = m.scope;
            const tid = escNotif(m.target_id);
            if (scope === "user") {
                const un = nameMap.get(String(m.target_id)) || t.mutedUserFallback;
                return `<li class="notif-mute-source-row">
      <i class="fas fa-user" aria-hidden="true"></i>
      <span class="notif-mute-source-label" title="${tid}">${escNotif(un)}</span>
      <button type="button" class="notif-mute-unmute-btn" data-notif-unmute data-notif-unmute-scope="user" data-notif-unmute-target="${tid}">${escNotif(
          t.unmute
      )}</button>
    </li>`;
            }
            if (scope === "topic") {
                const title = titleMap.get(String(m.target_id)) || t.mutedTopicFallback;
                return `<li class="notif-mute-source-row">
      <i class="fas fa-comments" aria-hidden="true"></i>
      <span class="notif-mute-source-label" title="${tid}">${escNotif(title)}</span>
      <button type="button" class="notif-mute-unmute-btn" data-notif-unmute data-notif-unmute-scope="topic" data-notif-unmute-target="${tid}">${escNotif(
          t.unmute
      )}</button>
    </li>`;
            }
            return "";
        });
        section.hidden = false;
        section.innerHTML = `<div class="notif-mutes-header">${escNotif(t.mutedSourcesLabel)}</div><ul class="notif-mutes-list">${rows.join("")}</ul>`;
    } catch (e) {
        console.error("loadMutesPanel", e);
        section.innerHTML = "";
        section.hidden = true;
    }
}

async function unmuteNotifSource(scope, targetId) {
    const t = getTranslations();
    if (!getNotifyUser() || !targetId) return;
    const s = String(scope || "");
    if (s !== "topic" && s !== "user") return;
    try {
        const r = await fetch("/api/notifications/mute", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ scope: s, target_id: String(targetId) }),
        });
        if (r.ok) {
            if (typeof window.showQuickToast === "function") {
                window.showQuickToast(t.unmuteOk);
            } else if (typeof window.showSuccess === "function") {
                window.showSuccess(t.unmuteOk);
            }
            try {
                document.dispatchEvent(new CustomEvent("notification-mutes-changed", { detail: { scope: s, target_id: String(targetId) } }));
            } catch {
                /* ignore */
            }
            await loadMutesPanel();
            await loadNotifications();
        } else {
            const err = await r.json().catch(() => ({}));
            console.warn("unmute failed", err);
        }
    } catch (e) {
        console.error(e);
    }
}

function updateNotificationUI(unreadCount) {
    const user = getNotifyUser();
    if (!user) {
        teardownNotificationUI();
        return;
    }

    const t = getTranslations();
    const uc = unreadCount != null && unreadCount !== "" ? Number(unreadCount) : lastServerUnreadCount;

    // 1. Ensure Bell Icon Exists
    injectBellIconIfNeeded();
    ensureNotifFilterBar();
    syncNotifFilterTabs();

    // 2. Update Badge
    const badge = document.getElementById("notif-badge");
    if (badge) {
        if (uc > 0) {
            badge.style.display = "block";
            badge.textContent = uc > 99 ? "99+" : String(uc);
        } else {
            badge.style.display = "none";
        }
    }

    // 3. Update Dropdown List
    const list = document.getElementById("notif-list");
    if (list) {
        const rows = currentNotifications.filter((n) => {
            if (notifListFilter === "unread") return isNotificationUnread(n);
            return true;
        });
        if (rows.length === 0) {
            const emptyMsg =
                currentNotifications.length === 0 ? t.noNotifications : t.noUnread;
            list.innerHTML = `
                <div class="notif-empty">
                    <i class="far fa-bell" aria-hidden="true"></i>
                    <p>${emptyMsg}</p>
                </div>`;
        } else {
            list.innerHTML = rows.map((n) => renderNotificationItem(n)).join("");
        }
    }
}

function parseMeta(n) {
    if (!n || !n.metadata) return {};
    if (typeof n.metadata === "object") return n.metadata;
    try {
        return JSON.parse(n.metadata);
    } catch {
        return {};
    }
}

function renderNotificationItem(n) {
    const isUnread = isNotificationUnread(n);
    const bgStyle = isUnread
        ? "background: rgba(0, 102, 179, 0.1); border-left: 3px solid #0066b3;"
        : "border-left: 3px solid transparent;";
    const time = timeAgo(n.created_at);
    const textBody = n.text || n.title || "";
    const titleLine = n.title && n.title !== textBody ? escNotif(n.title) : "";
    const iconIClasses = safeNotifIconClassAttr(n.icon);
    const iconColor =
        n.type === "like"
            ? "#e74c3c"
            : n.type === "solve" || n.type === "solved"
              ? "#2ecc71"
              : n.type === "reaction"
                ? "#f1c40f"
                : "#3498db";
    const meta = parseMeta(n);
    const topicId = meta.topic_id || meta.topicId;
    const senderId = meta.sender_id || meta.senderId;
    const t = getTranslations();
    const muteLine =
        topicId && senderId
            ? `<div class="notif-mute-row" data-topic="${escNotif(topicId)}" data-sender="${escNotif(
                  senderId
              )}">
         <button type="button" class="notif-mute-btn" data-mute="topic">${escNotif(t.muteTopic)}</button>
         <button type="button" class="notif-mute-btn" data-mute="user">${escNotif(t.muteUser)}</button>
       </div>`
            : topicId
              ? `<div class="notif-mute-row" data-topic="${escNotif(topicId)}" data-sender="">
         <button type="button" class="notif-mute-btn" data-mute="topic">${escNotif(t.muteTopic)}</button>
       </div>`
              : "";

    return `
        <div class="notif-item" id="notif-${n.id}" data-notif-id="${escNotif(n.id)}" style="${bgStyle}">
            <div class="notif-item__icon" style="color:${iconColor};">
                <i class="${iconIClasses}" aria-hidden="true"></i>
            </div>
            <div class="notif-item__body">
                <div class="notif-item__content" data-nid="${escNotif(n.id)}">
                    ${titleLine ? `<div class="notif-item__title">${titleLine}</div>` : ""}
                    <div class="notif-text-body" style="font-weight: ${isUnread ? "600" : "400"};">${escNotif(
                        textBody
                    )}</div>
                    <div class="notif-item__time">${time}</div>
                </div>
                ${muteLine}
            </div>
            <button type="button" class="notif-item__dismiss" data-del="${escNotif(n.id)}" title="Remove" aria-label="Remove">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </div>
    `;
}

// === ACTIONS ===

// Notification Modal
function openNotificationModal(text, link) {
    let modal = document.getElementById('notif-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'notif-modal';
        
        // Use structure matching CSS
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close-icon" onclick="closeNotifModal()"><i class="fas fa-times"></i></button>
                <h3>Notification</h3>
                <p id="notif-modal-content"></p>
                <div id="notif-modal-actions" class="notif-modal-actions">
                     <!-- Buttons will be injected here -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Event Listeners
        modal.addEventListener('click', (e) => {
           if (e.target === modal) closeNotifModal();
        });
    }
    
    document.getElementById('notif-modal-content').textContent = text;
    
    // Update Actions
    const actionsContainer = document.getElementById('notif-modal-actions') || modal.querySelector('.modal-content > div:last-child');
    
    // Default Close button (Secondary)
    let buttonsHtml = `<button class="notif-btn secondary" onclick="closeNotifModal()">Close</button>`;
    
    if (link && link !== '#' && link !== 'null' && link !== 'undefined') {
        // Open button (Primary)
        buttonsHtml = `
            <button class="notif-btn secondary" onclick="closeNotifModal()">Cancel</button>
            <a href="${link}" class="notif-btn primary">Open Link</a>
        `;
    }
    
    if (actionsContainer) actionsContainer.innerHTML = buttonsHtml;
    
    // Show
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeNotifModal() {
    const modal = document.getElementById('notif-modal');
    if(modal) modal.classList.remove('active');
}
window.closeNotifModal = closeNotifModal;

async function handleNotifClick(id) {
    const n = currentNotifications.find((x) => String(x.id) === String(id));
    if (!n) return;
    const fullText = n.text || n.title || "";
    const link = n.link && String(n.link).trim() ? n.link : "";
    const wasUnread = isNotificationUnread(n);

    n.is_read = 1;
    if (wasUnread) lastServerUnreadCount = Math.max(0, lastServerUnreadCount - 1);

    // Optimistic Update: mark read in UI
    const el = document.getElementById(`notif-${id}`);
    if (el) {
        el.style.background = "transparent";
        el.style.borderLeftColor = "transparent";
        const textEl = el.querySelector(".notif-text-body");
        if (textEl) textEl.style.fontWeight = "400";
    }

    const badge = document.getElementById("notif-badge");
    if (wasUnread && badge && badge.textContent !== "0") {
        let count = parseInt(badge.textContent, 10) || 0;
        if (count > 0) count--;
        badge.textContent = count;
        if (count <= 0) badge.style.display = "none";
    }

    try {
        await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
            method: "POST",
            headers: { ...authHeaders() },
        }).catch((e) => console.error(e));
    } catch (e) {
        console.error(e);
    }

    openNotificationModal(fullText, link);
}

async function markAllRead() {
    // Optimistic UI
    document.querySelectorAll('.notif-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.borderLeftColor = 'transparent';
    });
    const badge = document.getElementById("notif-badge");
    if(badge) badge.style.display = 'none';

    // API Call
    const user = JSON.parse(localStorage.getItem("user_data"));
    if (user) {
        await fetch("/api/notifications/read-all", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify({ user_id: user.id }),
        });
    }
    lastServerUnreadCount = 0;
    setTimeout(loadNotifications, 1000);
}

async function deleteNotificationById(id) {
    const n = currentNotifications.find((x) => String(x.id) === String(id));
    if (n && isNotificationUnread(n)) {
        lastServerUnreadCount = Math.max(0, lastServerUnreadCount - 1);
    }
    currentNotifications = currentNotifications.filter((x) => String(x.id) !== String(id));
    updateNotificationUI(lastServerUnreadCount);

    try {
        await fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: "DELETE", headers: { ...authHeaders() } });
    } catch (err) {
        console.error("Delete failed", err);
    }
}

/** Legacy: (event, id) from inline HTML */
async function deleteNotification(e, id) {
    e.stopPropagation();
    await deleteNotificationById(id);
}

async function muteNotifSource(scope, targetId) {
    const t = getTranslations();
    if (!getNotifyUser() || !targetId) return;
    try {
        const r = await fetch("/api/notifications/mute", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ scope, target_id: String(targetId) }),
        });
        if (r.ok) {
            if (typeof window.showQuickToast === "function") {
                window.showQuickToast(t.muteOk);
            } else if (typeof window.showSuccess === "function") {
                window.showSuccess(t.muteOk);
            }
            await loadNotifications();
        } else {
            const err = await r.json().catch(() => ({}));
            console.warn("mute failed", err);
        }
    } catch (e) {
        console.error(e);
    }
}

// === HELPERS ===

function ensureNotifFilterBar() {
    const dd = document.getElementById("notifications-dropdown");
    if (!dd) return;
    if (document.getElementById("notif-filter-bar")) return;
    const t = getTranslations();
    const bar = document.createElement("div");
    bar.id = "notif-filter-bar";
    bar.className = "notif-filter-bar";
    bar.setAttribute("role", "tablist");
    bar.innerHTML = `<button type="button" class="notif-filter" data-notif-filter="all" role="tab">${escNotif(
        t.tabAll
    )}</button><button type="button" class="notif-filter" data-notif-filter="unread" role="tab">${escNotif(
        t.tabUnread
    )}</button>`;
    const list = document.getElementById("notif-list");
    if (list) {
        dd.insertBefore(bar, list);
    } else {
        dd.appendChild(bar);
    }
}

function syncNotifFilterTabs() {
    const bar = document.getElementById("notif-filter-bar");
    if (!bar) return;
    bar.querySelectorAll("[data-notif-filter]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-notif-filter") === notifListFilter);
    });
    bar.setAttribute("aria-label", notifListFilter === "unread" ? "unread" : "all");
}

function notifPanelClickCapture(e) {
    const filterBtn = e.target.closest("#notif-filter-bar [data-notif-filter]");
    if (filterBtn) {
        e.preventDefault();
        notifListFilter = filterBtn.getAttribute("data-notif-filter") || "all";
        syncNotifFilterTabs();
        updateNotificationUI(lastServerUnreadCount);
        return;
    }

    const unmuteBtn = e.target.closest("[data-notif-unmute]");
    if (unmuteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const scope = unmuteBtn.getAttribute("data-notif-unmute-scope");
        const tid = unmuteBtn.getAttribute("data-notif-unmute-target");
        if (scope && tid) void unmuteNotifSource(scope, tid);
        return;
    }

    if (!e.target.closest("#notif-list")) return;

    const muteBtn = e.target.closest(".notif-mute-btn[data-mute]");
    if (muteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const row = muteBtn.closest(".notif-mute-row");
        const kind = muteBtn.getAttribute("data-mute");
        const topicId = (row && row.getAttribute("data-topic")) || "";
        const senderId = (row && row.getAttribute("data-sender")) || "";
        const targetId = kind === "topic" ? topicId : senderId;
        if (targetId) {
            void muteNotifSource(kind, targetId);
        }
        return;
    }

    if (e.target.closest(".notif-item__dismiss")) {
        e.preventDefault();
        e.stopPropagation();
        const del = e.target.closest(".notif-item__dismiss");
        const rawId = del && (del.getAttribute("data-del") || del.getAttribute("data-nid"));
        if (rawId) {
            void deleteNotificationById(rawId);
        }
        return;
    }

    const item = e.target.closest(".notif-item");
    if (!item) return;
    if (e.target.closest(".notif-mute-row")) return;
    const content = item.querySelector(".notif-item__content[data-nid], .notif-item__content");
    let rawId = content && content.getAttribute("data-nid");
    if (!rawId) {
        rawId = item.getAttribute("data-notif-id");
    }
    if (rawId) {
        void handleNotifClick(rawId);
    }
}

function bindNotifPanelDelegation() {
    if (window.__notifPanelCapBound) return;
    window.__notifPanelCapBound = true;
    document.addEventListener("click", notifPanelClickCapture, true);
}

function injectBellIconIfNeeded() {
    if (!getNotifyUser()) return;

    const existingBtn = document.querySelector(".notification-btn") || document.getElementById("notif-btn-wrapper");
    if (existingBtn) {
        // Static HTML: ensure filter bar exists
        if (document.getElementById("notifications-dropdown") && !document.getElementById("notif-filter-bar")) {
            ensureNotifFilterBar();
        }
        return; // Already there
    }

    const headerRight =
        document.querySelector("header .header-right") ||
        document.querySelector("header .controls") ||
        document.querySelector(".forum-header .controls") ||
        document.querySelector("header [data-header-right]");
    if (!headerRight) return;

    removeLegacyNotifNodes();

    const t = getTranslations();
    const wrapper = document.createElement("div");
    wrapper.id = "notif-btn-wrapper";
    wrapper.className = "btn index-header-btn btn-icon notification-btn";
    wrapper.setAttribute("aria-label", t.notifications);
    wrapper.setAttribute("title", t.notifications);
    wrapper.onclick = toggleNotifications;
    
    wrapper.innerHTML = `
        <i class="fas fa-bell" aria-hidden="true"></i>
        <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
        
        <div id="notifications-dropdown" class="notifications-dropdown" onclick="event.stopPropagation()">
            <div class="notif-header">
                <span>${t.notifications}</span>
                <button type="button" class="notif-action-btn" onclick="markAllRead()">${t.markAllRead}</button>
            </div>
            <div class="notif-list" id="notif-list"></div>
        </div>
    `;

    // Insert before the last control (e.g. Login / account) so order matches design
    if (headerRight.lastElementChild) {
        headerRight.insertBefore(wrapper, headerRight.lastElementChild);
    } else {
        headerRight.appendChild(wrapper);
    }
}

function toggleNotifications() {
    if (!getNotifyUser()) return;
    const dd = document.getElementById("notifications-dropdown");
    if (dd) dd.classList.toggle("active");
    else {
        // User just logged in but UI not mounted yet
        loadNotifications();
    }
}

function timeAgo(dateString) {
    if(!dateString) return '';
    const safeDate = dateString.endsWith("Z") ? dateString : dateString + "Z";
    const date = new Date(safeDate);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
}

function getTranslations() {
    const lang = typeof currentForumLang !== "undefined" ? currentForumLang : localStorage.getItem("forumLanguage") || "en";
    const dict = {
        en: {
            notifications: "Notifications",
            noNotifications: "No new notifications",
            noUnread: "No unread notifications",
            markAllRead: "Mark all as read",
            tabAll: "All",
            tabUnread: "Unread",
            muteTopic: "Mute this topic",
            muteUser: "Mute this user",
            muteOk: "Notifications from this source are muted",
            mutedSourcesLabel: "Muted",
            unmute: "Unmute",
            unmuteOk: "Notifications restored",
            mutedUserFallback: "User",
            mutedTopicFallback: "Topic",
        },
        ru: {
            notifications: "Уведомления",
            noNotifications: "Нет уведомлений",
            noUnread: "Нет непрочитанных",
            markAllRead: "Прочитать все",
            tabAll: "Все",
            tabUnread: "Непрочитанные",
            muteTopic: "Отключить тему",
            muteUser: "Отключить пользователя",
            muteOk: "Уведомления от этого источника отключены",
            mutedSourcesLabel: "Отключено",
            unmute: "Включить",
            unmuteOk: "Уведомления снова включены",
            mutedUserFallback: "Пользователь",
            mutedTopicFallback: "Тема",
        },
        ka: {
            notifications: "შეტყობინებები",
            noNotifications: "შეტყობინებები არაა",
            noUnread: "წაუკითხავი არაა",
            markAllRead: "ყველას წაკითხვა",
            tabAll: "ყველა",
            tabUnread: "წაუკითხავი",
            muteTopic: "თემის გათიშვა",
            muteUser: "მომხმარებლის გათიშვა",
            muteOk: "შეტყობინებები გამორთულია ამ წყაროდან",
            mutedSourcesLabel: "გამორთული",
            unmute: "ჩართვა",
            unmuteOk: "შეტყობინებები ისევ ჩართულია",
            mutedUserFallback: "მომხმარებელი",
            mutedTopicFallback: "თემა",
        },
    };
    return dict[lang] || dict.en;
}

// Close dropdown on outside click
document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("notif-btn-wrapper") || document.querySelector(".btn.notification-btn");
    const dd = document.getElementById("notifications-dropdown");

    if (wrapper && dd && dd.classList.contains("active")) {
        if (!wrapper.contains(e.target)) {
            dd.classList.remove("active");
        }
    }
});

// Inline onclick / debugging
window.handleNotifClick = handleNotifClick;
window.markAllRead = markAllRead;
window.deleteNotification = deleteNotification;
window.muteNotifSource = muteNotifSource;

// Forum.js delegates here so both pages behave the same; only logged-in users have a target.
window.__notifications = {
    toggle: toggleNotifications,
    refresh: loadNotifications,
    setup: setupNotificationsForUser,
    teardown: teardownNotificationUI,
    unmute: unmuteNotifSource,
    refreshMutes: loadMutesPanel,
};
