
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, doc, writeBatch, serverTimestamp, getDocs, updateDoc } from "firebase/firestore";
import type { Payment, Reservation } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard } from "lucide-react";
import { format } from "date-fns";

export const PlayerPaymentButton = ({ payment, reservation, onPaymentProcessed }: { payment: Payment, reservation: Reservation | null, onPaymentProcessed: () => void }) => {
    const { toast } = useToast();

    const handlePayNow = async () => {
        if (!reservation || !reservation.pitchId || !reservation.date) {
            toast({ variant: "destructive", title: "Error", description: "This payment is missing critical reservation details." });
            return;
        }
        
        const reservationRef = doc(db, "reservations", reservation.id);

        const conflictingReservationsQuery = query(
            collection(db, "reservations"),
            where("pitchId", "==", reservation.pitchId),
            where("date", "==", reservation.date)
        );

        const conflictingSnap = await getDocs(conflictingReservationsQuery);

        const otherTeamsConfirmed = conflictingSnap.docs.some(d => {
            const data = d.data() as Reservation;
            return d.id !== reservation.id && (data.status === 'Scheduled' || data.paymentStatus === 'Paid');
        });
        
        if (otherTeamsConfirmed) {
            toast({ variant: "destructive", title: "Slot Taken", description: "Sorry, another team has just booked this slot. Your reservation has been cancelled." });
            await updateDoc(reservationRef, { status: "Canceled", paymentStatus: "Cancelled" });
            onPaymentProcessed();
            return;
        }

        const batch = writeBatch(db);
        const paymentRef = doc(db, "payments", payment.id);
        
        try {
            batch.update(paymentRef, { status: "Paid" });
            
            const paymentsQuery = query(collection(db, 'payments'), where('reservationRef', '==', reservation.id));
            const paymentsSnap = await getDocs(paymentsQuery);
            let totalPaid = payment.amount;
            paymentsSnap.forEach(doc => {
                if (doc.id !== payment.id && doc.data().status === 'Paid') {
                    totalPaid += doc.data().amount;
                }
            });

            if (totalPaid >= reservation.totalAmount) {
                batch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });
                
                const matchQuery = query(collection(db, 'matches'), where('reservationRef', '==', reservation.id));
                const matchSnap = await getDocs(matchQuery);
                if (!matchSnap.empty) {
                    batch.update(matchSnap.docs[0].ref, { status: 'Scheduled' });
                }
                
                const ownerNotificationRef = doc(collection(db, "notifications"));
                batch.set(ownerNotificationRef, {
                    ownerProfileId: reservation.ownerProfileId,
                    message: `Booking confirmed for ${reservation.pitchName} on ${format(new Date(reservation.date), 'MMM d')}. Payment received.`,
                    link: `/dashboard/schedule`,
                    read: false,
                    createdAt: serverTimestamp() as any,
                });
                
                if (reservation.managerRef) {
                    const managerNotificationRef = doc(collection(db, "notifications"));
                    batch.set(managerNotificationRef, {
                        userId: reservation.managerRef,
                        message: `The payment for your game at ${reservation.pitchName} is complete. The match is confirmed!`,
                        link: `/dashboard/games/${matchSnap.docs[0].id}`,
                        read: false,
                        createdAt: serverTimestamp() as any,
                    });
                }

                conflictingSnap.docs.forEach(otherResDoc => {
                    if(otherResDoc.id !== reservation.id) {
                        batch.update(otherResDoc.ref, { status: "Canceled", paymentStatus: "Cancelled" });
                        const managerId = otherResDoc.data().managerRef || otherResDoc.data().playerRef;
                        if(managerId) {
                            const cancellationNotificationRef = doc(collection(db, 'notifications'));
                            batch.set(cancellationNotificationRef, { userId: managerId, message: `The slot you booked for ${format(new Date(reservation.date), 'MMM d, HH:mm')} was secured by another team.`, link: '/dashboard/games', read: false, createdAt: serverTimestamp() as any });
                        }
                    }
                });
            }

            await batch.commit();
        
            toast({ title: "Payment Successful!", description: totalPaid >= reservation.totalAmount ? "Your game is confirmed!" : "Your share is paid." });
            onPaymentProcessed();
            
        } catch (error: any) {
            console.error("Error processing payment:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
        }
    }

    return (
        <Button size="sm" onClick={handlePayNow} disabled={!reservation}><CreditCard className="mr-2"/> Pay To Confirm</Button>
    )
}

