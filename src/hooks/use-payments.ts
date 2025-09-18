
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import type { Payment, Reservation, User, UserRole, OwnerProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";


export function usePayments(user: User | null) {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [playerUsers, setPlayerUsers] = React.useState<Map<string, User>>(new Map());
  const [owners, setOwners] = React.useState<Map<string, OwnerProfile>>(new Map());
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      setAllPayments([]);
      return;
    }

    setLoading(true);

    try {
      let paymentsQuery;
      // This query is now built based on the user's role to be compliant with Firestore rules.
      switch (user.role) {
        case 'PLAYER':
          paymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id));
          break;
        case 'MANAGER':
          paymentsQuery = query(collection(db, "payments"), where("managerRef", "==", user.id));
          break;
        case 'OWNER':
          paymentsQuery = query(collection(db, "payments"), where("ownerRef", "==", user.id));
          break;
        default:
          // For other roles or if no specific logic, fetch no payments.
          setAllPayments([]);
          setLoading(false);
          return;
      }
      
      const snapshot = await getDocs(paymentsQuery);
      const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
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

    } catch (error) {
        console.error("Error fetching payment data:", error);
        toast({
            variant: "destructive",
            title: "Error fetching data",
            description: "Could not load your payment information."
        });
    } finally {
        setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { allPayments, reservations, playerUsers, owners, loading, fetchData };
}
