
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId, updateDoc } from "firebase/firestore";
import type { Payment, Notification, PaymentStatus, Reservation, User, Team, Match } from "@/types";
import { useToast } from "@/hooks/use-toast";
import type { User as AuthUser } from 'firebase/auth';


export function usePayments(user: AuthUser | null) {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [playerUsers, setPlayerUsers] = React.useState<Map<string, User>>(new Map());
  const [loading, setLoading] = React.useState(true);

  const runConsistencyCheck = React.useCallback(async (reservationsMap: Map<string, Reservation>) => {
        const consistencyBatch = writeBatch(db);
        let hasUpdates = false;

        const reservationsToCheck = Array.from(reservationsMap.values()).filter(r => r.paymentStatus === 'Split');

        for (const res of reservationsToCheck) {
            const paymentsQuery = query(collection(db, "payments"), where("reservationRef", "==", res.id));
            const paymentsSnap = await getDocs(paymentsQuery);
            const totalPaid = paymentsSnap.docs
                .filter(doc => doc.data().status === 'Paid')
                .reduce((sum, doc) => sum + doc.data().amount, 0);
            
            if (totalPaid >= res.totalAmount && res.paymentStatus !== 'Paid') {
                const resRef = doc(db, "reservations", res.id);
                consistencyBatch.update(resRef, { paymentStatus: "Paid", status: "Scheduled" });
                
                const matchQuery = query(collection(db, 'matches'), where('reservationRef', '==', res.id));
                const matchSnap = await getDocs(matchQuery);
                if (!matchSnap.empty) {
                    const matchRef = matchSnap.docs[0].ref;
                    consistencyBatch.update(matchRef, { status: 'Scheduled' });
                }
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            try {
              await consistencyBatch.commit();
              toast({ title: "Data Synced", description: "Corrected the status of some pending games." });
              return true;
            } catch(e) {
                console.error("Consistency check failed:", e);
                return false;
            }
        }
        return false;

  }, [toast]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    if (!user) {
        setLoading(false);
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            setLoading(false);
            return;
        }
        const userData = userDoc.data() as User;


        let initialQuery;

        if (userData.role === 'PLAYER') {
            initialQuery = query(collection(db, "payments"), where("playerRef", "==", user.uid));
        } else if (userData.role === 'MANAGER') {
            const teamsQuery = query(collection(db, 'teams'), where('managerId', '==', user.uid));
            const teamsSnap = await getDocs(teamsQuery);
            const teamIds = teamsSnap.docs.map(doc => doc.id);
            
            if (teamIds.length > 0) {
                initialQuery = query(collection(db, "payments"), where("teamRef", "in", teamIds));
            } else {
                 setAllPayments([]);
                 setLoading(false);
                 return;
            }
        } else if (userData.role === 'OWNER') {
            const ownerProfileQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", user.uid));
            const ownerProfileSnap = await getDocs(ownerProfileQuery);
            if(!ownerProfileSnap.empty) {
                const ownerProfileId = ownerProfileSnap.docs[0].id;
                initialQuery = query(collection(db, "payments"), where("ownerRef", "==", ownerProfileId));
            } else {
                setAllPayments([]);
                setLoading(false);
                return;
            }
        } else {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(initialQuery, async (snapshot) => {
            const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            setAllPayments(paymentsData);

            const reservationIds = [...new Set(paymentsData.map(p => p.reservationRef).filter(Boolean))];
            const playerIds = [...new Set(paymentsData.map(p => p.playerRef).filter(Boolean)), ...new Set(paymentsData.map(p => p.managerRef).filter(Boolean))];

            const reservationsMap = new Map<string, Reservation>();
            if (reservationIds.length > 0) {
                const reservationsQuery = query(collection(db, "reservations"), where(documentId(), "in", reservationIds));
                const reservationsSnap = await getDocs(reservationsQuery);
                reservationsSnap.forEach(doc => {
                    reservationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Reservation);
                });
                setReservations(reservationsMap);

                if (userData.role === 'MANAGER') {
                   const updated = await runConsistencyCheck(reservationsMap);
                   if (updated) return;
                }
            }
            
            if (playerIds.length > 0) {
                const usersQuery = query(collection(db, 'users'), where('id', 'in', playerIds.filter(Boolean)));
                const usersSnap = await getDocs(usersQuery);
                const usersMap = new Map<string, User>();
                usersSnap.forEach(doc => {
                    usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
                });
                setPlayerUsers(usersMap);
            }
            
            setLoading(false);
        }, (error) => {
            console.error("Error fetching payments:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch payments." });
            setLoading(false);
        });

        return () => unsubscribe();
    } catch (error) {
        console.error("Error in fetchData:", error);
        toast({ variant: "destructive", title: "An unexpected error occurred while fetching data." });
        setLoading(false);
    }
  }, [user, toast, runConsistencyCheck]);


  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  return { allPayments, reservations, playerUsers, loading, fetchData };
}
