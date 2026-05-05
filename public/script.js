// ── lobby script.js ──
window.showProductDetails = null; // Pre-declare
document.addEventListener('DOMContentLoaded', async () => {
  setupProductDetailModal();
  try {
    const [summaryRes, productsRes] = await Promise.all([
      fetch('/api/summary'),
      fetch('/api/products')
    ]);

    const { categories, featured, storeCount, stores, totalProducts } = await summaryRes.json();
    allProducts = await productsRes.json();

    // Hero stats
    const total = categories.reduce((s, c) => s + c.count, 0);
    document.getElementById('stat-total').textContent = total.toLocaleString();
    document.getElementById('stat-cats').textContent = categories.length;
    document.getElementById('stat-stores').textContent = storeCount || 0;

    renderCategoryCards(categories);
    renderStoreCards(stores, totalProducts || total);
    renderFeatured(featured);
    setupLocationTabs();

  } catch (err) {
    console.error('Error loading summary:', err);
  }
});

// Firebase configuration and initialization
import { initProfile, toggleFavorite, isFavorite } from "./profile.js";
import { CAT_ICONS, catIcon, renderStarsHtml, getStoreBadgeClass } from "./icons.js";

// Initialize Profile Modal & Auth State
initProfile();

let allProducts = []; // To store featured or similar for modal

const STORE_CARD_IMAGES = {
  alkosto: '/assets/Alkosto.webp',
  compulago: '/assets/Compulago',
  computerworking: '/assets/Compuworking.png',
  exito: '/assets/Exito.svg',
  falabella: '/assets/Falabella.png',
  tauretcomputadores: '/assets/TauretComputadores.png'
};

function normalizeStoreKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getStoreCardImageUrl(storeName) {
  return STORE_CARD_IMAGES[normalizeStoreKey(storeName)] || '';
}

function getHighResImageUrl(imageUrl, targetWidth = 900) {
  if (!imageUrl || typeof imageUrl !== 'string') return imageUrl;

  try {
    const url = new URL(imageUrl, window.location.origin);
    let changed = false;

    ['w', 'width', 'imwidth', 'sz'].forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, String(targetWidth));
        changed = true;
      }
    });

    if (changed) return url.toString();
  } catch (_) {
    // If the URL is not parseable, keep the original one.
  }

  return imageUrl;
}

