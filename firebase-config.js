// firebase-config.js (SDK v9)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB58ojfz5unPkb9BiTFwAOX1Gm9PaLgktg",
  authDomain: "materialistapage.firebaseapp.com",
  projectId: "materialistapage",
  storageBucket: "materialistapage.firebasestorage.app",
  messagingSenderId: "988439912442",
  appId: "1:988439912442:web:6369f68cd16741b44ece43",
  measurementId: "G-D7JY670L6R"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
