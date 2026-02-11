// js/report.js
// Shared logic for Reporting System (Phase 18)

document.addEventListener('DOMContentLoaded', () => {
    injectReportModal();
});

function injectReportModal() {
    if (document.getElementById('report-modal')) return;

    const lang = localStorage.getItem('forumLanguage') || localStorage.getItem('language') || 'en';
    const t = APP_TRANSLATIONS[lang] || APP_TRANSLATIONS.en;

    const modalHtml = `
    <div id="report-modal" class="auth-modal">
        <div class="auth-content">
            <button class="close-auth" onclick="closeReportModal()">
                <i class="fas fa-times"></i>
            </button>
            <h2 style="color: white; margin-bottom: 20px;" data-i18n="reportContent">${t.reportContent}</h2>
            <form id="report-form" onsubmit="submitReport(event)">
                <input type="hidden" id="report-entity-type">
                <input type="hidden" id="report-entity-id">
                <input type="hidden" id="report-user-id">
                
                <div class="input-group">
                    <label data-i18n="reportReason">${t.reportReason}</label>
                    <div class="custom-select-wrapper">
                        <select id="report-reason" class="auth-input" required>
                            <option value="" disabled selected data-i18n="reportSelectReason">${t.reportSelectReason}</option>
                            <option value="spam" data-i18n="reportSpam">${t.reportSpam}</option>
                            <option value="harassment" data-i18n="reportHarassment">${t.reportHarassment}</option>
                            <option value="inappropriate" data-i18n="reportInappropriate">${t.reportInappropriate}</option>
                            <option value="off_topic" data-i18n="reportOffTopic">${t.reportOffTopic}</option>
                            <option value="other" data-i18n="reportOther">${t.reportOther}</option>
                        </select>
                    </div>
                </div>

                <div class="input-group">
                    <label data-i18n="reportDescription">${t.reportDescription}</label>
                    <textarea id="report-desc" class="auth-input" rows="4" data-i18n-placeholder="reportPlaceholder" placeholder="${t.reportPlaceholder}"></textarea>
                </div>

                <button type="submit" class="submit-btn" style="background: var(--admin-danger);">
                    <i class="fas fa-flag"></i> <span data-i18n="reportSubmit">${t.reportSubmit}</span>
                </button>
            </form>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openReportModal(entityType, entityId, reportedUserId = null) {
    if (!localStorage.getItem('auth_token')) {
        const lang = localStorage.getItem('forumLanguage') || localStorage.getItem('language') || 'en';
        const t = APP_TRANSLATIONS[lang] || APP_TRANSLATIONS.en;
        // Prompt login if not authenticated
        if (typeof toggleAuthModal === 'function') {
            toggleAuthModal();
        } else {
            alert(t.reportLoginRequired || "Please login to report content.");
        }
        return;
    }

    document.getElementById('report-entity-type').value = entityType;
    document.getElementById('report-entity-id').value = entityId;
    document.getElementById('report-user-id').value = reportedUserId || '';
    
    // Reset form
    document.getElementById('report-reason').selectedIndex = 0;
    document.getElementById('report-desc').value = '';
    
    document.getElementById('report-modal').classList.add('active');
}

function closeReportModal() {
    document.getElementById('report-modal').classList.remove('active');
}

async function submitReport(e) {
    e.preventDefault();
    
    const lang = localStorage.getItem('forumLanguage') || localStorage.getItem('language') || 'en';
    const t = APP_TRANSLATIONS[lang] || APP_TRANSLATIONS.en;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t.reportSubmitting || "Submitting..."}`;
    submitBtn.disabled = true;

    const entityType = document.getElementById('report-entity-type').value;
    const entityId = document.getElementById('report-entity-id').value;
    const reportedUserId = document.getElementById('report-user-id').value;
    const reason = document.getElementById('report-reason').value;
    const description = document.getElementById('report-desc').value;

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/moderation/report', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                entity_type: entityType,
                entity_id: entityId,
                reported_user_id: reportedUserId || null,
                reason: reason,
                description: description
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert(t.reportSuccess || "Report submitted successfully. Thank you for helping keep the community safe.");
            closeReportModal();
        } else {
            alert("Error: " + (data.error || t.reportError || "Failed to submit report"));
        }

    } catch (err) {
        console.error(err);
        alert(t.reportError || "Network error occurred.");
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}
