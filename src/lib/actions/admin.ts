
'use server';

import * as admin from 'firebase-admin';

// This new, robust pattern ensures Firebase Admin is initialized only once.
const initializeAdmin = () => {
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
  return admin;
};

const getAdminDb = () => {
    initializeAdmin();
    return admin.firestore();
};

const convertTimestamps = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) {
        return data.map(item => convertTimestamps(item));
    }
    if (data instanceof admin.firestore.Timestamp) {
        return data.toDate().toISOString();
    }
    if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
        const newData: any = {};
        for (const key in data) {
            newData[key] = convertTimestamps(data[key]);
        }
        return newData;
    }
    return data;
};


// Helper function for batch deletion
async function deleteCollectionBatch(collectionRef: FirebaseFirestore.CollectionReference, batchSize: number): Promise<number> {
    const query = collectionRef.limit(batchSize);
    let deletedCount = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const snapshot = await query.get();
        if (snapshot.size === 0) {
            break;
        }

        const batch = getAdminDb().batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        deletedCount += snapshot.size;
    }
    return deletedCount;
}


// --- Match Flows ---

export async function deleteAllMatches() {
    try {
        const adminDb = getAdminDb();
        const matchesRef = adminDb.collection('matches');
        const deletedCount = await deleteCollectionBatch(matchesRef, 100);
        return { success: true, deletedCount };
    } catch (error) {
        console.error("Error in deleteAllMatches: ", error);
        return { success: false, deletedCount: 0, message: (error as Error).message };
    }
}

export async function deleteMatchById(matchId: string) {
    if (!matchId) {
        return { success: false, message: "Match ID is required." };
    }
    try {
        const adminDb = getAdminDb();
        const batch = adminDb.batch();
        
        const matchRef = adminDb.doc(`matches/${matchId}`);
        const matchSnap = await matchRef.get();

        if (!matchSnap.exists) {
            return { success: false, message: "Match not found." };
        }
        
        const matchData = matchSnap.data();
        const reservationRef = matchData?.reservationRef ? adminDb.doc(`reservations/${matchData.reservationRef}`) : null;

        // Delete match
        batch.delete(matchRef);

        // Delete associated reservation if it exists
        if (reservationRef) {
             const resSnap = await reservationRef.get();
             if(resSnap.exists) batch.delete(reservationRef);
        }
        
        // Delete payments associated with the reservation
        if(matchData?.reservationRef) {
            const paymentsQuery = adminDb.collection('payments').where('reservationRef', '==', matchData.reservationRef);
            const paymentsSnap = await paymentsQuery.get();
            paymentsSnap.forEach(doc => batch.delete(doc.ref));
        }
        
        // Delete invitations for this match
        const invitationsQuery = adminDb.collection('matchInvitations').where('matchId', '==', matchId);
        const invitesSnap = await invitationsQuery.get();
        invitesSnap.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        return { success: true, message: "Game and all associated data deleted." };

    } catch (error: any) {
        console.error(`Error deleting match ${matchId}:`, error);
        return { success: false, message: `Server error: ${error.message}` };
    }
}


export async function getAllMatches() {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection('matches').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }));
}


// --- Other Admin Flows ---

export async function getAllReservations() {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection('reservations').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }));
}

export async function getAllPayments() {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection('payments').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }));
}

export async function getAllTeams() {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection('teams').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }));
}

export async function getAllUsers() {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection('users').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) }));
}

export async function getMonthlyStats(month: number, year: number) {
    const adminDb = getAdminDb();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Users
    const usersSnapshot = await adminDb.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    const newUsersQuery = adminDb.collection('users').where('createdAt', '>=', startDate).where('createdAt', '<', endDate);
    const newUsersSnapshot = await newUsersQuery.get();
    const newUsers = newUsersSnapshot.size;

    const premiumUsersSnapshot = await adminDb.collection('users').where('premiumPlan', '!=', null).get();
    const premiumUsers = premiumUsersSnapshot.size;
    
    // Reservations
    const reservationsQuery = adminDb.collection('reservations').where('date', '>=', startDate.toISOString()).where('date', '<', endDate.toISOString());
    const reservationsSnapshot = await reservationsQuery.get();
    const totalReservations = reservationsSnapshot.size;
    const cancelledReservations = reservationsSnapshot.docs.filter(doc => doc.data().status === 'Canceled').length;

    // Games
    const gamesQuery = adminDb.collection('matches').where('date', '>=', startDate.toISOString()).where('date', '<', endDate.toISOString());
    const gamesSnapshot = await gamesQuery.get();
    const totalGames = gamesSnapshot.size;

    // Payments
    const paymentsQuery = adminDb.collection('payments').where('date', '>=', startDate.toISOString()).where('date', '<', endDate.toISOString());
    const paymentsSnapshot = await paymentsQuery.get();
    const totalPayments = paymentsSnapshot.size;
    const totalPaymentVolume = paymentsSnapshot.docs.reduce((sum, doc) => {
        const payment = doc.data();
        return payment.status === 'Paid' ? sum + payment.amount : sum;
    }, 0);

    return {
        totalUsers,
        newUsers,
        premiumUsers,
        totalReservations,
        cancelledReservations,
        totalGames,
        totalPayments,
        totalPaymentVolume
    };
}
