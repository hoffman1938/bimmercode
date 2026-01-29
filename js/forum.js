// js/forum.js

// Глобальное состояние
const state = {
    currentCategory: 'all',
    searchQuery: '',
    user: JSON.parse(localStorage.getItem('user')) || null,
    categories: []
};

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadCategories();
    loadTopics();
    
    // Поиск
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

// === 1. AUTH UI ===
function initAuth() {
    const authContainer = document.getElementById('auth-container');
    const userCard = document.getElementById('user-mini-card');
    
    // Обновляем кнопку в Хедере
    const headerAuthBtn = document.getElementById('auth-btn'); // Кнопка в хедере
    
    if (state.user) {
        // Хедер (меняем кнопку Login на Аватар)
        if(headerAuthBtn) {
            headerAuthBtn.onclick = null; // Убираем вызов модалки входа
            headerAuthBtn.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:14px;">${state.user.username}</span>
                    <img src="${state.user.avatar || './assets/icons/default-avatar.png'}" 
                         style="width:28px; height:28px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
                </div>
            `;
        }

        // Сайдбар
        if(userCard) {
            userCard.style.display = 'block';
            document.getElementById('side-username').textContent = state.user.username;
        }
    } else {
        if(userCard) userCard.style.display = 'none';
        // Хедер вернется к дефолту из HTML
    }
}

// === 2. CATEGORIES ===
async function loadCategories() {
    try {
        const res = await fetch('/api/forum/categories');
        if(!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        // Проверка что пришел массив
        if(Array.isArray(data)) {
            state.categories = data;
        }
    } catch (e) {
        console.warn('Cats load error:', e);
    }
}

window.filterCat = function(slug) {
    state.currentCategory = slug;
    document.querySelectorAll('.cat-link').forEach(el => el.classList.remove('active'));
    // Безопасный выбор активного элемента
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    loadTopics();
}

// === 3. TOPICS (FIXED) ===
async function loadTopics() {
    const container = document.getElementById('topics-container');
    container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

    try {
        const url = new URL('/api/forum/topics', window.location.origin);
        if(state.currentCategory !== 'all') url.searchParams.append('category', state.currentCategory);
        if(state.searchQuery) url.searchParams.append('search', state.searchQuery);

        const res = await fetch(url);
        const data = await res.json(); // Получаем данные (массив или ошибку)

        // ИСПРАВЛЕНИЕ ОШИБКИ map is not a function
        if (Array.isArray(data)) {
            renderTopics(data);
        } else {
            // Если пришла ошибка от сервера (объект {error: ...})
            console.error("Server API Error:", data);
            container.innerHTML = `<div style="padding:20px; text-align:center; color:#e74c3c;">
                Error loading topics: ${data.error || "Unknown error"}
            </div>`;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="padding:20px; text-align:center; color:#e74c3c;">Connection Error.</div>`;
    }
}

function renderTopics(topics) {
    const container = document.getElementById('topics-container');
    
    if(topics.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;">No topics found. Be the first to post!</div>`;
        return;
    }

    container.innerHTML = topics.map(topic => `
        <div class="topic-row" onclick="window.location.href='topic.html?id=${topic.id}'">
            <div class="t-main">
                <div class="t-title">${escapeHtml(topic.title)}</div>
                <div class="t-meta">
                    <span class="t-tag">${topic.category_slug}</span>
                    <span>by <span style="color:#aaa">${topic.username || 'Unknown'}</span></span>
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

// === 4. MODALS & UTILS ===
window.openNewTopicModal = function() {
    if(!state.user) {
        toggleAuthModal(); // Вызываем модалку из script.js
        return;
    }
    const modal = document.getElementById('new-topic-modal');
    const select = document.getElementById('nt-category');
    
    if(select.options.length === 0 && state.categories.length > 0) {
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.slug;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

window.closeNewTopicModal = function() {
    document.getElementById('new-topic-modal').style.display = 'none';
}

window.submitNewTopic = async function() {
    const title = document.getElementById('nt-title').value.trim();
    const content = document.getElementById('nt-content').value.trim();
    const category = document.getElementById('nt-category').value;
    const btn = document.querySelector('.btn-new-topic-submit'); // Класс кнопки

    if(!title || !content) return alert("Fill all fields");

    btn.textContent = "Posting...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/forum/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, content, category_slug: category, user_id: state.user.id
            })
        });
        const ans = await res.json();
        if(!res.ok) throw new Error(ans.error || 'Error');

        closeNewTopicModal();
        loadTopics();
    } catch(e) {
        alert(e.message);
    } finally {
        btn.textContent = "Post Topic";
        btn.disabled = false;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds/60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds/3600) + "h ago";
    return Math.floor(seconds/86400) + "d ago";
}