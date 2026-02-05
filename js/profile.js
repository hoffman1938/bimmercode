document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const profileId = urlParams.get("id");

  // 0. Handle "My Profile" (No ID param)
  if (!profileId) {
    const me = JSON.parse(localStorage.getItem("user_data"));
    if (me) {
        // Replace URL without reload for cleaner history (optional) OR just redirect
        window.location.replace(`/profile?id=${me.id}`); 
        return;
    } else {
        // Not logged in -> Go home
        window.location.href = "/forum";
        return;
    }
  }

  await loadProfile(profileId);
});

let currentProfileUser = null;

async function loadProfile(profileId) {
  try {
    // 1. Fetch User Data
    const userRes = await fetch(`/api/user/get?id=${profileId}`);
    if (!userRes.ok) throw new Error("Failed to load user");
    const user = await userRes.json();
    currentProfileUser = user;

    // 2. Render Header
    document.getElementById("profile-username").textContent = user.username;
    
    // Bio
    const bioEl = document.getElementById("profile-bio");
    if (user.bio) {
        bioEl.textContent = user.bio;
        bioEl.style.fontStyle = "italic";
        bioEl.style.color = "#ccc";
    } else {
        bioEl.textContent = "This user hasn't written a bio yet.";
        bioEl.style.fontStyle = "normal";
        bioEl.style.color = "var(--f-text-muted)";
    }

    // Car Model
    document.getElementById("profile-car").innerHTML = `<i class="fas fa-car" style="color:var(--bmw-sky)"></i> <span>${user.car_model || "No model specified"}</span>`;
    
    // Avatar (Using IMG for object-fit support)
    const avatarEl = document.getElementById("profile-avatar");
    if (user.avatar_url) {
        avatarEl.innerHTML = `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`;
        avatarEl.style.backgroundImage = "none";
    } else {
        avatarEl.innerHTML = `<span style="font-size:60px;">${user.username[0].toUpperCase()}</span>`;
    }

    // Role Badges
    const badgeContainer = document.getElementById("profile-badges");
    badgeContainer.innerHTML = "";
    if (user.role === 'admin') {
        badgeContainer.innerHTML += `<span class="topic-badge" style="background: #e74c3c; color: white; border: none;">ADMIN</span>`;
    }
    if (user.reputation > 50) {
        badgeContainer.innerHTML += `<span class="topic-badge" style="background: #f1c40f; color: black; border: none;">EXPERT</span>`;
    }
    badgeContainer.innerHTML += `<span class="topic-badge">${user.role.toUpperCase()}</span>`;

    // 3. Stats
    document.getElementById("stat-reputation").textContent = user.reputation || 0;
    document.getElementById("stat-joined").textContent = new Date(user.created_at).toLocaleDateString();

    // 4. Check Ownership (Show Edit Button)
    const currentUser = JSON.parse(localStorage.getItem("user_data")); // Fix key name (was forum_user)
    if (currentUser && String(currentUser.id) === String(user.id)) {
        document.getElementById("btn-edit-profile").style.display = "inline-block";
        
        // Pre-fill edit form
        document.getElementById("edit-bio").value = user.bio || "";
        document.getElementById("edit-car").value = user.car_model || "";
        document.getElementById("edit-avatar").value = user.avatar_url || "";
    }

    // 5. Load Topics
    loadUserTopics(profileId); // Reuse logic effectively, but might need custom function if different from main forum
    
  } catch (error) {
    console.error(error);
    alert("Error loading profile");
  }
}

async function loadUserTopics(userId) {
    const container = document.getElementById("topics-list-container");
    container.innerHTML = `<div class="skeleton-row"><div class="skeleton-content"><div class="skeleton-line long"></div></div></div>`;
    
    try {
        const res = await fetch(`/api/forum/topics?user_id=${userId}`);
        const topics = await res.json();
        
        document.getElementById("stat-topics").textContent = topics.length;

        if (topics.length === 0) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: #888;">No topics created yet.</div>`;
            return;
        }

        container.innerHTML = topics.map(topic => `
            <div class="topic-row" onclick="window.location.href='/topic?id=${topic.id}'">
                <div class="topic-status-icon ${topic.is_solved ? 'solved' : ''}">
                     <i class="fas ${topic.is_solved ? 'fa-check-circle' : 'fa-comment-alt'}"></i>
                </div>
                <div class="topic-main-content">
                    <h3>${escapeHtml(topic.title)}</h3>
                    <div class="topic-meta-line">
                        <span>${new Date(topic.created_at).toLocaleDateString()}</span>
                        <span>• ${topic.reply_count} replies</span>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        container.innerHTML = "Failed to load topics.";
    }
}

// === Edit Modal Logic ===
function openEditProfileModal() {
    document.getElementById("edit-profile-modal").classList.add("active");
}
function closeEditProfileModal() {
    document.getElementById("edit-profile-modal").classList.remove("active");
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const currentUser = JSON.parse(localStorage.getItem("user_data"));
    if (!currentUser) return;

    const bio = document.getElementById("edit-bio").value;
    const car_model = document.getElementById("edit-car").value;
    const avatar_url = document.getElementById("edit-avatar").value;
    
    const btn = e.target.querySelector("button");
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentUser.id,
                bio,
                car_model,
                avatar_url
            })
        });

        if (res.ok) {
            // Update local storage
            // Fetch fresh data to be sure
            const freshRes = await fetch(`/api/user/get?id=${currentUser.id}`);
            const freshUser = await freshRes.json();
            localStorage.setItem("user_data", JSON.stringify(freshUser));
            
            closeEditProfileModal();
            loadProfile(currentUser.id); // Reload UI
        } else {
            alert("Update failed");
        }
    } catch (err) {
        console.error(err);
        alert("Error updating profile");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
