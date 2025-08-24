
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId, updateDoc, or } from "firebase/firestore";
import type { Payment, Notification, PaymentStatus, Reservation, User, Team, Match, OwnerProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";

export function usePayments(user: User | null) {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [playerUsers, setPlayerUsers] = React.useState<Map<string, User>>(new Map());
  const [owners, setOwners] = React.useState<Map<string, OwnerProfile>>(new Map());
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    // This function will be called by the onSnapshot listeners.
    // It's designed to be idempotent and handle fetching all related data.
    const processData = async (paymentsData: Payment[]) => {
        setAllPayments(paymentsData);

        const reservationIds = [...new Set(paymentsData.map(p => p.reservationRef).filter(Boolean))];
        const playerIds = [...new Set([...paymentsData.map(p => p.playerRef), ...paymentsData.map(p => p.managerRef)].filter(Boolean))];
        const ownerIds = [...new Set(paymentsData.map(p => p.ownerRef).filter(Boolean))];

        if (reservationIds.length > 0) {
            const reservationsQuery = query(collection(db, "reservations"), where(documentId(), "in", reservationIds));
            const fetchedReservationsSnap = await getDocs(reservationsQuery);
            const reservationsMap = new Map<string, Reservation>();
            fetchedReservationsSnap.forEach(doc => {
                reservationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Reservation);
            });
            setReservations(reservationsMap);
        }
        
        if (playerIds.length > 0) {
            const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', playerIds));
            const usersSnap = await getDocs(usersQuery);
            const usersMap = new Map<string, User>();
            usersSnap.forEach(doc => {
                usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
            });
            setPlayerUsers(usersMap);
        }
        
        if (ownerIds.length > 0) {
             const ownersQuery = query(collection(db, 'ownerProfiles'), where(documentId(), 'in', ownerIds));
             const ownersSnap = await getDocs(ownersQuery);
             const ownersMap = new Map<string, OwnerProfile>();
             ownersSnap.forEach(doc => {
                 ownersMap.set(doc.id, { id: doc.id, ...doc.data() } as OwnerProfile);
             });
             setOwners(ownersMap);
        }
        
        setLoading(false);
    };

    // Determine the base query based on user role
    let paymentsQuery;
    if (user.role === 'PLAYER') {
        paymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id));
    } else if (user.role === 'MANAGER') {
        const teamsQuery = query(collection(db, 'teams'), where('managerId', '==', user.id));
        const teamsSnap = await getDocs(teamsQuery);
        const teamIds = teamsSnap.docs.map(doc => doc.id);
        const queries = [where("managerRef", "==", user.id)];
        if (teamIds.length > 0) {
            queries.push(where("teamRef", "in", teamIds));
        }
        paymentsQuery = query(collection(db, "payments"), or(...queries));
    } else if (user.role === 'OWNER') {
        const ownerProfileQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
        const ownerProfileSnap = await getDocs(ownerProfileQuery);
        if (!ownerProfileSnap.empty) {
            const ownerProfileId = ownerProfileSnap.docs[0].id;
            paymentsQuery = query(collection(db, "payments"), where("ownerRef", "==", ownerProfileId));
        } else {
            setAllPayments([]);
            setLoading(false);
            return () => {}; // Return a no-op function for cleanup
        }
    } else {
        setAllPayments([]);
        setLoading(false);
        return () => {}; // Return a no-op function for cleanup
    }

    const unsubscribe = onSnapshot(paymentsQuery, async (paymentsSnapshot) => {
        try {
            const paymentsData = paymentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Payment));
            await processData(paymentsData);
        } catch (error) {
            console.error("Error processing payment snapshots:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update payments data." });
        }
    }, (error) => {
        console.error("Error in payments listener:", error);
        toast({ variant: "destructive", title: "Error", description: "Lost connection to payments data." });
        setLoading(false);
    });

    return () => unsubscribe(); // Return the cleanup function for useEffect
  }, [toast, user]);


  React.useEffect(() => {
    let unsubscribe = () => {};
    if (user?.id) {
      fetchData().then(cleanup => {
          if (cleanup) unsubscribe = cleanup;
      });
    } else if (user === null) { 
      setLoading(false);
      setAllPayments([]);
    }
    return () => unsubscribe();
  }, [user, fetchData]);

  return { allPayments, reservations, playerUsers, owners, loading, fetchData: () => fetchData() };
}
