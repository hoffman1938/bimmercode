// js/footer.js
document.addEventListener('DOMContentLoaded', async () => {
    const footer = document.querySelector('footer');
    if (!footer) return;

    // Default text
    let footerText = "© 2026 BimmerCodes. All rights reserved.";

    // Try to fetch from settings if available (optional enhancement)
    // For now, we use a static dynamic rendering to ensure consistency
    
    footer.innerHTML = `
      <div class="footer-container">
        <div class="footer-left">
            <p id="footer-copyright" class="footer-text">${footerText}</p>
            <p class="footer-subtext">Not affiliated with BMW AG.</p>
        </div>
        <div class="footer-links">
             <a href="terms.html">Terms</a>
             <a href="privacy.html">Privacy</a>
             <a href="contact.html">Contact</a>
        </div>
      </div>
    `;

    // Analytics Tracking
    const trackPageView = async () => {
        try {
            const userData = localStorage.getItem('user_data');
            const user = userData ? JSON.parse(userData) : null;
            
            await fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user ? user.id : null,
                    event_type: 'page_view',
                    path: window.location.pathname,
                    referrer: document.referrer,
                    user_agent: navigator.userAgent,
                    device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
                })
            });
        } catch (e) {
            console.error("Tracking Error:", e); // Silent fail in prod usually
        }
    };
    
    trackPageView();

    // AI assistant (all pages with footer)
    if (!window.__bcAiChatLoader) {
        const loader = document.createElement('script');
        loader.src = '/js/ai-chat-loader.js?v=4';
        loader.defer = true;
        loader.setAttribute('data-cfasync', 'false');
        document.body.appendChild(loader);
    }
});