// ── PRODUCT DETAIL MODAL ──
function showProductDetails(product) {
  const overlay = document.getElementById('product-detail-modal-overlay');
  const modal = document.getElementById('product-detail-modal');
  const modalImageUrl = getHighResImageUrl(product.image, 900);
  
  document.getElementById('pd-img-box').innerHTML = product.image 
    ? `<img src="${modalImageUrl}" alt="${product.name}" loading="eager" decoding="async" fetchpriority="high">` 
    : catIcon(product.category, 100);
  
  const storeBadge = document.getElementById('pd-store');
  storeBadge.className = 'pd-store-badge ' + getStoreBadgeClass(product.store);
  storeBadge.textContent = product.store;
  
  document.getElementById('pd-title').textContent = product.name;
  document.getElementById('pd-rating').innerHTML = renderStarsHtml(product.rating);
  
  const oldPriceEl = document.getElementById('pd-price-old');
  const newPriceEl = document.getElementById('pd-price-new');
  const discPctEl = document.getElementById('pd-discount-pct');
  
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  if (hasDiscount) {
    oldPriceEl.style.display = 'block';
    oldPriceEl.textContent = `$${Number(product.originalPrice).toLocaleString()}`;
    const pct = Math.round((1 - (product.price / product.originalPrice)) * 100);
    discPctEl.style.display = 'inline-block';
    discPctEl.textContent = `-${pct}%`;
  } else {
    oldPriceEl.style.display = 'none';
    discPctEl.style.display = 'none';
  }
  
  newPriceEl.textContent = `$${Number(product.price).toLocaleString()}`;
  
  const buyBtn = document.getElementById('pd-buy-btn');
  buyBtn.href = product.url;
  
  const favBtn = document.getElementById('pd-fav-btn');
  const favIcon = document.getElementById('pd-fav-icon');
  
  function updateFavBtn() {
    const active = isFavorite(product._id);
    favBtn.classList.toggle('active', active);
    favIcon.innerHTML = active ? CAT_ICONS.heartFilled : CAT_ICONS.heart;
  }
  updateFavBtn();
  
  favBtn.onclick = async (e) => {
    e.stopPropagation();
    const success = await toggleFavorite(product);
    if (success) updateFavBtn();
  };

  renderSimilarProducts(product);

  overlay.style.display = 'block';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
window.showProductDetails = showProductDetails;

function renderSimilarProducts(current) {
  const grid = document.getElementById('pd-similar-grid');
  grid.innerHTML = '';
  const similar = allProducts
    .filter(p => p._id !== current._id && p.category === current.category)
    .slice(0, 12);
    
  similar.forEach(p => {
    const card = makeFeaturedCard(p);
    grid.appendChild(card);
  });
}

function setupProductDetailModal() {
  const overlay = document.getElementById('product-detail-modal-overlay');
  const modal = document.getElementById('product-detail-modal');
  const close = document.getElementById('close-pd-modal');
  const closeModal = () => {
    overlay.style.display = 'none';
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };
  if (close) close.onclick = closeModal;
  if (overlay) overlay.onclick = closeModal;
}

function makeFeaturedCard(p, i = 0) {
  const card = document.createElement('div');
  card.className = 'featured-card';
  card.style.animationDelay = `${i * 0.05}s`;
  card.style.cursor = 'pointer';

  const fallbackIcon = catIcon(p.category, 36);
  const imgContent = p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const svgFallback = `<span class="feat-placeholder" style="${p.image ? 'display:none' : ''}">${fallbackIcon}</span>`;

  const discountTag = (p.discount || (p.originalPrice && p.originalPrice > p.price))
    ? `<span class="feat-discount">${p.discount || 'OFERTA'}</span>`
    : '';

  card.innerHTML = `
    <div class="feat-img">
      ${imgContent}${svgFallback}
      ${discountTag}
    </div>
    <div class="feat-body">
      <span class="feat-store ${getStoreBadgeClass(p.store)}">${p.store}</span>
      <span class="feat-name">${p.name}</span>
      ${renderStarsHtml(p.rating)}
      ${formatPriceHtml(p)}
    </div>
  `;
  card.onclick = () => showProductDetails(p);
  return card;
}

// ── CATEGORY CARDS ──
function renderCategoryCards(categories) {
  const grid = document.getElementById('cat-cards-grid');
  grid.innerHTML = '';

  categories.forEach(cat => {
    const icon = catIcon(cat.name, 18);
    const iconBig = catIcon(cat.name, 40);
    const label = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);

    const thumbs = cat.samples
      .filter(p => p.image)
      .slice(0, 3)
      .map(p => `<img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">`)
      .join('');

    const card = document.createElement('a');
    card.className = 'cat-card';
    card.href = `category.html?cat=${encodeURIComponent(cat.name)}`;
    card.innerHTML = `
      <div class="cat-card-thumbs">
        ${thumbs || `<span class="cat-card-icon-big">${iconBig}</span>`}
      </div>
      <div class="cat-card-body">
        <span class="cat-card-icon">${icon}</span>
        <span class="cat-card-name">${label}</span>
        <span class="cat-card-count">${cat.count.toLocaleString()} productos</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function formatPriceHtml(p) {
  const hasDiscount = p.originalPrice && p.originalPrice > p.price;
  if (!hasDiscount) {
    return `<span class="feat-price">$${Number(p.price).toLocaleString()}</span>`;
  }
  return `
    <div class="feat-price-wrap">
      <span class="feat-price-old">$${Number(p.originalPrice).toLocaleString()}</span>
      <span class="feat-price-new">$${Number(p.price).toLocaleString()}</span>
    </div>
  `;
}

// ── FEATURED PRODUCTS ──
function renderFeatured(products) {
  const grid = document.getElementById('featured-grid');
  grid.innerHTML = '';
  products.forEach((p, i) => {
    grid.appendChild(makeFeaturedCard(p, i));
  });
}

function renderStoreCards(stores, totalProducts = 0) {
  const grid = document.getElementById('store-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const safeTotal = Number(totalProducts) || 1;
  const storeCounts = (Array.isArray(allProducts) ? allProducts : []).reduce((acc, product) => {
    const key = String(product?.store || 'Otro');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  (Array.isArray(stores) ? stores : []).forEach((store, i) => {
    const storeName = String(
      typeof store === 'string'
        ? store
        : (store?.name || store?.store || store?.slug || 'Otro')
    );
    const rawCount = Number(
      typeof store === 'object'
        ? (store?.count ?? store?.total ?? storeCounts[storeName] ?? storeCounts[storeName.trim()] ?? 0)
        : (storeCounts[storeName] ?? storeCounts[storeName.trim()] ?? 0)
    );
    const count = Number.isFinite(rawCount) ? rawCount : 0;
    const card = document.createElement('a');
    card.href = `category.html?store=${encodeURIComponent(storeName)}`;
    card.style.animationDelay = `${i * 0.05}s`;

    const imageUrl = getStoreCardImageUrl(storeName);
    const storeKey = normalizeStoreKey(storeName);
    const percent = Number.isFinite(Number(store?.percent))
      ? Number(store.percent)
      : Math.round((count / safeTotal) * 1000) / 10;
    const initial = storeName.charAt(0).toUpperCase();
    const cardClass = [
      'store-card',
      `store-card--${storeKey}`
    ].filter(Boolean).join(' ');

    card.className = cardClass;
    card.innerHTML = `
      <div class="store-card-image store-card-image--${storeKey}">
        ${imageUrl
          ? `<img src="${imageUrl}" alt="${storeName}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="store-card-fallback" style="${imageUrl ? 'display:none' : ''}">${initial}</div>
      </div>
      <div class="store-card-body">
        <div class="store-card-top">
          <h3 class="store-card-name">${storeName}</h3>
          <span class="store-card-count">${count.toLocaleString()} productos</span>
        </div>
        <div class="store-card-meter" aria-hidden="true">
          <div class="store-card-meter-fill" style="width:${Math.max(4, Math.min(100, percent))}%"></div>
        </div>
        <div class="store-card-footer">
          <span class="store-card-share">${percent.toFixed(1)}% del total</span>
          <span class="store-card-cta">Ver tienda →</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}


const STORE_LOCATIONS = {
  'Exito': {
    name: 'Almacenes Éxito',
    branches: [
      { label: 'Éxito San Diego', q: 'Exito+San+Diego+Cartagena', url: 'https://maps.app.goo.gl/fQo3BmKqc5uYBRMP8' },
      { label: 'Éxito Cartagena', q: 'Exito+Cartagena', url: 'https://maps.app.goo.gl/Q7y7sQTLNu3r51pZA' },
      { label: 'Éxito Castellana', q: 'Exito+Castellana+Cartagena', url: 'https://maps.app.goo.gl/qBYAnMPSH3MVLNpz6' },
      { label: 'Éxito Los Ejecutivos', q: 'Exito+Ejecutivos+Cartagena', url: 'https://maps.app.goo.gl/d27qrXc4v6H92tQj8' },
      { label: 'Éxito Matuna', q: 'Exito+Matuna+Cartagena', url: 'https://maps.app.goo.gl/SSztywu2iWwmJJBdA' },
      { label: 'Éxito Super crespo', q: 'Cl. 70 ##157', url: 'https://maps.app.goo.gl/kGXhYFcYySn8hSV3A' }
    ]
  },
  'Alkosto': {
    name: 'Alkosto',
    branches: [
      { label: 'Alkosto Barranquilla', q: 'Alkosto+Barranquilla', url: 'https://maps.app.goo.gl/Pg3ntm2Y52mPiSR96' }
    ]
  },
  'Compulago': {
    name: 'Compulago',
    branches: [
      { label: 'C.C. Paseo de la Castellana', q: 'Compulago+Castellana+Cartagena', url: 'https://maps.app.goo.gl/oih7Cm6J9jFJUnrZA' },
      { label: 'C.C Centro Uno', q: 'COMPULAGO CENTRO COMERCIAL CENTRO UNO CARTAGENA', url: 'https://maps.app.goo.gl/Njxt6N9hZKSCCSZy5' },
      { label: 'C.C Paseo de la Castellana', q: 'CENTRO COMERCIAL PASEO LA CASTELLANA CARTAGENA', url: 'https://maps.app.goo.gl/vVbWDFneZCVpJogZ7' },
      { label: 'C.C La Plazuela', q: 'COMPULAGO PLAZUELA IN CENTRO COMERCIAL MULTICENTRO LA PLAZUELA', url: 'https://maps.app.goo.gl/3ZnMx5VPrYbN8sn76' }
    ]
  },
  'Computerworking': {
    name: 'Computerworking',
    branches: [
      { label: 'C.C Centro uno', q: 'COMPUWORKING S.A.S', url: 'https://maps.app.goo.gl/rzEU5Gbev459CuRg7' },
      { label: 'AVENIDA PEDRO DE HEREDIA', q: 'Avenida Pedro de Heredia 63A-62', url: 'https://maps.app.goo.gl/eQ6RmrNM43rstE8X8' },
      { label: 'CC Paseo La Castellana', q: 'CC Paseo La Castellana Lc 118 piso 1', url: 'https://maps.app.goo.gl/doXxZPicC7raAHE69' }
    ]
  },
  'Falabella': {
    name: 'Falabella',
    branches: [
      { label: 'C.C. Mall Plaza El Castillo', q: 'Falabella+Mallplaza+Cartagena', url: 'https://maps.app.goo.gl/LfyjQv83TT5nctxv8' }
    ]
  }
};
function setupLocationTabs() {
  const tabs = document.querySelectorAll('.loc-tab');
  const nameEl = document.getElementById('loc-store-name');
  const listEl = document.getElementById('loc-address-list');
  const mapEl = document.getElementById('loc-map-iframe');
  const linkEl = document.getElementById('loc-gmaps-link'); // Referencia al botón
  function updateMap(query, url) {
    const mapUrl = `https://maps.google.com/maps?q=${query}&t=&z=16&ie=UTF8&iwloc=A&output=embed`;
    mapEl.style.opacity = '0.5';
    mapEl.src = mapUrl;
    linkEl.href = url; // Actualizamos el enlace del botón

    mapEl.onload = () => { mapEl.style.opacity = '1'; };
  }
  function updateStore(storeKey) {
    const data = STORE_LOCATIONS[storeKey];
    if (!data) return;
    nameEl.textContent = data.name;
    listEl.innerHTML = data.branches.map((branch, idx) => `
      <li class="loc-address-item ${idx === 0 ? 'active' : ''}" data-q="${branch.q}" data-url="${branch.url}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        ${branch.label}
      </li>
    `).join('');
    listEl.querySelectorAll('.loc-address-item').forEach(item => {
      item.addEventListener('click', () => {
        listEl.querySelectorAll('.loc-address-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        updateMap(item.dataset.q, item.dataset.url);
      });
    });
    // Carga inicial de la primera sucursal
    updateMap(data.branches[0].q, data.branches[0].url);
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateStore(tab.dataset.store);
    });
  });
  updateStore('Alkosto');
}

