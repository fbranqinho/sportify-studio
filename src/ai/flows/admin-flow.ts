
'use server';
/**
 * @fileOverview Admin flows for data management.
 * WARNING: These functions have admin-level access and can perform destructive actions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin SDK
const app = initFirebaseAdmin();
const db = getFirestore(app);

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

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        deletedCount += snapshot.size;
    }
    return deletedCount;
}


// --- Match Flows ---

export const deleteAllMatchesFlow = ai.defineFlow(
    {
        name: 'deleteAllMatchesFlow',
        outputSchema: z.object({ success: z.boolean(), deletedCount: z.number() }),
    },
    async () => {
        try {
            const matchesRef = db.collection('matches');
            const deletedCount = await deleteCollectionBatch(matchesRef, 100);
            return { success: true, deletedCount };
        } catch (error) {
            console.error("Error in deleteAllMatchesFlow: ", error);
            return { success: false, deletedCount: 0 };
        }
    }
);
export async function deleteAllMatches() {
    return deleteAllMatchesFlow();
}

export const deleteMatchByIdFlow = ai.defineFlow(
    {
        name: 'deleteMatchByIdFlow',
        inputSchema: z.string(),
        outputSchema: z.object({ success: z.boolean(), message: z.string() }),
    },
    async (matchId) => {
        if (!matchId) {
            return { success: false, message: "Match ID is required." };
        }
        try {
            const batch = db.batch();
            
            const matchRef = db.doc(`matches/${matchId}`);
            const matchSnap = await matchRef.get();

            if (!matchSnap.exists) {
                return { success: false, message: "Match not found." };
            }
            
            const matchData = matchSnap.data();
            const reservationRef = matchData?.reservationRef ? db.doc(`reservations/${matchData.reservationRef}`) : null;

            // Delete match
            batch.delete(matchRef);

            // Delete associated reservation if it exists
            if (reservationRef) {
                 const resSnap = await reservationRef.get();
                 if(resSnap.exists) batch.delete(reservationRef);
            }
            
            // Delete payments associated with the reservation
            if(matchData?.reservationRef) {
                const paymentsQuery = db.collection('payments').where('reservationRef', '==', matchData.reservationRef);
                const paymentsSnap = await paymentsQuery.get();
                paymentsSnap.forEach(doc => batch.delete(doc.ref));
            }
            
            // Delete invitations for this match
            const invitationsQuery = db.collection('matchInvitations').where('matchId', '==', matchId);
            const invitesSnap = await invitationsQuery.get();
            invitesSnap.forEach(doc => batch.delete(doc.ref));

            await batch.commit();

            return { success: true, message: "Game and all associated data deleted." };

        } catch (error: any) {
            console.error(`Error deleting match ${matchId}:`, error);
            return { success: false, message: `Server error: ${error.message}` };
        }
    }
);
export async function deleteMatchById(matchId: string) {
    return deleteMatchByIdFlow(matchId);
}


export const getAllMatchesFlow = ai.defineFlow(
    {
        name: 'getAllMatchesFlow',
        outputSchema: z.any(),
    },
    async () => {
        const snapshot = await db.collection('matches').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
);
export async function getAllMatches() {
    return getAllMatchesFlow();
}


// --- Other Admin Flows ---

export const getAllReservationsFlow = ai.defineFlow(
    {
        name: 'getAllReservationsFlow',
        outputSchema: z.any(),
    },
    async () => {
        const snapshot = await db.collection('reservations').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
);
export async function getAllReservations() {
    return getAllReservationsFlow();
}

export const getAllPaymentsFlow = ai.defineFlow(
    {
        name: 'getAllPaymentsFlow',
        outputSchema: z.any(),
    },
    async () => {
        const snapshot = await db.collection('payments').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
);
export async function getAllPayments() {
    return getAllPaymentsFlow();
}

export const getAllTeamsFlow = ai.defineFlow(
    {
        name: 'getAllTeamsFlow',
        outputSchema: z.any(),
    },
    async () => {
        const snapshot = await db.collection('teams').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
);
export async function getAllTeams() {
    return getAllTeamsFlow();
}

export const getAllUsersFlow = ai.defineFlow(
    {
        name: 'getAllUsersFlow',
        outputSchema: z.any(),
    },
    async () => {
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
);
export async function getAllUsers() {
    return getAllUsersFlow();
}
