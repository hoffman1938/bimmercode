// js/admin.js - Admin Panel Logic
console.log("Admin JS Loaded - Version 2 (Auth Token Fix)"); // DEBUG

const API_URL = "/api";
let currentUser = null;

// On Load
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    loadUsers();
    
    // Search Listener
    document.getElementById('user-search').addEventListener('input', debounce(loadUsers, 500));
});

// Auth Check
async function checkAdminAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // Verify token and role via profile endpoint or verify endpoint
        // For now, we assume if we can fetch admin data, we are good.
        // Or we decode token if client-side check is enough for redirect (server validates API calls)
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Simple client-side check (real security is in API)
        // We can define a set of admin roles
        const adminRoles = ['admin_role', 'mod_role']; // Adjust based on DB
        // But payload might just have role name or we need to fetch it.
        // Let's rely on the first API call failing with 403 to redirect.
    } catch (e) {
        window.location.href = 'index.html';
    }
}

function logoutAdmin() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = 'index.html';
}

// Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('.dashboard-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (tabId === 'users') loadUsers();
    if (tabId === 'reports') loadReports(); // Future
}

// Load Users
async function loadUsers() {
    const search = document.getElementById('user-search').value;
    const tbody = document.getElementById('users-table-body');
    const loading = document.getElementById('users-loading');
    
    tbody.innerHTML = '';
    loading.style.display = 'block';

    try {
        const token = localStorage.getItem('auth_token');
        console.log("Admin Panel: Using token:", token); // DEBUG
        
        const res = await fetch(`${API_URL}/admin/users?limit=20&search=${encodeURIComponent(search)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            alert("Unauthorized access");
            window.location.href = 'index.html';
            return;
        }

        const data = await res.json();
        
        loading.style.display = 'none';
        
        if (data.users && data.users.length > 0) {
            data.users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="display: flex; align-items: center;">
                            <img src="${user.avatar_url || 'assets/default-avatar.png'}" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                            ${user.username}
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>${user.role_id || 'User'}</td>
                    <td><span class="status-badge" style="background: ${user.level_color}33; color: ${user.level_color}">${user.level_name || 'Novice'}</span></td>
                    <td>
                        <span class="status-badge ${user.is_active ? 'status-active' : 'status-banned'}">
                            ${user.is_active ? 'Active' : 'Banned'}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn" onclick="openActionModal('${user.id}', 'edit')"><i class="fas fa-edit"></i></button>
                        ${user.is_active ? 
                            `<button class="action-btn btn-danger" onclick="openActionModal('${user.id}', 'ban')"><i class="fas fa-ban"></i></button>` :
                            `<button class="action-btn" onclick="openActionModal('${user.id}', 'unban')"><i class="fas fa-undo"></i></button>`
                        }
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users found</td></tr>';
        }

    } catch (e) {
        console.error(e);
        loading.innerHTML = 'Error loading users';
    }
}

// Modal Actions
const modal = document.getElementById('action-modal');
const form = document.getElementById('action-form');

function openActionModal(userId, type) {
    document.getElementById('target-user-id').value = userId;
    document.getElementById('action-type').value = type;
    
    document.getElementById('ban-options').classList.add('hidden');
    
    if (type === 'ban') {
        document.getElementById('action-title').innerText = 'Ban User';
        document.getElementById('ban-options').classList.remove('hidden');
    } else if (type === 'unban') {
        document.getElementById('action-title').innerText = 'Unban User';
    } else {
        document.getElementById('action-title').innerText = 'Edit User';
    }
    
    modal.classList.add('active');
}

function closeActionModal() {
    modal.classList.remove('active');
    form.reset();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('target-user-id').value;
    const type = document.getElementById('action-type').value;
    const reason = document.getElementById('action-reason').value;
    const token = localStorage.getItem('auth_token');

    try {
        let endpoint = '';
        let body = {};

        if (type === 'ban') {
            endpoint = '/admin/ban';
            body = { user_id: userId, reason: reason };
        } else if (type === 'unban') {
            endpoint = '/admin/unban';
            body = { user_id: userId, reason: reason };
        }

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const json = await res.json();
        
        if (res.ok) {
            alert("Action successful");
            closeActionModal();
            loadUsers();
        } else {
            alert("Error: " + json.error);
        }

    } catch (e) {
        console.error(e);
        alert("Request failed");
    }
});

// Utils
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
