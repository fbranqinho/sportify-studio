// src/lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// This new, robust pattern ensures Firebase Admin is initialized only once.
if (!admin.apps.length) {
  // When running in a deployed environment, initializeApp() is called without
  // arguments and it uses GOOGLE_APPLICATION_CREDENTIALS environment variable.
  // In a local environment, the Genkit dev server automatically sets up
  // the required environment variables.
  try {
      admin.initializeApp();
  } catch (error: any) {
      console.error('Firebase admin initialization error', error.stack);
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };
