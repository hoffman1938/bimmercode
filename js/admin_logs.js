// js/admin_logs.js - Audit Logs Viewer

async function loadLogs(page = 1) {
    const tbody = document.getElementById('logs-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Loading logs...</td></tr>';

    try {
        const token = localStorage.getItem('auth_token');
        // Retrieve logs with simpler query for now, add filtering later
        // Need to create an endpoint specifically for this or generic logs endpoint.
        // Assuming /api/admin/audit-logs exists or we create it.
        // I haven't created it yet! I skipped it in backend phase.
        // Wait, I need to create /api/admin/logs.js first!
        
        // Let's create the API first, then this file. 
        // But since I am writing this file now, I'll assume the endpoint will be /api/admin/logs
        
        const res = await fetch(`${API_URL}/admin/logs?limit=50&offset=${(page-1)*50}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        
        if (data.success) {
            renderLogs(data.logs);
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
            // Create a mini-table or formatted list for details
            detailsHtml = '<div style="font-size:11px; font-family:monospace; white-space:pre-wrap;">' + 
                          escapeHtml(JSON.stringify(parsed, null, 2)) + 
                          '</div>';
        } catch(e) {
            detailsHtml = escapeHtml(log.details || '');
        }

        // Format Date to User's Locale
        const dateObj = new Date(log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z'); 
        const dateStr = dateObj.toLocaleString();

        return `
        <tr>
            <td style="color:#aaa; font-size:12px; white-space:nowrap;">${dateStr}</td>
            <td>${log.username || log.user_id}</td>
            <td><span class="tag">${log.action}</span></td>
            <td>${log.target_entity_type} <span style="font-size:10px; color:#666;">${log.target_entity_id ? '('+log.target_entity_id.substring(0,8)+')' : ''}</span></td>
            <td>
                ${detailsHtml}
            </td>
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
