

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId, updateDoc, or, deleteDoc } from "firebase/firestore";
import type { Payment, Notification, PaymentStatus, Reservation, User, UserRole, OwnerProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";


export function usePayments(user: User | null) {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [playerUsers, setPlayerUsers] = React.useState<Map<string, User>>(new Map());
  const [owners, setOwners] = React.useState<Map<string, OwnerProfile>>(new Map());
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    // This function is intentionally left blank as useEffect handles the data fetching lifecycle.
    // It can be used for manual refetching if needed in the future.
  }, []);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      setAllPayments([]);
      return; // Early return if there's no user
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

    let paymentsQuery;
    let unsubscribe = () => {};

    if (user.role === 'PLAYER') {
        paymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id));
    } else if (user.role === 'MANAGER') {
        paymentsQuery = query(collection(db, "payments"), where("managerRef", "==", user.id));
    } else if (user.role === 'OWNER') {
        paymentsQuery = query(collection(db, "payments"), where("ownerRef", "==", user.id));
    } else {
        // For roles with no payments page or other roles
        setAllPayments([]);
        setLoading(false);
        return;
    }
    
    if (paymentsQuery) {
        unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
            const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            processData(paymentsData).catch(console.error);
        }, (error) => {
            console.error("Error in payments listener:", error);
            setLoading(false);
        });
    }
    
    // This is the cleanup function that will be called when the component unmounts
    // or when the dependencies (user) change.
    return () => {
      unsubscribe();
    };

  }, [user]); // Rerun effect if user changes

  return { allPayments, reservations, playerUsers, owners, loading, fetchData };
}
