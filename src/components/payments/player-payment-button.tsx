
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { doc, writeBatch, serverTimestamp, getDocs, query, collection, where, getDoc, updateDoc } from "firebase/firestore";
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
        if (!reservation) {
            toast({ variant: "destructive", title: "Error", description: "This payment is missing critical reservation details." });
            setIsProcessing(false);
            return;
        }

        try {
            // This is now a simple, single update operation.
            // It only modifies the user's own payment document.
            // This is allowed by the Firestore security rules.
            const paymentRef = doc(db, "payments", payment.id);
            await updateDoc(paymentRef, { 
                status: "Paid", 
                date: new Date().toISOString() 
            });

            // The logic to check if all players have paid and then update the reservation/match
            // should be handled by a manager action or a server-side function in the future
            // to avoid client-side permission issues. For now, the critical part is that the
            // player can successfully pay.
        
            toast({ title: "Payment Successful!", description: "Your share of the game fee has been paid." });
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
