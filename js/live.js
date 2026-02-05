// js/live.js

const API_BASE = "/api";
let lastNotificationCount = 0;

// 1. Управление кликом по колокольчику
window.toggleNotifications = function () {
  const dropdown = document.getElementById("notifications-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("active");
  }
};

// 2. Клик по конкретному уведомлению
window.handleNotificationClick = async function (topicId, notifId) {
  const userDataStr = localStorage.getItem("user_data");
  if (!userDataStr) {
    window.location.href = `/topic?id=${topicId}`;
    return;
  }
  const user = JSON.parse(userDataStr);

  try {
    // Помечаем КОНКРЕТНОЕ уведомление как прочитанное
    fetch(`${API_BASE}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        notification_ids: [notifId],
      }),
    });
    window.location.href = `/topic?id=${topicId}`;
  } catch (e) {
    window.location.href = `/topic?id=${topicId}`;
  }
};

// 3. НОВОЕ: Прочитать всё
window.markAllRead = async function (event) {
  if (event) event.stopPropagation(); // Чтобы меню не закрылось

  const userDataStr = localStorage.getItem("user_data");
  if (!userDataStr) return;
  const user = JSON.parse(userDataStr);

  try {
    // Отправляем запрос БЕЗ ID уведомлений -> сервер поймет, что нужно отметить ВСЕ
    await fetch(`${API_BASE}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }),
    });

    // Мгновенно обновляем интерфейс
    const badges = document.querySelectorAll(".notif-badge");
    badges.forEach((b) => {
      b.classList.remove("visible");
      b.textContent = "0";
    });

    const unreadItems = document.querySelectorAll(".notif-item.unread");
    unreadItems.forEach((item) => item.classList.remove("unread"));

    // Убираем кнопку "Прочитать все"
    updateHeaderUI(0);
  } catch (e) {
    console.error("Error marking all read:", e);
  }
};

// Закрытие при клике вне
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("notifications-dropdown");
  const btn = document.querySelector(".notification-btn");

  if (dropdown && dropdown.classList.contains("active")) {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.remove("active");
    }
  }
});

// Основной цикл
async function checkLiveNotifications() {
  const userDataStr = localStorage.getItem("user_data");
  if (!userDataStr) return;

  let user;
  try {
    user = JSON.parse(userDataStr);
  } catch (e) {
    return;
  }

  if (!user || !user.id) return;

  try {
    const res = await fetch(`${API_BASE}/notifications?user_id=${user.id}`);
    if (!res.ok) return;

    const data = await res.json();

    let notifications = [];
    if (Array.isArray(data)) {
      notifications = data;
    } else if (data.notifications) {
      notifications = data.notifications;
    }

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    // Обновляем бейдж
    updateBadgeUI(unreadCount);

    // Обновляем заголовок (добавляем/убираем кнопку)
    updateHeaderUI(unreadCount);

    // Обновляем список (только если массив изменился, можно добавить проверку)
    updateDropdownUI(notifications);
  } catch (e) {}
}

function updateBadgeUI(count) {
  const badges = document.querySelectorAll(".notif-badge");
  badges.forEach((badge) => {
    if (count > 0) {
      badge.classList.add("visible");
      badge.textContent = count > 99 ? "99+" : count;
      if (count > lastNotificationCount) {
        badge.classList.add("pulse-animation");
        setTimeout(() => badge.classList.remove("pulse-animation"), 1000);
      }
    } else {
      badge.classList.remove("visible");
    }
  });
  lastNotificationCount = count;
}

// НОВАЯ ФУНКЦИЯ: Обновление заголовка выпадашки
function updateHeaderUI(unreadCount) {
  const header = document.querySelector(".notif-header");
  if (!header) return;

  // Если есть непрочитанные - показываем кнопку
  if (unreadCount > 0) {
    header.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span>Notifications</span>
                <button onclick="markAllRead(event)" 
                        style="background:none; border:none; color:#0066b3; font-size:11px; cursor:pointer; font-weight:bold; text-transform:uppercase;">
                    Mark all read
                </button>
            </div>
        `;
  } else {
    header.innerHTML = "Notifications";
  }
}

function updateDropdownUI(notifications) {
  const list = document.getElementById("notif-list");
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = `<div style="padding:20px; text-align:center; color:#666;">No notifications</div>`;
    return;
  }

  // Простая перерисовка (для надежности)
  list.innerHTML = notifications
    .map(
      (n) => `
        <div class="notif-item ${!n.is_read ? "unread" : ""}" 
             onclick="handleNotificationClick('${n.topic_id}', '${n.id}')">
            <div class="notif-icon">
                <i class="fas ${getIconByType(n.type)}"></i>
            </div>
            <div>
                <div style="font-weight:bold; font-size:13px; color:white;">${escapeHtml(n.sender_name)}</div>
                <div style="font-size:12px; color:#aaa;">
                    ${getTextByType(n.type)} "${escapeHtml(n.topic_title || "Topic")}"
                </div>
                <div style="font-size:10px; color:#666; margin-top:2px;">${timeAgoShort(n.created_at)}</div>
            </div>
        </div>
    `,
    )
    .join("");
}

function getIconByType(type) {
  if (type === "like") return "fa-heart";
  if (type === "solve") return "fa-check";
  return "fa-reply";
}

function getTextByType(type) {
  if (type === "like") return "liked your post in";
  if (type === "solve") return "marked solution in";
  return "replied to";
}

function timeAgoShort(dateString) {
  if (!dateString) return "";
  const cleanDate = dateString.endsWith("Z") ? dateString : dateString + "Z";
  const seconds = Math.floor((new Date() - new Date(cleanDate)) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

setInterval(checkLiveNotifications, 5000);
document.addEventListener("DOMContentLoaded", checkLiveNotifications);
