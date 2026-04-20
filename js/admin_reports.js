// js/admin_reports.js  (Moderation Dashboard v2)
// Works against the new endpoints:
//   GET  /api/admin/moderation/queue?tab=reports|ai_flagged&status=open
//   POST /api/admin/moderation/resolve        { report_id, action, note }
//   POST /api/admin/moderation/topic-action   { topic_id, action }
//   POST /api/admin/moderation/warn           { user_id, reason, severity }

(function () {
  "use strict";

  let activeTab = "reports";     // 'reports' | 'ai_flagged'
  let activeStatus = "open";

  function token() { return localStorage.getItem("auth_token"); }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
    );
  }

  // ------------------------------------------------------------------ API
  async function fetchQueue() {
    const tb = document.getElementById("reports-table-body");
    const loading = document.getElementById("reports-loading");
    if (loading) loading.style.display = "block";
    if (tb) tb.innerHTML = "";
    try {
      const r = await fetch(
        `/api/admin/moderation/queue?tab=${activeTab}&status=${activeStatus}`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      render(data.items || []);
    } catch (e) {
      if (tb) tb.innerHTML = `<tr><td colspan="6" style="color:#e74c3c;padding:16px;text-align:center;">${escapeHtml(e.message)}</td></tr>`;
    } finally {
      if (loading) loading.style.display = "none";
    }
  }

  async function resolve(reportId, action) {
    const note = prompt(`Resolution note for action "${action}" (optional):`, "");
    if (note === null) return;
    try {
      const r = await fetch(`/api/admin/moderation/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ report_id: reportId, action, note }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "failed");
      fetchQueue();
    } catch (e) { alert(e.message); }
  }

  async function topicAction(topicId, action) {
    try {
      const r = await fetch(`/api/admin/moderation/topic-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ topic_id: topicId, action }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "failed");
      fetchQueue();
    } catch (e) { alert(e.message); }
  }

  async function warnUser(userId) {
    const reason = prompt("Warning reason:");
    if (!reason) return;
    const sev = prompt("Severity (low | medium | high | critical):", "medium") || "medium";
    try {
      const r = await fetch(`/api/admin/moderation/warn`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ user_id: userId, reason, severity: sev }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "failed");
      alert("Warning issued.");
    } catch (e) { alert(e.message); }
  }

  // ------------------------------------------------------------------ UI
  function render(items) {
    const tb = document.getElementById("reports-table-body");
    if (!tb) return;
    if (!items.length) {
      tb.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">No items.</td></tr>`;
      return;
    }
    if (activeTab === "ai_flagged") {
      tb.innerHTML = items.map(aiRow).join("");
      return;
    }
    tb.innerHTML = items.map(reportRow).join("");
  }

  function reportRow(r) {
    const entityLink =
      r.entity_type === "topic" || r.entity_type === "post"
        ? `<a href="/topic?id=${encodeURIComponent(r.entity_type === "post" ? "" : r.entity_id)}" target="_blank" style="color:#60a5fa">view</a>`
        : "";
    return `
      <tr>
        <td><span class="message-tag">${escapeHtml(r.entity_type)}</span></td>
        <td>
          ${r.author_username ? `<strong>${escapeHtml(r.author_username)}</strong><br>` : ""}
          <span style="color:#888;font-size:12px;">${escapeHtml((r.snippet || "").slice(0, 160))}${(r.snippet || "").length > 160 ? "…" : ""}</span>
        </td>
        <td><span class="message-tag" style="background:rgba(239,68,68,.15);color:#ef4444;">${escapeHtml(r.reason)}</span></td>
        <td>${escapeHtml(r.reporter_name || "?")}</td>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="action-btn" title="Dismiss (keep content)" onclick="ModDash.resolve('${r.id}','approve')"><i class="fas fa-check"></i></button>
            <button class="action-btn btn-danger" title="Remove content" onclick="ModDash.resolve('${r.id}','remove')"><i class="fas fa-trash"></i></button>
            ${r.entity_type === "topic" ? `<button class="action-btn" title="Lock topic" onclick="ModDash.topicAction('${r.entity_id}','lock')"><i class="fas fa-lock"></i></button>` : ""}
            ${r.entity_type === "topic" ? `<button class="action-btn" title="Pin topic" onclick="ModDash.topicAction('${r.entity_id}','pin')"><i class="fas fa-thumbtack"></i></button>` : ""}
            ${r.author_id ? `<button class="action-btn" title="Warn user" onclick="ModDash.warnUser('${r.author_id}')"><i class="fas fa-exclamation-triangle"></i></button>` : ""}
          </div>
        </td>
      </tr>`;
  }

  function aiRow(r) {
    let flags = r.flags;
    try { if (typeof flags === "string") flags = JSON.parse(flags); } catch {}
    const flagsHtml = Array.isArray(flags) ? flags.map((f) => `<span class="message-tag">${escapeHtml(f)}</span>`).join(" ") : "";
    return `
      <tr>
        <td><span class="message-tag">${escapeHtml(r.entity_type)}</span></td>
        <td style="font-size:12px;color:#888;">${escapeHtml((r.explanation || "").slice(0, 180))}</td>
        <td>${flagsHtml}<br><span style="color:#888">sev: ${escapeHtml(r.severity || "?")}</span></td>
        <td>${escapeHtml(r.source || "")}</td>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td>
          <button class="action-btn" onclick="window.open('/topic?id=${encodeURIComponent(r.entity_id)}','_blank')"><i class="fas fa-external-link-alt"></i></button>
        </td>
      </tr>`;
  }

  // ------------------------------------------------------------------ Global API
  window.ModDash = {
    load: fetchQueue,
    setTab: (t) => { activeTab = t; fetchQueue(); },
    setStatus: (s) => { activeStatus = s; fetchQueue(); },
    resolve,
    topicAction,
    warnUser,
  };

  // Backward-compatible wrappers for existing admin.html buttons
  window.loadReports = function (status = "open") {
    activeStatus = status === "pending" ? "open" : status;
    activeTab = "reports";
    fetchQueue();
  };
  window.resolveReport = (id, action) => resolve(id, action);
})();
