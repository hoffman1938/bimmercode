/**
 * Client-side rasterization to WebP before /api/upload — smaller R2 usage, fits 10MB limit.
 * Exposes: window.convertImageToWebP(file, options?)
 */
(function (global) {
  "use strict";

  var DEFAULT_MAX_EDGE = 2560;
  var DEFAULT_QUALITY = 0.82;
  var SERVER_MAX = 10 * 1024 * 1024;

  function baseName(name) {
    var n = String(name || "image");
    return n.replace(/\.[^/.]+$/, "") || "image";
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || !file.type.startsWith("image/")) {
        reject(new Error("not_image"));
        return;
      }
      if (file.type === "image/svg+xml") {
        reject(new Error("svg_not_supported"));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.onload = function () {
        resolve({ img: img, url: url });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("load_failed"));
      };
      img.src = url;
    });
  }

  function renderToWebpBlob(img, maxEdge, quality) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return Promise.reject(new Error("bad_dimensions"));
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("no_canvas"));
    ctx.drawImage(img, 0, 0, cw, ch);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("webp_encode_failed"));
        },
        "image/webp",
        quality
      );
    });
  }

  /**
   * @param {File|Blob} file
   * @param {{ maxLongEdge?: number, quality?: number, maxBytes?: number }} [options]
   * @returns {Promise<File>}
   */
  function convertImageToWebP(file, options) {
    options = options || {};
    var maxEdgeO = options.maxLongEdge != null ? options.maxLongEdge : DEFAULT_MAX_EDGE;
    var qualityO = options.quality != null ? options.quality : DEFAULT_QUALITY;
    var maxBytes = options.maxBytes != null ? options.maxBytes : SERVER_MAX - 2048;

    return loadImageFromFile(file).then(function (ref) {
      var img = ref.img;
      var url = ref.url;
      var edge = maxEdgeO;
      var q = qualityO;

      function step(attempt) {
        return renderToWebpBlob(img, edge, q).then(function (blob) {
          if (blob.size <= maxBytes || edge <= 400) {
            URL.revokeObjectURL(url);
            return new File([blob], baseName(file.name) + ".webp", {
              type: "image/webp",
              lastModified: Date.now(),
            });
          }
          if (attempt >= 8) {
            URL.revokeObjectURL(url);
            throw new Error("image_too_large");
          }
          edge = Math.max(400, Math.floor(edge * 0.72));
          q = Math.max(0.42, q - 0.08);
          return step(attempt + 1);
        });
      }

      return step(0);
    });
  }

  global.convertImageToWebP = convertImageToWebP;
})(typeof window !== "undefined" ? window : globalThis);
