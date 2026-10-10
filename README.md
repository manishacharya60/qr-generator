# QR Generator

Create QR codes for papers, projects, websites, and other links, with custom colors and icons.

**Use the hosted browser app: [qr.acharyamanish.net](https://qr.acharyamanish.net).** It is free to use and requires no account, installation, or local server. Clone this repository only if you want to run or modify your own copy.

## How to use

1. Enter a complete URL beginning with `https://` or `http://`.
2. Choose a built-in icon, upload your own image, or select No Icon.
3. Adjust the QR color and icon size.
4. Download a PNG or SVG. For PNG, choose your preferred resolution.

Scan the downloaded QR code before sharing or printing it. Dark colors and smaller icons generally make codes easier to scan. QR codes do not expire, but the linked page must remain available.

## Run locally

Install Node.js 22 and Git, then clone the public repository and start the development server:

```sh
git clone https://github.com/manishacharya60/qr-generator.git
cd qr-generator
npm ci
npm run dev
```

Open **http://localhost:5173**. If you already have the source, start with `npm ci` in the project directory.

To build and preview the production version locally:

```sh
npm run build
npm run preview
```

Open **http://localhost:4173**. The server listens on your local network, so you can open `http://YOUR_COMPUTER_LAN_IP:4173` on a phone connected to the same Wi-Fi. If the OS asks, allow local network access. The production files are generated in `dist/` and can be served by a static host.

## Features

- Live QR preview with high error correction.
- Built-in Paper/PDF, Video, Slides, Website, Code/GitHub, Dataset, and No Icon choices.
- Custom PNG, JPEG, WebP, and simple SVG icons, with adjustable size.
- QR color picker and editable hex color. Built-in icons match the QR color; custom images retain their colors.
- PNG downloads at 512, 1024, or 2048 pixels.
- SVG downloads with vector QR modules and an embedded icon.
- Works on desktop and mobile browsers.

## Privacy and uploads

QR generation and image processing happen entirely in your browser. The app does not upload your links or images, store them, or require a backend.

Custom images must be no larger than 2 MiB, 8192 pixels per side, and 16 megapixels. Use simple SVGs made from shapes and paths; SVGs containing scripts, external resources, text, filters, or other unsupported content are rejected.

## Credits

QR generation uses [qrcode.react](https://github.com/zpao/qrcode.react), which includes Project Nayuki's QR encoder.

The Paper/PDF icon is [created by Those Icons — Flaticon](https://www.flaticon.com/free-icon/pdf_482216) and used under the [Flaticon attribution license](https://www.flaticon.com/media/license/license.pdf). Retain the creator credit when sharing exported artwork that uses this icon.
