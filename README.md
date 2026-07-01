# Slide Layout Builder

A browser-native bento-grid slide builder with Liquid Glass tile effects, multi-format export, and physical page sizing. No server, no build step — open `index.html` and it runs.

**Live demo:** `https://YOUR-USERNAME.github.io/slide-layout-builder/`

---

## Features

- Drag-and-drop grid layout with snap-to-grid and multi-pitch resize
- Four tile style modes: Opaque, Glass, Tinted, Liquid Glass
- Liquid Glass — SVG `feDisplacementMap` lens using Snell's Law refraction (n = 1.5) across a squircle bezel profile
- Physical page sizes: 16:9 / 4:3 / 1:1, ISO A3 / A4 / A5, US Letter / Legal / Ledger, custom px / mm / in
- Export: HTML (self-contained), SVG, PNG, JPEG, WebP, PDF, PPTX
- PPTX export via [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) — produces editable native PowerPoint shapes and real text, not a flattened image
- Fully offline after first load — no CDN dependencies at runtime

---

## File structure

```
index.html                 Main application shell
css/
  styles.css               All layout and component styles
js/
  liquid-glass.js          Liquid Glass SVG filter module
  app.js                   Application logic
lib/
  dom-to-pptx.bundle.js    PPTX export library (bundled locally)
```

---

## Credits and open-source acknowledgments

See [CREDITS.md](./CREDITS.md) for full attribution of all referenced libraries and source code.

---

## License

This project is released for personal and educational use.  
Third-party libraries retain their original licenses — see [CREDITS.md](./CREDITS.md).
