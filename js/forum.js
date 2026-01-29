// js/forum.js

document.addEventListener('DOMContentLoaded', () => {
    initAuthForum();
    loadCategories();
    // Читаем язык из localStorage (установленный переключателем) или дефолтный
    const currentLang = localStorage.getItem('forumLanguage') || 'en';
    loadTopics('all', '', currentLang);
    
    // Вешаем слушатель на переключатель языка (если он меняется в хедере)
    window.addEventListener('storage', (e) => {
        if (e.key === 'forumLanguage') {
            window.location.reload();
        }
    });
});

// === AUTH UI ===
function initAuthForum() {
    const user = JSON.parse(localStorage.getItem('user'));
    const sideCard = document.getElementById('user-mini-card');
    const sideName = document.getElementById('side-username');
    const sideAvatar = document.getElementById('user-avatar-display');
    const sideStats = document.querySelector('.user-stats-grid'); // Нужно добавить класс в HTML

    if (user && sideCard) {
        sideCard.style.display = 'block';
        sideName.textContent = user.username;
        
        // Показываем машину юзера в сайдбаре
        let carInfo = "No car selected";
        if (user.bmw && user.bmw.chassis) {
            carInfo = `${user.bmw.chassis} ${user.bmw.model}`;
        }
        
        // Вставляем инфо под именем
        const carDiv = document.createElement('div');
        carDiv.style.color = '#0066b3'; carDiv.style.fontSize = '12px'; carDiv.style.marginBottom = '10px';
        carDiv.innerHTML = `<i class="fas fa-car"></i> ${carInfo} <a href="profile.html" style="color:#666; margin-left:5px;"><i class="fas fa-cog"></i></a>`;
        sideName.after(carDiv);

        if (sideAvatar) {
            const imgUrl = user.avatar_url || './assets/icons/default-avatar.png';
            sideAvatar.innerHTML = `<img src="${imgUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        }
    }
}

// === КАТЕГОРИИ ===
async function loadCategories() {
    const lang = localStorage.getItem('forumLanguage') || 'en';
    const navMenu = document.querySelector('.nav-menu');
    
    try {
        const res = await fetch(`/api/forum/categories?lang=${lang}`);
        const categories = await res.json();
        
        if (!categories || categories.error) return;

        // Очищаем старые ссылки (кроме заголовков, если хотим сохранить структуру)
        // Для простоты перерисуем меню полностью
        navMenu.innerHTML = `<div class="group-title">Menu</div>
             <a href="#" class="nav-item active" onclick="filterCat('all')"><i class="fas fa-stream"></i> All Topics</a>`;

        categories.forEach(cat => {
            const link = document.createElement('a');
            link.className = 'nav-item';
            link.href = '#';
            link.onclick = (e) => { e.preventDefault(); filterCat(cat.slug, e.currentTarget); };
            link.innerHTML = `<i class="fas ${cat.icon_class || 'fa-folder'}"></i> ${cat.title}`;
            navMenu.appendChild(link);
        });

    } catch (e) {
        console.error("Failed to load categories", e);
    }
}

window.filterCat = function(slug, element) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');
    else document.querySelector('.nav-item').classList.add('active'); // Fallback for 'all'
    
    const lang = localStorage.getItem('forumLanguage') || 'en';
    loadTopics(slug, '', lang);
}

// === ТЕМЫ ===
async function loadTopics(category = 'all', search = '', lang = 'en') {
    const container = document.getElementById('topics-container');
    container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;"><i class="fas fa-circle-notch fa-spin"></i> Loading discussions...</div>`;

    try {
        const url = new URL('/api/forum/topics', window.location.origin);
        if (category !== 'all') url.searchParams.append('category', category);
        if (search) url.searchParams.append('search', search);
        url.searchParams.append('lang', lang);

        const res = await fetch(url);
        let data = await res.json();

        if (!Array.isArray(data)) data = [];
        renderTopics(data);

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="text-align:center; color:#e74c3c;">Failed to load topics.</div>`;
    }
}

function renderTopics(topics) {
    const container = document.getElementById('topics-container');
    
    if (topics.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;">
            <i class="far fa-comments" style="font-size:30px; margin-bottom:10px;"></i><br>
            No topics yet in this language/category. Be the first!
        </div>`;
        return;
    }

    container.innerHTML = topics.map(topic => {
        // Форматируем инфо о машине автора
        let authorCar = '';
        // API возвращает данные юзера, присоединенные к топику. 
        // В SQL запросе мы не вытаскивали bmw поля, давайте добавим их в topics.js API или проверим что есть
        // Предположим пока, что есть role и reputation
        
        return `
        <div class="topic-card" onclick="window.location.href='topic.html?id=${topic.id}'">
            <div class="topic-main">
                <div class="topic-icon">
                    <img src="${topic.avatar_url || './assets/icons/default-avatar.png'}" 
                         style="width:40px; height:40px; border-radius:50%; border:2px solid #333;">
                </div>
                <div class="topic-info">
                    <h3>${escapeHtml(topic.title)}</h3>
                    <p>
                        <span class="cat-tag tag-${topic.category_slug}">${topic.category_slug}</span> 
                        • <span style="color:#ccc">${topic.username}</span> 
                        ${topic.role === 'admin' ? '<i class="fas fa-check-circle" style="color:#3498db" title="Admin"></i>' : ''}
                        • ${timeAgo(topic.last_activity_at)}
                    </p>
                </div>
            </div>
            <div class="topic-stats">
                <div class="stat-mini"><i class="far fa-comment-alt"></i> <span>${topic.reply_count || 0}</span></div>
                <div class="stat-mini"><i class="far fa-eye"></i> <span>${topic.views || 0}</span></div>
            </div>
        </div>
    `}).join('');
}

// Остальные функции модалок (openNewTopicModal, submitNewTopic) остаются как были,
// но при submitNewTopic добавьте lang: localStorage.getItem('forumLanguage') в тело запроса.

window.openNewTopicModal = function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        if(window.toggleAuthModal) window.toggleAuthModal();
        return;
    }
    const modal = document.getElementById('new-topic-modal');
    modal.classList.remove('hidden');
    
    // Загрузка категорий в селект
    loadCategoriesForSelect();
}

async function loadCategoriesForSelect() {
    const select = document.getElementById('nt-category');
    if (select.children.length > 0) return; // Уже загружено
    
    const lang = localStorage.getItem('forumLanguage') || 'en';
    const res = await fetch(`/api/forum/categories?lang=${lang}`);
    const cats = await res.json();
    
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.slug;
        opt.textContent = c.title;
        select.appendChild(opt);
    });
}

window.submitNewTopic = async function() {
    // ... (код получения значений) ...
    const title = document.getElementById('nt-title').value;
    const content = document.getElementById('nt-content').value;
    const category = document.getElementById('nt-category').value;
    const user = JSON.parse(localStorage.getItem('user'));
    const lang = localStorage.getItem('forumLanguage') || 'en';

    // ... (валидация) ...

    try {
        const res = await fetch('/api/forum/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, content, category_slug: category, 
                user_id: user.id, 
                lang: lang // ВАЖНО: Отправляем язык
            })
        });
        // ... (обработка успеха) ...
        window.location.reload();
    } catch(e) { console.error(e); }
}

// Utils
function escapeHtml(text) { if(!text) return ''; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function timeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds/60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds/3600) + "h ago";
    return Math.floor(seconds/86400) + "d ago";
}