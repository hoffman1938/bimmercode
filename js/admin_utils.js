// js/admin_utils.js - Shared Admin Utilities

// Make functions global for inline onclick handlers
window.adminUtils = {
    getAvatar: (url) => {
        if (url && url.startsWith('http')) return url;
        // Return a generated SVG data URI for a default avatar if none exists
        // Simple gray circle with user icon
        return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ccc'><circle cx='50' cy='50' r='50' fill='%23333'/><path d='M50 25a15 15 0 100 30 15 15 0 000-30zm-25 55c0-13.8 11.2-25 25-25s25 11.2 25 25H25z' fill='%23fff'/></svg>`;
    }
};

// Expose other module functions to window if they are needed by HTML
// We will assign them in their respective modules
