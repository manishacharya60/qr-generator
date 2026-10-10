import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import { icons, svgIcon, svgData } from './icons';
import { loadImage, processUpload, makeIconPanel } from './uploads';
import { validUrl } from './url';
import { DEFAULT_COLOR, isHexColor, contrastOnWhite } from './colors';
import './style.css';

const DEFAULT_URL = 'https://acharyamanish.net';
function Icon({ id, size = 24 }) {
  const icon = icons.find(i => i.id === id) || icons[0];
  if (icon.image) return <span className="line-icon raster-icon" aria-hidden="true" style={{ width: size, height: size, maskImage: `url("${icon.image}")`, WebkitMaskImage: `url("${icon.image}")` }} />;
  return <span className="line-icon" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svgIcon(icon.path, 'currentColor') }} />;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [selected, setSelected] = useState('website');
  const [custom, setCustom] = useState(null);
  const [panel, setPanel] = useState(null);
  const [iconSize, setIconSize] = useState(24);
  const [qrColor, setQrColor] = useState(DEFAULT_COLOR);
  const [colorInput, setColorInput] = useState(DEFAULT_COLOR);
  const [resolution, setResolution] = useState('1024');
  const [uploadError, setUploadError] = useState('');
  const [exportError, setExportError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filename, setFilename] = useState('qr-code');
  const preview = useRef(null), input = useRef(null), uploadId = useRef(0);
  const valid = validUrl(url.trim());
  const activeIcon = icons.find(i => i.id === selected);
  const iconSource = selected === 'custom' ? custom?.data : selected === 'none' ? null : activeIcon.image || svgData(svgIcon(activeIcon.path, qrColor));
  const iconTint = activeIcon.image ? qrColor : null;
  const colorValid = isHexColor(colorInput);
  const lowContrast = contrastOnWhite(qrColor) < 4.5;
  function changeColor(value) {
    setColorInput(value);
    if (isHexColor(value)) setQrColor(value.toLowerCase());
  }

  useLayoutEffect(() => {
    const svg = preview.current?.querySelector('svg');
    const cells = Number(svg?.getAttribute('viewBox')?.split(/\s+/)[2]);
    // Crop three of the four quiet-zone modules from each side for display only.
    // The SVG itself retains its full viewBox for both download formats.
    preview.current?.style.setProperty('--qr-preview-scale', cells > 8 ? String(cells / (cells - 6)) : '1');
  }, [valid, url, panel, iconSize, qrColor]);

  useEffect(() => {
    let cancelled = false;
    setPanel(null); setPreparing(!!iconSource);
    if (iconSource) makeIconPanel(iconSource, iconTint).then(data => { if (!cancelled) { setPanel(data); setPreparing(false); } }).catch(() => { if (!cancelled) { setExportError('The icon could not be prepared. Try another image.'); setPreparing(false); } });
    return () => { cancelled = true; };
  }, [iconSource, iconTint]);
  useEffect(() => { setNotice(''); setExportError(''); }, [url, selected, custom, iconSize, resolution, qrColor, colorInput]);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const id = ++uploadId.current;
    setUploading(true); setUploadError('');
    try { const result = await processUpload(file); if (id === uploadId.current) setCustom(result); }
    catch (e) { if (id === uploadId.current) setUploadError(e.message); }
    finally { if (id === uploadId.current) setUploading(false); }
  }
  const ready = valid && colorValid && !uploading && !preparing && !exporting && (selected !== 'custom' || !!custom);
  async function exportQr(format) {
    if (!ready) return;
    setExporting(true); setExportError(''); setNotice('');
    try {
      const svg = preview.current.querySelector('svg').cloneNode(true);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      svg.setAttribute('width', resolution); svg.setAttribute('height', resolution);
      const markup = new XMLSerializer().serializeToString(svg);
      const name = filename.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'qr-code';
      if (format === 'svg') downloadBlob(new Blob([markup], { type: 'image/svg+xml' }), `${name}.svg`);
      else {
        const image = await loadImage(svgData(markup));
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Number(resolution);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('The PNG could not be created. Try again.');
        downloadBlob(blob, `${name}.png`);
      }
      setNotice(`${format.toUpperCase()} downloaded. Scan it with your phone before sharing.`);
    } catch (e) { setExportError(e.message || 'Download failed. Try again.'); }
    finally { setExporting(false); }
  }
  return <>
    <main>
      <div className="tool-title"><img src={`${import.meta.env.BASE_URL}qr-mark.svg`} alt="" width="40" height="40"/><h1>QR Generator</h1></div>
      <div className="workspace">
        <section className="editor" aria-label="QR code settings">
          <div className="section-heading"><span className="step">01</span><h2>Add your link</h2></div>
          <label htmlFor="url">Destination URL</label><div className={`url-input ${valid ? '' : 'invalid'}`}><Icon id="website" size={20}/><input id="url" type="url" value={url} onChange={e => setUrl(e.target.value)} aria-describedby="url-help" aria-invalid={!valid} spellCheck="false" placeholder="https://example.com" /></div>
          <p id="url-help" className={valid ? 'hint' : 'error'}>{valid ? 'The exact link your QR code will open.' : !url.trim() ? 'Enter a URL to generate your code.' : 'Enter a full http:// or https:// URL without login credentials (up to 1,000 bytes).'}</p>
          <div className="divider"/>
          <div className="section-heading"><span className="step">02</span><h2>Give it an icon</h2><span className="optional">Optional</span></div>
          <div className="icon-grid" role="group" aria-label="Choose an icon">{icons.map(icon => <button key={icon.id} className={`icon-choice ${selected === icon.id ? 'selected' : ''}`} aria-pressed={selected === icon.id} onClick={() => setSelected(icon.id)}><Icon id={icon.id}/><span>{icon.label}</span>{selected === icon.id && <span className="check" aria-hidden="true">✓</span>}</button>)}</div>
          {selected === 'paper' && <p className="hint icon-credit"><a href="https://www.flaticon.com/free-icon/pdf_482216" target="_blank" rel="noreferrer">PDF icon created by Those Icons — Flaticon</a></p>}
          {selected === 'custom' && <div className="custom-controls">
            <input ref={input} id="upload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} className="visually-hidden" aria-label="Upload custom icon" />
            {!custom ? <button className="upload-area" onClick={() => input.current.click()} disabled={uploading}><Icon id="custom"/><strong>{uploading ? 'Processing image…' : 'Choose an image'}</strong><span>PNG, JPEG, WebP, or simple SVG · Up to 2 MB</span></button> : <div className="uploaded"><div className="image-checker"><img src={custom.data} alt="Custom icon preview" /></div><div className="upload-detail"><strong title={custom.name}>{custom.name}</strong><span>{custom.width} × {custom.height} · Stored only in this tab</span><div><button onClick={() => input.current.click()} disabled={uploading}>{uploading ? 'Processing…' : 'Replace'}</button><button onClick={() => { ++uploadId.current; setCustom(null); setUploading(false); setUploadError(''); }}>Remove</button></div></div></div>}
            {uploadError && <p className="error" role="alert">{uploadError}</p>}
            <p className="hint">Simple SVG shapes are supported. SVGs with scripts, styles, links, text, filters, or external images are rejected.</p>
          </div>}
          {selected !== 'none' && <div className="size-control"><label htmlFor="icon-size">Icon size <output>{iconSize}%</output></label><input id="icon-size" type="range" min="10" max="26" step="1" value={iconSize} onChange={e => setIconSize(Number(e.target.value))}/><p className="hint">White backing keeps the icon clear. Scan your download before sharing, especially at larger sizes.</p></div>}
          <div className="divider"/>
          <div className="section-heading"><span className="step">03</span><h2>Choose a color</h2></div>
          <div className="color-controls"><div><label htmlFor="qr-color">QR color</label><input className="color-input" id="qr-color" type="color" value={qrColor} onChange={e => changeColor(e.target.value)} aria-describedby="color-help"/></div><div className="hex-control"><label htmlFor="hex-color">Hex color</label><input id="hex-color" value={colorInput} maxLength={7} spellCheck="false" autoComplete="off" onChange={e => changeColor(e.target.value)} aria-invalid={!colorValid} aria-describedby="color-help" placeholder="#172b4d"/></div><button className="color-reset" onClick={() => changeColor(DEFAULT_COLOR)}>Reset to navy</button></div>
          <p id="color-help" className={!colorValid ? 'error' : lowContrast ? 'color-warning' : 'hint'} role={!colorValid || lowContrast ? 'status' : undefined}>{!colorValid ? 'Enter a six-digit hex color, such as #172b4d.' : lowContrast ? 'This color may be hard to scan on white. Try a darker shade.' : 'Applied to the code and built-in icon in both PNG and SVG.'}</p>
          <div className="divider"/>
          <div className="section-heading"><span className="step">04</span><h2>Make it ready to share</h2></div>
          <div className="export-fields"><div><label htmlFor="filename">File name</label><input id="filename" value={filename} maxLength="60" onChange={e => setFilename(e.target.value)} placeholder="qr-code" /></div><div><label htmlFor="resolution">PNG size</label><select id="resolution" value={resolution} onChange={e => setResolution(e.target.value)}><option value="512">512 × 512 px</option><option value="1024">1024 × 1024 px</option><option value="2048">2048 × 2048 px</option></select></div></div>
        </section>
        <aside className="preview-card" aria-label="QR code preview"><div className="preview-heading"><h2>Your QR code</h2><span className="live-label"><span className="status-dot"/>{valid ? 'Live preview' : 'Add a link'}</span></div><div className="qr-surround"><div className="qr-paper" ref={preview}>{valid ? <QRCodeSVG value={url.trim()} size={280} level="H" includeMargin={true} fgColor={qrColor} bgColor="#ffffff" imageSettings={panel ? { src: panel, width: 280 * iconSize / 100, height: 280 * iconSize / 100, excavate: true } : undefined} /> : <div className="empty-qr"><Icon id="none" size={60}/><span>Your code will appear here</span></div>}</div></div><div className="preview-caption"><span className="caption-icon">↗</span><span>{valid ? new URL(url.trim()).hostname : 'Your destination'}</span></div><p className="preview-description">{selected === 'none' ? 'Clean and simple. Ready for any link.' : selected === 'custom' && !custom ? 'Upload your icon to personalize this code.' : `${activeIcon.label} icon · High error correction`}</p><div className="download-buttons"><button className="primary" disabled={!ready} onClick={() => exportQr('png')}><span aria-hidden="true">↓</span>Download PNG</button><button className="secondary" disabled={!ready} onClick={() => exportQr('svg')}><span aria-hidden="true">↓</span>Download SVG</button></div><p className="format-note">PNG for everyday use. SVG for crisp prints at any size.</p>{exportError && <p className="error" role="alert">{exportError}</p>}<p className="download-notice" role="status">{notice || (uploading || preparing ? 'Preparing your icon…' : exporting ? 'Preparing download…' : '')}</p><div className="scan-note"><span aria-hidden="true">◎</span><p><strong>A quick scan goes a long way.</strong>Test your downloaded code with your phone before printing or sharing.</p></div></aside>
      </div>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
