
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
    
    // Store for modal access
    window.currentReportsCache = reports;

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

// Added viewReportDetails
// Added viewReportDetails
async function viewReportDetails(reportId) {
    const report = window.currentReportsCache.find(r => r.id === reportId);
    if (!report) return;

    const content = document.getElementById('report-details-content');
    content.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Loading details...</div>';
    document.getElementById('report-details-modal').classList.add('active');

    let additionalInfo = '';

    if (report.reported_entity_type === 'user') {
        try {
            const res = await fetch(`/api/user/get?id=${report.reported_entity_id}`);
            if (res.ok) {
                const user = await res.json();
                
                // Avatar Logic
                let avatarHTML = '';
                if (user.avatar_url) {
                    avatarHTML = `<img src="${user.avatar_url}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid var(--bmw-blue);">`;
                } else {
                    avatarHTML = `<div style="width:60px; height:60px; border-radius:50%; background:#333; color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold;">${user.username[0].toUpperCase()}</div>`;
                }

                additionalInfo = `
                    <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-top: 20px; border: 1px solid var(--glass-border);">
                        <h3 style="margin-top:0; color:var(--bmw-sky); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:15px;">Reported Profile</h3>
                        <div style="display: flex; gap: 20px; align-items: start;">
                            ${avatarHTML}
                            <div style="flex:1;">
                                <div style="font-size: 1.2em; font-weight: bold; color: white;">${escapeHtml(user.username)}</div>
                                <div style="color: #aaa; font-size: 0.9em; margin-bottom: 5px;">${escapeHtml(user.email || 'No Email')}</div>
                                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:5px;">
                                    <span class="message-tag">${user.role}</span>
                                    <span class="message-tag" style="background:rgba(52, 152, 219, 0.2); color:#3498db;"><i class="fas fa-star"></i> ${user.reputation || 0} Rep</span>
                                    <span class="message-tag" style="background:rgba(46, 204, 113, 0.2); color:#2ecc71;"><i class="fas fa-car"></i> ${escapeHtml(user.car_model || 'No Car')}</span>
                                </div>
                                ${user.bio ? `<div style="margin-top:10px; font-style:italic; color:#ddd; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">"${escapeHtml(user.bio)}"</div>` : ''}
                            </div>
                        </div>
                        <div style="margin-top: 15px; display:flex; gap:10px;">
                             <a href="/profile?id=${user.id}" target="_blank" class="btn" style="font-size:12px; padding:5px 10px;">View Full Profile <i class="fas fa-external-link-alt"></i></a>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.error("Error fetching user details", e);
            additionalInfo = '<div style="color:orange; margin-top:10px;">Could not load user profile details.</div>';
        }
    }

    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 10px; margin-bottom: 10px;">
            <div style="color: #aaa;">Type:</div>
            <div><span class="message-tag">${report.reported_entity_type}</span></div>
            
            <div style="color: #aaa;">Reporter:</div>
            <div>${escapeHtml(report.reporter_name || 'Anonymous')}</div>
            
            <div style="color: #aaa;">Reported:</div>
            <div>${escapeHtml(report.reported_username || 'Unknown')} (ID: ${report.reported_user_id || 'N/A'})</div>
            
            <div style="color: #aaa;">Reason:</div>
            <div style="color: var(--bmw-sky); font-weight: bold;">${escapeHtml(report.reason)}</div>
            
            <div style="color: #aaa;">Description:</div>
            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px;">${escapeHtml(report.description || 'No description provided.')}</div>
            
            <div style="color: #aaa;">Date:</div>
            <div>${new Date(report.created_at).toLocaleString()}</div>
        </div>
        
        ${additionalInfo}

        ${ report.reported_entity_type === 'post' || report.reported_entity_type === 'topic' ? 
           `<div style="margin-top:10px;"><a href="/topic?id=${report.reported_entity_id}" target="_blank" class="btn" style="display:inline-block; font-size:12px;">View Content Context <i class="fas fa-external-link-alt"></i></a></div>` 
           : '' 
        }
    `;

    // Setup buttons
    const banBtn = document.getElementById('btn-report-ban');
    const dismissBtn = document.getElementById('btn-report-dismiss');
    
    banBtn.onclick = () => { closeReportDetailsModal(); resolveReport(reportId, 'ban_user'); };
    dismissBtn.onclick = () => { closeReportDetailsModal(); resolveReport(reportId, 'dismiss'); };
}

function closeReportDetailsModal() {
    document.getElementById('report-details-modal').classList.remove('active');
}
