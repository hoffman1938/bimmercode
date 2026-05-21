// js/admin.js - Admin Panel Logic
console.log("Admin JS Loaded - Version 2 (Auth Token Fix)"); // DEBUG

const API_URL = "/api";
let currentUser = null;

function unlockAdminPanel() {
    document.documentElement.classList.remove('admin-gate-pending');
}

function safeAdminRedirect(url) {
    const target = new URL(url, window.location.origin).href;
    document.documentElement.classList.add("admin-gate-pending");
    try {
        if (window.self !== window.top) {
            window.top.location.replace(target);
        } else {
            window.location.replace(target);
        }
    } catch (_) {
        window.location.href = target;
    }
}

function lockAndLeaveAdmin(url) {
    safeAdminRedirect(url);
}

// On Load
document.addEventListener('DOMContentLoaded', async () => {
    // Sidebar: prevent <base href> + href="#" from navigating to https://bimmercodes.net/#
    const sidebar = document.querySelector('.sidebar-menu');
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            const link = e.target.closest('[data-admin-tab]');
            if (!link) return;
            e.preventDefault();
            switchTab(link.dataset.adminTab);
            if (window.innerWidth <= 768) {
                document.querySelector('.sidebar')?.classList.remove('active');
            }
        });
    }

    const ok = await checkAdminAuth();
    if (!ok) return;

    if (typeof loadUsers === 'function') loadUsers();

    const search = document.getElementById('user-search');
    if (search) search.addEventListener('input', debounce(loadUsers, 500));

    // Deep link: /admin#users
    const hashTab = (location.hash || '').replace(/^#/, '');
    if (hashTab && document.getElementById(`tab-${hashTab}`)) {
        switchTab(hashTab);
    }
});

