// js/live.js

const API_BASE = "/api";
let lastNotificationCount = 0;

// === ГЛОБАЛЬНЫЕ ЖИВЫЕ УВЕДОМЛЕНИЯ ===
async function checkLiveNotifications() {
  // ВАЖНО: Правильное получение ID пользователя из сохраненного объекта
  const userDataStr = localStorage.getItem("user_data");
  if (!userDataStr) return;

  let user;
  try {
    user = JSON.parse(userDataStr);
  } catch (e) {
    console.error("Auth error: corrupted data");
    return;
  }

  if (!user || !user.id) return;

  try {
    // Запрашиваем уведомления
    const res = await fetch(`${API_BASE}/notifications?user_id=${user.id}`);
    if (!res.ok) return;

    const data = await res.json();
    // Сервер должен возвращать { notifications: [], unread_count: 0 }
    // Если старый API возвращает массив, считаем вручную
    let unreadCount = 0;
    if (data.unread_count !== undefined) {
      unreadCount = data.unread_count;
    } else if (Array.isArray(data)) {
      unreadCount = data.filter((n) => !n.is_read).length;
    }

    // Обновляем бейджи везде, где они есть (в шапке и в мобильном меню)
    const badges = document.querySelectorAll(".notif-badge");
    badges.forEach((badge) => {
      if (unreadCount > 0) {
        badge.classList.add("visible");
        badge.textContent = unreadCount > 99 ? "99+" : unreadCount;

        // Анимация пульсации, если пришло новое уведомление
        if (unreadCount > lastNotificationCount) {
          badge.classList.add("pulse-animation");
          setTimeout(() => badge.classList.remove("pulse-animation"), 1000);
        }
      } else {
        badge.classList.remove("visible");
      }
    });

    lastNotificationCount = unreadCount;
  } catch (e) {
    console.error("Live update error:", e);
  }
}

// Запускаем опрос каждые 10 секунд
setInterval(checkLiveNotifications, 10000);

// Первый запуск сразу после загрузки
document.addEventListener("DOMContentLoaded", checkLiveNotifications);
