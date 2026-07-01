# Credits & Open-Source Acknowledgments

This tool was built by hand as a single-file browser application, then refactored into
a multi-file structure (`index.html` / `css/` / `js/` / `lib/`). Several ideas, algorithms,
and libraries informed or were directly adapted into the codebase. All sources are
credited below with their original licenses and the specific way each was used.

---

## Liquid Glass effect

**Source:** [naughtyduk/liquidGL](https://github.com/naughtyduk/liquidGL)  
**Author:** naughtyduk  
**License:** MIT

### What it does

`liquidGL` is a WebGL-based library that renders a real-time refraction lens over DOM
elements by snapshotting the page with `html2canvas` and applying a GPU displacement
shader. It also provides tilt-on-hover and bevel highlight effects.

### How it was used in this project

The physical optics model from liquidGL — Snell's Law refraction (n₁ = 1.0 air,
n₂ = 1.5 glass) mapped across a squircle convex surface profile
`h(x) = (1 − (1 − x)⁴)^0.25` — was studied and re-implemented from scratch as a
pure SVG filter pipeline in `js/liquid-glass.js`.

**The implementation in this project is entirely original code** and does not copy or
bundle any part of the liquidGL source. The algorithm produces a Snell's Law
displacement map on a 2D HTML Canvas, encodes it as a data URL, and pipes it through
an SVG `<feImage>` → `<feDisplacementMap>` filter applied only to a background surface
layer (`.tile-surface`), keeping text and overlay elements in separate layers that are
never filtered — fixing a common artifact where the lens distortion bleeds onto text.

Key differences from the original library:

| | liquidGL | This project |
|---|---|---|
| Rendering | WebGL + page snapshot | SVG `feDisplacementMap` |
| Scope | Full-page DOM elements | Per-tile background layer only |
| Text | Subject to refraction (artifact) | Isolated — never filtered |
| Caching | Per render | Aspect-ratio-bucketed raster cache |
| Drag/resize cost | Full raster regen every mousemove | rAF-batched, 0 regen during drag |
| Tilt effect | CSS 3D on hover | Optional per-tile |

---

## PPTX export

**Source:** [atharva9167j/dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx)  
**Author:** atharva9167j  
**License:** MIT

### What it does

`dom-to-pptx` converts a DOM element to a PowerPoint file by reading its computed
CSS styles and building native PPTX shapes (rounded rectangles, text boxes, fills,
borders). Unlike `html2canvas`-based approaches it does **not** rasterize — the
output is a real `.pptx` where every text run stays editable in PowerPoint, Keynote,
and Google Slides.

### How it was used in this project

The pre-built browser bundle (`dom-to-pptx.bundle.js`) is included locally under
`lib/` and loaded as a script tag. No modifications were made to the library itself.

At export time, `exportToPptx('#slide-canvas', { width, height, skipDownload: false })`
is called with the physical slide dimensions (in inches) derived from the current ratio
setting. The library traverses the slide canvas DOM, reads `border-radius`,
`background`, `color`, and `font-*` computed styles, and maps them to native PPTX
`<p:sp>` shape XML.

This is the **primary** PPTX export path. The legacy shape-by-shape reconstruction
using `pptxgenjs` is retained as a silent fallback in case `dom-to-pptx` is
unavailable.

---

## Supporting libraries

The following libraries are loaded via CDN at runtime and are not bundled in this repo:

### html2canvas
Used internally by `dom-to-pptx` for rasterizing elements that cannot be expressed
as native PPTX shapes (e.g. SVG filters).  
**Repo:** [niklasvh/html2canvas](https://github.com/niklasvh/html2canvas)  
**License:** MIT

### jsPDF
Used for PDF export (`exportPDF()`). The slide canvas is rasterized via
`html2canvas` and embedded as an image in a jsPDF document sized to the current
physical page dimensions.  
**Repo:** [parallax/jsPDF](https://github.com/parallax/jsPDF)  
**License:** MIT

### PptxGenJS
Fallback PPTX export library. Used only if `dom-to-pptx` fails. Reconstructs each
tile as a `roundRect` shape with fill, line, and `addText` calls — a shape-by-shape
approximation rather than a DOM-faithful conversion.  
**Repo:** [gitbrent/PptxGenJS](https://github.com/gitbrent/PptxGenJS)  
**License:** MIT

---

## Note on adaptation vs. copying

All code in `js/liquid-glass.js` and `js/app.js` was written manually for this
project. Where external algorithms (Snell's Law table construction, squircle profile
derivative) informed the implementation, the corresponding source was linked above.
No source files from any of the above repositories were copied verbatim into this
codebase, with the exception of `lib/dom-to-pptx.bundle.js`, which is the library's
own official production build included under its MIT license.
