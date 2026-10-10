import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'qrcode.react';
import { createCanvas, Image as CanvasImage, loadImage as nativeLoad } from '@napi-rs/canvas';
import { DOMParser as XmlParser, XMLSerializer } from '@xmldom/xmldom';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { sanitizeSvg, processUpload, makeIconPanel } from '../src/uploads.js';
import { icons, svgIcon, svgData } from '../src/icons.js';
import { validUrl } from '../src/url.js';
import { isHexColor, contrastOnWhite } from '../src/colors.js';
const { QRCodeSVG } = QRCode;

test('QR colors validate, flag pale shades, and survive SVG and PNG rendering', async () => {
  assert.equal(contrastOnWhite('#000000'), 21);
  assert.equal(contrastOnWhite('#ffffff'), 1);
  assert.ok(contrastOnWhite('#172b4d') > 4.5);
  assert.ok(contrastOnWhite('#ffeecc') < 4.5);
  for (const value of ['navy', '#123', '#gg0000', '#12345678', '']) assert.equal(isHexColor(value), false);
  for (const color of ['#172b4d', '#72204d', '#14656c']) {
    assert.ok(isHexColor(color));
    assert.ok(svgIcon(icons[1].path, color).includes(`stroke="${color}"`));
    const paper = icons.find(icon => icon.id === 'paper');
    assert.equal(paper.image, 'data:image/png;base64,' + (await fs.readFile('pdf.png')).toString('base64'), 'The supplied PDF asset is used exactly');
    const panel = await nativeLoad(await makeIconPanel(paper.image, color));
    const panelCanvas = createCanvas(512, 512), panelCtx = panelCanvas.getContext('2d');
    panelCtx.drawImage(panel, 0, 0);
    const panelRgb = color.slice(1).match(/../g).map(value => parseInt(value, 16));
    assert.deepEqual([...panelCtx.getImageData(98, 256, 1, 1).data], [...panelRgb, 255], 'The PDF outline follows the selected color');
    assert.deepEqual([...panelCtx.getImageData(0, 0, 1, 1).data], [255, 255, 255, 255]);
    const svg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: 'https://example.com', size: 512, level: 'H', includeMargin: true, fgColor: color, bgColor: '#ffffff' }));
    assert.ok(svg.includes(`fill="${color}"`));
    const image = await nativeLoad(Buffer.from(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')));
    const canvas = createCanvas(512, 512), ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 512, 512).data;
    const rgb = color.slice(1).match(/../g).map(value => parseInt(value, 16));
    let matching = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === rgb[0] && pixels[i + 1] === rgb[1] && pixels[i + 2] === rgb[2] && pixels[i + 3] === 255) matching++;
    assert.ok(matching > 1000, 'PNG rendering retains the selected QR color');
  }
});

// Native canvas supplies rendering for core tests; browser-specific interactions use Playwright.
const doc = new XmlParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml');
for (const collection of [doc.documentElement.attributes, doc.childNodes]) {
  Object.getPrototypeOf(collection)[Symbol.iterator] = function* () { for (let i = 0; i < this.length; i++) yield this.item(i); };
}
globalThis.DOMParser = class {
  parseFromString(source, type) {
    let invalid = false;
    const result = new XmlParser({ errorHandler: { warning() { invalid = true; }, error() { invalid = true; }, fatalError() { invalid = true; } } }).parseFromString(source, type);
    if (invalid) return new XmlParser().parseFromString('<parsererror/>', type);
    return result;
  }
};
globalThis.XMLSerializer = XMLSerializer;
globalThis.document = { createElement(name) { assert.equal(name, 'canvas'); return createCanvas(1, 1); } };
globalThis.Image = class extends CanvasImage {
  set src(source) {
    if (source.startsWith('blob:')) fetch(source).then(r => r.arrayBuffer()).then(bytes => { super.src = Buffer.from(bytes); }).catch(() => this.onerror?.());
    else if (source.startsWith('data:image/svg+xml;charset=utf-8,')) super.src = Buffer.from(decodeURIComponent(source.split(',').slice(1).join(',')));
    else super.src = source;
  }
};
const simple = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect x="10" y="10" width="100" height="40" fill="#d97742"/></svg>';

test('URL validation keeps the intended destination explicit and rejects unsafe or excessive input', () => {
  for (const value of ['https://example.com/path?a=1&b=2#results', 'http://localhost:3000', 'https://例子.测试/研究', 'HTTPS://example.com']) assert.equal(validUrl(value), true);
  for (const value of ['', 'example.com', 'https:example.com', 'ftp://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://exam\nple.com', 'https://example.com/' + 'x'.repeat(1000)]) assert.equal(validUrl(value), false);
});

test('SVG allowlist accepts simple shapes and rejects dangerous or unsupported content', () => {
  assert.match(sanitizeSvg(simple), /width="120"/);
  assert.match(sanitizeSvg('<?xml version="1.0"?>' + simple), /height="60"/);
  for (const bad of [
    '<svg broken',
    '<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///etc/passwd">]>' + simple,
    simple.replace('<rect ', '<rect onclick="alert(1)" '),
    simple.replace('fill="#d97742"', 'fill="url(https://example.com/x)"'),
    simple.replace('120 60', '0 0'),
    ...['script', 'foreignObject', 'image', 'use', 'style', 'text', 'filter', 'animate', 'linearGradient'].map(tag => simple.replace('</svg>', `<${tag}/></svg>`)),
    simple.replace('</svg>', '<g>' .repeat(34) + '</g>'.repeat(34) + '</svg>'),
    simple.replace('</svg>', '<path/>'.repeat(3001) + '</svg>'),
  ]) assert.throws(() => sanitizeSvg(bad));
});

