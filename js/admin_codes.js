// Error Codes admin tab
let codesSearchTimer;

function debounceCodesSearch() {
  clearTimeout(codesSearchTimer);
  codesSearchTimer = setTimeout(() => loadAdminCodes(), 400);
}

async function loadAdminCodes() {
  const tbody = document.getElementById('codes-table-body');
  if (!tbody) return;
  const q = document.getElementById('codes-search')?.value || '';
  tbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/admin/codes?search=${encodeURIComponent(q)}&limit=80`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="5">${data.error || 'Error'}</td></tr>`;
      return;
    }
    tbody.innerHTML = (data.codes || []).map((c) => `
      <tr>
        <td><a href="/code/${c.code}" target="_blank" rel="noopener">${c.code}</a></td>
        <td>${c.title_en || '—'}</td>
        <td>${c.severity || '—'}</td>
        <td>${c.is_published ? 'Yes' : 'No'}</td>
        <td><button class="action-btn btn-danger" onclick="deleteDtcCode('${c.code}')"><i class="fas fa-trash"></i></button></td>
      </tr>
    `).join('') || '<tr><td colspan="5">No codes in D1 — use Import from JSON</td></tr>';
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5">Failed to load</td></tr>';
  }
}

async function importDtcCodes() {
  if (!confirm('Import all codes from data/codes.json and data/data.json into D1?')) return;
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_URL}/admin/codes/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  alert(data.success ? `Imported ${data.imported} codes` : (data.error || 'Failed'));
  loadAdminCodes();
}

async function deleteDtcCode(code) {
  if (!confirm(`Delete ${code}?`)) return;
  const token = localStorage.getItem('auth_token');
  await fetch(`${API_URL}/admin/codes?code=${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  loadAdminCodes();
}

window.loadAdminCodes = loadAdminCodes;
window.importDtcCodes = importDtcCodes;
window.debounceCodesSearch = debounceCodesSearch;
