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

    // Attempt to fetch custom text if API is accessible (public read-only endpoint would be ideal, 
    // but our settings are admin-only. We can leave it static for now or create a public config endpoint later).
});
