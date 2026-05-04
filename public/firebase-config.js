import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzT1ZPmdYSwXUV1tFZj7mD5cxc3HlLGLo",
  authDomain: "techfind-72d4a.firebaseapp.com",
  projectId: "techfind-72d4a",
  storageBucket: "techfind-72d4a.firebasestorage.app",
  messagingSenderId: "1028121276535",
  appId: "1:1028121276535:web:0411b77cd54fa97eb69672",
  measurementId: "G-V3BKW6P35N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const googleProvider = new GoogleAuthProvider();

export { 
  auth, 
  db, 
  googleProvider, 
  analytics,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  doc,
  setDoc,
  getDoc
};
