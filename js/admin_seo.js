async function loadAdminSeo() {
  const tbody = document.getElementById('seo-meta-body');
  if (!tbody) return;
  try {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/admin/seo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    tbody.innerHTML = (data.meta || []).map((m) => `
      <tr><td>${m.path}</td><td>${m.title || ''}</td><td>${(m.description || '').substring(0,60)}</td></tr>
    `).join('') || '<tr><td colspan="3">No custom meta yet</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="3">Error</td></tr>';
  }
}

async function saveSeoMeta() {
  const token = localStorage.getItem('auth_token');
  await fetch(`${API_URL}/admin/seo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: document.getElementById('seo-path')?.value,
      title: document.getElementById('seo-title')?.value,
      description: document.getElementById('seo-description')?.value,
    }),
  });
  loadAdminSeo();
}

window.loadAdminSeo = loadAdminSeo;
window.saveSeoMeta = saveSeoMeta;
