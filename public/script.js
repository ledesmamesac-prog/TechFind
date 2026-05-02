// ── lobby script.js ──
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/summary');
    const { categories, featured, storeCount, stores } = await res.json();

    // Hero stats
    const total = categories.reduce((s, c) => s + c.count, 0);
    document.getElementById('stat-total').textContent = total.toLocaleString();
    document.getElementById('stat-cats').textContent = categories.length;
    document.getElementById('stat-stores').textContent = storeCount || 0;

    // Render stores in topbar is now static in HTML

    renderCategoryCards(categories);
    renderFeatured(featured);

    // Initialize locations section
    setupLocationTabs();
  } catch (err) {
    console.error('Error loading summary:', err);
  }
});

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
    const card = document.createElement('a');
    card.className = 'featured-card';
    card.href = p.url;
    card.target = '_blank';
    card.rel = 'noopener';
    card.style.animationDelay = `${i * 0.05}s`;

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
    grid.appendChild(card);
  });
}

// ... (dentro de script.js)

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

