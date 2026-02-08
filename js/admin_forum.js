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
