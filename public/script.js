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

    // Render stores in topbar
    const topbarStores = document.getElementById('topbar-stores-list');
    if (topbarStores && stores) {
      topbarStores.innerHTML = stores.map(store => {
        const lower = store.toLowerCase();
        let badgeClass = 'store-badge';
        if (lower.includes('exito') || lower.includes('éxito')) badgeClass += ' exito-badge';
        else if (lower.includes('alkosto')) badgeClass += ' alkosto-badge';
        // Add more default classes if needed
        return `<span class="${badgeClass}">${store}</span>`;
      }).join('');
    }

    renderCategoryCards(categories);
    renderFeatured(featured);
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
        <span class="feat-store ${p.store === 'Alkosto' ? 'alkosto-badge' : 'exito-badge'}">${p.store}</span>
        <span class="feat-name">${p.name}</span>
        ${renderStarsHtml(p.rating)}
        ${formatPriceHtml(p)}
      </div>
    `;
    grid.appendChild(card);
  });
}
