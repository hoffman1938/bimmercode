// js/forum.js

document.addEventListener('DOMContentLoaded', () => {
    // Язык уже инициализирован в script.js, но здесь мы подгружаем контент
    loadCategories();
    loadTopics();
});

// === КАТЕГОРИИ ===
async function loadCategories() {
    try {
        const res = await fetch('/api/forum/categories');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        
        // Тут можно добавить рендер категорий, если нужно динамически
    } catch (e) {
        console.warn('Categories error:', e);
    }
}

window.filterCat = function(slug) {
    const state = window.forumState || { currentCategory: 'all' }; // Безопасный доступ
    state.currentCategory = slug;
    
    document.querySelectorAll('.cat-link').forEach(el => el.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    
    loadTopics(slug);
}

// === ТЕМЫ (ИСПРАВЛЕНИЕ ОШИБКИ) ===
async function loadTopics(category = 'all', search = '') {
    const container = document.getElementById('topics-container');
    container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

    try {
        const url = new URL('/api/forum/topics', window.location.origin);
        if (category !== 'all') url.searchParams.append('category', category);
        if (search) url.searchParams.append('search', search);

        const res = await fetch(url);
        let data = await res.json();

        // === ГЛАВНОЕ ИСПРАВЛЕНИЕ ===
        // Если API вернул ошибку или null, превращаем в пустой массив
        if (!data || data.error || !Array.isArray(data)) {
            console.warn("API returned invalid data:", data);
            data = []; 
        }

        renderTopics(data);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="padding:20px; text-align:center; color:#e74c3c;">Connection Error</div>`;
    }
}

function renderTopics(topics) {
    const container = document.getElementById('topics-container');
    
    if (topics.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;">No topics found.</div>`;
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
            <div class="t-stat">${topic.reply_count || 0} <small>replies</small></div>
            <div class="t-stat">${topic.views || 0} <small>views</small></div>
            <div class="t-last">
                <div class="t-last-date">Recently</div>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}