test('custom uploads preserve aspect ratio and alpha; panels have white backgrounds', async () => {
  const canvas = createCanvas(120, 60);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#dc7535'; ctx.fillRect(10, 10, 100, 40);
  const fixtures = [
    ['image/png', canvas.toBuffer('image/png')],
    ['image/jpeg', canvas.toBuffer('image/jpeg')],
    ['image/webp', canvas.toBuffer('image/webp')],
    ['image/svg+xml', simple],
  ];
  for (const [type, data] of fixtures) {
    const file = new File([data], 'icon', { type });
    const image = await processUpload(file);
    assert.equal(image.width / image.height, 2);
    const uploaded = await nativeLoad(image.data);
    const c = createCanvas(120, 60); const context = c.getContext('2d'); context.drawImage(uploaded, 0, 0);
    if (type !== 'image/jpeg') assert.equal(context.getImageData(0, 0, 1, 1).data[3], 0);
    const panel = await nativeLoad(await makeIconPanel(image.data));
    const p = createCanvas(512, 512); const pc = p.getContext('2d'); pc.drawImage(panel, 0, 0);
    assert.deepEqual([...pc.getImageData(0, 0, 1, 1).data], [255, 255, 255, 255]);
    assert.equal(panel.width, panel.height);
  }
  const large = createCanvas(1200, 600);
  const normalized = await processUpload(new File([large.toBuffer('image/png')], 'large.png', { type: 'image/png' }));
  assert.deepEqual([normalized.width, normalized.height], [512, 256]);
});

test('upload validation rejects unsupported files, oversized files, corrupt images and excessive dimensions', async () => {
  for (const [type, data] of [
    ['image/gif', 'gif'], ['image/png', new Uint8Array(2 * 1024 * 1024 + 1)],
    ['image/png', 'broken'], ['image/svg+xml', simple.replace('120 60', '10000 10000')],
  ]) await assert.rejects(processUpload(new File([data], 'bad', { type })));
});

test('all QR icon exports render as self-contained SVG and PNG', async () => {
  await fs.mkdir('test-results/core', { recursive: true });
  const custom = await processUpload(new File([simple], 'custom.svg', { type: 'image/svg+xml' }));
  for (const url of ['https://a.co', 'https://example.com/research?paper=42&source=qr#results', 'https://example.com/' + 'a'.repeat(850)]) {
    for (const icon of icons) {
      const panel = icon.id === 'none' ? null : await makeIconPanel(icon.id === 'custom' ? custom.data : icon.image || svgData(svgIcon(icon.path)), icon.image ? '#172b4d' : null);
      const svg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: url, size: 1024, level: 'H', includeMargin: true, fgColor: '#172b4d', bgColor: '#ffffff', imageSettings: panel ? { src: panel, width: 1024 * .26, height: 1024 * .26, excavate: true } : undefined }));
      assert.ok(!svg.includes('blob:'));
      if (panel) assert.ok(svg.includes('data:image/png;base64,'));
      // The browser adds xmlns during export; SSR needs the same declaration for native rendering.
      const standalone = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ');
      const image = await nativeLoad(Buffer.from(standalone));
      const canvas = createCanvas(1024, 1024);
      canvas.getContext('2d').drawImage(image, 0, 0);
      // Skia's SVG loader omits <image>; composite the SVG's embedded image geometry explicitly.
      // Browser SVG rendering and actual downloaded files are exercised by the browser suite.
      const xml = new XmlParser().parseFromString(standalone, 'image/svg+xml');
      const cellCount = Number(xml.documentElement.getAttribute('viewBox').split(' ')[2]);
      const images = xml.getElementsByTagName('image');
      for (let i = 0; i < images.length; i++) {
        const embedded = images.item(i), scale = 1024 / cellCount;
        const raster = await nativeLoad(embedded.getAttribute('xlink:href'));
        canvas.getContext('2d').drawImage(raster, Number(embedded.getAttribute('x')) * scale, Number(embedded.getAttribute('y')) * scale, Number(embedded.getAttribute('width')) * scale, Number(embedded.getAttribute('height')) * scale);
      }
      if (icon.id === 'custom') {
        const center = canvas.getContext('2d').getImageData(512, 512, 1, 1).data;
        assert.deepEqual([...center], [217, 119, 66, 255], 'The embedded custom icon must appear in the rendered export');
      }
      const base = `test-results/core/${url.length}-${icon.id}`;
      await fs.writeFile(`${base}.svg`, standalone);
      await fs.writeFile(`${base}.png`, canvas.toBuffer('image/png'));
      if (process.env.QR_DECODER) assert.equal(execFileSync(process.env.QR_DECODER, [`${base}.png`], { encoding: 'utf8' }).trim(), url);
    }
  }
});
