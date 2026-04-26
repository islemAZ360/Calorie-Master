import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCEibzdg2m0toM_zEcmWJahsE7Lqu9ApYI",
  authDomain: "calorie-d3a81.firebaseapp.com",
  projectId: "calorie-d3a81",
  storageBucket: "calorie-d3a81.firebasestorage.app",
  messagingSenderId: "114051539203",
  appId: "1:114051539203:web:43d3fbed92a4fcfd0a8936",
  measurementId: "G-GNMM4SFPLJ"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize analytics only in browser environment
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
