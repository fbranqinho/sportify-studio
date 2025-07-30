
// scripts/seed-firestore.js
/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config({ path: './.env' });
const admin = require('firebase-admin');
const { mockData } = require('../dist/lib/mock-data');

// Your web app's Firebase configuration
const firebaseConfig = {
  projectId: "sportify-ge7ao",
  // IMPORTANT: For Admin SDK, we use service account credentials, not the web config.
  // The FIREBASE_CONFIG env var should be set to a JSON string with your service account key.
  // OR you can set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account file.
};

// Initialize Firebase Admin SDK
// Check if GOOGLE_APPLICATION_CREDENTIALS is set
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('ERROR: The GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
    console.log('Please download your service account key from the Firebase console and set the path in your environment.');
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId,
    });
} catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    console.log('Please ensure your GOOGLE_APPLICATION_CREDENTIALS path is correct and the file is valid.');
    process.exit(1);
}


const db = admin.firestore();

async function seedDatabase() {
  console.log('Starting to seed database...');

  const collections = {
    users: mockData.users,
    playerProfiles: mockData.playerProfiles,
    managerProfiles: mockData.managerProfiles,
    ownerProfiles: mockData.ownerProfiles,
    promoterProfiles: mockData.promoterProfiles,
    refereeProfiles: mockData.refereeProfiles,
    adminProfiles: mockData.adminProfiles,
    teams: mockData.teams,
    pitches: mockData.pitches,
    competitions: mockData.competitions,
    matches: mockData.matches,
    payments: mockData.payments,
  };

  for (const [collectionName, data] of Object.entries(collections)) {
    console.log(`Seeding collection: ${collectionName}...`);
    const collectionRef = db.collection(collectionName);
    const batch = db.batch();

    data.forEach((doc) => {
      const docRef = collectionRef.doc(doc.id);
      batch.set(docRef, doc);
    });

    await batch.commit();
    console.log(`Successfully seeded ${data.length} documents into ${collectionName}.`);
  }

  console.log('Database seeding completed successfully!');
}

seedDatabase().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
