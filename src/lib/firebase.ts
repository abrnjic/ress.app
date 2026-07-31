import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB89ra_6JZhp9EHFYZM3-9mvx5OUgo95cE",
  authDomain: "reseller-c7b06.firebaseapp.com",
  projectId: "reseller-c7b06",
  storageBucket: "reseller-c7b06.firebasestorage.app",
  messagingSenderId: "63027999030",
  appId: "1:63027999030:web:0afaeb5d1bef0969750397"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
