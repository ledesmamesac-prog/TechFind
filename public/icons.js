// ── icons.js — SVG icon library (stroke-based, 20×20 viewBox) ──
// Usage: CAT_ICONS['computadores']  →  '<svg …>…</svg>'

const CAT_ICONS = {
  computadores: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="20" height="13" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>`,

  celulares: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2"/>
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>
  </svg>`,

  tablets: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="2" width="18" height="20" rx="2"/>
    <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
    <line x1="7" y1="6" x2="17" y2="6"/>
    <line x1="7" y1="10" x2="14" y2="10"/>
  </svg>`,

  pantallas: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="13" rx="2"/>
    <path d="M8 21h8M12 16v5"/>
  </svg>`,

  audio: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 14a9 9 0 0 1 18 0"/>
    <path d="M3 14v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H3z"/>
    <path d="M21 14v3a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h3z"/>
  </svg>`,

  consolas: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="6" y1="12" x2="10" y2="12"/>
    <line x1="8" y1="10" x2="8" y2="14"/>
    <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none"/>
    <path d="M4 8h16a1 1 0 0 1 1 1l-2 7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L3 9a1 1 0 0 1 1-1z"/>
  </svg>`,

  impresoras: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 9V2h12v7"/>
    <rect x="2" y="9" width="20" height="9" rx="1"/>
    <path d="M6 14h12v6H6z"/>
    <line x1="6" y1="12" x2="6.01" y2="12" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  otros: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <line x1="12" y1="22" x2="12" y2="12"/>
    <path d="m3.27 6.96 8.73 5.04 8.73-5.04"/>
  </svg>`
};

function catIcon(name, size = 20) {
  const svg = CAT_ICONS[name] || CAT_ICONS['otros'];
  return svg.replace(/width="20" height="20"/, `width="${size}" height="${size}"`);
}

function renderStarsHtml(rating) {
  if (!rating) return '';
  const num = parseFloat(rating);
  if (isNaN(num)) return '';

  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= num) {
      starsHtml += '<span style="color: #f59e0b;">★</span>';
    } else if (i - 0.5 <= num) {
      starsHtml += '<span style="color: #f59e0b;">★</span>';
    } else {
      starsHtml += '<span style="color: #4b5563;">★</span>';
    }
  }
  return `<div class="product-rating" style="font-size: 1.15rem; margin-top: 0.2rem;" title="${num} de 5">${starsHtml} <span style="color: #9ca3af; font-size: 0.9rem; margin-left: 4px; position: relative; top: -1px;">(${num})</span></div>`;
}
