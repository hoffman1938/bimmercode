// js/live.js

const API_BASE = '/api'; // Путь к вашим Cloudflare Functions
let lastNotificationCount = 0;

// 1. ЖИВЫЕ УВЕДОМЛЕНИЯ (Работает везде)
async function checkLiveNotifications() {
    const userId = localStorage.getItem('user_id'); // Или как вы храните ID
    if (!userId) return;

    try {
        // Запрашиваем уведомления
        const res = await fetch(`${API_BASE}/notifications?user_id=${userId}`);
        if (!res.ok) return;
        
        const data = await res.json();
        const unreadCount = data.unread_count || 0;

        // Обновляем бейдж в хедере
        const badge = document.querySelector('.notif-badge'); // Создайте этот элемент в HTML
        if (badge) {
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                
                // Звук или анимация, если стало больше
                if (unreadCount > lastNotificationCount) {
                    badge.classList.add('pulse-animation'); // Добавьте анимацию в CSS
                }
            } else {
                badge.style.display = 'none';
            }
        }
        lastNotificationCount = unreadCount;

    } catch (e) {
        console.error("Live update error:", e);
    }
}

// 2. ЖИВАЯ ТЕМА (Работает только внутри topic.html)
async function checkLiveTopicUpdates() {
    // Проверяем, находимся ли мы в теме
    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get('id');
    if (!topicId) return;

    const postsContainer = document.querySelector('.replies-list');
    if (!postsContainer) return;

    // Считаем сколько постов сейчас на экране
    const currentPostCount = document.querySelectorAll('.post-card').length;

    try {
        // Запрашиваем данные темы
        const res = await fetch(`${API_BASE}/forum/topic?id=${topicId}`);
        if (!res.ok) return;
        
        const data = await res.json();
        const serverPosts = data.posts || [];

        // Если на сервере больше постов, чем у нас -> подгружаем новые
        if (serverPosts.length > currentPostCount) {
            const newPosts = serverPosts.slice(currentPostCount);
            
            newPosts.forEach(post => {
                // Используем вашу функцию рендера поста (нужно вынести её в общую)
                const postHTML = createPostHTML(post); 
                postsContainer.insertAdjacentHTML('beforeend', postHTML);
            });
            
            // Звук уведомления о новом сообщении (опционально)
        }
        
        // Обновляем счетчики лайков и просмотров в реальном времени
        document.getElementById('view-count').innerText = data.topic.views;
        
    } catch (e) {
        console.error("Topic sync error:", e);
    }
}

// Вспомогательная функция генерации HTML поста (вынесите из topic.js сюда или дублируйте)
function createPostHTML(post) {
    // Здесь должен быть ваш HTML шаблон карточки поста
    // Пример:
    return `
    <div class="post-card fade-in">
        <div class="post-user">
            <div class="user-avatar">${post.username[0]}</div>
            <div class="user-name">${post.username}</div>
        </div>
        <div class="post-content">
            <div class="post-body">${post.content}</div>
        </div>
    </div>`;
}

// ЗАПУСК ЦИКЛА (Каждые 5 секунд)
setInterval(() => {
    checkLiveNotifications();
    checkLiveTopicUpdates();
}, 5000);

// Первый запуск сразу
document.addEventListener('DOMContentLoaded', () => {
    checkLiveNotifications();
    checkLiveTopicUpdates();
});