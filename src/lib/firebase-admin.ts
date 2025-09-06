
import * as admin from 'firebase-admin';

let adminApp: admin.app | null = null;

function initializeAdminApp() {
  if (admin.apps.length > 0) {
    adminApp = admin.app();
    return;
  }

  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn("Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Admin features will be disabled.");
    }
  } catch (error: any) {
    console.error("Firebase Admin SDK Initialization Error:", error.message);
    adminApp = null; // Ensure adminApp is null if initialization fails
  }
}

// Initialize on first import. Subsequent calls to getAdminApp will use the existing instance.
if (typeof window === 'undefined') { // Ensure this only runs on the server
  initializeAdminApp();
}


export { adminApp };
