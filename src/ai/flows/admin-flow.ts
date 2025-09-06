
'use server';
/**
 * @fileOverview Admin actions flow using the standard client-side Firestore SDK.
 * Permissions are enforced by Firestore Security Rules, where the 'ADMIN' role has full access.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, query, where, deleteDoc, getDoc, Timestamp } from "firebase/firestore";
import { z } from 'zod';
import type { Payment, Notification, Match, Reservation, Team, User } from '@/types';

// Schemas remain the same as they define the data structure, which is correct.
const DeleteAllResultSchema = z.object({
  deletedCount: z.number().describe('The number of documents deleted.'),
});

const DeleteByIdResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

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
    createdAt: z.any(),
});


// Helper function to fetch all documents from a collection
async function fetchAll<T>(collectionName: string): Promise<T[]> {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => {
        const data = doc.data();
        // Convert Firestore Timestamps to JS Date objects for fields that are known to be timestamps
        for (const key in data) {
            if (data[key] instanceof Timestamp) {
                data[key] = data[key].toDate();
            }
        }
        return { id: doc.id, ...data } as T;
    });
}

// Exported functions remain the same
export async function deleteAllMatches(): Promise<z.infer<typeof DeleteAllResultSchema>> {
  return deleteAllMatchesFlow();
}

export async function deleteMatchById(matchId: string): Promise<z.infer<typeof DeleteByIdResultSchema>> {
  return deleteMatchByIdFlow(matchId);
}

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
    const matchesCollection = collection(db, 'matches');
    const snapshot = await getDocs(matchesCollection);

    if (snapshot.empty) {
      return { deletedCount: 0 };
    }

    const batch = writeBatch(db);
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
    const batch = writeBatch(db);
    const matchRef = doc(db, 'matches', matchId);
    
    try {
        const matchDoc = await getDoc(matchRef);
        if (!matchDoc.exists()) {
            return { success: false, message: 'Match not found.' };
        }
        const match = matchDoc.data();

        if (match?.reservationRef) {
            const reservationRef = doc(db, 'reservations', match.reservationRef);
            batch.delete(reservationRef);
            
            const paymentsQuery = query(collection(db, 'payments'), where('reservationRef', '==', match.reservationRef));
            const paymentsSnap = await getDocs(paymentsQuery);

            if (!paymentsSnap.empty) {
                paymentsSnap.forEach(paymentDoc => {
                     batch.delete(paymentDoc.ref);
                });
            }
        }
        
        batch.delete(matchRef);
        await batch.commit();
        
        return { success: true, message: 'Game and all associated data deleted successfully.' };

    } catch (error: any) {
        console.error("Error deleting game:", error);
        return { success: false, message: `Could not delete the game: ${error.message}` };
    }
  }
);

// --- Flows using the standard client SDK ---

const getAllMatchesFlow = ai.defineFlow({ name: 'getAllMatchesFlow', outputSchema: z.array(MatchSchema) }, () => fetchAll<Match>('matches'));
const getAllReservationsFlow = ai.defineFlow({ name: 'getAllReservationsFlow', outputSchema: z.array(ReservationSchema) }, () => fetchAll<Reservation>('reservations'));
const getAllPaymentsFlow = ai.defineFlow({ name: 'getAllPaymentsFlow', outputSchema: z.array(PaymentSchema) }, () => fetchAll<Payment>('payments'));
const getAllTeamsFlow = ai.defineFlow({ name: 'getAllTeamsFlow', outputSchema: z.array(TeamSchema) }, () => fetchAll<Team>('teams'));
const getAllUsersFlow = ai.defineFlow({ name: 'getAllUsersFlow', outputSchema: z.array(UserSchema) }, () => fetchAll<User>('users'));
