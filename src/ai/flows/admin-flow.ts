
'use server';
/**
 * @fileOverview Admin actions flow.
 * - deleteAllMatches: Deletes all documents from the 'matches' collection.
 * - deleteMatchById: Deletes a specific match and its related data.
 */

import { ai } from '@/ai/genkit';
import { getAdminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Payment, Notification, Match, Reservation, Team, User } from '@/types';

const DeleteAllResultSchema = z.object({
  deletedCount: z.number().describe('The number of documents deleted.'),
});

const DeleteByIdResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Define Zod schemas for the new data types
const MatchSchema = z.object({
  id: z.string(),
  date: z.string(),
  teamARef: z.string().nullable(),
  teamBRef: z.string().nullable(),
  scoreA: z.number(),
  scoreB: z.number(),
  pitchRef: z.string(),
  status: z.string(),
  managerRef: z.string().nullable(),
  reservationRef: z.string().optional(),
});

const ReservationSchema = z.object({
    id: z.string(),
    date: z.string(),
    status: z.string(),
    paymentStatus: z.string(),
    pitchId: z.string(),
    pitchName: z.string(),
    ownerProfileId: z.string(),
    totalAmount: z.number(),
    actorId: z.string(),
    actorName: z.string(),
    actorRole: z.string(),
});

const PaymentSchema = z.object({
    id: z.string(),
    type: z.string(),
    amount: z.number(),
    date: z.string(),
    status: z.string(),
    playerRef: z.string().optional(),
    managerRef: z.string().optional(),
    ownerRef: z.string().optional(),
    pitchName: z.string().optional(),
    teamName: z.string().optional(),
});

const TeamSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    city: z.string().optional(),
    managerId: z.string().optional(),
    playerIds: z.array(z.string()).optional(),
    wins: z.number().optional(),
    draws: z.number().optional(),
    losses: z.number().optional(),
});

const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    profileCompleted: z.boolean(),
    createdAt: z.any(), // Timestamps can be complex
});


export async function deleteAllMatches(): Promise<
  z.infer<typeof DeleteAllResultSchema>
> {
  return deleteAllMatchesFlow();
}

export async function deleteMatchById(
  matchId: string
): Promise<z.infer<typeof DeleteByIdResultSchema>> {
  return deleteMatchByIdFlow(matchId);
}

// New exported functions for fetching all data
export async function getAllMatches(): Promise<Match[]> {
  return getAllMatchesFlow();
}
export async function getAllReservations(): Promise<Reservation[]> {
  return getAllReservationsFlow();
}
export async function getAllPayments(): Promise<Payment[]> {
  return getAllPaymentsFlow();
}
export async function getAllTeams(): Promise<Team[]> {
  return getAllTeamsFlow();
}
export async function getAllUsers(): Promise<User[]> {
  return getAllUsersFlow();
}


const deleteAllMatchesFlow = ai.defineFlow(
  {
    name: 'deleteAllMatchesFlow',
    outputSchema: DeleteAllResultSchema,
  },
  async () => {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const matchesCollection = db.collection('matches');
    const snapshot = await matchesCollection.get();

    if (snapshot.empty) {
      return { deletedCount: 0 };
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return { deletedCount: snapshot.size };
  }
);

const deleteMatchByIdFlow = ai.defineFlow(
  {
    name: 'deleteMatchByIdFlow',
    inputSchema: z.string(),
    outputSchema: DeleteByIdResultSchema,
  },
  async (matchId) => {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const batch = db.batch();
    const matchRef = db.collection('matches').doc(matchId);
    
    try {
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return { success: false, message: 'Match not found.' };
        }
        const match = matchDoc.data();

        let playerIdsToNotify: string[] = [];

        // Handle associated reservation and payments if they exist
        if (match?.reservationRef) {
            const reservationRef = db.collection('reservations').doc(match.reservationRef);
            const paymentsQuery = db.collection('payments').where('reservationRef', '==', match.reservationRef);
            const paymentsSnap = await paymentsQuery.get();

            if (!paymentsSnap.empty) {
                paymentsSnap.forEach(paymentDoc => {
                    const payment = paymentDoc.data() as Payment;
                    const playerRef = payment.playerRef || (payment.managerRef && payment.type === 'booking_split' ? payment.managerRef : undefined);
                    
                    if (playerRef && !playerIdsToNotify.includes(playerRef)) {
                        playerIdsToNotify.push(playerRef);
                    }

                    if (payment.status === 'Paid') {
                        batch.update(paymentDoc.ref, { status: 'Refunded' });
                    } else if (payment.status === 'Pending') {
                        batch.update(paymentDoc.ref, { status: 'Cancelled' });
                    }
                });
            }
            batch.delete(reservationRef);
        }

        // Add all players from the match to the notification list
        const matchPlayerIds = [...new Set([...(match?.teamAPlayers || []), ...(match?.teamBPlayers || [])])];
        playerIdsToNotify.push(...matchPlayerIds);
        
        // Add manager if not already in the list
        if (match?.managerRef && !playerIdsToNotify.includes(match.managerRef)) {
            playerIdsToNotify.push(match.managerRef);
        }

        // Create notifications
        const uniquePlayerIds = [...new Set(playerIdsToNotify)];
        uniquePlayerIds.forEach(userId => {
            const notificationRef = db.collection('users').doc(userId).collection('notifications').doc();
            const notificationData: Omit<Notification, 'id'> = {
                message: `The game on ${new Date(match?.date).toLocaleDateString()} has been cancelled. Payments have been handled.`,
                link: '/dashboard/payments',
                read: false,
                createdAt: new Date() as any,
                userId,
            };
            batch.set(notificationRef, notificationData);
        });
        
        batch.delete(matchRef);

        await batch.commit();
        
        return { success: true, message: 'Game and all associated data deleted successfully.' };

    } catch (error: any) {
        console.error("Error deleting game:", error);
        return { success: false, message: `Could not delete the game: ${error.message}` };
    }
  }
);


// New flows for fetching all documents from a collection
const getAllMatchesFlow = ai.defineFlow({ name: 'getAllMatchesFlow', outputSchema: z.array(MatchSchema) }, async () => {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('matches').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Match);
});

const getAllReservationsFlow = ai.defineFlow({ name: 'getAllReservationsFlow', outputSchema: z.array(ReservationSchema) }, async () => {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('reservations').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Reservation);
});

const getAllPaymentsFlow = ai.defineFlow({ name: 'getAllPaymentsFlow', outputSchema: z.array(PaymentSchema) }, async () => {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('payments').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Payment);
});

const getAllTeamsFlow = ai.defineFlow({ name: 'getAllTeamsFlow', outputSchema: z.array(TeamSchema) }, async () => {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('teams').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Team);
});

const getAllUsersFlow = ai.defineFlow({ name: 'getAllUsersFlow', outputSchema: z.array(UserSchema) }, async () => {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
});