// Auth: valid JWT is not enough — server checks admin_role / super_admin_role.
// Local dev: `pages dev` uses a separate local D1; run `npm run db:migrate:local` and
// set ADMIN_PANEL_EMAILS or admin role in DB. Use admin.html or /admin (see _redirects).
/** Refresh role from API so promoted super-admins are not blocked by stale user_data. */
async function refreshAdminUserCache(token) {
    try {
        const raw = localStorage.getItem("user_data");
        const me = raw ? JSON.parse(raw) : null;
        if (!me?.id) return;
        const res = await fetch(`${API_URL}/user/get?id=${encodeURIComponent(me.id)}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const fresh = await res.json();
        const merged = {
            ...me,
            ...fresh,
            role_id: fresh.role_id || fresh.role || me.role_id,
        };
        localStorage.setItem("user_data", JSON.stringify(merged));
    } catch (e) {
        console.warn("[admin] user refresh skipped", e);
    }
}

/** @returns {Promise<boolean>} */
async function checkAdminAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        lockAndLeaveAdmin('/index.html?need_login=1&return=' + encodeURIComponent('/admin.html'));
        return false;
    }

    try {
        JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        lockAndLeaveAdmin('/index.html?bad_token=1');
        return false;
    }

    await refreshAdminUserCache(token);

    let res;
    try {
        res = await fetch(`${API_URL}/admin/access`, {
            headers: { Authorization: `Bearer ${token}` }
        });
    } catch (e) {
        console.error('[admin] /api/admin/stats network error', e);
        lockAndLeaveAdmin('/index.html?admin=denied');
        return false;
    }

    if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        lockAndLeaveAdmin('/index.html?session=1');
        return false;
    }
    if (res.status === 403) {
        console.warn('[admin] 403: not admin in this DB, or wrong JWT_SECRET');
        lockAndLeaveAdmin('/index.html?admin=denied');
        return false;
    }
    if (!res.ok) {
        console.error('[admin] /api/admin/stats HTTP', res.status);
        lockAndLeaveAdmin('/index.html?admin=denied');
        return false;
    }

    unlockAdminPanel();
    switchTab('dashboard');
    return true;
}

function logoutAdmin() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = 'index.html';
}

// Sidebar Toggle
function toggleAdminSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

// Close sidebar when clicking outside on mobile (optional enhancement)
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    
    if (window.innerWidth <= 768 && 
        sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        !toggle.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

function switchTab(tabId, context = {}) {
    const panel = document.getElementById(`tab-${tabId}`);
    if (!panel) {
        console.warn('[admin] unknown tab:', tabId);
        return;
    }

    document.querySelectorAll('.dashboard-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));

    panel.classList.remove('hidden');

    document.querySelectorAll('.sidebar-menu a[data-admin-tab]').forEach(link => {
        if (link.dataset.adminTab === tabId) link.classList.add('active');
    });

    if (history.replaceState) {
        history.replaceState(null, '', `${location.pathname}${location.search}#${tabId}`);
    }

    // Load data based on tab
    if (tabId === 'dashboard') loadDashboardStats();
    if (tabId === 'users') {
        if(typeof loadUsers === 'function') {
            // Context handling for deep linking
            if (context.role !== undefined) {
                 const filter = document.getElementById('role-filter');
                 if(filter) filter.value = context.role;
            }
            loadUsers();
        }
    }
    if (tabId === 'forum') {
         if(typeof loadCategories === 'function') loadCategories();
         if(typeof loadTags === 'function') loadTags();
    }
    if (tabId === 'posts') {
        if (typeof loadForumPosts === 'function') loadForumPosts(1);
    }
    if (tabId === 'logs') {
        if(typeof loadLogs === 'function') loadLogs();
    }
    if (tabId === 'reports') {
        if(typeof loadReports === 'function') loadReports();
    }
    if (tabId === 'messages') {
        if(typeof loadMessages === 'function') loadMessages();
    }
    if (tabId === 'settings') {
        if(typeof loadSettings === 'function') loadSettings();
    }
    if (tabId === 'codes' && typeof loadAdminCodes === 'function') loadAdminCodes();
    if (tabId === 'garage' && typeof loadAdminGarage === 'function') loadAdminGarage();
    if (tabId === 'marketplace' && typeof loadAdminMarketplace === 'function') loadAdminMarketplace();
    if (tabId === 'seo' && typeof loadAdminSeo === 'function') loadAdminSeo();
    if (tabId === 'ads' && typeof loadAdminAds === 'function') loadAdminAds();
    if (tabId === 'notifications' && typeof loadAdminNotifications === 'function') loadAdminNotifications();
}

async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('auth_token');
        
        // 1. General Stats
        const resStats = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataStats = await resStats.json();
        
        if (dataStats.success) {
            const s = dataStats.stats;
            const container = document.getElementById('stats-container');
            const growthGrid = document.getElementById('dashboard-growth-grid');
            if (growthGrid) {
                growthGrid.innerHTML = `
                    <div class="stat-card"><div class="stat-value">${s.growth?.new_users_24h ?? 0}</div><div>New users (24h)</div></div>
                    <div class="stat-card"><div class="stat-value">${s.content?.new_topics_24h ?? 0}</div><div>New topics (24h)</div></div>
                    <div class="stat-card"><div class="stat-value">${s.content?.new_posts_24h ?? 0}</div><div>New posts (24h)</div></div>
                `;
            }
            container.innerHTML = `
                <div class="stat-card" onclick="switchTab('users', { role: '' })">
                    <div class="stat-value">${s.users.total}</div>
                    <div>Total Users</div>
                    <div style="font-size:0.8em; opacity:0.7;">${s.users.active} active</div>
                </div>
                <div class="stat-card" style="border-left-color: #e74c3c;" onclick="switchTab('users', { role: 'banned' })">
                    <div class="stat-value">${s.users.banned}</div>
                    <div>Banned Users</div>
                </div>
                <div class="stat-card" style="border-left-color: #f1c40f;" onclick="switchTab('reports')">
                    <div class="stat-value">${s.moderation.pending_reports}</div>
                    <div>Pending Reports</div>
                </div>
                <div class="stat-card" style="border-left-color: #2ecc71;" onclick="switchTab('forum')">
                    <div class="stat-value">${s.content.posts}</div>
                    <div>Total Posts</div>
                    <div style="font-size:0.8em; opacity:0.7;">in ${s.content.topics} topics</div>
                </div>
            `;
        }

        // 2. Real-time Analytics
        const resAnalytics = await fetch(`${API_URL}/admin/analytics`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataAnalytics = await resAnalytics.json();
        
        if(dataAnalytics.success) {
            const a = dataAnalytics.data;
            
            // Active Users
            document.getElementById('active-users-count').innerText = a.activeUsers;
            
            // Traffic Chart
            renderTrafficChart(a.pageViews);
            
            // Device Chart
            renderDeviceChart(a.devices);

            // Top Pages
            const pagesBody = document.getElementById('top-pages-body');
            if(pagesBody) {
                pagesBody.innerHTML = a.topPages.map(p => `
                    <tr>
                        <td style="color:var(--admin-accent); font-family:monospace;">${p.path}</td>
                        <td style="text-align:right;">${p.count} views</td>
                    </tr>
                `).join('');
            }
        }

        const resDash = await fetch(`${API_URL}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dash = await resDash.json();
        if (dash.success && dash.widgets) {
            const w = dash.widgets;
            const tu = document.getElementById('top-users-body');
            if (tu) {
                tu.innerHTML = (w.top_users || []).map(u =>
                    `<tr><td>${u.username}</td><td style="text-align:right">${u.post_count} posts</td></tr>`
                ).join('') || '<tr><td colspan="2">No data</td></tr>';
            }
            const tt = document.getElementById('top-topics-body');
            if (tt) {
                tt.innerHTML = (w.top_topics || []).map(t =>
                    `<tr><td>${t.title?.substring(0,40)}</td><td style="text-align:right">${t.reply_count} replies</td></tr>`
                ).join('') || '<tr><td colspan="2">No data</td></tr>';
            }
            const ts = document.getElementById('top-searches-body');
            if (ts) {
                ts.innerHTML = (w.top_searches || []).map(s =>
                    `<tr><td>${s.query}</td><td style="text-align:right">${s.cnt}</td></tr>`
                ).join('') || '<tr><td colspan="2">No searches logged yet</td></tr>';
            }
        }

    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

// Chart Renderers
let trafficChartInstance = null;
let deviceChartInstance = null;

function renderTrafficChart(data) {
    const ctx = document.getElementById('trafficChart').getContext('2d');
    
    // Prepare data
    const labels = data.map(d => d.hour);
    const counts = data.map(d => d.count);
    
    if(trafficChartInstance) trafficChartInstance.destroy();
    
    trafficChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Page Views',
                data: counts,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderDeviceChart(data) {
    const ctx = document.getElementById('deviceChart').getContext('2d');
    
    const labels = data.map(d => d.device_type);
    const counts = data.map(d => d.count);
    
    if(deviceChartInstance) deviceChartInstance.destroy();
    
    deviceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
        }
    });
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
            const hrs = document.getElementById('ban-duration-hours')?.value;
            body = { user_id: userId, reason: reason };
            if (hrs) body.duration_hours = parseInt(hrs, 10);
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
window.switchTab = switchTab;

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
