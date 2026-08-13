async function loadAdminNotifications() {
  const tbody = document.getElementById('notif-templates-body');
  if (!tbody) return;
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/admin/notification-templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    tbody.innerHTML = (data.templates || []).map((t) => `
      <tr><td>${t.type}</td><td>${t.channel}</td><td>${t.enabled ? 'On' : 'Off'}</td></tr>
    `).join('') || '<tr><td colspan="3">No templates — defaults used</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="3">Error</td></tr>';
  }
}

window.loadAdminNotifications = loadAdminNotifications;
