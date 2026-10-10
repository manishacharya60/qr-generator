# QR Generator

A browser-only QR code tool for papers, projects, and links. Anyone can use the hosted app without an account. QR generation and image processing happen entirely on the user's device; no backend is required.

## Run locally

Install Node.js 22 and Git, then clone the public repository and start the development server:

```sh
git clone https://github.com/manishacharya60/qr-generator.git
cd qr-generator
npm ci
npm run dev
```

Open **http://localhost:5173**. If you already have the source, start with `npm ci` in the project directory. The clone URL will become available after the repository is published.

To build and preview the production version locally:

```sh
npm run build
npm run preview
```

Open **http://localhost:4173**. The server listens on your local network, so you can open `http://YOUR_COMPUTER_LAN_IP:4173` on a phone connected to the same Wi-Fi. If the OS asks, allow local network access. The production files are generated in `dist/` and can be served by a static host.

## Features

- Encodes the exact trimmed HTTP or HTTPS URL with high QR error correction. Downloads retain a four-module white quiet zone; the preview crops it to one module for a larger display.
- Built-in Paper/PDF, Video, Slides, Website, Code/GitHub, Dataset, and No Icon choices.
- QR color picker with editable six-digit hex value and reset to navy. Colors apply to the preview, both exports, and built-in icons; custom image colors are retained. Pale colors display a scan-readability hint.
- Custom PNG, JPEG, WebP, or simple SVG images; preview, replace/remove controls, and a 10–26% icon-panel size (24% by default; test scans at larger sizes).
- Uploads never leave the browser. No remote fonts, analytics, accounts, API, or persistent storage.
- Transparent uploads are preserved in their preview and composited over a white panel in the QR code. Aspect ratios are preserved.
- PNG exports at 512, 1024, or 2048 pixels. SVG exports preserve vector QR modules and embed the icon as PNG data, requiring no external resources.
- Static codes do not expire; their destination must remain available. Always scan the actual export before using it.

## Upload limits and SVG safety

Files are limited to 2 MiB, 8192 pixels per side, and 16 megapixels. Icons are resampled to at most 512 pixels on the longest side. SVGs are parsed and rebuilt from an allowlist of basic shapes, groups, and geometric/presentation attributes. Scripts, event handlers, CSS/styles, links, images, foreign HTML, text, filters, gradients, references, external resources, entities, and unsupported declarations are rejected. XML declarations are allowed. SVGs must have a valid viewBox or explicit dimensions. Complex SVGs are rejected at 3000 elements or a depth greater than 32. Rasterizing accepted SVGs gives both exports an inert, self-contained icon.

## Automated verification

`npm test` runs six core tests without a browser. Native canvas renders QR modules and separately composites embedded icon images from their SVG coordinates; these checks do not replace browser rendering or phone scanning. The Playwright suite tests actual browser interactions and exports.

```sh
npm test
npx playwright install chromium
npm run build
npm run test:browser
```

To use installed Chrome on macOS instead of downloading Chromium:

```sh
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser
```

Browser tests cover URL validation, all icons, uploads, unsafe SVG rejection, exports, and mobile overflow. On macOS, build the optional native QR decoder to verify exported PNGs and rasterized SVGs against their intended URLs:

```sh
xcrun swiftc -module-cache-path /tmp/qr-generator-swift-cache tests/decode.swift -o /tmp/qr-generator-decode
QR_DECODER=/tmp/qr-generator-decode CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser
```

## Manual review before publishing

- Check the desktop layout and narrow mobile layout, using your phone or browser device tools.
- Enter your own URLs and try all built-in icons and No Icon.
- Upload PNG, JPEG, WebP, and simple SVG; check transparent and non-square icons, preview, replacement, removal, and size adjustment.
- Try an unsupported file, a file over 2 MiB, and a complex SVG; confirm a clear error appears.
- Download PNG and SVG with built-in and custom icons. Open each exported file independently. Print or enlarge the SVG to inspect sharpness.
- Scan the actual downloads with your phone and confirm the complete intended URL opens. Test at the final intended print size. Reduce the icon size or use No Icon if a camera struggles.

GitHub pushes run checks; the GitHub Pages deployment workflow runs only when manually triggered. Source dependencies are pinned and the lockfile is included for reproducible builds. The public website requires no login or installation; cloning the repository is only necessary to run or modify your own copy.

QR engine: [qrcode.react](https://github.com/zpao/qrcode.react), which includes Project Nayuki's QR encoder. Built-in icons are defined locally in `src/icons.js`. The Paper / PDF image is the supplied `pdf.png`, embedded in `src/pdf-icon.js`: [PDF icon created by Those Icons — Flaticon](https://www.flaticon.com/free-icon/pdf_482216), used under the [Flaticon attribution license](https://www.flaticon.com/media/license/license.pdf). It is tinted to the selected QR color. Retain the creator credit when sharing exported artwork that uses this icon.
