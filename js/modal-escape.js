/**
 * Close the topmost overlay on Escape — same intent as the modal × buttons.
 * Works with auth, recovery, code detail, new topic, custom alerts, admin modals, etc.
 */
(function () {
  "use strict";

  function getZIndex(el) {
    if (!el) return 0;
    const z = parseInt(getComputedStyle(el).zIndex, 10);
    if (!isNaN(z) && getComputedStyle(el).zIndex !== "auto") return z;
    let p = el;
    for (let i = 0; i < 8 && p; i++) {
      const zi = parseInt(getComputedStyle(p).zIndex, 10);
      if (!isNaN(zi)) return zi;
      p = p.parentElement;
    }
    return 0;
  }

  function collectOpenLayers() {
    const out = [];
    const push = function (el) {
      if (el && out.indexOf(el) < 0) out.push(el);
    };

    document.querySelectorAll(".custom-alert-overlay").forEach((el) => {
      if (el.classList.contains("active")) push(el);
    });

    const ids = [
      "notif-modal",
      "report-modal",
      "recovery-modal",
      "auth-modal",
      "code-detail-modal",
      "new-topic-modal",
      "edit-profile-modal",
      "profile-modal",
      "favorites-modal",
      "inspector-modal",
      "role-modal",
      "action-modal",
      "category-modal",
      "report-details-modal",
    ];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (el && el.classList.contains("active")) push(el);
    });

    document.querySelectorAll(".mobile-offcanvas.active").forEach(push);

    const aiLimitModal = document.getElementById("bc-ai-limit-modal");
    if (aiLimitModal && aiLimitModal.classList.contains("is-visible")) push(aiLimitModal);

    return out;
  }

  function selectTop(layers) {
    if (layers.length <= 1) return layers[0] || null;
    return layers.slice().sort(function (a, b) {
      const zd = getZIndex(b) - getZIndex(a);
      if (zd !== 0) return zd;
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return 1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return -1;
      return 0;
    })[0];
  }

  function closeLayer(el) {
    if (!el) return false;

    if (el.classList.contains("custom-alert-overlay")) {
      if (typeof window.closeCustomModal === "function") {
        window.closeCustomModal();
        return true;
      }
      el.classList.remove("active");
      return true;
    }

    if (el.classList.contains("mobile-offcanvas")) {
      if (typeof window.toggleMobileMenu === "function") {
        window.toggleMobileMenu();
        return true;
      }
      el.classList.remove("active");
      return true;
    }

    var id = el.id;
    if (id === "notif-modal" && typeof window.closeNotifModal === "function") {
      window.closeNotifModal();
      return true;
    }
    if (id === "report-modal") {
      if (typeof window.closeReportModal === "function") {
        window.closeReportModal();
        return true;
      }
      el.classList.remove("active");
      return true;
    }
    if (id === "recovery-modal" && typeof window.closeRecoveryModal === "function") {
      window.closeRecoveryModal();
      return true;
    }
    if (id === "auth-modal") {
      el.classList.remove("active");
      return true;
    }
    if (id === "code-detail-modal" && typeof window.hideDetail === "function") {
      window.hideDetail();
      return true;
    }
    if (id === "new-topic-modal" && typeof window.closeModal === "function") {
      window.closeModal("new-topic-modal");
      return true;
    }
    if (id === "edit-profile-modal" && typeof window.closeEditProfileModal === "function") {
      window.closeEditProfileModal();
      return true;
    }
    if (id === "profile-modal") {
      el.classList.remove("active");
      return true;
    }
    if (id === "bc-ai-limit-modal") {
      if (typeof window.hideBcAiLimitModal === "function") {
        window.hideBcAiLimitModal();
        return true;
      }
      el.classList.remove("is-visible");
      return true;
    }
    if (id === "favorites-modal") {
      el.classList.remove("active");
      return true;
    }
    if (id === "inspector-modal" && typeof closeInspectorModal === "function") {
      closeInspectorModal();
      return true;
    }
    if (id === "role-modal" && typeof closeRoleModal === "function") {
      closeRoleModal();
      return true;
    }
    if (id === "action-modal" && typeof closeActionModal === "function") {
      closeActionModal();
      return true;
    }
    if (id === "category-modal" && typeof closeCategoryModal === "function") {
      closeCategoryModal();
      return true;
    }
    if (id === "report-details-modal") {
      el.classList.remove("active");
      return true;
    }

    return false;
  }

  function tryClose() {
    if (document.fullscreenElement || document.webkitFullscreenElement) return false;

    var layers = collectOpenLayers();
    if (!layers.length) return false;
    var top = selectTop(layers);
    return closeLayer(top);
  }

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      if (!tryClose()) return;
      e.preventDefault();
    },
    false
  );
})();
