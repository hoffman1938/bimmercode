// js/admin_forum.js - Forum Management (Categories & Tags)

// --- CATEGORIES ---

async function loadCategories() {
    const list = document.getElementById('categories-list');
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            renderCategories(data.categories);
        }
    } catch (e) {
        list.innerHTML = '<p class="error">Failed to load categories</p>';
    }
}

function renderCategories(categories) {
    const list = document.getElementById('categories-list');
    if (!list) return;

    list.innerHTML = categories.map(cat => `
        <div class="category-item-admin">
            <div style="display:flex; align-items:center; gap:20px;">
                <div class="category-icon">
                    <i class="${cat.icon}"></i>
                </div>
                <div>
                    <h4 style="margin:0; font-size:1.1rem; color:#f8fafc;">${cat.title} 
                        <span style="font-size:0.8rem; color:#64748b; font-weight:normal; margin-left:8px;">(Order: ${cat.sort_order})</span>
                    </h4>
                    <div style="font-size:0.9rem; color:#94a3b8; margin-top:4px;">${cat.description || 'No description'}</div>
                </div>
            </div>
            <div>
                <button class="action-btn" onclick="editCategory('${cat.id}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-danger" onclick="deleteCategory('${cat.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

// Modal Logic
function openCategoryModal(cat = null) {
    const modal = document.getElementById('category-modal');
    modal.classList.add('active');
    
    if (cat) {
        document.getElementById('cat-modal-title').textContent = "Edit Category";
        document.getElementById('cat-id').value = cat.id;
        document.getElementById('cat-title').value = cat.title;
        document.getElementById('cat-desc').value = cat.description;
        document.getElementById('cat-icon').value = cat.icon;
        document.getElementById('cat-order').value = cat.sort_order;
    } else {
        document.getElementById('cat-modal-title').textContent = "New Category";
        document.getElementById('category-form').reset();
        document.getElementById('cat-id').value = "";
    }
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.remove('active');
}

// Save Category
document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('cat-id').value;
    const title = document.getElementById('cat-title').value;
    const description = document.getElementById('cat-desc').value;
    const icon = document.getElementById('cat-icon').value;
    const order = document.getElementById('cat-order').value;

    const method = id ? 'PUT' : 'POST';
    const body = { title, description, icon, sort_order: parseInt(order) };
    if (id) body.id = id;

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/categories`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (data.success) {
            closeCategoryModal();
            loadCategories();
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        console.error(e);
    }
});

async function deleteCategory(id) {
    if (!confirm("Delete this category? ALL TOPICS WITHIN IT MAY BE LOST (or check safety).")) return;

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/categories`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
            loadCategories();
        } else {
            alert(data.error);
        }
    } catch (e) {
        console.error(e);
    }
}

// --- TAGS ---

async function loadTags() {
    const container = document.getElementById('tags-list');
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/tags`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
             container.innerHTML = data.tags.map(tag => `
                <div class="tag-badge" style="background:${tag.color}; padding:5px 10px; border-radius:15px; font-size:12px; display:flex; align-items:center; gap:8px;">
                    ${tag.name}
                    <i class="fas fa-times" style="cursor:pointer; opacity:0.7;" onclick="deleteTag('${tag.id}')"></i>
                </div>
             `).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

async function createTag() {
    const name = document.getElementById('new-tag-name').value;
    const color = document.getElementById('new-tag-color').value;
    
    if (!name) return;

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/tags`, {
            method: 'POST',
             headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, color })
        });
        
        const data = await res.json();
        if (data.success) {
            document.getElementById('new-tag-name').value = "";
            loadTags();
        }
    } catch (e) {
        console.error(e);
    }
}

async function deleteTag(id) {
    try {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_URL}/admin/tags`, {
            method: 'DELETE',
             headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
        });
        loadTags();
    } catch (e) {
        console.error(e);
    }
}

// Make functions global for HTML onclick attributes
window.editCategory = openCategoryModal;
window.deleteCategory = deleteCategory;
window.createTag = createTag;
window.deleteTag = deleteTag;

// --- ALL FORUM POSTS (admin list + search) ---

const FORUM_POSTS_PAGE_SIZE = 40;
/** @type {number} */ window.forumPostsPage = 1;

function escapeAdminHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
    );
}

