// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "sportify-ge7ao",
  "appId": "1:980987118705:web:81abe478e1817ae02407d0",
  "storageBucket": "sportify-ge7ao.firebasestorage.app",
  "apiKey": "AIzaSyAr9Cud3duyQpJ7pyzOMoNsxXFqhQ9JbTo",
  "authDomain": "sportify-ge7ao.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "980987118705"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
