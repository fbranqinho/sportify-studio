
import * as admin from 'firebase-admin';

let adminApp: admin.app | null = null;

function initializeAdminApp(): admin.app {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn("Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Admin features will be disabled.");
      throw new Error("Service account key is not available.");
    }
  } catch (error: any) {
    console.error("Firebase Admin SDK Initialization Error:", error.message);
    throw new Error("Failed to initialize Firebase Admin SDK.");
  }
}

export function getAdminApp(): admin.app {
    if (!adminApp) {
        adminApp = initializeAdminApp();
    }
    return adminApp;
}
