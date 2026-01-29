// js/auth-modal.js
// Модуль для управления авторизацией и регистрацией в форуме

window.toggleAuthModal = function() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    
    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
        modal.classList.remove('hidden');
        showAuthTab('login'); // По умолчанию показываем вкладку входа
    } else {
        modal.classList.add('hidden');
    }
};

window.showAuthTab = function(tab) {
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');
    const loginTab = document.getElementById('auth-tab-login');
    const registerTab = document.getElementById('auth-tab-register');
    
    if (tab === 'login') {
        if (loginForm) loginForm.style.display = 'flex';
        if (registerForm) registerForm.style.display = 'none';
        if (loginTab) loginTab.classList.add('active');
        if (registerTab) registerTab.classList.remove('active');
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'flex';
        if (loginTab) loginTab.classList.remove('active');
        if (registerTab) registerTab.classList.add('active');
    }
};

// === ВХОД (LOGIN) ===
window.handleForumLogin = async function(e) {
    if (e) e.preventDefault();
    
    const emailInput = document.getElementById('auth-login-email');
    const passwordInput = document.getElementById('auth-login-password');
    const btn = document.getElementById('auth-login-btn');
    
    if (!emailInput || !passwordInput) return;
    
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Logging in...';
    }
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        // ✓ Сохраняем токен и юзера
        if (data.token) {
            localStorage.setItem('authToken', data.token);
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        window.state.user = data.user;
        
        console.log('✓ User logged in:', data.user.username);
        
        // Закрываем модалку и перезагружаем
        window.toggleAuthModal();
        setTimeout(() => {
            window.location.reload();
        }, 300);
        
    } catch (e) {
        alert('Error: ' + e.message);
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Sign In';
        }
    }
};

// === РЕГИСТРАЦИЯ (REGISTER) ===
window.handleForumRegister = async function(e) {
    if (e) e.preventDefault();
    
    const emailInput = document.getElementById('auth-register-email');
    const usernameInput = document.getElementById('auth-register-username');
    const passwordInput = document.getElementById('auth-register-password');
    const password2Input = document.getElementById('auth-register-password2');
    const btn = document.getElementById('auth-register-btn');
    
    if (!emailInput || !usernameInput || !passwordInput || !password2Input) return;
    
    const email = emailInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const password2 = password2Input.value.trim();
    
    // Валидация
    if (!email || !username || !password || !password2) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
    }
    
    if (password !== password2) {
        alert('Passwords do not match');
        return;
    }
    
    if (username.length < 3) {
        alert('Username must be at least 3 characters');
        return;
    }
    
    if (!/^[a-z0-9._-]+$/i.test(username)) {
        alert('Username can only contain letters, numbers, dots, hyphens, and underscores');
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Creating account...';
    }
    
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password, language: 'en' })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        alert('✓ Account created! Now logging in...');
        
        // Автоматически логинимся
        setTimeout(() => {
            window.handleForumLogin({ preventDefault: () => {} });
        }, 1000);
        
    } catch (e) {
        alert('Error: ' + e.message);
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Create Account';
        }
    }
};