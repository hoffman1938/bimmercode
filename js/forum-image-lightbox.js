// Fullscreen image gallery: zoom via pixel size (not transform on wrapper — fixes huge empty stage),
// wheel / +/-, prev/next, thumbnails.
// Exposes: window.openForumImageLightbox(urls, startIndex)
(function () {
  "use strict";

  var urls = [];
  var index = 0;
  /** User zoom factor on top of “fit to stage” (1 = fit) */
  var userZoom = 1;
  var ZOOM_MIN = 0.25;
  var ZOOM_MAX = 4;

  var root, imgEl, stage, counter, thumbs, zoomPct, pan, built;

  function $id(i) {
    return document.getElementById(i);
  }

  function buildDom() {
    if (built) return;
    if ($id("forum-image-lightbox")) {
      root = $id("forum-image-lightbox");
    } else {
      root = document.createElement("div");
      root.id = "forum-image-lightbox";
      root.className = "forum-image-lb";
      root.setAttribute("hidden", "");
      root.innerHTML = [
        '<div class="forum-image-lb__backdrop" data-lb-close tabindex="-1"></div>',
        '<div class="forum-image-lb__dialog" role="dialog" aria-modal="true" aria-label="Image">',
        '  <div class="forum-image-lb__top">',
        '    <span class="forum-image-lb__counter" id="forum-lb-counter">1 / 1</span>',
        '    <div class="forum-image-lb__zoom-ctl" aria-label="Zoom">',
        '      <button type="button" class="btn btn-ghost btn-sm" id="forum-lb-zoom-out" title="Zoom out" aria-label="Zoom out">−</button>',
        '      <span class="forum-image-lb__zoom-pct" id="forum-lb-zoom-pct">100%</span>',
        '      <button type="button" class="btn btn-ghost btn-sm" id="forum-lb-zoom-in" title="Zoom in" aria-label="Zoom in">+</button>',
        '      <button type="button" class="btn btn-ghost btn-sm" id="forum-lb-fit" title="Fit" aria-label="Fit to screen">Fit</button>',
        "    </div>",
        '    <button type="button" class="forum-image-lb__close" id="forum-lb-close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>',
        "  </div>",
        '  <button type="button" class="forum-image-lb__nav forum-image-lb__nav--prev" id="forum-lb-prev" aria-label="Previous image"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>',
        '  <button type="button" class="forum-image-lb__nav forum-image-lb__nav--next" id="forum-lb-next" aria-label="Next image"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>',
        '  <div class="forum-image-lb__stage" id="forum-lb-stage">',
        '    <div class="forum-image-lb__pan" id="forum-lb-pan">',
        '      <img id="forum-lb-img" class="forum-image-lb__img" alt="" />',
        "    </div>",
        "  </div>",
        '  <div class="forum-image-lb__thumbs" id="forum-lb-thumbs"></div>',
        "</div>",
      ].join("");
      document.body.appendChild(root);
    }

    imgEl = $id("forum-lb-img");
    stage = $id("forum-lb-stage");
    pan = $id("forum-lb-pan");
    counter = $id("forum-lb-counter");
    thumbs = $id("forum-lb-thumbs");
    zoomPct = $id("forum-lb-zoom-pct");

    $id("forum-lb-close").addEventListener("click", close);
    root.querySelector(".forum-image-lb__backdrop").addEventListener("click", close);
    $id("forum-lb-prev").addEventListener("click", function () { go(-1); });
    $id("forum-lb-next").addEventListener("click", function () { go(1); });
    $id("forum-lb-zoom-in").addEventListener("click", function () { zoomBy(1.2); });
    $id("forum-lb-zoom-out").addEventListener("click", function () { zoomBy(1 / 1.2); });
    $id("forum-lb-fit").addEventListener("click", fitToStage);

    if (!thumbs.dataset.lbDelegate) {
      thumbs.dataset.lbDelegate = "1";
      thumbs.addEventListener("click", function (ev) {
        var b = ev.target.closest("button[data-lb-idx]");
        if (!b) return;
        var i = parseInt(b.getAttribute("data-lb-idx"), 10);
        if (i === index || isNaN(i)) return;
        index = i;
        showCurrent();
      });
    }

    stage.addEventListener(
      "wheel",
      function (e) {
        if (root && root.hidden) return;
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
      },
      { passive: false }
    );

    document.addEventListener("keydown", onKey);
    built = true;
  }

  function onKey(e) {
    if (!root || root.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  }

  function close() {
    if (!root) return;
    root.hidden = true;
    document.body.classList.remove("forum-lb-open");
    if (imgEl) {
      imgEl.removeAttribute("src");
      imgEl.style.width = "";
      imgEl.style.height = "";
    }
  }

  function go(delta) {
    if (!urls.length) return;
    index = (index + delta + urls.length) % urls.length;
    showCurrent();
  }

  /**
   * Size image in CSS pixels to fit in stage, then apply userZoom.
   * Avoids transform:scale on .pan (transform does not shrink layout box — caused giant empty stage).
   */
  function applyImageLayout() {
    if (!imgEl || !stage) return;
    if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;

    var pad = 24;
    var aw = stage.clientWidth - pad;
    var ah = stage.clientHeight - pad;
    if (aw < 40) aw = 40;
    if (ah < 40) ah = 40;

    var iw = imgEl.naturalWidth;
    var ih = imgEl.naturalHeight;
    var fit = Math.min(aw / iw, ah / ih, 1);
    var uz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, userZoom));
    var tw = Math.max(1, Math.round(iw * fit * uz));
    var th = Math.max(1, Math.round(ih * fit * uz));

    imgEl.style.width = tw + "px";
    imgEl.style.height = th + "px";
    if (pan) {
      pan.style.transform = "none";
    }
    if (zoomPct) zoomPct.textContent = Math.round(uz * 100) + "%";
  }

  function fitToStage() {
    userZoom = 1;
    if (stage) {
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }
    requestAnimationFrame(applyImageLayout);
  }

  function zoomBy(factor) {
    userZoom *= factor;
    userZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, userZoom));
    applyImageLayout();
  }

  function onResize() {
    if (root && !root.hidden) applyImageLayout();
  }
  if (typeof window !== "undefined" && !window._forumLbResize) {
    window._forumLbResize = true;
    window.addEventListener("resize", onResize);
  }

  function showCurrent() {
    if (!imgEl) return;
    userZoom = 1;
    if (pan) pan.style.transform = "none";
    if (stage) {
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }
    if (counter) counter.textContent = urls.length > 0 ? index + 1 + " / " + urls.length : "0 / 0";

    var prevB = $id("forum-lb-prev");
    var nextB = $id("forum-lb-next");
    if (prevB) prevB.style.display = urls.length > 1 ? "flex" : "none";
    if (nextB) nextB.style.display = urls.length > 1 ? "flex" : "none";

    if (thumbs && urls.length) {
      thumbs.innerHTML = urls
        .map(function (u, i) {
          var active = i === index ? " is-active" : "";
          return (
            '<button type="button" class="forum-image-lb__thumb' +
            active +
            '" data-lb-idx="' +
            i +
            '">' +
            '<img src="' +
            u.replace(/"/g, "&quot;") +
            '" alt="" loading="lazy" /></button>'
          );
        })
        .join("");
    }

    var nextUrl = urls[index] || "";
    imgEl.style.width = "";
    imgEl.style.height = "";
    imgEl.onload = function () {
      userZoom = 1;
      requestAnimationFrame(function () {
        requestAnimationFrame(applyImageLayout);
      });
    };
    imgEl.onerror = function () {
      if (zoomPct) zoomPct.textContent = "—";
    };
    imgEl.src = nextUrl;
    if (imgEl.complete && imgEl.naturalWidth) {
      userZoom = 1;
      requestAnimationFrame(function () {
        requestAnimationFrame(applyImageLayout);
      });
    }
  }

  function open(u, start) {
    buildDom();
    urls = (u && u.length ? u : []).slice();
    index = Math.min(Math.max(0, +start | 0), Math.max(0, urls.length - 1));
    if (!root) return;
    root.hidden = false;
    document.body.classList.add("forum-lb-open");
    showCurrent();
  }

  window.openForumImageLightbox = function (u, i) {
    if (!u || !u.length) return;
    open(u, i);
  };
})();
