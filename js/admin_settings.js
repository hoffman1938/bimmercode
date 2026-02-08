// js/admin_settings.js
async function loadSettings() {
    const container = document.getElementById('tab-settings').querySelector('.dashboard-card');
    container.innerHTML = '<p>Loading settings...</p>';
    
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/settings`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            renderSettingsForm(data.settings);
        } else {
             container.innerHTML = `<p class="error">Error loading settings: ${data.error}</p>`;
        }
    } catch(e) {
        container.innerHTML = `<p class="error">Connection error</p>`;
    }
}

function renderSettingsForm(settings) {
    const container = document.getElementById('tab-settings').querySelector('.dashboard-card');
    
    // Default values
    const regEnabled = settings.registration_enabled !== "0"; // Default true
    const maintMode = settings.maintenance_mode === "1"; // Default false
    const footerText = settings.footer_text || "© 2026 BimmerCodes. All rights reserved.";
    
    container.innerHTML = `
        <form id="settings-form">
            <div class="input-group">
                <label>User Registration</label>
                <select id="set-reg" class="form-input" style="background:rgba(255,255,255,0.1); color:white;">
                    <option value="1" ${regEnabled ? 'selected' : ''}>Enabled</option>
                    <option value="0" ${!regEnabled ? 'selected' : ''}>Disabled</option>
                </select>
                <div style="font-size:12px; color:#aaa; margin-top:5px;">If disabled, new users cannot sign up.</div>
            </div>

            <div class="input-group">
                <label>Maintenance Mode</label>
                <select id="set-maint" class="form-input" style="background:rgba(255,255,255,0.1); color:white;">
                    <option value="0" ${!maintMode ? 'selected' : ''}>Off (Normal Operation)</option>
                    <option value="1" ${maintMode ? 'selected' : ''}>On (Admins only)</option>
                </select>
                <div style="font-size:12px; color:#aaa; margin-top:5px;">Display maintenance message to non-admin users.</div>
            </div>
            
            <div class="input-group">
                <label>Footer Text</label>
                <input type="text" id="set-footer" class="form-input" value="${footerText}">
            </div>

            <button type="submit" class="submit-btn">Save Settings</button>
        </form>
    `;
    
    document.getElementById('settings-form').addEventListener('submit', saveSettings);
}

async function saveSettings(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;
    
    const settings = {
        registration_enabled: document.getElementById('set-reg').value,
        maintenance_mode: document.getElementById('set-maint').value,
        footer_text: document.getElementById('set-footer').value
    };
    
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/settings`, {
            method: 'POST',
             headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}` 
             },
             body: JSON.stringify({ settings })
        });
        
        const data = await res.json();
        if (data.success) {
            alert("Settings saved successfully");
        } else {
            alert("Error: " + data.error);
        }
    } catch(e) {
        alert("Connection error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
