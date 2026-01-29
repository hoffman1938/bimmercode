// js/topic-view.js

const state = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    topicId: new URLSearchParams(window.location.search).get('id'),
    topicData: null
};

document.addEventListener('DOMContentLoaded', () => {
    if (!state.topicId) {
        alert("Topic not found");
        window.location.href = 'forum.html';
        return;
    }
    
    initAuth();
    loadTopicData();
});

// === 1. ЗАГРУЗКА ДАННЫХ ===

async function loadTopicData() {
    try {
        // Мы используем тот же API топика, но теперь он должен уметь отдавать детали
        // ВАЖНО: Нам нужно будет обновить functions/api/forum/topic.js (единственное число)
        // Но пока используем старый путь (или создадим новый endpoint)
        
        // Давайте создадим правильный запрос
        const res = await fetch(`/api/forum/topic?id=${state.topicId}&user_id=${state.user?.id || 0}`);
        
        if (!res.ok) throw new Error('Topic not found');
        
        const data = await res.json();
        state.topicData = data;
        
        renderHeader(data.topic);
        renderPosts(data.posts, data.topic); // Передаем топик, чтобы первый пост был телом темы
        
    } catch (e) {
        console.error(e);
        document.getElementById('posts-container').innerHTML = 
            `<div style="text-align:center; padding:50px; color:#e74c3c;">Error loading topic.</div>`;
    }
}

// === 2. РЕНДЕР ===

function renderHeader(topic) {
    document.title = `${topic.title} - BMW Forum`;
    document.getElementById('topic-title').innerText = topic.title;
    
    const tagsContainer = document.getElementById('topic-tags-placeholder');
    tagsContainer.innerHTML = `<span class="tag">${topic.category_slug}</span>`;
    if (topic.is_solved) tagsContainer.innerHTML += `<span class="tag" style="color:#2ecc71; background:rgba(46,204,113,0.2)">Solved</span>`;

    // Сайдбар инфо
    document.getElementById('info-date').innerText = new Date(topic.created_at).toLocaleDateString();
    document.getElementById('info-views').innerText = topic.views;
    document.getElementById('info-replies').innerText = topic.reply_count;
}

function renderPosts(posts, topic) {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    // Сначала рендерим САМУ ТЕМУ как первый пост
    // (В нашей структуре БД контент темы лежит в таблице topics, а ответы в posts)
    // Но для единообразия мы можем визуально представить это как пост #1
    
    // 1. Главный пост (OP - Original Poster)
    const opHTML = createPostHTML({
        id: 'topic-' + topic.id,
        user_id: topic.user_id,
        username: topic.username || 'Unknown', // Нужно подтянуть в API
        avatar_url: topic.avatar_url,
        role: 'Topic Starter',
        content: topic.content,
        created_at: topic.created_at,
        likes_count: topic.likes_count || 0
    }, true);
    
    container.innerHTML += opHTML;

    // 2. Ответы
    if (posts && posts.length > 0) {
        posts.forEach(post => {
            container.innerHTML += createPostHTML(post, false);
        });
    }
}

function createPostHTML(post, isOp) {
    // Парсим Markdown (если подключен marked.js)
    const contentHTML = typeof marked !== 'undefined' ? marked.parse(post.content) : post.content;
    const dateStr = new Date(post.created_at).toLocaleString();
    const avatar = post.avatar_url || './assets/icons/default-avatar.png';
    const role = post.role || (isOp ? 'Author' : 'Member');

    return `
    <div class="post-card" id="post-${post.id}">
        <div class="post-header">
            <span>${dateStr}</span>
            <span>#${post.id}</span>
        </div>
        <div class="post-body">
            <div class="post-author">
                <img src="${avatar}" class="author-avatar">
                <span class="author-name">${post.username}</span>
                <span class="author-role">${role}</span>
            </div>
            <div class="post-content">
                ${contentHTML}
            </div>
        </div>
        <div class="post-footer">
            <button class="btn-action" onclick="alert('Quote coming soon')">
                <i class="fas fa-quote-right"></i> Quote
            </button>
            <button class="btn-action like-btn" onclick="likePost('${post.id}')">
                <i class="far fa-thumbs-up"></i> ${post.likes_count || 0}
            </button>
        </div>
    </div>
    `;
}

// === 3. ДЕЙСТВИЯ ===

async function submitReply() {
    if (!state.user) {
        alert("Please login to reply");
        return;
    }

    const textarea = document.getElementById('reply-content');
    const content = textarea.value.trim();
    const btn = document.querySelector('.btn-submit');

    if (!content) return;

    btn.disabled = true;
    btn.innerText = "Posting...";

    try {
        // Отправляем на endpoint СОЗДАНИЯ ПОСТА (нужно создать api/forum/post.js)
        // Или можно использовать тот же api/forum/topic.js с методом PUT/POST для ответов
        
        // Давайте используем POST на /api/forum/topic (как договаривались ранее или создадим post.js)
        // Лучше создать отдельный functions/api/forum/reply.js для чистоты
        const res = await fetch('/api/forum/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic_id: state.topicId,
                user_id: state.user.id,
                content: content
            })
        });

        if (!res.ok) throw new Error("Failed to post");

        // Успех
        textarea.value = '';
        loadTopicData(); // Перезагружаем посты

    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Post Reply";
    }
}

// Auth UI (Дублирует forum.js, можно вынести в utils)
function initAuth() {
    const c = document.getElementById('auth-container');
    if (state.user) {
        c.innerHTML = `<span style="color:white; font-size:13px;">${state.user.username}</span>`;
    } else {
        document.getElementById('reply-box').style.display = 'none'; // Скрываем форму ответа гостям
        c.innerHTML = `<button onclick="window.location.href='forum.html'" style="padding:5px 10px;">Login</button>`;
    }
}