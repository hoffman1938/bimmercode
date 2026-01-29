// js/profile.js
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        alert('Please login first');
        window.location.href = 'forum.html';
        return;
    }

    // Заполнение полей
    document.getElementById('p-username').textContent = user.username;
    document.getElementById('p-role').textContent = user.role || 'User';
    document.getElementById('p-avatar').src = user.avatar_url || './assets/icons/default-avatar.png';
    document.getElementById('p-avatar-url').value = user.avatar_url || '';
    document.getElementById('p-lang').value = user.locale || 'en';

    if (user.bmw) {
        document.getElementById('p-chassis').value = user.bmw.chassis || '';
        document.getElementById('p-model').value = user.bmw.model || '';
        document.getElementById('p-engine').value = user.bmw.engine || '';
    }

    // Логаут
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            window.location.href = 'forum.html';
        }
    });

    // Сохранение профиля
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        const updatedData = {
            bmw_chassis: document.getElementById('p-chassis').value,
            bmw_model: document.getElementById('p-model').value,
            bmw_engine: document.getElementById('p-engine').value,
            avatar_url: document.getElementById('p-avatar-url').value,
            locale: document.getElementById('p-lang').value
        };

        try {
            // Получаем токен из localStorage
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                throw new Error('Session expired. Please login again.');
            }

            const res = await fetch('/api/user/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            });

            const result = await res.json();
            
            if (!res.ok) {
                throw new Error(result.error || 'Failed to update profile');
            }

            if (result.success) {
                // Обновляем локальное хранилище
                const newUser = { ...user, ...result.user };
                
                // Восстанавливаем структуру bmw объекта для фронта
                newUser.bmw = {
                    model: result.user.bmw_model,
                    chassis: result.user.bmw_chassis,
                    engine: result.user.bmw_engine
                };
                
                localStorage.setItem('user', JSON.stringify(newUser));
                localStorage.setItem('forumLanguage', updatedData.locale);
                
                alert('✓ Profile updated successfully!');
                window.location.reload();
            } else {
                throw new Error(result.error || 'Unknown error occurred');
            }
        } catch (err) {
            alert('Error: ' + err.message);
            console.error(err);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
});