

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc } from "firebase/firestore";
import type { Payment, Notification } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

export const ManagerRemindButton = ({ payment }: { payment: Payment }) => {
    const { toast } = useToast();
    const [isSending, setIsSending] = React.useState(false);

    const handleRemind = async () => {
        if (!payment.playerRef || !payment.teamName || !payment.pitchName) {
            toast({ variant: "destructive", title: "Error", description: "Payment details are incomplete." });
            return;
        }
        setIsSending(true);
        try {
            const notificationRef = doc(collection(db, "users", payment.playerRef, "notifications"));
            const notification: Omit<Notification, 'id'> = {
                userId: payment.playerRef,
                message: `Reminder: You have a pending payment for the game with ${payment.teamName}.`,
                link: '/dashboard/payments',
                read: false,
                createdAt: serverTimestamp() as any,
            };
            await addDoc(collection(db, "notifications"), notification);

            toast({ title: "Reminder Sent!", description: "A notification has been sent to the player." });
        } catch (error: any) {
            console.error("Error sending reminder:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not send reminder: ${error.message}` });
        } finally {
            setIsSending(false);
        }
    }

    return (
        <Button size="sm" variant="outline" onClick={handleRemind} disabled={isSending}>
           {isSending ? "Sending..." : <><Send className="mr-2 h-3 w-3" /> Remind</>}
        </Button>
    )
}
