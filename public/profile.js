import { auth, db, onAuthStateChanged, signOut, doc, setDoc, getDoc } from "./firebase-config.js";
import { catIcon } from "./icons.js";

let userFavorites = [];

export function initProfile() {
  const profileIcon = document.querySelector('.profile-icon');
  if (!profileIcon) return;

  const profileImg = profileIcon.querySelector('img');
  const modalOverlay = document.getElementById('profile-modal-overlay');
  const closeModal = document.getElementById('close-profile-modal');
  const logoutBtn = document.getElementById('logout-btn');
  
  const modalImg = document.getElementById('modal-user-img');
  const modalName = document.getElementById('modal-user-name');
  const modalEmail = document.getElementById('modal-user-email');
  const favoritesList = document.getElementById('modal-favorites-list');

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const photo = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random&color=fff`;
      
      if (profileImg) profileImg.src = photo;
      if (modalImg) modalImg.src = photo;
      if (modalName) modalName.textContent = user.displayName || 'Usuario';
      if (modalEmail) modalEmail.textContent = user.email;
      
      // Load favorites from Firestore
      userFavorites = await loadFavorites(user.uid);
      renderFavoritesInModal(favoritesList);

      profileIcon.onclick = (e) => {
        e.preventDefault();
        renderFavoritesInModal(favoritesList);
        modalOverlay.classList.add('active');
      };
    } else {
      userFavorites = [];
      if (profileImg) profileImg.src = 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';
      profileIcon.onclick = null; 
    }
  });

  if (closeModal) closeModal.onclick = () => modalOverlay.classList.remove('active');
  if (modalOverlay) {
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        await signOut(auth);
        modalOverlay.classList.remove('active');
        window.location.reload();
      } catch (err) {
        console.error("Error signing out:", err);
      }
    };
  }
}

async function loadFavorites(uid) {
  try {
    const d = await getDoc(doc(db, "users", uid));
    if (d.exists()) return d.data().favorites || [];
  } catch (err) {
    console.error("Error loading favorites:", err);
  }
  return [];
}

async function saveFavorites(uid) {
  try {
    await setDoc(doc(db, "users", uid), { favorites: userFavorites }, { merge: true });
  } catch (err) {
    console.error("Error saving favorites:", err);
  }
}

export async function toggleFavorite(product) {
  const user = auth.currentUser;
  if (!user) {
    alert("Inicia sesión para guardar favoritos");
    window.location.href = 'login.html';
    return false;
  }

  const idx = userFavorites.findIndex(p => p._id === product._id);
  if (idx > -1) {
    userFavorites.splice(idx, 1);
  } else {
    // Store minimal product info in favorites
    userFavorites.push({
      _id: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      store: product.store,
      url: product.url,
      category: product.category
    });
  }
  
  await saveFavorites(user.uid);
  return true;
}

export function isFavorite(productId) {
  return userFavorites.some(p => p._id === productId);
}

function renderFavoritesInModal(container) {
  if (!container) return;
  if (userFavorites.length === 0) {
    container.innerHTML = '<p class="empty-favs">No tienes productos favoritos aún.</p>';
    return;
  }

  container.innerHTML = userFavorites.map(p => `
    <div class="fav-item">
      <div class="fav-img">${p.image ? `<img src="${p.image}" alt="">` : catIcon(p.category, 24)}</div>
      <div class="fav-info">
        <div class="fav-name">${p.name}</div>
        <div class="fav-price">$${Number(p.price).toLocaleString()}</div>
      </div>
      <a href="${p.url}" target="_blank" class="fav-btn">Ver</a>
    </div>
  `).join('');
}
