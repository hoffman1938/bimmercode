
// js/admin_settings.js

async function loadSettings() {
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        if (data.success) {
            const s = data.settings;
            document.getElementById('set-site-name').value = s.site_name || '';
            document.getElementById('set-maintenance').checked = s.maintenance_mode === 'true';
            document.getElementById('set-registration').checked = s.registrations_open === 'true';
            document.getElementById('set-banner-active').checked = s.announcement_active === 'true';
            document.getElementById('set-banner-msg').value = s.announcement_banner || '';
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
}

async function saveSettings() {
    const settings = {
        site_name: document.getElementById('set-site-name').value,
        maintenance_mode: document.getElementById('set-maintenance').checked,
        registrations_open: document.getElementById('set-registration').checked,
        announcement_active: document.getElementById('set-banner-active').checked,
        announcement_banner: document.getElementById('set-banner-msg').value
    };
    
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/settings`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        const data = await res.json();
        if (data.success) {
            alert("Settings saved successfully!");
        } else {
            alert("Error saving settings: " + (data.error || "Unknown error"));
        }
        
    } catch (e) {
        console.error("Save error", e);
        alert("Failed to save settings");
    }
}

async function sendBroadcast(e) {
    if(e) e.preventDefault();
    
    const msg = document.getElementById('broadcast-msg').value;
    if(!msg) return alert("Please enter a message");
    
    if(!confirm("Are you sure you want to send this notification to ALL users? This cannot be undone.")) return;
    
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/announcements/send`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: msg, title: "Admin Announcement" })
        });
        
        const data = await res.json();
        if (data.success) {
            alert(`Broadcast sent to ${data.count} users.`);
            document.getElementById('broadcast-msg').value = '';
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to send broadcast");
    }
}
