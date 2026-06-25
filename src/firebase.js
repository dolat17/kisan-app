import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCXY9SY5fCOqlkhNDFsefmjcgQCEUnq0c0",
  authDomain: "haari-kisaan-finance-app.firebaseapp.com",
  projectId: "haari-kisaan-finance-app",
  storageBucket: "haari-kisaan-finance-app.firebasestorage.app",
  messagingSenderId: "222002214036",
  appId: "1:222002214036:web:58f360337184bbca2db081",
  measurementId: "G-G7VCDJ471G"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);