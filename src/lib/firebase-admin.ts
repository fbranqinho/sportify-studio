// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// This new, robust pattern ensures Firebase Admin is initialized only once.
if (!admin.apps.length) {
  try {
    // This is the robust way to initialize for server-side environments like Next.js Server Actions / API routes.
    // It uses environment variables to securely configure the connection.
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };
