
// js/admin_messages.js

async function loadMessages() {
    const list = document.getElementById('messages-list');
    list.innerHTML = '<p style="text-align:center; padding:20px;">Loading messages...</p>';

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/admin/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            renderMessages(data.messages);
        } else {
            list.innerHTML = `<p class="error">Error loading messages: ${data.error}</p>`;
        }
    } catch (e) {
        list.innerHTML = `<p class="error">Connection error</p>`;
    }
}

function renderMessages(messages) {
    const list = document.getElementById('messages-list');
    list.className = 'message-list'; // Add class for container styling
    
    if (!messages || messages.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox" style="font-size: 3em; margin-bottom: 20px; opacity: 0.5;"></i>
                <p>No messages found.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = messages.map(msg => {
        // Ensure UTC interpretation by appending 'Z' if missing
        const timeStr = msg.created_at.endsWith('Z') ? msg.created_at : msg.created_at + 'Z';
        const date = new Date(timeStr).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        const isReadClass = msg.is_read ? 'read' : 'unread';
        const statusIcon = msg.is_read ? '<i class="fas fa-envelope-open"></i>' : '<i class="fas fa-envelope"></i>';
        
        // Determine tag color based on subject (simple hash or static)
        let tagClass = 'tag-default'; 
        // We could implement dynamic tag colors later, for now just use the CSS class
        
        return `
            <div class="message-card ${isReadClass}" id="msg-${msg.id}">
                <div class="message-header">
                    <div class="message-info">
                        <div class="message-subject">
                            ${statusIcon}
                            ${escapeHtml(msg.subject || 'No Subject')}
                            <span class="message-tag">${escapeHtml(msg.subject ? msg.subject.split(' ')[0] : 'General')}</span>
                        </div>
                        <div class="message-meta">
                            <span><i class="fas fa-user"></i> ${escapeHtml(msg.name)}</span>
                            <span>&bull;</span>
                            <span><i class="fas fa-at"></i> ${escapeHtml(msg.email)}</span>
                            <span>&bull;</span>
                            <span><i class="fas fa-clock"></i> ${date}</span>
                        </div>
                    </div>
                    <div class="message-actions">
                        ${!msg.is_read ? 
                            `<button onclick="markMessageRead('${msg.id}')" class="btn" style="padding: 8px 16px; font-size: 0.85rem;">
                                <i class="fas fa-check"></i> Mark Read
                            </button>` : 
                            `<span class="status-badge status-active" style="background:rgba(255,255,255,0.1); color:#aaa; border:none;">Read</span>`
                        }
                        <button onclick="deleteMessage('${msg.id}')" class="action-btn btn-danger" title="Delete Message">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="message-body">${escapeHtml(msg.message)}</div>
            </div>
        `;
    }).join('');
}

async function markMessageRead(id) {
    try {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_URL}/admin/messages`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ id, action: 'mark_read' })
        });
        loadMessages(); // Reload to update UI
    } catch(e) {
        alert('Error updating message');
    }
}

async function deleteMessage(id) {
    if(!confirm("Are you sure you want to delete this message?")) return;
    
    try {
        const token = localStorage.getItem('auth_token');
        await fetch(`${API_URL}/admin/messages`, {
            method: 'PUT', // Using PUT with action delete as per API design, or could be DELETE method if API supported it directly
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ id, action: 'delete' })
        });
        loadMessages();
    } catch(e) {
        alert('Error deleting message');
    }
}
