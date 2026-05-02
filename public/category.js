// ── category.js — Products page ──

let allProducts = [];
let compareList = [];
let activeStores = [];
let activeCategories = [];
let activeSubcategories = [];
let activeBrands = [];
let onlyDiscounted = false;
let maxPrice = 10000;

document.addEventListener('DOMContentLoaded', async () => {
  // Read ?cat= from URL and pre-select it
  const params = new URLSearchParams(window.location.search);
  const presetCat = params.get('cat');
  if (presetCat) activeCategories = [presetCat];

  await loadProducts();
  setupSearch();
  setupSort();
  setupPriceRange();
  setupQuickPrices();
  setupDiscountToggle();
  setupCompareBar();
  setupModal();
  setupClearFilters();
  setupBackToTop();
});

// ── FETCH ──
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();

    if (allProducts.length > 0) {
      const max = Math.max(...allProducts.map(p => p.price));
      maxPrice = Math.ceil(max / 1000) * 1000;
      const range = document.getElementById('price-range');
      range.max = maxPrice;
      range.value = maxPrice;
      document.getElementById('price-val').textContent = '$' + maxPrice.toLocaleString();
    }

    buildCategoryFilters();
    buildSubcategoryFilters();
    buildStoreFilters();
    buildBrandFilters();
    applyFilters();
  } catch (err) {
    document.getElementById('loading-state').innerHTML = '<p style="color:#c00">Error al cargar productos.</p>';
  }
}

// ── CATEGORY FILTER CHIPS ──
const CAT_ORDER = ['computadores','celulares','tablets','pantallas','audio','consolas','impresoras','otros'];

function buildCategoryFilters() {
  const cats = [...new Set(allProducts.map(p => p.category || 'otros'))]
    .sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1; if (ib === -1) return -1;
      return ia - ib;
    });

  const container = document.getElementById('filter-category');
  container.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (activeCategories.includes(cat) ? ' active' : '');
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.innerHTML = catIcon(cat, 14) + ' ' + label;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      activeCategories = activeCategories.includes(cat)
        ? activeCategories.filter(c => c !== cat)
        : [...activeCategories, cat];
      activeSubcategories = [];
      buildSubcategoryFilters();
      updateCatTitleBar();
      applyFilters();
    });
    container.appendChild(btn);
  });
  updateCatTitleBar();
}

function updateCatTitleBar() {
  const bar = document.getElementById('cat-title-bar');
  const iconEl = document.getElementById('cat-title-icon');
  const nameEl = document.getElementById('cat-title-name');
  const countEl = document.getElementById('cat-title-count');

  if (activeCategories.length === 1) {
    const cat = activeCategories[0];
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    const count = allProducts.filter(p => (p.category || 'otros') === cat).length;
    iconEl.innerHTML = catIcon(cat, 20);
    nameEl.textContent = label;
    countEl.textContent = `${count.toLocaleString()} productos`;
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

// ── SUBCATEGORY FILTER CHIPS ──
function buildSubcategoryFilters() {
  const container = document.getElementById('filter-subcategory');
  const group = document.getElementById('filter-group-subcategory');
  
  if (activeCategories.length === 0) {
    group.style.display = 'none';
    return;
  }
  
  const validProducts = allProducts.filter(p => activeCategories.includes(p.category || 'otros'));
  const subcats = [...new Set(validProducts.map(p => p.subcategory || 'General'))].sort();
  
  if (subcats.length <= 1) {
    group.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  subcats.forEach(sub => {
    if (sub === 'General' && subcats.length > 1) return;
    const btn = document.createElement('button');
    btn.className = 'chip' + (activeSubcategories.includes(sub) ? ' active' : '');
    btn.textContent = sub;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      activeSubcategories = activeSubcategories.includes(sub)
        ? activeSubcategories.filter(s => s !== sub)
        : [...activeSubcategories, sub];
      applyFilters();
    });
    container.appendChild(btn);
  });
  
  group.style.display = 'block';
}

// ── BRAND FILTER CHIPS ──
function buildBrandFilters() {
  const brands = [...new Set(allProducts.map(p => p.brand))].sort();
  const container = document.getElementById('filter-brand');
  container.innerHTML = '';
  // Show top 12 brands or search? Let's show top brands
  brands.slice(0, 15).forEach(brand => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = brand;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      activeBrands = activeBrands.includes(brand)
        ? activeBrands.filter(b => b !== brand)
        : [...activeBrands, brand];
      applyFilters();
    });
    container.appendChild(btn);
  });
}

// ── STORE FILTER CHIPS ──
function buildStoreFilters() {
  const stores = [...new Set(allProducts.map(p => p.store))].sort();
  const container = document.getElementById('filter-store');
  container.innerHTML = '';
  stores.forEach(store => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = store;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      activeStores = activeStores.includes(store)
        ? activeStores.filter(s => s !== store)
        : [...activeStores, store];
      applyFilters();
    });
    container.appendChild(btn);
  });
}

