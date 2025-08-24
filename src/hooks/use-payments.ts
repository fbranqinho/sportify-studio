
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId, updateDoc, or } from "firebase/firestore";
import type { Payment, Notification, PaymentStatus, Reservation, User, UserRole, OwnerProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";

export function usePayments(user: User | null) {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [playerUsers, setPlayerUsers] = React.useState<Map<string, User>>(new Map());
  const [owners, setOwners] = React.useState<Map<string, OwnerProfile>>(new Map());
  const [loading, setLoading] = React.useState(true);

  // This function is kept for any potential external refresh calls, but the main logic is in useEffect.
  const fetchData = React.useCallback(async () => {
    // Intentionally left blank as useEffect handles the data fetching lifecycle.
  }, []);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      setAllPayments([]);
      return; // No user, do nothing.
    }

    setLoading(true);

    const processData = async (paymentsData: Payment[]) => {
        setAllPayments(paymentsData);

        const reservationIds = [...new Set(paymentsData.map(p => p.reservationRef).filter(Boolean))];
        const playerIds = [...new Set([...paymentsData.map(p => p.playerRef), ...paymentsData.map(p => p.managerRef)].filter(Boolean))];
        const ownerIds = [...new Set(paymentsData.map(p => p.ownerRef).filter(Boolean))];

        if (reservationIds.length > 0) {
            const reservationsQuery = query(collection(db, "reservations"), where(documentId(), "in", reservationIds.slice(0, 30)));
            const fetchedReservationsSnap = await getDocs(reservationsQuery);
            const reservationsMap = new Map<string, Reservation>();
            fetchedReservationsSnap.forEach(doc => {
            reservationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Reservation);
            });
            setReservations(reservationsMap);
        } else {
            setReservations(new Map());
        }
        
        if (playerIds.length > 0) {
            const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', playerIds.slice(0, 30)));
            const usersSnap = await getDocs(usersQuery);
            const usersMap = new Map<string, User>();
            usersSnap.forEach(doc => {
            usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
            });
            setPlayerUsers(usersMap);
        } else {
            setPlayerUsers(new Map());
        }
        
        if (ownerIds.length > 0) {
            const ownersQuery = query(collection(db, 'ownerProfiles'), where(documentId(), 'in', ownerIds.slice(0, 30)));
            const ownersSnap = await getDocs(ownersQuery);
            const ownersMap = new Map<string, OwnerProfile>();
            ownersSnap.forEach(doc => {
                ownersMap.set(doc.id, { id: doc.id, ...doc.data() } as OwnerProfile);
            });
            setOwners(ownersMap);
        } else {
            setOwners(new Map());
        }
        
        setLoading(false);
    };

    let unsubscribe = () => {}; 
    
    const setupListener = async () => {
        let paymentsQuery;
        try {
            if (user.role === 'PLAYER') {
                paymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id));
            } else if (user.role === 'MANAGER') {
                const teamsQuery = query(collection(db, 'teams'), where('managerId', '==', user.id));
                const teamsSnap = await getDocs(teamsQuery);
                const teamRefs = teamsSnap.docs.map(doc => doc.id);
                
                const queries = [where("managerRef", "==", user.id)];
                if (teamRefs.length > 0) {
                    queries.push(where("teamRef", "in", teamRefs));
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
                    return;
                }
            } else {
                setAllPayments([]);
                setLoading(false);
                return;
            }
            
            unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
                const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
                processData(paymentsData).catch(err => {
                    console.error("Error processing snapshot data:", err);
                    toast({ variant: "destructive", title: "Data Error", description: "Failed to process payments data." });
                });
            }, (error) => {
                console.error("Error in payments listener:", error);
                 if (error.code !== 'permission-denied') {
                    toast({ variant: "destructive", title: "Error", description: "Lost connection to payments data." });
                 }
                 setLoading(false);
            });
        } catch (error) {
            console.error("Error setting up payments query:", error);
            setLoading(false);
        }
    }
    
    setupListener();

    return () => {
      unsubscribe();
    };

  }, [user, toast]);

  return { allPayments, reservations, playerUsers, owners, loading, fetchData };
}
