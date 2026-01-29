// js/forum.js

document.addEventListener('DOMContentLoaded', () => {
    // Загружаем данные форума
    loadCategories();
    loadTopics();
    
    // Инициализация поиска по форуму
    const forumSearch = document.getElementById("forum-search");
    if(forumSearch) {
        let timeout;
        forumSearch.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                loadTopics('all', e.target.value.trim());
            }, 500);
        });
    }
});

// КАТЕГОРИИ
async function loadCategories() {
    try {
        const res = await fetch('/api/forum/categories');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        // Можно использовать data для рендера сайдбара динамически, если нужно
    } catch (e) {
        console.warn('Categories API error', e);
    }
}

window.filterCat = function(slug) {
    document.querySelectorAll('.cat-link').forEach(el => el.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    loadTopics(slug);
}

// ТЕМЫ
async function loadTopics(category = 'all', search = '') {
    const container = document.getElementById('topics-container');
    container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>`;

    try {
        const url = new URL('/api/forum/topics', window.location.origin);
        if (category !== 'all') url.searchParams.append('category', category);
        if (search) url.searchParams.append('search', search);

        const res = await fetch(url);
        let data = await res.json();

        if (!data || data.error || !Array.isArray(data)) {
            console.warn("API Error:", data);
            data = []; // Фолбек на пустой массив
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

// МОДАЛКА НОВОЙ ТЕМЫ
window.openNewTopicModal = function() {
    // Проверка авторизации через глобальный state
    if (!window.state || !window.state.user) {
        if(typeof window.toggleAuthModal === 'function') {
            window.toggleAuthModal();
        } else {
            alert("Please login first (Auth modal error)");
        }
        return;
    }

    const modal = document.getElementById('new-topic-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        // Загрузка категорий в селект (упрощенно)
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
        modal.style.display = 'none';
    }
}

window.submitNewTopic = async function() {
    const title = document.getElementById('nt-title').value.trim();
    const content = document.getElementById('nt-content').value.trim();
    const category = document.getElementById('nt-category').value;
    const btn = document.querySelector('.btn-new-topic-submit');

    if(!title || !content) {
        alert("Please fill all fields");
        return;
    }

    if(btn) { btn.textContent = "Posting..."; btn.disabled = true; }

    try {
        const res = await fetch('/api/forum/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, content, category_slug: category, user_id: window.state.user.id
            })
        });
        
        if(!res.ok) throw new Error('Failed');
        
        window.closeNewTopicModal();
        loadTopics(); // Перезагружаем список
        
        // Очистка формы
        document.getElementById('nt-title').value = '';
        document.getElementById('nt-content').value = '';

    } catch(e) {
        alert("Error creating topic");
    } finally {
        if(btn) { btn.textContent = "Post Topic"; btn.disabled = false; }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}