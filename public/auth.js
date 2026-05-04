import { 
  auth, 
  db, 
  googleProvider,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  onAuthStateChanged,
  doc, 
  setDoc 
} from "./firebase-config.js";

// Register Form Logic
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nombre").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save additional data in Firestore
      await setDoc(doc(db, "usuarios", user.uid), {
        nombre: nombre,
        email: email,
        createdAt: new Date().toISOString()
      });

      alert("¡Cuenta creada exitosamente!");
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error en registro:", error);
      alert(`Error: ${error.message}`);
    }
  });
}

// Login Form Logic
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Inicio de sesión exitoso");
      window.location.href = "index.html"; // Redirect to home
    } catch (error) {
      console.error("Error en login:", error);
      alert(`Error: ${error.message}`);
    }
  });
}

// Google Login (if button exists)
const googleBtn = document.getElementById("google-login");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Also save Google users to Firestore if they are new
      await setDoc(doc(db, "usuarios", user.uid), {
        nombre: user.displayName,
        email: user.email,
        lastLogin: new Date().toISOString()
      }, { merge: true });

      alert(`Bienvenido ${user.displayName}`);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Error en Google login:", error);
      alert(`Error: ${error.message}`);
    }
  });
}

// Check auth state for protected elements or redirects
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Usuario autenticado:", user.email);
    // If we are on login/register page, maybe redirect to home?
    const path = window.location.pathname;
    if (path.includes("login.html") || path.includes("register.html")) {
      // window.location.href = "index.html";
    }
  } else {
    console.log("No hay usuario autenticado");
  }
});
