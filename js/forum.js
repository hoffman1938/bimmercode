// js/forum.js

document.addEventListener('DOMContentLoaded', () => {
    initAuthForum();
    loadCategories();
    const currentLang = localStorage.getItem('forumLanguage') || 'en';
    loadTopics('all', '', currentLang);
    
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
    const authBtn = document.getElementById('auth-btn');

    if (user && sideCard) {
        sideCard.style.display = 'block';
        sideName.textContent = user.username;
        
        let carInfo = "No car selected";
        if (user.bmw && user.bmw.chassis) {
            carInfo = `${user.bmw.chassis} ${user.bmw.model}`;
        }
        
        const carDiv = document.createElement('div');
        carDiv.style.color = '#0066b3'; 
        carDiv.style.fontSize = '12px'; 
        carDiv.style.marginBottom = '10px';
        carDiv.innerHTML = `<i class="fas fa-car"></i> ${carInfo} <a href="profile.html" style="color:#666; margin-left:5px;"><i class="fas fa-cog"></i></a>`;
        sideName.after(carDiv);

        if (sideAvatar) {
            const imgUrl = user.avatar_url || './assets/icons/default-avatar.png';
            sideAvatar.innerHTML = `<img src="${imgUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        }

        // Обновляем кнопку авторизации
        if (authBtn) {
            authBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> <span>${user.username}</span>`;
            authBtn.onclick = logoutUser;
            authBtn.style.opacity = "1";
        }
    } else {
        // Юзер не авторизован
        if (authBtn) {
            authBtn.innerHTML = `<i class="fas fa-user"></i> <span>Login</span>`;
            authBtn.onclick = toggleAuthModal;
        }
    }
}

window.logoutUser = function() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        window.location.reload();
    }
};

// === КАТЕГОРИИ ===
async function loadCategories() {
    const lang = localStorage.getItem('forumLanguage') || 'en';
    const navMenu = document.querySelector('.nav-menu');
    
    try {
        const res = await fetch(`/api/forum/categories?lang=${lang}`);
        const categories = await res.json();
        
        if (!categories || categories.error) return;

        navMenu.innerHTML = `<div class="group-title">Menu</div>
             <a href="#" class="nav-item active" onclick="filterCat('all'); return false;"><i class="fas fa-stream"></i> All Topics</a>`;

        categories.forEach(cat => {
            const link = document.createElement('a');
            link.className = 'nav-item';
            link.href = '#';
            link.onclick = (e) => { e.preventDefault(); filterCat(cat.slug, link); };
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
    else document.querySelector('.nav-item').classList.add('active');
    
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

window.openNewTopicModal = function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        alert('Please login to create a topic');
        if(window.toggleAuthModal) window.toggleAuthModal();
        return;
    }
    const modal = document.getElementById('new-topic-modal');
    modal.classList.remove('hidden');
    loadCategoriesForSelect();
}

async function loadCategoriesForSelect() {
    const select = document.getElementById('nt-category');
    if (select.children.length > 0) return;
    
    const lang = localStorage.getItem('forumLanguage') || 'en';
    try {
        const res = await fetch(`/api/forum/categories?lang=${lang}`);
        const cats = await res.json();
        
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.slug;
            opt.textContent = c.title;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load categories for select", e);
    }
}

window.closeNewTopicModal = function() {
    const modal = document.getElementById('new-topic-modal');
    modal.classList.add('hidden');
    
    // Очищаем форму
    document.getElementById('nt-title').value = '';
    document.getElementById('nt-content').value = '';
}

window.submitNewTopic = async function() {
    const title = document.getElementById('nt-title').value.trim();
    const content = document.getElementById('nt-content').value.trim();
    const category = document.getElementById('nt-category').value;
    const user = JSON.parse(localStorage.getItem('user'));
    const lang = localStorage.getItem('forumLanguage') || 'en';

    // Валидация
    if (!title || !content) {
        alert('Please fill in all fields');
        return;
    }

    if (!category) {
        alert('Please select a category');
        return;
    }

    const btn = document.querySelector('.btn-new-topic-submit');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const res = await fetch('/api/forum/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                content: content,
                category_slug: category,
                user_id: user.id,
                lang: lang
            })
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.error || 'Failed to create topic');
        }

        if (result.success) {
            closeNewTopicModal();
            window.location.href = `topic.html?id=${result.topicId}`;
        } else {
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch(e) {
        console.error('Topic creation error:', e);
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Utils
function escapeHtml(text) { 
    if(!text) return ''; 
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds/60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds/3600) + "h ago";
    return Math.floor(seconds/86400) + "d ago";
}

window.toggleFavoritesModal = function() {
    const modal = document.getElementById('favorites-modal');
    if (!modal) return;
    
    const isHidden = modal.style.display === 'none' || modal.style.display === '';
    modal.style.display = isHidden ? 'flex' : 'none';
    
    if (isHidden) {
        loadFavorites();
    }
}

function loadFavorites() {
    const favorites = JSON.parse(localStorage.getItem('bmwFavorites')) || [];
    const list = document.getElementById('favorites-list');
    
    if (favorites.length === 0) {
        list.innerHTML = '<p style="color:#999;">No saved codes yet.</p>';
        return;
    }
    
    list.innerHTML = favorites.map(code => `
        <div style="padding:10px; border-bottom:1px solid #333;">
            <strong>${code}</strong>
            <button style="margin-left:10px; cursor:pointer;" onclick="removeFavorite('${code}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

window.removeFavorite = function(code) {
    let favorites = JSON.parse(localStorage.getItem('bmwFavorites')) || [];
    favorites = favorites.filter(c => c !== code);
    localStorage.setItem('bmwFavorites', JSON.stringify(favorites));
    loadFavorites();
}