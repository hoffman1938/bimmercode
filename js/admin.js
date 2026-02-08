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
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Basic check, real check is API call
        // Also check if admin role
        // For now, let's just proceed and let APIs fail if 401
    } catch (e) {
        localStorage.removeItem('auth_token');
        window.location.href = 'index.html';
    }

    // Load initial tab
    switchTab('dashboard');
}

function logoutAdmin() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = 'index.html';
}

function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));

    // Show target
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    // Update active link (find link with onclick matching)
    // Simplified: just select by iteration or ID if we had them. 
    // For now let's just assume the user clicked and handled the class logic there? 
    // Actually we need to update sidebar visual:
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        if(link.getAttribute('onclick') === `switchTab('${tabId}')`) {
            link.classList.add('active');
        }
    });

    // Load data based on tab
    if (tabId === 'dashboard') loadDashboardStats();
    if (tabId === 'users') {
        if(typeof loadUsers === 'function') loadUsers();
    }
    if (tabId === 'forum') {
         if(typeof loadCategories === 'function') loadCategories();
         if(typeof loadTags === 'function') loadTags();
    }
    if (tabId === 'logs') {
        if(typeof loadLogs === 'function') loadLogs();
    }
    if (tabId === 'messages') {
        if(typeof loadMessages === 'function') loadMessages();
    }
    if (tabId === 'settings') {
        if(typeof loadSettings === 'function') loadSettings();
    }
}

async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            alert("Session expired");
            logoutAdmin();
            return;
        }

        const data = await res.json();
        if (data.success) {
            const s = data.stats;
            const container = document.getElementById('stats-container');
            container.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${s.users.total}</div>
                    <div>Total Users</div>
                    <div style="font-size:0.8em; opacity:0.7;">${s.users.active} active</div>
                </div>
                <div class="stat-card" style="border-left-color: #e74c3c;">
                    <div class="stat-value">${s.users.banned}</div>
                    <div>Banned Users</div>
                </div>
                <div class="stat-card" style="border-left-color: #f1c40f;">
                    <div class="stat-value">${s.moderation.pending_reports}</div>
                    <div>Pending Reports</div>
                </div>
                <div class="stat-card" style="border-left-color: #2ecc71;">
                    <div class="stat-value">${s.content.posts}</div>
                    <div>Total Posts</div>
                    <div style="font-size:0.8em; opacity:0.7;">in ${s.content.topics} topics</div>
                </div>
            `;
        }
    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

// Load Users is now handled in js/admin_users.js


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
