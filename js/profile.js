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
    // Use global helper if available, otherwise fallback (or simple check)
    if (typeof getReputationBadge === "function") {
        badgeContainer.innerHTML = getReputationBadge(user.reputation, user.role);
    } else {
        // Fallback if script.js not loaded yet (shouldn't happen)
        badgeContainer.innerHTML = `<span class="topic-badge">${user.role.toUpperCase()}</span>`;
    }

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

// Global pagination state for profile
let currentProfilePage = 1;
const ITEMS_PER_PAGE = 10;

async function loadUserTopics(userId, page = 1) {
    currentProfilePage = page;
    const container = document.getElementById("profile-topics-container");
    container.innerHTML = `<div class="skeleton-row"><div class="skeleton-content"><div class="skeleton-line long"></div></div></div>`;
    
    try {
        const res = await fetch(`/api/forum/topics?user_id=${userId}&page=${page}&limit=${ITEMS_PER_PAGE}`);
        const data = await res.json();
        
        // Handle new response format { topics: [], total: ... }
        const topics = data.topics || [];
        const total = data.total || 0;
        const totalPages = data.totalPages || 1;
        
        document.getElementById("stat-topics").textContent = total;

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

        // Render Pagination Controls
        if (totalPages > 1) {
            const paginationDiv = document.createElement("div");
            paginationDiv.className = "pagination-controls";
            paginationDiv.style.display = "flex";
            paginationDiv.style.justifyContent = "center";
            paginationDiv.style.gap = "10px";
            paginationDiv.style.marginTop = "20px";

            // Prev Button
            if (page > 1) {
                const prevBtn = document.createElement("button");
                prevBtn.className = "btn secondary";
                prevBtn.innerHTML = "<i class='fas fa-chevron-left'></i>";
                prevBtn.onclick = () => loadUserTopics(userId, page - 1);
                paginationDiv.appendChild(prevBtn);
            }

            // Page Info
            const info = document.createElement("span");
            info.style.alignSelf = "center";
            info.style.color = "#888";
            info.textContent = `Page ${page} of ${totalPages}`;
            paginationDiv.appendChild(info);

            // Next Button
            if (page < totalPages) {
                const nextBtn = document.createElement("button");
                nextBtn.className = "btn secondary";
                nextBtn.innerHTML = "<i class='fas fa-chevron-right'></i>";
                nextBtn.onclick = () => loadUserTopics(userId, page + 1);
                paginationDiv.appendChild(nextBtn);
            }

            container.appendChild(paginationDiv);
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = "Failed to load topics.";
    }
}

// === Edit Modal Logic ===
function openEditProfileModal() {
    document.getElementById("edit-profile-modal").classList.add("active");
    
    // Initialize avatar preview
    const avatarPreview = document.getElementById("avatar-preview-edit");
    const deleteBtn = document.getElementById("btn-delete-avatar");
    const currentUser = JSON.parse(localStorage.getItem("user_data"));
    
    if (currentUser && currentUser.avatar_url) {
        avatarPreview.innerHTML = `<img src="${currentUser.avatar_url}" alt="Avatar">`;
        deleteBtn.style.display = "block";
    } else {
        avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
        deleteBtn.style.display = "none";
    }
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

// === Avatar Upload Functions ===
function triggerAvatarUpload() {
    document.getElementById("avatar-file-input").click();
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
    }
    
    const uploadBtn = document.querySelector('.btn-upload-avatar');
    const uploadIcon = uploadBtn.querySelector('i');
    const originalHTML = uploadBtn.innerHTML;
    
    try {
        // Show loading state
        uploadBtn.classList.add('uploading');
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        // Convert to WebP
        const webpFile = await convertToWebP(file);
        
        // Upload to server
        const formData = new FormData();
        formData.append('file', webpFile);
        
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        
        if (data.url) {
            // Update preview
            const avatarPreview = document.getElementById('avatar-preview-edit');
            avatarPreview.innerHTML = `<img src="${data.url}" alt="Avatar">`;
            
            // Update hidden input
            document.getElementById('edit-avatar').value = data.url;
            
            // Show delete button
            document.getElementById('btn-delete-avatar').style.display = 'block';
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error(error);
        alert('Error uploading image. Please try again.');
    } finally {
        // Reset button
        uploadBtn.classList.remove('uploading');
        uploadBtn.innerHTML = originalHTML;
        // Clear file input
        event.target.value = '';
    }
}

function deleteAvatar() {
    // Reset preview
    const avatarPreview = document.getElementById('avatar-preview-edit');
    avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
    
    // Clear hidden input
    document.getElementById('edit-avatar').value = '';
    
    // Hide delete button
    document.getElementById('btn-delete-avatar').style.display = 'none';
}

// WebP Conversion Function (reused from topic.js)
function convertToWebP(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Smaller for avatars
                const scale = Math.min(1, MAX_WIDTH / img.width);
                
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return reject(new Error('Canvas conversion failed'));
                        const fileName = file.name.split('.')[0] + '.webp';
                        const newFile = new File([blob], fileName, { type: 'image/webp' });
                        resolve(newFile);
                    },
                    'image/webp',
                    0.85
                );
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
}
