async function loadAdminMarketplace() {
  const tbody = document.getElementById('marketplace-table-body');
  if (!tbody) return;
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/admin/marketplace?status=pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    tbody.innerHTML = (data.listings || []).map((l) => `
      <tr>
        <td>${l.title}</td>
        <td>${l.username || l.user_id}</td>
        <td>${l.price != null ? l.price + ' ' + (l.currency || '') : '—'}</td>
        <td>${l.status}</td>
        <td>
          <button class="action-btn" onclick="setListingStatus('${l.id}','active')">Approve</button>
          <button class="action-btn btn-danger" onclick="setListingStatus('${l.id}','rejected')">Reject</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5">No pending listings</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="5">Error</td></tr>';
  }
}

async function setListingStatus(id, status) {
  const token = localStorage.getItem('auth_token');
  await fetch(`${API_URL}/admin/marketplace`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  loadAdminMarketplace();
}

window.loadAdminMarketplace = loadAdminMarketplace;
