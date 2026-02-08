// js/footer.js
document.addEventListener('DOMContentLoaded', async () => {
    const footer = document.querySelector('footer');
    if (!footer) return;

    // Default text
    let footerText = "© 2026 BimmerCodes. All rights reserved.";

    // Try to fetch from settings if available (optional enhancement)
    // For now, we use a static dynamic rendering to ensure consistency
    
    footer.innerHTML = `
      <div class="footer-content" style="max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; padding: 20px;">
        <div class="footer-left">
            <p id="footer-copyright" style="margin: 0; color: #aaa;">${footerText}</p>
            <p style="font-size: 0.8em; color: #666; margin: 5px 0 0 0;">Not affiliated with BMW AG.</p>
        </div>
        <div class="footer-links" style="display: flex; gap: 20px;">
             <a href="terms.html" style="color: var(--text-muted, #aaa); text-decoration: none; font-size: 0.9em;">Terms</a>
             <a href="privacy.html" style="color: var(--text-muted, #aaa); text-decoration: none; font-size: 0.9em;">Privacy</a>
             <a href="contact.html" style="color: var(--text-muted, #aaa); text-decoration: none; font-size: 0.9em;">Contact</a>
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
});
