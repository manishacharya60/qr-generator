export const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const tags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'title', 'desc']);
const attrs = new Set(['xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'transform', 'preserveAspectRatio']);

// Rebuild a small, inert SVG subset. No HTML, CSS, links, entities or external resources.
export function sanitizeSvg(source) {
  if (/<!DOCTYPE|<!ENTITY|<\?/i.test(source.replace(/<\?xml\s[^?]*\?>/i, ''))) throw new Error('This SVG contains unsupported declarations. Export a simple SVG or use PNG.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length || root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('This SVG is invalid. Try another image.');
  let count = 0;
  function copy(node, depth = 0) {
    if (++count > 3000 || depth > 32) throw new Error('This SVG is too complex. Use a simpler SVG or PNG.');
    if (!tags.has(node.localName) || node.namespaceURI !== root.namespaceURI) throw new Error('This SVG contains unsupported features. Use a simple SVG without scripts, styles, links, text, filters, or external images, or upload PNG.');
    const clean = doc.createElementNS(root.namespaceURI, node.localName);
    for (const attr of node.attributes) {
      if (!attrs.has(attr.name) || (attr.namespaceURI && attr.name !== 'xmlns') || /url\s*\(|javascript:|data:|https?:|\/\//i.test(attr.value) && attr.name !== 'xmlns') throw new Error('This SVG contains unsafe or unsupported attributes. Export a simple SVG or use PNG.');
      if (attr.name === 'xmlns' && attr.value !== root.namespaceURI) throw new Error('Unsupported SVG namespace.');
      clean.setAttribute(attr.name, attr.value);
    }
    for (const child of node.childNodes) {
      if (child.nodeType === 1) clean.appendChild(copy(child, depth + 1));
      else if (child.nodeType === 3 && ['title', 'desc'].includes(node.localName)) clean.appendChild(doc.createTextNode(child.textContent));
    }
    return clean;
  }
  const clean = copy(root);
  const viewBox = clean.getAttribute('viewBox');
  if (viewBox) {
    const dimensions = viewBox.trim().split(/[\s,]+/).map(Number);
    if (dimensions.length !== 4 || !dimensions.every(Number.isFinite) || dimensions[2] <= 0 || dimensions[3] <= 0) throw new Error('The SVG needs a valid viewBox.');
    clean.setAttribute('width', dimensions[2]);
    clean.setAttribute('height', dimensions[3]);
  } else if (!/^\d+(\.\d+)?(px)?$/.test(clean.getAttribute('width') || '') || !/^\d+(\.\d+)?(px)?$/.test(clean.getAttribute('height') || '')) {
    throw new Error('The SVG needs a viewBox or explicit width and height.');
  }
  const w = parseFloat(clean.getAttribute('width')), h = parseFloat(clean.getAttribute('height'));
  if (w <= 0 || h <= 0 || w > 8192 || h > 8192 || w * h > 16000000) throw new Error('Image dimensions are too large or invalid. Use at most 8192 pixels per side and 16 megapixels.');
  return new XMLSerializer().serializeToString(clean);
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be read. Try a different file.'));
    image.src = src;
  });
}

export async function processUpload(file) {
  if (file.size > MAX_BYTES) throw new Error('This file is too large. Choose an image smaller than 2 MB.');
  if (!TYPES.has(file.type)) throw new Error('Unsupported file. Choose PNG, JPEG, WebP, or SVG.');
  let blob = file;
  if (file.type === 'image/svg+xml') blob = new Blob([sanitizeSvg(await file.text())], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8192 || image.naturalHeight > 8192 || image.naturalWidth * image.naturalHeight > 16000000) throw new Error('Image dimensions are too large. Use at most 8192 pixels per side and 16 megapixels.');
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return { name: file.name, data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(url); }
}

export async function makeIconPanel(src, tint = null) {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 512, 512);
  const scale = 448 / Math.max(image.naturalWidth, image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  if (tint) {
    const layer = document.createElement('canvas');
    layer.width = layer.height = 512;
    const mask = layer.getContext('2d');
    mask.drawImage(image, (512 - w) / 2, (512 - h) / 2, w, h);
    mask.globalCompositeOperation = 'source-in';
    mask.fillStyle = tint;
    mask.fillRect(0, 0, 512, 512);
    ctx.drawImage(layer, 0, 0);
  } else ctx.drawImage(image, (512 - w) / 2, (512 - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}
