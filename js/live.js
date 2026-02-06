// js/live.js - Notification System 2.0

const NOTIFICATION_POLL_INTERVAL = 15000; // 15 seconds

document.addEventListener("DOMContentLoaded", () => {
    initNotifications();
});

// Handle Back/Forward Cache & Visibility
window.addEventListener("pageshow", () => loadNotifications());
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'visible') loadNotifications();
});

function initNotifications() {
     // Check auth
     const user = JSON.parse(localStorage.getItem("user_data"));
     if (!user || !user.id) return;

     // Initial load
     loadNotifications();
     
     // Start polling
     setInterval(loadNotifications, NOTIFICATION_POLL_INTERVAL);
}

// State
let currentNotifications = [];

async function loadNotifications() {
    const user = JSON.parse(localStorage.getItem("user_data"));
    if (!user || !user.id) return;

    try {
        const res = await fetch(`/api/notifications?user_id=${user.id}&_=${Date.now()}`);
        if (!res.ok) return;

        const data = await res.json();
        currentNotifications = data.notifications || [];
        const unreadCount = data.unread_count || 0;

        updateNotificationUI(unreadCount);
    } catch (e) {
        console.error("Failed to load notifications", e);
    }
}

function updateNotificationUI(unreadCount) {
    const t = getTranslations();

    // 1. Ensure Bell Icon Exists
    injectBellIconIfNeeded();

    // 2. Update Badge
    const badge = document.getElementById("notif-badge");
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = "block";
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        } else {
            badge.style.display = "none";
        }
    }

    // 3. Update Dropdown List
    const list = document.getElementById("notif-list");
    if (list) {
        if (currentNotifications.length === 0) {
            list.innerHTML = `
                <div style="padding:40px 20px; text-align:center; color:#666;">
                    <i class="far fa-bell" style="font-size:24px; margin-bottom:10px; opacity:0.5;"></i>
                    <p style="font-size:14px;">${t.noNotifications}</p>
                </div>`;
        } else {
            list.innerHTML = currentNotifications.map(n => renderNotificationItem(n)).join('');
        }
    }
}

function renderNotificationItem(n) {
    const isUnread = !n.is_read;
    const bgStyle = isUnread ? 'background: rgba(0, 102, 179, 0.1); border-left: 3px solid #0066b3;' : 'border-left: 3px solid transparent;';
    const time = timeAgo(n.created_at);
    
    // Icon mapping
    const iconClass = n.icon || 'fa-bell';
    const iconColor = n.type === 'like' ? '#e74c3c' : (n.type === 'solve' ? '#2ecc71' : '#3498db');

    return `
        <div class="notif-item" id="notif-${n.id}" style="${bgStyle}; padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; display: flex; gap: 12px; align-items: start; transition: background 0.2s;">
            <div style="font-size:16px; color:${iconColor}; margin-top: 2px;">
                <i class="fas ${iconClass}"></i>
            </div>
            <div style="flex: 1;" onclick="handleNotifClick('${n.id}', '${n.link}')">
                <div class="notif-text-body" style="font-size:13px; color:#fff; font-weight: ${isUnread ? '600' : '400'}; line-height: 1.4;">
                    ${n.text}
                </div>
                <div style="font-size:11px; color:#666; margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
                    <span>${time}</span>
                </div>
            </div>
             <button onclick="deleteNotification(event, '${n.id}')" style="background:transparent; border:none; color:#444; cursor:pointer; padding:5px;" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

// === ACTIONS ===

async function handleNotifClick(id, link) {
    // Optimistic Update: Mark as read immediately in UI
    const el = document.getElementById(`notif-${id}`);
    if (el) {
        el.style.background = 'transparent';
        el.style.borderLeftColor = 'transparent';
        // Safe selection with optional chaining or if check
        const textEl = el.querySelector('.notif-text-body') || el.querySelector('div[style*="font-weight: 600"]');
        if (textEl) {
            textEl.style.fontWeight = '400';
        }
    }
    
    // Reduce badge count locally
    const badge = document.getElementById("notif-badge");
    if(badge && badge.textContent !== '0') {
         let count = parseInt(badge.textContent) || 0;
         if(count > 0) count--;
         badge.textContent = count;
         if(count === 0) badge.style.display = 'none';
    }

    // API Call (Fire and forget, but logically we await if we wanted to be sure)
    try {
        await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch (e) {
        console.error("Mark read failed", e);
    }

    // Navigate
    if (link && link !== '#') {
        window.location.href = link;
    }
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
        await fetch('/api/notifications/read-all', { 
            method: 'POST',
            body: JSON.stringify({ user_id: user.id }) 
        });
    }
    
    // Refresh to be sure
    setTimeout(loadNotifications, 1000);
}

async function deleteNotification(e, id) {
    e.stopPropagation(); // Don't trigger click action
    
    // Optimistic UI
    const el = document.getElementById(`notif-${id}`);
    if(el) {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }

    // API Call
    try {
        await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch (err) {
        console.error("Delete failed", err);
    }
}

// === HELPERS ===

function injectBellIconIfNeeded() {
    const existingBtn = document.querySelector(".notification-btn") || document.getElementById("notif-btn-wrapper");
    if (existingBtn) return; // Already there

    const headerRight = document.querySelector("header .header-right") || document.querySelector("header .controls");
    if (!headerRight) return;

    const t = getTranslations();
    const wrapper = document.createElement("div");
    wrapper.id = "notif-btn-wrapper";
    wrapper.className = "btn notification-btn"; // Use existing class for style
    wrapper.style.position = "relative";
    wrapper.onclick = toggleNotifications;
    
    wrapper.innerHTML = `
        <i class="fas fa-bell"></i>
        <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
        
        <div id="notifications-dropdown" class="notifications-dropdown" onclick="event.stopPropagation()">
            <div class="notif-header" style="display:flex; justify-content:space-between; align-items:center;">
                <span>${t.notifications}</span>
                <button onclick="markAllRead()" style="background:transparent; border:none; color:var(--bmw-blue); font-size:12px; cursor:pointer;">${t.markAllRead}</button>
            </div>
            <div class="notif-list" id="notif-list"></div>
        </div>
    `;

    // Insert before the last element (Auth btn)
    headerRight.insertBefore(wrapper, headerRight.lastElementChild);
}

function toggleNotifications() {
    const dd = document.getElementById("notifications-dropdown");
    if (dd) dd.classList.toggle("active");
}

function timeAgo(dateString) {
    if(!dateString) return '';
    const date = new Date(dateString);
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
    // Simple fallback logic
    const lang = (typeof currentForumLang !== 'undefined') ? currentForumLang : (localStorage.getItem("forumLanguage") || "en");
    const dict = {
        en: { notifications: "Notifications", noNotifications: "No new notifications", markAllRead: "Mark all as read" },
        ru: { notifications: "Уведомления", noNotifications: "Нет новых уведомлений", markAllRead: "Прочитать все" },
        ka: { notifications: "შეტყობინებები", noNotifications: "ახალი შეტყობინებები არ არის", markAllRead: "ყველას წაკითხვა" }
    };
    return dict[lang] || dict['en'];
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById("notif-btn-wrapper") || document.querySelector(".btn.notification-btn");
    const dd = document.getElementById("notifications-dropdown");
    
    if (wrapper && dd && dd.classList.contains('active')) {
         if (!wrapper.contains(e.target)) {
             dd.classList.remove("active");
         }
    }
});
