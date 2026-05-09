import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, signOut } from './firebase-config.js';
import { initProfile } from './profile.js';
import { catIcon, getStoreBadgeClass, renderStarsHtml } from './icons.js';

initProfile();

const favoritesGrid = document.getElementById('favorites-grid');
const favoritesEmpty = document.getElementById('favorites-empty');
const favoritesCount = document.getElementById('favorites-page-count');
const clearFavoritesBtn = document.getElementById('clear-favorites-btn');
const sortGroup = document.getElementById('favorites-sort-group');
const profileOverlay = document.getElementById('profile-modal-overlay');
const logoutBtn = document.getElementById('logout-btn');

let currentUser = null;
let favorites = [];
let currentSort = 'recent';

function formatPrice(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function getSortedFavorites() {
  const items = [...favorites];

  if (currentSort === 'price-asc') {
    return items.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  }

  if (currentSort === 'discount-desc') {
    return items.sort((a, b) => {
      const discountA = Number(a.originalPrice || 0) > Number(a.price || 0)
        ? Number(a.originalPrice) - Number(a.price)
        : 0;
      const discountB = Number(b.originalPrice || 0) > Number(b.price || 0)
        ? Number(b.originalPrice) - Number(b.price)
        : 0;
      return discountB - discountA;
    });
  }

  return items.reverse();
}

function updateHeader() {
  if (favoritesCount) {
    favoritesCount.textContent = `${favorites.length} producto${favorites.length === 1 ? '' : 's'}`;
  }
}

function renderEmptyState() {
  favoritesEmpty.hidden = false;
  favoritesGrid.innerHTML = '';
}

function renderFavorites() {
  updateHeader();

  if (!favorites.length) {
    renderEmptyState();
    return;
  }

  favoritesEmpty.hidden = true;
  favoritesGrid.innerHTML = getSortedFavorites().map((product) => {
    const discount = Number(product.originalPrice || 0) > Number(product.price || 0)
      ? Math.round((1 - (Number(product.price) / Number(product.originalPrice))) * 100)
      : 0;

    return `
      <article class="product-card favorite-card" data-id="${product._id}">
        <div class="card-img-box ${product.image ? 'loading' : ''}">
          ${product.image
            ? `<img src="${product.image}" alt="${product.name}" loading="lazy" class="product-img" onload="this.classList.add('loaded');this.parentElement.classList.remove('loading')" onerror="this.style.display='none';this.parentElement.classList.remove('loading');this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="card-img-fallback" style="${product.image ? 'display:none' : ''}">${catIcon(product.category, 40)}</div>
          <span class="card-store ${getStoreBadgeClass(product.store)}">${product.store || 'Favorito'}</span>
          ${discount ? `<span class="card-discount-badge">-${discount}%</span>` : ''}
        </div>
        <div class="card-name">${product.name}</div>
        ${renderStarsHtml(product.rating)}
        ${product.originalPrice && Number(product.originalPrice) > Number(product.price)
          ? `<div class="card-price-wrap"><div class="card-price-old">${formatPrice(product.originalPrice)}</div><div class="card-price-new">${formatPrice(product.price)}</div></div>`
          : `<div class="card-price">${formatPrice(product.price)}</div>`}
        <div class="card-actions">
          <a href="${product.url}" target="_blank" class="btn-view">Ver producto</a>
          <button type="button" class="btn-compare" data-remove-id="${product._id}">Eliminar</button>
        </div>
      </article>
    `;
  }).join('');

  favoritesGrid.querySelectorAll('[data-remove-id]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await removeFavorite(button.getAttribute('data-remove-id'));
    });
  });
}


async function loadFavorites(uid) {
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    if (snapshot.exists()) return snapshot.data().favorites || [];
  } catch (error) {
    console.error('Error loading favorites:', error);
  }
  return [];
}

async function saveFavorites(uid, nextFavorites) {
  try {
    await setDoc(doc(db, 'users', uid), { favorites: nextFavorites }, { merge: true });
  } catch (error) {
    console.error('Error saving favorites:', error);
  }
}

async function removeFavorite(productId) {
  if (!currentUser) return;
  favorites = favorites.filter((item) => item._id !== productId);
  await saveFavorites(currentUser.uid, favorites);
  renderFavorites();
}

async function clearFavorites() {
  if (!currentUser) return;
  favorites = [];
  await saveFavorites(currentUser.uid, favorites);
  renderFavorites();
}

if (clearFavoritesBtn) {
  clearFavoritesBtn.addEventListener('click', clearFavorites);
}

if (sortGroup) {
  sortGroup.addEventListener('click', (event) => {
    const button = event.target.closest('[data-sort]');
    if (!button) return;

    currentSort = button.getAttribute('data-sort');
    sortGroup.querySelectorAll('.favorites-sort-btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    renderFavorites();
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      if (profileOverlay) profileOverlay.classList.remove('active');
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (!user) {
    favorites = [];
    renderFavorites();
    return;
  }

  favorites = await loadFavorites(user.uid);
  renderFavorites();
});