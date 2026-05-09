/**
 * shared/product-card.js
 * ──────────────────────────────────────────────────────────────────
 * Módulo reutilizable para generar tarjetas de productos.
 * Desacoplado de cualquier estado de página a través de callbacks.
 *
 * Uso:
 *   import { makeProductCard } from '../shared/product-card.js';
 *
 *   const card = makeProductCard(product, {
 *     delay:       0,                         // animación (opcional)
 *     inCompare:   compareList.has(product),  // estado de comparación (opcional)
 *     favorited:   isFavorite(product._id),   // estado de favorito (opcional)
 *     onCardClick: (p) => showProductDetails(p),
 *     onCompare:   (p) => toggleCompare(p),
 *     onFavorite:  async (p) => { await toggleFavorite(p); applyFilters(); },
 *   });
 * ──────────────────────────────────────────────────────────────────
 */

import { CAT_ICONS, catIcon, renderStarsHtml, getStoreBadgeClass } from '../dashboard/icons.js';

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Devuelve el HTML del precio, con tachado si hay descuento.
 * @param {object} product
 * @returns {string}
 */
export function formatCardPriceHtml(product) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  if (!hasDiscount) {
    return `<div class="card-price">$${Number(product.price).toLocaleString()}</div>`;
  }
  return `
    <div class="card-price-wrap">
      <div class="card-price-old">$${Number(product.originalPrice).toLocaleString()}</div>
      <div class="card-price-new">$${Number(product.price).toLocaleString()}</div>
    </div>
  `;
}

// ── makeProductCard ───────────────────────────────────────────────

/**
 * Crea un elemento <div class="product-card"> listo para insertar en el DOM.
 *
 * @param {object} product   - Objeto de producto desde la API.
 * @param {object} [options]
 * @param {number}   [options.delay=0]        - Retraso de la animación de entrada (segundos).
 * @param {boolean}  [options.inCompare=false] - Si el producto está en la lista de comparación.
 * @param {boolean}  [options.favorited=false] - Si el producto está marcado como favorito.
 * @param {boolean}  [options.showCompare=true]- Mostrar el botón de comparar.
 * @param {function} [options.onCardClick]    - Callback al hacer clic en la tarjeta.
 * @param {function} [options.onCompare]      - Callback al hacer clic en "Comparar".
 * @param {function} [options.onFavorite]     - Callback (async) al hacer clic en el corazón.
 * @returns {HTMLElement}
 */
export function makeProductCard(product, options = {}) {
  const {
    delay = 0,
    inCompare = false,
    favorited = false,
    showCompare = true,
    onCardClick = null,
    onCompare = null,
    onFavorite = null,
  } = options;

  // ── DOM element ──
  const card = document.createElement('div');
  card.className = 'product-card';
  card.style.animationDelay = `${delay}s`;
  if (onCardClick) card.style.cursor = 'pointer';

  // ── Image ──
  const imgContent = product.image
    ? `<img
        src="${product.image}"
        alt="${product.name}"
        loading="lazy"
        class="product-img"
        onload="this.classList.add('loaded');this.parentElement.classList.remove('loading')"
        onerror="this.style.display='none';this.parentElement.classList.remove('loading');this.nextElementSibling.style.display='flex'"
      >`
    : '';
  const svgFallback = `<span class="card-img-fallback" style="${product.image ? 'display:none' : ''}">${catIcon(product.category, 40)}</span>`;

  // ── Badges ──
  const discountTag = (product.discount || (product.originalPrice && product.originalPrice > product.price))
    ? `<span class="card-discount-badge">${product.discount || 'OFERTA'}</span>`
    : '';

  const compareBtn = showCompare
    ? `<button class="btn-compare ${inCompare ? 'active' : ''}" data-id="${product._id}">
         ${inCompare ? '✓ Comparar' : '+ Comparar'}
       </button>`
    : '';

  // ── HTML ──
  card.innerHTML = `
    <div class="card-img-box ${product.image ? 'loading' : ''}">
      ${imgContent}${svgFallback}
      <span class="card-store ${getStoreBadgeClass(product.store)}">${product.store}</span>
      ${discountTag}
      <button class="card-fav-btn ${favorited ? 'active' : ''}" title="Añadir a favoritos">
        ${favorited ? CAT_ICONS.heartFilled : CAT_ICONS.heart}
      </button>
    </div>
    <div class="card-name">${product.name}</div>
    ${renderStarsHtml(product.rating)}
    ${formatCardPriceHtml(product)}
    <div class="card-actions">
      <a class="btn-view" href="${product.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Ver producto</a>
      ${compareBtn}
    </div>
  `;

  // ── Event Listeners ──
  if (onCardClick) {
    card.addEventListener('click', () => onCardClick(product));
  }

  if (showCompare && onCompare) {
    card.querySelector('.btn-compare').addEventListener('click', (e) => {
      e.stopPropagation();
      onCompare(product);
    });
  }

  const favBtn = card.querySelector('.card-fav-btn');
  if (onFavorite) {
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await onFavorite(product);
    });
  }

  return card;
}
