/* ============================================================
   liquid-glass.js
   ------------------------------------------------------------
   Self-contained "Liquid Glass" surface effect for slide tiles.

   Builds an SVG feDisplacementMap lens that simulates light
   bending through a convex squircle edge (Snell's Law, n=1.5),
   exactly as the original implementation did. Two fixes versus
   the original inline version:

   1. SHAPE-ONLY SCOPE (correctness fix)
      ensure() only ever returns a filter id meant to be applied
      to a dedicated, content-free ".tile-surface" background
      layer. It must never be applied to an element that also
      contains text/icons — the old bug applied the filter to the
      whole tile, so headline text got blurred and double-edged
      by the same distortion meant for the glass background.

   2. ASPECT-BUCKETED CACHE (performance fix)
      The displacement map only encodes the *shape* of the lens
      (Snell's-law refraction across a squircle bezel), which
      depends only on the tile's aspect ratio and bezel width —
      never on its absolute pixel size. The original code
      regenerated a full W×H canvas raster (with a 128-sample
      Snell's-law table evaluated per pixel) on *every single
      drag/resize mousemove event*, which is why dragging or
      resizing a Liquid Glass tile felt janky. This version:
        - renders the raster at a small fixed resolution
          (independent of the tile's actual on-screen size)
        - keys a cache by the tile's *rounded* aspect ratio, so
          many tiles/resizes reuse the same generated map
      The actual blur radius and refraction strength still use
      the tile's real current width/height — only the shape
      raster itself is cached/bucketed.
   ============================================================ */

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const MAP_RESOLUTION = 160;  // px — fixed raster budget, independent of tile size
  const ASPECT_BUCKET = 0.05;  // round aspect ratio to nearest 5% for cache reuse
  const SNELL_SAMPLES = 128;

  const mapCache = new Map(); // key: "WxH@bezelFrac" -> displacement map data URL

  /* --------------------------------------------------------
   * Build (or fetch cached) displacement map for a given
   * aspect ratio + bezel width. Encodes Snell's Law refraction
   * (n1=1 air, n2=1.5 glass) across a squircle profile
   * y = (1-(1-x)^4)^0.25, same physical model as the original.
   * -------------------------------------------------------- */
  function buildDisplacementMap(aspect, bezelFrac) {
    let W, H;
    if (aspect >= 1) {
      W = MAP_RESOLUTION;
      H = Math.max(8, Math.round(MAP_RESOLUTION / aspect));
    } else {
      H = MAP_RESOLUTION;
      W = Math.max(8, Math.round(MAP_RESOLUTION * aspect));
    }
    const key = `${W}x${H}@${bezelFrac}`;
    const cached = mapCache.get(key);
    if (cached) return cached;

    const oc = document.createElement("canvas");
    oc.width = W;
    oc.height = H;
    const ctx = oc.getContext("2d");
    const id = ctx.createImageData(W, H);
    const d = id.data;

    const n1 = 1.0, n2 = 1.5, ratio = n1 / n2;
    const mag = new Float32Array(SNELL_SAMPLES);
    let maxMag = 0;
    for (let i = 0; i < SNELL_SAMPLES; i++) {
      const t = i / (SNELL_SAMPLES - 1);
      const dy2 = 0.001;
      const h1 = Math.pow(1 - Math.pow(1 - Math.max(0, t - dy2), 4), 0.25);
      const h2 = Math.pow(1 - Math.pow(1 - Math.min(1, t + dy2), 4), 0.25);
      const deriv = (h2 - h1) / (2 * dy2);
      const nx = -deriv, ny = 1, nL = Math.sqrt(nx * nx + ny * ny);
      const cosI = Math.abs(ny / nL);
      const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
      const sinT = ratio * sinI;
      if (sinT >= 1) { mag[i] = 0; continue; }
      mag[i] = Math.abs(sinT - sinI);
      if (mag[i] > maxMag) maxMag = mag[i];
    }
    if (maxMag === 0) maxMag = 1;

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const dx = ((px + 0.5) / W) * 2 - 1;
        const dy = ((py + 0.5) / H) * 2 - 1;
        const edgeDist = 1 - Math.max(Math.abs(dx), Math.abs(dy));
        let rv = 128, gv = 128;
        if (edgeDist >= 0 && edgeDist <= bezelFrac) {
          const t = 1 - edgeDist / bezelFrac;
          // NOTE: the squircle profile h(x)=(1-(1-x)^4)^0.25 has a
          // *vertical* tangent at x=0 and a *flat* tangent at x=1 (see
          // mag[] construction above). t=0 here means "just inside the
          // bezel, bordering the flat undisplaced interior" — that
          // boundary needs the FLAT end of the table (index near
          // SNELL_SAMPLES-1) so displacement eases to ~0 and matches
          // the interior's hardcoded zero, instead of jumping straight
          // to peak magnitude. t=1 (the tile's outer edge) gets the
          // steep end, which is also the physically correct place for
          // the strongest bend in a real bezel.
          const si = Math.min(SNELL_SAMPLES - 1, Math.round((1 - t) * (SNELL_SAMPLES - 1)));
          const m = mag[si] / maxMag;
          const len = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));
          const dirX = -dx / len, dirY = -dy / len;
          rv = Math.round(128 + m * 127 * dirX);
          gv = Math.round(128 + m * 127 * dirY);
        }
        const idx = (py * W + px) * 4;
        d[idx] = Math.max(0, Math.min(255, rv));
        d[idx + 1] = Math.max(0, Math.min(255, gv));
        d[idx + 2] = 128;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    const url = oc.toDataURL("image/png");
    mapCache.set(key, url);
    return url;
  }

  function quantizedAspect(w, h) {
    const raw = w / Math.max(1, h);
    return Math.max(0.1, Math.round(raw / ASPECT_BUCKET) * ASPECT_BUCKET);
  }

  /* --------------------------------------------------------
   * ensure(tileId, w, h, opts) — create/update the <filter>
   * for a tile and return its id (e.g. "lgf-3"). Apply the
   * result ONLY to a content-free surface layer:
   *   surfaceEl.style.filter = `url(#${id})`
   * opts: { lgScale, glassBlur, bezelFrac }
   *
   * NOTE on primitiveUnits: this used to be "objectBoundingBox"
   * for both the filter region AND its primitives (blur/displace),
   * matching the original implementation. That second part is a
   * known cross-browser trouble spot — feGaussianBlur/feDisplacementMap
   * with primitiveUnits=objectBoundingBox on a non-square box can
   * render as a hard rectangular block instead of a smooth lens,
   * because browsers don't consistently resolve fractional
   * stdDeviation/scale into independent x/y pixel amounts. We now
   * only use objectBoundingBox for the outer filter REGION (which
   * is fine/well-supported) and switch the primitives themselves to
   * userSpaceOnUse with real pixel values — the standards-recommended
   * way to avoid this. The raster shape map is still cached by
   * (bucketed) aspect ratio since its geometry is resolution-independent.
   * -------------------------------------------------------- */
  function ensure(tileId, w, h, opts = {}) {
    const defsEl = document.getElementById("lg-defs");
    if (!defsEl) return null;

    const fid = "lgf-" + tileId;
    const bezelFrac = opts.bezelFrac ?? 0.28;
    const aspect = quantizedAspect(w, h);
    const mapUrl = buildDisplacementMap(aspect, bezelFrac);

    let fEl = document.getElementById(fid);
    if (!fEl) {
      fEl = document.createElementNS(SVG_NS, "filter");
      fEl.id = fid;
      fEl.setAttribute("color-interpolation-filters", "sRGB");
      fEl.setAttribute("filterUnits", "objectBoundingBox");
      defsEl.appendChild(fEl);
    }
    // Generous margin around the box so blur/displacement sampling
    // near the edges isn't truncated by the filter region itself.
    fEl.setAttribute("x", "-15%");
    fEl.setAttribute("y", "-15%");
    fEl.setAttribute("width", "130%");
    fEl.setAttribute("height", "130%");

    const W = Math.max(1, w), H = Math.max(1, h);
    const blur = opts.glassBlur || 8;
    // "Refraction" slider is intended as a literal pixel bend strength.
    const dispPx = opts.lgScale || 60;

    fEl.innerHTML = `
      <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blurred"/>
      <feImage href="${mapUrl}" x="0" y="0" width="${W}" height="${H}" result="dmap" preserveAspectRatio="none"/>
      <feDisplacementMap in="blurred" in2="dmap" scale="${dispPx}" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feComposite in="displaced" in2="SourceGraphic" operator="in"/>`;

    return fid;
  }

  function remove(tileId) {
    document.getElementById("lgf-" + tileId)?.remove();
  }

  function clearAll() {
    const defsEl = document.getElementById("lg-defs");
    if (defsEl) defsEl.innerHTML = "";
  }

  window.LiquidGlass = { ensure, remove, clearAll, buildDisplacementMap, quantizedAspect };
})();
