import { auth, onAuthStateChanged, signOut } from "./firebase-config.js";

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

  onAuthStateChanged(auth, (user) => {
    if (user) {
      const photo = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random&color=fff`;
      
      if (profileImg) profileImg.src = photo;
      if (modalImg) modalImg.src = photo;
      if (modalName) modalName.textContent = user.displayName || 'Usuario';
      if (modalEmail) modalEmail.textContent = user.email;
      
      // If logged in, clicking the icon opens the modal
      profileIcon.onclick = (e) => {
        e.preventDefault();
        modalOverlay.classList.add('active');
      };
    } else {
      if (profileImg) profileImg.src = 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';
      profileIcon.onclick = null; // Default behavior (link to login.html)
    }
  });

  if (closeModal) {
    closeModal.onclick = () => modalOverlay.classList.remove('active');
  }

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
