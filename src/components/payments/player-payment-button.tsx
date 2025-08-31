
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, doc, writeBatch, serverTimestamp, getDocs, updateDoc, getDoc } from "firebase/firestore";
import type { Payment, Reservation, Pitch, Match, Notification } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard } from "lucide-react";
import { format } from "date-fns";
import { getPlayerCapacity } from "@/lib/utils";

export const PlayerPaymentButton = ({ payment, reservation, onPaymentProcessed }: { payment: Payment, reservation: Reservation | null, onPaymentProcessed: () => void }) => {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handlePayNow = async () => {
        setIsProcessing(true);
        if (!reservation || !reservation.pitchId || !reservation.date) {
            toast({ variant: "destructive", title: "Error", description: "This payment is missing critical reservation details." });
            setIsProcessing(false);
            return;
        }
        
        const reservationRef = doc(db, "reservations", reservation.id);

        try {
            const batch = writeBatch(db);
            const paymentRef = doc(db, "payments", payment.id);
            
            batch.update(paymentRef, { status: "Paid", date: new Date().toISOString() });
            
            const paymentsQuery = query(collection(db, 'payments'), where('reservationRef', '==', reservation.id));
            const paymentsSnap = await getDocs(paymentsQuery);
            let totalPaid = payment.amount;
            let allPlayersPaid = true;
            
            paymentsSnap.forEach(pDoc => {
                const p = pDoc.data() as Payment;
                if (pDoc.id !== payment.id) {
                     if (p.status === 'Paid') {
                        totalPaid += p.amount;
                    } else if (p.type === 'booking_split') {
                        allPlayersPaid = false;
                    }
                }
            });

            if (allPlayersPaid) {
                batch.update(reservationRef, { paymentStatus: "Paid" });
                
                const matchQuery = query(collection(db, 'matches'), where('reservationRef', '==', reservation.id));
                const matchSnap = await getDocs(matchQuery);
                if (!matchSnap.empty) {
                    const matchRef = matchSnap.docs[0].ref;
                    const matchData = matchSnap.docs[0].data() as Match;
                    
                    const pitchSnap = await getDoc(doc(db, "pitches", matchData.pitchRef));
                    const pitchData = pitchSnap.data() as Pitch;
                    const capacity = getPlayerCapacity(pitchData.sport);
                    const currentPlayers = (matchData.teamAPlayers?.length || 0) + (matchData.teamBPlayers?.length || 0);

                    if (currentPlayers >= capacity) {
                        batch.update(matchRef, { status: 'Scheduled' });
                    }
                }
                
                const ownerProfileDoc = await getDoc(doc(db, "ownerProfiles", reservation.ownerProfileId));
                if (ownerProfileDoc.exists()) {
                    const ownerUserId = ownerProfileDoc.data().userRef;
                    const ownerNotificationRef = doc(collection(db, "users", ownerUserId, "notifications"));
                    const notification : Omit<Notification, 'id' | 'userId'> = {
                        message: `Booking confirmed for ${reservation.pitchName} on ${format(new Date(reservation.date), 'MMM d')}. Payment received.`,
                        link: `/dashboard/schedule`,
                        read: false,
                        createdAt: serverTimestamp() as any,
                    };
                    batch.set(ownerNotificationRef, {userId: ownerUserId, ...notification});
                }
                
                if (reservation.managerRef) {
                    const managerNotificationRef = doc(collection(db, "users", reservation.managerRef, "notifications"));
                     batch.set(managerNotificationRef, {
                        userId: reservation.managerRef,
                        message: `The payment for your game at ${reservation.pitchName} is complete.`,
                        link: `/dashboard/games/${matchSnap.docs[0].id}`,
                        read: false,
                        createdAt: serverTimestamp() as any,
                    });
                }
            }

            await batch.commit();
        
            toast({ title: "Payment Successful!", description: allPlayersPaid ? "Your game is confirmed!" : "Your share is paid." });
            onPaymentProcessed();
            
        } catch (error: any) {
            console.error("Error processing payment:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
        } finally {
            setIsProcessing(false);
        }
    }

    return (
        <Button size="sm" onClick={handlePayNow} disabled={!reservation || isProcessing}><CreditCard className="mr-2"/>{isProcessing ? 'Processing...' : 'Pay To Confirm'}</Button>
    )
}
