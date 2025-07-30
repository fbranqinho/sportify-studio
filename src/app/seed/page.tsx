
"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { mockData } from '@/lib/mock-data';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const seedDatabase = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      console.log('Starting to seed database...');
      const collections = {
        users: mockData.users,
        playerProfiles: mockData.playerProfiles,
        managerProfiles: mockData.managerProfiles,
        ownerProfiles: mockData.ownerProfiles,
        promoterProfiles: mockData.promoterProfiles,
        refereeProfiles: mockData.refereeProfiles,
        adminProfiles: mock.adminProfiles,
        teams: mockData.teams,
        pitches: mockData.pitches,
        competitions: mockData.competitions,
        matches: mockData.matches,
        payments: mockData.payments,
        reservations: mockData.reservations,
        teamInvitations: mockData.teamInvitations,
        promos: mockData.promos,
      };

      // Firestore allows a maximum of 500 operations in a single batch.
      // We will create multiple batches if needed.
      const batchPromises = [];
      
      for (const [collectionName, data] of Object.entries(collections)) {
        if (!Array.isArray(data)) {
          console.warn(`Skipping non-array data for collection: ${collectionName}`);
          continue;
        }
        let batch = writeBatch(db);
        let operationCount = 0;
        console.log(`Preparing collection: ${collectionName}...`);

        for (const item of data) {
          if (!item.id) {
            console.warn(`Skipping item without ID in ${collectionName}:`, item);
            continue;
          }
          const docRef = doc(collection(db, collectionName), item.id);
          batch.set(docRef, item);
          operationCount++;

          if (operationCount >= 499) {
            batchPromises.push(batch.commit());
            batch = writeBatch(db);
            operationCount = 0;
          }
        }

        if (operationCount > 0) {
          batchPromises.push(batch.commit());
        }
      }
      
      await Promise.all(batchPromises);

      console.log('Database seeding completed successfully!');
      setMessage('Database seeded successfully! You can now remove the /seed page.');
    } catch (e: any) {
      console.error('Error seeding database:', e);
      setError(`Error seeding database: ${e.message}. Check the browser console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Seed Firestore Database</CardTitle>
          <CardDescription>
            Click the button below to populate your Firestore database with mock data.
            This is a one-time operation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={seedDatabase} disabled={loading}>
            {loading ? 'Seeding...' : 'Seed Database'}
          </Button>
          {message && (
            <Alert variant="default">
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {error && (
             <Alert variant="destructive">
               <AlertTitle>Error</AlertTitle>
               <AlertDescription>{error}</AlertDescription>
             </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
