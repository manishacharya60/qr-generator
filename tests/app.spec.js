import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';

const URL = 'https://example.com/research?paper=42&source=qr#results';
const simpleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect x="10" y="10" width="100" height="40" rx="8" fill="#d97742"/></svg>';

async function initialize(page) {
  await page.goto('/');
  await page.getByLabel('Destination URL').fill(URL);
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
}
async function saveExport(page, format, info, suffix) {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download ${format.toUpperCase()}` }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
  const path = info.outputPath(`${suffix}.${format}`);
  await download.saveAs(path);
  return path;
}
async function verifyQr(page, path, info, name) {
  const bytes = await fs.readFile(path);
  const mime = path.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  const rendered = await page.evaluate(async ({ data, mime }) => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = `data:${mime};base64,${data}`; });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 1024, 1024);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { data: bytes.toString('base64'), mime });
  const raster = info.outputPath(`${name}-raster.png`);
  await fs.writeFile(raster, Buffer.from(rendered, 'base64'));
  if (process.env.QR_DECODER) expect(execFileSync(process.env.QR_DECODER, [raster], { encoding: 'utf8' }).trim()).toBe(URL);
}

test('desktop and mobile layout, naming, URL validation, no remote requests', async ({ page }) => {
  const remote = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) remote.push(r.url()); });
  await initialize(page);
  await expect(page).toHaveTitle('QR Generator');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  for (const value of ['', 'example.com', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com/' + 'x'.repeat(1000)]) {
    await page.getByLabel('Destination URL').fill(value);
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Download SVG' })).toBeDisabled();
  }
  await page.getByLabel('Destination URL').fill(URL);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  expect(remote).toEqual([]);
});

test('every built-in icon exports PNG and self-contained SVG that decode', async ({ page }, info) => {
  await initialize(page);
  for (const name of ['Paper / PDF', 'Video', 'Slides', 'Website', 'Code / GitHub', 'Dataset', 'No Icon']) {
    await page.getByRole('button', { name, exact: true }).click();
    if (name !== 'No Icon') await page.getByLabel('Icon size').fill('26');
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    const suffix = name.replace(/\W+/g, '-');
    for (const format of ['png', 'svg']) {
      const path = await saveExport(page, format, info, suffix);
      if (format === 'svg') {
        const text = await fs.readFile(path, 'utf8');
        if (name === 'No Icon') expect(text).not.toContain('<image');
        else expect(text).toContain('data:image/png;base64,');
        expect(text).not.toContain('blob:');
      }
      await verifyQr(page, path, info, `${suffix}-${format}`);
    }
  }
});

test('minimal layout and color controls update preview and downloaded codes', async ({ page }, info) => {
  await initialize(page);
  await expect(page.locator('header, footer')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'QR Generator', exact: true })).toBeVisible();
  await page.getByLabel('Hex color', { exact: true }).fill('#72204d');
  await expect(page.getByLabel('QR color', { exact: true })).toHaveValue('#72204d');
  await expect(page.locator('.qr-paper svg path').last()).toHaveAttribute('fill', '#72204d');
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  for (const format of ['png', 'svg']) {
    const path = await saveExport(page, format, info, 'colored');
    if (format === 'svg') expect(await fs.readFile(path, 'utf8')).toContain('fill="#72204d"');
    await verifyQr(page, path, info, `colored-${format}`);
  }
  await page.getByLabel('QR color', { exact: true }).fill('#ffeecc');
  await expect(page.getByText('This color may be hard to scan on white. Try a darker shade.')).toBeVisible();
  await page.getByLabel('Hex color', { exact: true }).fill('#nope');
  await expect(page.getByRole('button', { name: 'Download SVG' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset to navy' }).click();
  await expect(page.getByLabel('QR color', { exact: true })).toHaveValue('#172b4d');
  await expect(page.getByRole('button', { name: 'Download SVG' })).toBeEnabled();
});

test('all custom formats, transparency, aspect ratio, replacement, removal and downloads', async ({ page }, info) => {
  await initialize(page);
  await page.getByRole('button', { name: 'Custom Icon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  const raster = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 120; c.height = 60;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#db7637'; ctx.fillRect(10, 10, 100, 40);
    return ['image/png', 'image/jpeg', 'image/webp'].map(type => ({ type, data: c.toDataURL(type).split(',')[1] }));
  });
  for (const fixture of [...raster, { type: 'image/svg+xml', data: Buffer.from(simpleSvg).toString('base64') }]) {
    await page.getByLabel('Upload custom icon').setInputFiles({ name: `wide.${fixture.type.split('/')[1]}`, mimeType: fixture.type, buffer: Buffer.from(fixture.data, 'base64') });
    await expect(page.getByAltText('Custom icon preview')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    const dimensions = await page.getByAltText('Custom icon preview').evaluate(img => [img.naturalWidth, img.naturalHeight]);
    expect(dimensions).toEqual([120, 60]);
    if (fixture.type !== 'image/jpeg') {
      const alpha = await page.getByAltText('Custom icon preview').evaluate(img => { const c = document.createElement('canvas'); c.width = 120; c.height = 60; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, 1, 1).data[3]; });
      expect(alpha).toBe(0);
    }
    await page.getByLabel('Icon size').fill('26');
    for (const format of ['png', 'svg']) {
      const path = await saveExport(page, format, info, `custom-${fixture.type.split('/')[1]}`);
      await verifyQr(page, path, info, `custom-${fixture.type.split('/')[1]}-${format}`);
    }
  }
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByAltText('Custom icon preview')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
});

test('unsupported, oversized, malformed and unsafe uploads are rejected without losing previous icon', async ({ page }) => {
  await initialize(page);
  await page.getByRole('button', { name: 'Custom Icon', exact: true }).click();
  await page.getByLabel('Upload custom icon').setInputFiles({ name: 'good.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(simpleSvg) });
  await expect(page.getByAltText('Custom icon preview')).toBeVisible();
  const sources = [
    ['unsupported.gif', 'image/gif', 'not an image'],
    ['too-big.png', 'image/png', Buffer.alloc(2 * 1024 * 1024 + 1)],
    ['corrupt.png', 'image/png', 'not a png'],
    ['script.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script></svg>'],
    ['event.svg', 'image/svg+xml', simpleSvg.replace('<rect ', '<rect onload="alert(1)" ')],
    ['remote.svg', 'image/svg+xml', simpleSvg.replace('fill="#d97742"', 'fill="url(https://example.com/image)"')],
    ['html.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>'],
    ['malformed.svg', 'image/svg+xml', '<svg broken'],
    ['entity.svg', 'image/svg+xml', '<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///etc/passwd">]>' + simpleSvg],
    ['dimensions.svg', 'image/svg+xml', simpleSvg.replace('120 60', '0 0')],
    ['large.svg', 'image/svg+xml', simpleSvg.replace('120 60', '10000 10000')],
  ];
  for (const [name, mimeType, source] of sources) {
    await page.getByLabel('Upload custom icon').setInputFiles({ name, mimeType, buffer: Buffer.isBuffer(source) ? source : Buffer.from(source) });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByAltText('Custom icon preview')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  }
});
