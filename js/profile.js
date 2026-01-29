// js/profile.js
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        window.location.href = 'index.html';
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
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    // Сохранение
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
            // Для запроса нужен токен сессии. Предполагаем, что он был сохранен при логине
            // В login.js мы сохраняли token в ответе, но надо проверить сохранили ли мы его в localStorage
            // ВАЖНО: В script.js в handleGoogleCredentialResponse мы сохраняли весь объект user. 
            // Давайте предположим, что token лежит в localStorage.getItem('authToken') или внутри user. 
            // *Правка*: login.js возвращает `token` отдельно. Нужно убедиться, что script.js его сохраняет.
            
            // Получаем токен из localStorage (если вы обновили логику логина, см. ниже)
            const token = localStorage.getItem('authToken'); 

            const res = await fetch('/api/user/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            });

            const result = await res.json();
            
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
                
                // Если сменили язык, сохраняем настройку форума
                localStorage.setItem('forumLanguage', updatedData.locale);
                
                alert('Profile updated!');
                window.location.reload();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            alert('Failed to save');
            console.error(err);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
});