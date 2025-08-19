
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId, updateDoc, or } from "firebase/firestore";
import type { Payment, Notification, PaymentStatus, Reservation, User, Team, Match } from "@/types";
import { useToast } from "@/hooks/use-toast";

export function usePayments(user: User | null) {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [playerUsers, setPlayerUsers] = React.useState<Map<string, User>>(new Map());
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (!userDoc.exists()) {
            console.error("User document not found for UID:", user.id);
            setLoading(false);
            return;
        }
        const userData = userDoc.data() as User;

        const handleSnapshots = async (paymentsSnapshot: any, reservationsSnapshot?: any) => {
            const paymentsData = paymentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Payment));
            
            const managerReservations: Reservation[] = [];
            if (reservationsSnapshot) {
                 reservationsSnapshot.docs.forEach((doc: any) => {
                     const res = { id: doc.id, ...doc.data() } as Reservation;
                     // If a payment document for this initial booking doesn't exist, create a temporary one for display
                     if (!paymentsData.some(p => p.reservationRef === res.id && p.type === 'booking')) {
                        paymentsData.push({
                            id: `temp-${res.id}`,
                            reservationRef: res.id,
                            type: 'booking',
                            amount: res.totalAmount,
                            status: 'Pending',
                            date: res.createdAt,
                            pitchName: res.pitchName,
                            teamName: 'Initial Booking',
                            managerRef: res.managerRef,
                        } as Payment);
                     }
                     managerReservations.push(res);
                 });
            }

            setAllPayments(paymentsData);

            const reservationIds = [...new Set(paymentsData.map(p => p.reservationRef).filter(Boolean))];
            const playerIds = [...new Set(paymentsData.map(p => p.playerRef).filter(Boolean)), ...new Set(paymentsData.map(p => p.managerRef).filter(Boolean))];

            const reservationsMap = new Map<string, Reservation>();
            if (reservationIds.length > 0) {
                const reservationsQuery = query(collection(db, "reservations"), where(documentId(), "in", reservationIds));
                const fetchedReservationsSnap = await getDocs(reservationsQuery);
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
            
            setLoading(false);
        };
        
        let paymentsQuery;
        
        if (userData.role === 'PLAYER') {
            paymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id));
            const unsubscribe = onSnapshot(paymentsQuery, (snap) => handleSnapshots(snap));
            return () => unsubscribe();
        } else if (userData.role === 'MANAGER') {
            const teamsQuery = query(collection(db, 'teams'), where('managerId', '==', user.id));
            const teamsSnap = await getDocs(teamsQuery);
            const teamIds = teamsSnap.docs.map(doc => doc.id);

            const queries = [];
            if (teamIds.length > 0) {
                queries.push(where("teamRef", "in", teamIds));
            }
            queries.push(where("managerRef", "==", user.id));
            
            paymentsQuery = query(collection(db, "payments"), or(...queries));

            // Also fetch pending reservations that don't have a payment doc yet
            const reservationsQuery = query(
                collection(db, "reservations"),
                where("managerRef", "==", user.id),
                where("paymentStatus", "==", "Pending")
            );

            const unsubPayments = onSnapshot(paymentsQuery, (paymentsSnap) => {
                 getDocs(reservationsQuery).then(reservationsSnap => {
                     handleSnapshots(paymentsSnap, reservationsSnap);
                 });
            });
            const unsubReservations = onSnapshot(reservationsQuery, (reservationsSnap) => {
                 getDocs(paymentsQuery).then(paymentsSnap => {
                    handleSnapshots(paymentsSnap, reservationsSnap);
                 })
            });

            return () => {
                unsubPayments();
                unsubReservations();
            };

        } else if (userData.role === 'OWNER') {
            const ownerProfileQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
            const ownerProfileSnap = await getDocs(ownerProfileQuery);
            if(!ownerProfileSnap.empty) {
                const ownerProfileId = ownerProfileSnap.docs[0].id;
                paymentsQuery = query(collection(db, "payments"), where("ownerRef", "==", ownerProfileId));
                 const unsubscribe = onSnapshot(paymentsQuery, (snap) => handleSnapshots(snap));
                 return () => unsubscribe();
            } else {
                setAllPayments([]);
                setLoading(false);
                return;
            }
        } else {
            setLoading(false);
            return;
        }

    } catch (error) {
        console.error("Error in fetchData:", error);
        toast({ variant: "destructive", title: "An unexpected error occurred while fetching data." });
        setLoading(false);
    }
  }, [toast, user]);


  React.useEffect(() => {
    if (user?.id) {
      fetchData();
    } else if (user === null) { // Explicitly check for null to know auth state is determined
      setLoading(false);
      setAllPayments([]);
    }
  }, [user, fetchData]);

  return { allPayments, reservations, playerUsers, loading, fetchData };
}