// ── FILTERS ──
function applyFilters() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const priceMax = parseInt(document.getElementById('price-range').value);
  const sort = document.getElementById('sort-select').value;

  let filtered = allProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(query) || p.store.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query);
    const matchPrice = p.price <= priceMax;
    const matchStore = activeStores.length === 0 || activeStores.includes(p.store);
    const matchCat = activeCategories.length === 0 || activeCategories.includes(p.category || 'otros');
    const matchSubcat = activeSubcategories.length === 0 || activeSubcategories.includes(p.subcategory || 'General');
    const matchBrand = activeBrands.length === 0 || activeBrands.includes(p.brand);
    const matchDiscount = !onlyDiscounted || (p.originalPrice && p.originalPrice !== p.price);
    return matchSearch && matchPrice && matchStore && matchCat && matchSubcat && matchBrand && matchDiscount;
  });

  if (sort === 'price-asc')  filtered.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (sort === 'name-asc')   filtered.sort((a, b) => a.name.localeCompare(b.name));

  renderProducts(filtered);
}

// ── RENDER (grouped by category) ──
function renderProducts(products) {
  const grid = document.getElementById('product-grid');
  const loading = document.getElementById('loading-state');
  const empty = document.getElementById('empty-state');

  if (loading) loading.remove();
  grid.innerHTML = '';

  const total = allProducts.length;
  document.getElementById('results-count').textContent =
    products.length === total ? `${products.length} productos` : `${products.length} de ${total}`;

  if (products.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  // Group by category
  const grouped = {};
  products.forEach(p => {
    const cat = p.category || 'otros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const sortedCats = Object.keys(grouped).sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });

  let idx = 0;
  sortedCats.forEach(cat => {
    const items = grouped[cat];
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);

    const section = document.createElement('div');
    section.className = 'cat-section';

    const header = document.createElement('div');
    header.className = 'cat-header';
    header.innerHTML = `
      <span class="cat-icon">${catIcon(cat, 18)}</span>
      <span class="cat-name">${label}</span>
      <span class="cat-count">${items.length}</span>
      <span class="cat-toggle-icon">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M2 7l3-4 3 4"/>
        </svg>
      </span>
    `;

    const catGrid = document.createElement('div');
    catGrid.className = 'cat-grid';

    let collapsed = false;
    header.addEventListener('click', () => {
      collapsed = !collapsed;
      catGrid.style.display = collapsed ? 'none' : 'grid';
      const chevron = header.querySelector('.cat-toggle-icon svg path');
      if (chevron) chevron.setAttribute('d', collapsed ? 'M2 3l3 4 3-4' : 'M2 7l3-4 3 4');
      header.classList.toggle('collapsed', collapsed);
    });

    let displayedCount = 0;
    const CHUNK_SIZE = 16;
    let loadMoreBtn = null;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'load-more-container';

    function renderChunk() {
      const chunk = items.slice(displayedCount, displayedCount + CHUNK_SIZE);
      chunk.forEach(product => {
        catGrid.appendChild(makeCard(product, ((displayedCount++) * 0.02).toFixed(2)));
      });
      
      if (displayedCount < items.length) {
        if (!loadMoreBtn) {
          loadMoreBtn = document.createElement('button');
          loadMoreBtn.className = 'load-more-btn';
          loadMoreBtn.textContent = 'Ver más productos';
          loadMoreBtn.addEventListener('click', renderChunk);
          btnContainer.appendChild(loadMoreBtn);
          section.appendChild(btnContainer);
        }
      } else if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
      }
    }

    renderChunk();

    section.appendChild(header);
    section.appendChild(catGrid);
    if (loadMoreBtn) section.appendChild(btnContainer);
    grid.appendChild(section);
  });
}

function formatPriceHtml(p) {
  const hasDiscount = p.originalPrice && p.originalPrice > p.price;
  if (!hasDiscount) {
    return `<div class="card-price">$${Number(p.price).toLocaleString()}</div>`;
  }
  return `
    <div class="card-price-wrap">
      <div class="card-price-old">$${Number(p.originalPrice).toLocaleString()}</div>
      <div class="card-price-new">$${Number(p.price).toLocaleString()}</div>
    </div>
  `;
}

function makeCard(product, delay = 0) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.style.animationDelay = `${delay}s`;

  const inCompare = compareList.find(p => p._id === product._id);
  const imgContent = product.image
    ? `<img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const svgFallback = `<span class="card-img-fallback" style="${product.image ? 'display:none' : ''}">${catIcon(product.category, 40)}</span>`;

  const discountTag = (product.discount || (product.originalPrice && product.originalPrice > product.price)) 
    ? `<span class="card-discount-badge">${product.discount || 'OFERTA'}</span>` 
    : '';

  card.innerHTML = `
    <div class="card-img-box">
      ${imgContent}${svgFallback}
      <span class="card-store">${product.store}</span>
      ${discountTag}
    </div>
    <div class="card-name">${product.name}</div>
    ${renderStarsHtml(product.rating)}
    ${formatPriceHtml(product)}
    <div class="card-actions">
      <a class="btn-view" href="${product.url}" target="_blank" rel="noopener">Ver producto</a>
      <button class="btn-compare ${inCompare ? 'active' : ''}" data-id="${product._id}">
        ${inCompare ? '✓ Comparar' : '+ Comparar'}
      </button>
    </div>
  `;
  card.querySelector('.btn-compare').addEventListener('click', () => toggleCompare(product));
  return card;
}

// ── SETUP LISTENERS ──
function setupSearch() { document.getElementById('search-input').addEventListener('input', applyFilters); }
function setupSort()   { document.getElementById('sort-select').addEventListener('change', applyFilters); }
function setupPriceRange() {
  const range = document.getElementById('price-range');
  const val   = document.getElementById('price-val');
  range.addEventListener('input', () => { 
    val.textContent = '$' + parseInt(range.value).toLocaleString(); 
    document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('active'));
    applyFilters(); 
  });
}

function setupQuickPrices() {
  document.querySelectorAll('.price-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.price-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const max = btn.dataset.max ? parseInt(btn.dataset.max) : maxPrice;
      const min = btn.dataset.min ? parseInt(btn.dataset.min) : 0;
      
      const range = document.getElementById('price-range');
      range.value = max;
      document.getElementById('price-val').textContent = '$' + max.toLocaleString();
      
      // We could filter specifically by min too, but the slider only has max. 
      // For simplicity, we'll set the slider and apply filters.
      applyFilters();
    });
  });
}

function setupDiscountToggle() {
  document.getElementById('filter-discount').addEventListener('change', (e) => {
    onlyDiscounted = e.target.checked;
    applyFilters();
  });
}
function setupClearFilters() {
  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    activeStores = []; activeCategories = []; activeSubcategories = []; activeBrands = [];
    document.getElementById('filter-group-subcategory').style.display = 'none';
    onlyDiscounted = false;
    document.getElementById('filter-discount').checked = false;
    document.querySelectorAll('.chip, .price-chip').forEach(c => c.classList.remove('active'));
    const range = document.getElementById('price-range');
    range.value = range.max;
    document.getElementById('price-val').textContent = '$' + parseInt(range.max).toLocaleString();
    updateCatTitleBar();
    applyFilters();
  });
}

function setupBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ── COMPARE ──
function toggleCompare(product) {
  const idx = compareList.findIndex(p => p._id === product._id);
  if (idx > -1) {
    compareList.splice(idx, 1);
  } else {
    if (compareList.length >= 4) { alert('Puedes comparar máximo 4 productos.'); return; }
    compareList.push(product);
  }
  updateCompareBar();
  applyFilters();
}

function updateCompareBar() {
  const bar = document.getElementById('compare-bar');
  const items = document.getElementById('compare-items');
  if (compareList.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  items.innerHTML = compareList.map(p => `<span class="compare-chip-item">${p.name}</span>`).join('');
}

function setupCompareBar() {
  document.getElementById('compare-action').addEventListener('click', showCompareModal);
  document.getElementById('compare-clear').addEventListener('click', () => { compareList = []; updateCompareBar(); applyFilters(); });
}

// ── MODAL ──
function showCompareModal() {
  if (compareList.length < 2) { alert('Selecciona al menos 2 productos.'); return; }
  const wrap = document.getElementById('compare-table-wrap');
  const minPrice = Math.min(...compareList.map(p => p.price));
  let html = '<table class="compare-table"><thead><tr><th>Atributo</th>';
  compareList.forEach(p => { html += `<th>${p.name}</th>`; });
  html += '</tr></thead><tbody>';
  html += '<tr><td>Precio</td>';
  compareList.forEach(p => {
    const best = p.price === minPrice ? ' class="price-cell best"' : ' class="price-cell"';
    html += `<td${best}>$${Number(p.price).toLocaleString()}</td>`;
  });
  html += '</tr><tr><td>Tienda</td>';
  compareList.forEach(p => { html += `<td>${p.store}</td>`; });
  html += '</tr><tr><td>Enlace</td>';
  compareList.forEach(p => { html += `<td><a href="${p.url}" target="_blank" style="color:#1A5FBF;font-size:11px">Ver →</a></td>`; });
  html += '</tr></tbody></table>';
  wrap.innerHTML = html;
  document.getElementById('compare-modal').style.display = 'flex';
  document.getElementById('modal-overlay').style.display = 'block';
}

function setupModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);
}

function closeModal() {
  document.getElementById('compare-modal').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'none';
}
