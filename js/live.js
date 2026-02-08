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
            <div style="flex: 1;" onclick="handleNotifClick('${n.id}', '${n.link || ""}', \`${n.text ? n.text.replace(/`/g, '\\`').replace(/'/g, "\\'") : ''}\`)">
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

// Notification Modal
function openNotificationModal(text) {
    let modal = document.getElementById('notif-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'notif-modal';
        modal.className = 'modal'; // Add standard class
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); z-index: 10001;
            display: flex; justify-content: center; align-items: center;
            opacity: 0; transition: opacity 0.3s;
        `;
        // Removed inline onclick to prevent CSP/Scope issues. We bind globally or via dedicated listener.
        modal.innerHTML = `
            <div style="background: var(--admin-bg, #1a1a1a); width: 90%; max-width: 500px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); transform: scale(0.9); transition: transform 0.3s;">
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03);">
                    <h3 style="margin: 0; font-size: 1.1em; color: white;">Notification</h3>
                    <button class="close-modal-btn" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 1.2em;"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding: 20px; color: #ddd; line-height: 1.6; max-height: 60vh; overflow-y: auto;">
                    <p id="notif-modal-content" style="margin: 0; white-space: pre-wrap;"></p>
                </div>
                <div style="padding: 15px 20px; background: rgba(0,0,0,0.2); text-align: right;">
                    <button class="close-modal-btn" style="padding: 8px 16px; background: var(--bmw-blue, #3b82f6); color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Event Listeners (Locally scoped to this modal for robustness)
        modal.addEventListener('click', (e) => {
           if (e.target === modal) closeNotifModal();
        });
        
        // Allow close buttons to work
        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', closeNotifModal);
        });
    }
    
    document.getElementById('notif-modal-content').textContent = text;
    
    // Show
    requestAnimationFrame(() => {
        modal.classList.add('active');
        modal.style.opacity = '1';
        modal.querySelector('div').style.transform = 'scale(1)';
    });
}

function closeNotifModal() {
    const modal = document.getElementById('notif-modal');
    if(modal) modal.classList.remove('active');
}

async function handleNotifClick(id, link, fullText) {
    // Optimistic Update: Mark as read immediately in UI
    const el = document.getElementById(`notif-${id}`);
    if (el) {
        el.style.background = 'transparent';
        el.style.borderLeftColor = 'transparent';
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

    // API Call (Fire and forget)
    try {
         fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(e => console.error(e));
    } catch (e) { console.error(e); }

    // Logic: If system notification (no link or explicit type), open modal
    // We can infer system type if link is missing or empty
    if (!link || link === '#' || link === 'null' || link === 'undefined') {
        // Need to get the text. passed as arg now
        openNotificationModal(fullText);
    } else {
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
