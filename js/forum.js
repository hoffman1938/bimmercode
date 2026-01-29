// js/forum.js

// Глобальное состояние
const state = {
    currentCategory: 'all',
    searchQuery: '',
    user: JSON.parse(localStorage.getItem('user')) || null,
    categories: [] // Кэш категорий
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadCategories(); // Загрузит категории и сохранит в state
    loadTopics();
    
    // Слушатель поиска
    const searchInput = document.querySelector('input[placeholder="Search forum..."]');
    if(searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                state.searchQuery = e.target.value.trim();
                loadTopics();
            }, 500);
        });
    }
});

// === 1. АВТОРИЗАЦИЯ И UI ===
function initAuth() {
    const authContainer = document.getElementById('auth-container');
    const userCard = document.getElementById('user-mini-card');
    
    if (state.user) {
        authContainer.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                <div style="text-align:right; line-height:1.2;">
                    <div style="font-size:13px; font-weight:600; color:white;">${state.user.username}</div>
                    <div style="font-size:11px; color:#888;">Member</div>
                </div>
                <img src="${state.user.avatar || './assets/icons/default-avatar.png'}" 
                     style="width:36px; height:36px; border-radius:50%; border:1px solid #333;">
            </div>
        `;
        
        if(userCard) {
            userCard.style.display = 'block';
            document.getElementById('side-username').textContent = state.user.username;
        }
    } else {
        if(userCard) userCard.style.display = 'none';
    }
}

// === 2. КАТЕГОРИИ ===
async function loadCategories() {
    try {
        const res = await fetch('/api/forum/categories');
        if(!res.ok) throw new Error('Failed to load categories');
        state.categories = await res.json();
    } catch (e) {
        console.warn('Using fallback categories', e);
    }
}

window.filterCat = function(slug) {
    state.currentCategory = slug;
    document.querySelectorAll('.cat-link').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    loadTopics();
}

// === 3. ТЕМЫ (TOPICS) ===
async function loadTopics() {
    const container = document.getElementById('topics-container');
    container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

    try {
        const url = new URL('/api/forum/topics', window.location.origin);
        if(state.currentCategory !== 'all') url.searchParams.append('category', state.currentCategory);
        if(state.searchQuery) url.searchParams.append('search', state.searchQuery);

        const res = await fetch(url);
        const topics = await res.json();
        renderTopics(topics);
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="padding:20px; text-align:center; color:#e74c3c;">Failed to load topics.</div>`;
    }
}

function renderTopics(topics) {
    const container = document.getElementById('topics-container');
    if(topics.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;">No topics found. Be the first to post!</div>`;
        return;
    }

    container.innerHTML = topics.map(topic => `
        <div class="topic-row" onclick="alert('View Topic coming next step!')"> 
            <div class="t-main">
                <div class="t-title">${escapeHtml(topic.title)}</div>
                <div class="t-meta">
                    <span class="t-tag">${topic.category_slug}</span>
                    <span>by <span style="color:#aaa">${topic.username}</span></span>
                </div>
            </div>
            <div class="t-stat">${topic.reply_count} <small>replies</small></div>
            <div class="t-stat">${topic.views} <small>views</small></div>
            <div class="t-last">
                <div class="t-last-date">${timeAgo(topic.last_activity_at)}</div>
            </div>
        </div>
    `).join('');
}

// === 4. СОЗДАНИЕ ТЕМЫ (MODAL) ===

window.openNewTopicModal = function() {
    if(!state.user) {
        alert("Please Login to post."); // В идеале открывать модалку входа
        return;
    }

    const modal = document.getElementById('new-topic-modal');
    const select = document.getElementById('nt-category');
    
    // Заполняем селект категорий
    if(select.options.length === 0 && state.categories.length > 0) {
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.slug;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
    }

    modal.style.display = 'flex'; // Показываем
    modal.classList.remove('hidden');
}

window.closeNewTopicModal = function() {
    document.getElementById('new-topic-modal').style.display = 'none';
}

window.submitNewTopic = async function() {
    const title = document.getElementById('nt-title').value.trim();
    const content = document.getElementById('nt-content').value.trim();
    const category = document.getElementById('nt-category').value;
    const btn = document.querySelector('.btn-new-topic');

    if(!title || !content) {
        alert("Please fill all fields");
        return;
    }

    btn.textContent = "Posting...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/forum/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                content,
                category_slug: category,
                user_id: state.user.id
            })
        });

        if(!res.ok) throw new Error('Failed to create topic');

        // Успех
        closeNewTopicModal();
        document.getElementById('nt-title').value = '';
        document.getElementById('nt-content').value = '';
        loadTopics(); // Обновляем список

    } catch(e) {
        alert("Error: " + e.message);
    } finally {
        btn.textContent = "Post Topic";
        btn.disabled = false;
    }
}

// === УТИЛИТЫ ===
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "Just now";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
}