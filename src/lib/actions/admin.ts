
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { z } from 'zod';


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

        const batch = adminDb.batch();
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
        const matchesRef = adminDb.collection('matches');
        const deletedCount = await deleteCollectionBatch(matchesRef, 100);
        return { success: true, deletedCount };
    } catch (error) {
        console.error("Error in deleteAllMatches: ", error);
        return { success: false, deletedCount: 0 };
    }
}

export async function deleteMatchById(matchId: string) {
    if (!matchId) {
        return { success: false, message: "Match ID is required." };
    }
    try {
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
    const snapshot = await adminDb.collection('matches').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


// --- Other Admin Flows ---

export async function getAllReservations() {
    const snapshot = await adminDb.collection('reservations').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getAllPayments() {
    const snapshot = await adminDb.collection('payments').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getAllTeams() {
    const snapshot = await adminDb.collection('teams').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getAllUsers() {
    const snapshot = await adminDb.collection('users').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
