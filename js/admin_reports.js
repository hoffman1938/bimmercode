
// js/admin_reports.js

async function loadReports(status = 'pending') {
    const tbody = document.getElementById('reports-table-body');
    const loading = document.getElementById('reports-loading');
    
    if (loading) loading.style.display = 'block';
    if (tbody) tbody.innerHTML = '';

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/moderation/reports?status=${status}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (data.success) {
            renderReports(data.reports);
        }
    } catch (e) {
        console.error("Failed to load reports", e);
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderReports(reports) {
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;

    if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No reports found.</td></tr>';
        return;
    }

    tbody.innerHTML = reports.map(r => `
        <tr>
            <td><span class="message-tag">${r.reported_entity_type}</span></td>
            <td>
                ${r.reported_user_id ? 
                    `<span style="color:var(--admin-accent);"><i class="fas fa-user"></i> ${r.reported_username || 'Unknown'}</span>` : 
                    `ID: ${r.reported_entity_id.substring(0,8)}...`
                }
            </td>
            <td>${r.reason}</td>
            <td>${r.reporter_name || 'Anonymous'}</td>
            <td>${new Date(r.created_at).toLocaleDateString()}</td>
            <td>
                ${r.status === 'pending' ? `
                <div style="display:flex; gap:5px;">
                    <button class="action-btn" title="View Details" onclick="viewReportDetails('${r.id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn btn-danger" title="Ban User" onclick="resolveReport('${r.id}', 'ban_user')"><i class="fas fa-gavel"></i></button>
                    <button class="action-btn" title="Dismiss" onclick="resolveReport('${r.id}', 'dismiss')"><i class="fas fa-check"></i></button>
                </div>
                ` : `<span style="color:#aaa;">${r.status}</span>`}
            </td>
        </tr>
    `).join('');
}

async function resolveReport(reportId, action) {
    const reason = prompt("Enter resolution notes (optional):", "Handled via Admin Panel");
    if (reason === null) return; // Cancelled

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/moderation/resolve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                report_id: reportId,
                action: action,
                notes: reason
            })
        });

        const data = await res.json();
        if (data.success) {
            alert("Report " + action + " successful");
            loadReports(); // Refresh
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        console.error("Resolve error", e);
    }
}
