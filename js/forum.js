// js/forum.js

document.addEventListener('DOMContentLoaded', () => {
    initAuthForum(); // Запускаем проверку авторизации для элементов форума
    loadCategories();
    loadTopics();
});

// === AUTH UI ФОРУМА ===
function initAuthForum() {
    // Ждем глобальный state из script.js
    if (!window.state || !window.state.user) return;

    const user = window.state.user;
    const sideCard = document.getElementById('user-mini-card');
    const sideName = document.getElementById('side-username');
    const sideAvatar = document.getElementById('user-avatar-display');

    // Если элементы есть, обновляем их (Защита от ошибки null)
    if (sideCard) {
        sideCard.style.display = 'block';
        if (sideName) sideName.textContent = user.username;
        if (sideAvatar) {
            if (user.avatar) {
                sideAvatar.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;">`;
            } else {
                sideAvatar.innerHTML = `<i class="fas fa-user"></i>`;
            }
        }
    }
}

// === КАТЕГОРИИ ===
async function loadCategories() {
    // В будущем можно грузить с API, пока хардкод для скорости
    // Категории уже есть в HTML
}

window.filterCat = function(slug) {
    // UI активного класса
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    
    loadTopics(slug);
}

// === ТЕМЫ ===
async function loadTopics(category = 'all', search = '') {
    const container = document.getElementById('topics-container');
    // Используем стили из CSS для лоадера
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

    try {
        const url = new URL('/api/forum/topics', window.location.origin);
        if (category !== 'all') url.searchParams.append('category', category);
        if (search) url.searchParams.append('search', search);

        const res = await fetch(url);
        let data = await res.json();

        if (!data || data.error || !Array.isArray(data)) {
            console.warn("API returned invalid data or empty:", data);
            data = [];
        }

        renderTopics(data);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#e74c3c;">Connection Error (Check API)</div>`;
    }
}

function renderTopics(topics) {
    const container = document.getElementById('topics-container');
    
    if (topics.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;">No topics found here. Start a new one!</div>`;
        return;
    }

    container.innerHTML = topics.map(topic => `
        <div class="topic-card" onclick="window.location.href='topic.html?id=${topic.id}'">
            <div class="topic-main">
                <div class="topic-icon">
                    <i class="fas fa-comment-alt"></i>
                </div>
                <div class="topic-info">
                    <h3>${escapeHtml(topic.title)}</h3>
                    <p>
                        <span style="color:${getCatColor(topic.category_slug)}">#${topic.category_slug}</span> 
                        • by ${topic.username || 'User'} • ${timeAgo(topic.last_activity_at)}
                    </p>
                </div>
            </div>
            <div class="topic-stats">
                <div class="stat-mini"><span>${topic.reply_count || 0}</span><small>Replies</small></div>
                <div class="stat-mini"><span>${topic.views || 0}</span><small>Views</small></div>
            </div>
        </div>
    `).join('');
}

// === МОДАЛКА НОВОЙ ТЕМЫ ===
window.openNewTopicModal = function() {
    if (!window.state || !window.state.user) {
        if(window.toggleAuthModal) window.toggleAuthModal();
        return;
    }

    const modal = document.getElementById('new-topic-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active'); // Используем класс active для анимации из CSS
        
        // Заполняем селект
        const select = document.getElementById('nt-category');
        if(select && select.children.length === 0) {
             const cats = ['engines', 'chassis', 'electronics', 'coding', 'general', 'news'];
             cats.forEach(c => {
                 const opt = document.createElement('option');
                 opt.value = c;
                 opt.innerText = c.charAt(0).toUpperCase() + c.slice(1);
                 select.appendChild(opt);
             });
        }
    }
}

window.closeNewTopicModal = function() {
    const modal = document.getElementById('new-topic-modal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('active');
    }
}

window.submitNewTopic = async function() {
    const title = document.getElementById('nt-title').value.trim();
    const content = document.getElementById('nt-content').value.trim();
    const category = document.getElementById('nt-category').value;
    const btn = document.querySelector('.btn-new-topic-submit');

    if(!title || !content) return alert("Please fill all fields");

    if(btn) { btn.textContent = "Posting..."; btn.disabled = true; }

    try {
        const res = await fetch('/api/forum/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, content, category_slug: category, user_id: window.state.user.id, username: window.state.user.username
            })
        });
        
        if(!res.ok) throw new Error('Failed');
        
        window.closeNewTopicModal();
        loadTopics();
        
        document.getElementById('nt-title').value = '';
        document.getElementById('nt-content').value = '';

    } catch(e) {
        alert("Error creating topic");
    } finally {
        if(btn) { btn.textContent = "Post Topic"; btn.disabled = false; }
    }
}

// Утилиты
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function timeAgo(dateString) {
    if(!dateString) return 'recently';
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds/60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds/3600) + "h ago";
    return Math.floor(seconds/86400) + "d ago";
}

function getCatColor(slug) {
    const colors = { engines: '#e74c3c', coding: '#9b59b6', chassis: '#f1c40f', electronics: '#3498db' };
    return colors[slug] || '#888';
}