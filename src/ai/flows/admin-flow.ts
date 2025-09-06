
'use server';
/**
 * @fileOverview Admin actions flow.
 * - deleteAllMatches: Deletes all documents from the 'matches' collection.
 */

import { ai } from '@/ai/genkit';
import { adminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const DeleteAllResultSchema = z.object({
  deletedCount: z.number().describe('The number of documents deleted.'),
});

export async function deleteAllMatches(): Promise<
  z.infer<typeof DeleteAllResultSchema>
> {
  return deleteAllMatchesFlow();
}

const deleteAllMatchesFlow = ai.defineFlow(
  {
    name: 'deleteAllMatchesFlow',
    outputSchema: DeleteAllResultSchema,
  },
  async () => {
    if (!adminApp) {
      throw new Error('Firebase Admin SDK is not initialized.');
    }

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
