async function loadAdminGarage() {
  const tbody = document.getElementById('garage-table-body');
  if (!tbody) return;
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/admin/garage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    tbody.innerHTML = (data.vehicles || []).map((v) => `
      <tr>
        <td>${v.username || v.user_id}</td>
        <td>${v.model || v.title || '—'}</td>
        <td>${v.is_featured ? 'Yes' : 'No'}</td>
        <td>${v.is_approved ? 'Yes' : 'Pending'}</td>
        <td>
          ${!v.is_approved ? `<button class="action-btn" onclick="approveVehicle('${v.id}')">Approve</button>` : ''}
          <button class="action-btn btn-danger" onclick="deleteVehicle('${v.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5">No vehicles yet</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="5">Error loading</td></tr>';
  }
}

async function approveVehicle(id) {
  const token = localStorage.getItem('auth_token');
  await fetch(`${API_URL}/admin/garage`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, is_approved: 1 }),
  });
  loadAdminGarage();
}

async function deleteVehicle(id) {
  if (!confirm('Delete vehicle?')) return;
  const token = localStorage.getItem('auth_token');
  await fetch(`${API_URL}/admin/garage?id=${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  loadAdminGarage();
}

window.loadAdminGarage = loadAdminGarage;