function adminTopicPostUrl(post) {
    const tid = post.topic_id;
    const isOp = String(post.id) === String(tid);
    const base = `/topic?id=${encodeURIComponent(tid)}`;
    return isOp ? `${base}#op` : `${base}#post-${encodeURIComponent(post.id)}`;
}

async function loadForumPosts(page) {
    const tbody = document.getElementById("forum-posts-tbody");
    const loading = document.getElementById("forum-posts-loading");
    const summary = document.getElementById("forum-posts-summary");
    const pag = document.getElementById("forum-posts-pagination");
    if (!tbody) return;

    const p = Math.max(1, parseInt(page, 10) || 1);
    window.forumPostsPage = p;
    const q = (document.getElementById("forum-posts-search")?.value || "").trim();
    const onlyDel = document.getElementById("forum-posts-deleted-only")?.checked;

    const offset = (p - 1) * FORUM_POSTS_PAGE_SIZE;
    const params = new URLSearchParams({
        limit: String(FORUM_POSTS_PAGE_SIZE),
        offset: String(offset),
    });
    if (q) params.set("q", q);
    if (onlyDel) params.set("only_deleted", "1");

    if (loading) loading.style.display = "block";
    tbody.innerHTML = "";
    if (summary) summary.textContent = "";
    if (pag) pag.innerHTML = "";

    try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_URL}/admin/forum-posts?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:#e74c3c;padding:16px;">${escapeAdminHtml(data.error || "Request failed")}</td></tr>`;
            return;
        }

        const total = data.total || 0;
        const list = data.posts || [];
        if (summary) {
            const from = total === 0 ? 0 : offset + 1;
            const to = offset + list.length;
            summary.textContent =
                `Showing ${from}–${to} of ${total}` +
                (q ? ` · search: “${q}”` : "");
        }

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;opacity:0.75;">No posts found.</td></tr>';
        } else {
            tbody.innerHTML = list
                .map((row) => {
                    const del = row.is_deleted ? ' <span class="forum-posts-badge forum-posts-badge--del">deleted</span>' : "";
                    const sol = row.is_solution ? ' <span class="forum-posts-badge">solution</span>' : "";
                    const href = adminTopicPostUrl(row);
                    return `
                <tr>
                    <td class="forum-posts-cell--date">${escapeAdminHtml(new Date(row.created_at).toLocaleString())}</td>
                    <td class="forum-posts-cell--topic">
                        <div class="forum-posts-topic-title">${escapeAdminHtml(row.topic_title || "—")}</div>
                        <div class="forum-posts-meta">${escapeAdminHtml(row.category || "")} · id ${escapeAdminHtml(String(row.topic_id))}</div>
                    </td>
                    <td>${escapeAdminHtml(row.username || "")}</td>
                    <td class="forum-posts-excerpt">${escapeAdminHtml((row.content_preview || row.content || "").slice(0, 500))}${del}${sol}</td>
                    <td><a class="action-btn" href="${href}" target="_blank" rel="noopener noreferrer" title="Open in forum"><i class="fas fa-external-link-alt"></i></a></td>
                </tr>`;
                })
                .join("");
        }

        const totalPages = Math.max(1, Math.ceil(total / FORUM_POSTS_PAGE_SIZE));
        if (pag && total > 0) {
            const prev = p > 1
                ? `<button type="button" class="btn" onclick="loadForumPosts(${p - 1})">Prev</button>`
                : `<button type="button" class="btn" disabled>Prev</button>`;
            const next = p < totalPages
                ? `<button type="button" class="btn" onclick="loadForumPosts(${p + 1})">Next</button>`
                : `<button type="button" class="btn" disabled>Next</button>`;
            pag.innerHTML = `<div class="forum-posts-pag-inner">${prev}<span>Page ${p} / ${totalPages}</span>${next}</div>`;
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" style="color:#e74c3c;padding:16px;">${escapeAdminHtml(e.message || "Error")}</td></tr>`;
    } finally {
        if (loading) loading.style.display = "none";
    }
}

window.loadForumPosts = loadForumPosts;

document.addEventListener("DOMContentLoaded", () => {
    const inp = document.getElementById("forum-posts-search");
    if (inp && typeof debounce === "function") {
        inp.addEventListener("input", debounce(() => loadForumPosts(1), 500));
    }
    const del = document.getElementById("forum-posts-deleted-only");
    if (del) del.addEventListener("change", () => loadForumPosts(1));
});
