import pdfIcon from './pdf-icon.js';

export const icons = [
  { id: 'paper', label: 'Paper / PDF', image: pdfIcon },
  { id: 'video', label: 'Video', path: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>' },
  { id: 'slides', label: 'Slides', path: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5M8 21h8M7 8h10M7 11h6"/>' },
  { id: 'website', label: 'Website', path: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>' },
  { id: 'code', label: 'Code / GitHub', path: '<path d="m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16"/>' },
  { id: 'dataset', label: 'Dataset', path: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>' },
  { id: 'none', label: 'No Icon', path: '<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 3"/>' },
  { id: 'custom', label: 'Custom Icon', path: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>' },
];

export const svgIcon = (path, color = '#203c68') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
export const svgData = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
