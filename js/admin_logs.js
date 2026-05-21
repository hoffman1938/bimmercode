// js/admin_logs.js - Audit Logs Viewer

let logsPage = 1;
let logsTotal = 0;

async function loadLogs(page = 1) {
    logsPage = page;
    const tbody = document.getElementById('logs-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Loading logs...</td></tr>';

    const action = document.getElementById('logs-action-filter')?.value?.trim() || '';
    const userId = document.getElementById('logs-user-filter')?.value?.trim() || '';

    try {
        const token = localStorage.getItem('auth_token');
        let url = `${API_URL}/admin/logs?limit=50&offset=${(page - 1) * 50}`;
        if (action) url += `&action=${encodeURIComponent(action)}`;
        if (userId) url += `&user_id=${encodeURIComponent(userId)}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (data.success) {
            renderLogs(data.logs);
            logsTotal = data.pagination?.total ?? 0;
            const pag = document.getElementById('logs-pagination');
            if (pag) {
                const pages = Math.max(1, Math.ceil(logsTotal / 50));
                let html = '';
                if (page > 1) html += `<button class="btn" onclick="loadLogs(${page - 1})">Prev</button>`;
                html += `<span style="margin:0 10px;">Page ${page}/${pages}</span>`;
                if (page < pages) html += `<button class="btn" onclick="loadLogs(${page + 1})">Next</button>`;
                pag.innerHTML = html;
            }
        } else {
             if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error: ${data.error}</td></tr>`;
        }
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Connection error</td></tr>`;
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No logs found</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => {
        let detailsHtml = '';
        try {
            const parsed = JSON.parse(log.details);
            detailsHtml = '<div style="font-size:11px; font-family:monospace; white-space:pre-wrap;">' + 
                          escapeHtml(JSON.stringify(parsed, null, 2)) + 
                          '</div>';
        } catch(e) {
            detailsHtml = escapeHtml(log.details || '');
        }

        const dateObj = new Date(log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z'); 
        const dateStr = dateObj.toLocaleString();
        const actor = log.actor_username || log.username || log.user_id;

        return `
        <tr>
            <td style="color:#aaa; font-size:12px; white-space:nowrap;">${dateStr}</td>
            <td>${actor}</td>
            <td><span class="tag">${log.action}</span></td>
            <td>${log.target_entity_type} <span style="font-size:10px; color:#666;">${log.target_entity_id ? '('+log.target_entity_id.substring(0,8)+')' : ''}</span></td>
            <td>${detailsHtml}</td>
        </tr>
    `}).join('');
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
