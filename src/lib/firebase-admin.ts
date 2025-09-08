import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // When deployed to App Hosting, GOOGLE_APPLICATION_CREDENTIALS is automatically set.
  // When running locally, you need to set this environment variable yourself.
  admin.initializeApp();
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
