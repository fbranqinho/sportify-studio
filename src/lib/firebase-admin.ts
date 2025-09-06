
import * as admin from 'firebase-admin';

let adminApp: admin.app | null = null;

if (!admin.apps.length) {
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
  }
} else {
  adminApp = admin.apps[0];
}

export { adminApp };
