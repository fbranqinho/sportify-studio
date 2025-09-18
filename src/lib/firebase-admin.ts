import { initializeApp, getApps, getApp } from "firebase-admin/app";
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Explicitly load variables from .env.local into the environment
// This ensures that server-side code always has access to the credentials.
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};


const adminApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const adminDb = admin.firestore();
const adminAuth = admin.auth();
export { adminDb, adminAuth };
