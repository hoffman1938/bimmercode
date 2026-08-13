async function loadAdminAds() {
  const tbody = document.getElementById('ads-slots-body');
  if (!tbody) return;
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/admin/ads`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    tbody.innerHTML = (data.slots || []).map((s) => `
      <tr><td>${s.name}</td><td>${s.placement}</td><td>${s.is_active ? 'On' : 'Off'}</td></tr>
    `).join('') || '<tr><td colspan="3">No ad slots — add via API or seed</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="3">Error</td></tr>';
  }
}

window.loadAdminAds = loadAdminAds;
