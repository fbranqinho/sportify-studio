
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, writeBatch, collection, query, where, getDocs, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Reservation, Payment, Pitch } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { getPlayerCapacity } from "@/lib/utils";

export function ManageGame({ match, onMatchUpdate, reservation, pitch }: { match: Match; onMatchUpdate: (data: Partial<Match>) => void; reservation: Reservation | null; pitch: Pitch | null; }) {
    const { toast } = useToast();
    const router = useRouter();
    const isPaid = reservation?.paymentStatus === 'Paid';

    const capacity = pitch ? getPlayerCapacity(pitch.sport) : 0;
    const isFull = capacity > 0 && (match.teamAPlayers.length + (match.teamBPlayers?.length || 0)) >= capacity;

    const handleToggleExternalPlayers = async (checked: boolean) => {
        const matchRef = doc(db, "matches", match.id);
        try {
            await updateDoc(matchRef, { allowExternalPlayers: checked });
            onMatchUpdate({ allowExternalPlayers: checked });
            toast({ title: "Settings updated", description: `Players can ${checked ? 'now' : 'no longer'} apply to this game.`});
        } catch (error) {
            console.error("Error updating match settings:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not update match settings." });
        }
    }

    const handleToggleAllowChallenges = async (checked: boolean) => {
        const matchRef = doc(db, "matches", match.id);
        try {
            await updateDoc(matchRef, { allowChallenges: checked });
            onMatchUpdate({ allowChallenges: checked });
            toast({ title: "Settings updated", description: `Other teams can ${checked ? 'now' : 'no longer'} challenge you for this game slot.`});
        } catch (error) {
            console.error("Error updating match settings:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not update match settings." });
        }
    }
    
    const handleDeleteGame = async () => {
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", match.id);
        
        try {
            if (match.reservationRef) {
                const reservationRef = doc(db, "reservations", match.reservationRef);
                const paymentsQuery = query(collection(db, "payments"), where("reservationRef", "==", match.reservationRef));
                const paymentsSnap = await getDocs(paymentsQuery);

                let playerIdsToNotify: string[] = [];

                if (!paymentsSnap.empty) {
                    paymentsSnap.forEach(paymentDoc => {
                        const payment = paymentDoc.data() as Payment;
                        const playerRef = payment.playerRef || (payment.managerRef && payment.type === 'booking_split' ? payment.managerRef : undefined);
                        
                        if (playerRef) playerIdsToNotify.push(playerRef);

                        if (payment.status === 'Paid') {
                            batch.update(paymentDoc.ref, { status: 'Refunded' });
                        } else if (payment.status === 'Pending') {
                            batch.update(paymentDoc.ref, { status: 'Cancelled' });
                        }
                    });
                }
                
                if (match.managerRef && !playerIdsToNotify.includes(match.managerRef)) {
                    playerIdsToNotify.push(match.managerRef);
                }

                playerIdsToNotify.forEach(userId => {
                    const notificationRef = doc(collection(db, 'notifications'));
                    batch.set(notificationRef, {
                        userId: userId,
                        message: `The game on ${format(new Date(match.date), 'MMM d')} has been cancelled. Payments have been refunded/cancelled.`,
                        link: '/dashboard/payments',
                        read: false,
                        createdAt: serverTimestamp() as any,
                    });
                });

                batch.delete(reservationRef);
            }

            batch.delete(matchRef);

            await batch.commit();
            toast({ title: "Game Deleted", description: "The game, reservation, and associated payments have been removed or updated."});
            router.push('/dashboard/my-games');
        } catch (error) {
            console.error("Error deleting game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete the game." });
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Game Settings</CardTitle>
                 <CardDescription>Manage advanced options for this game.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="allow-external" className="text-base font-semibold">
                            Accept External Players
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Allow players who are not in a team to apply to fill empty slots in this game.
                        </p>
                    </div>
                    <Switch
                        id="allow-external"
                        checked={!!match.allowExternalPlayers}
                        onCheckedChange={handleToggleExternalPlayers}
                        disabled={isFull}
                    />
                </div>
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="allow-challenges" className="text-base font-semibold">
                            Accept Challenge from other teams
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Allow other teams to challenge you for this game slot.
                        </p>
                    </div>
                    <Switch
                        id="allow-challenges"
                        checked={!!match.allowChallenges}
                        onCheckedChange={handleToggleAllowChallenges}
                        disabled={isFull || !!match.teamBRef}
                    />
                </div>
                <div className="flex items-center justify-between space-x-2 rounded-lg border border-destructive/50 p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="delete-game" className="text-base font-semibold text-destructive">
                            Delete Game
                        </Label>
                        <p className="text-sm text-muted-foreground">
                        This will permanently delete the game and its associated field reservation. This action cannot be undone.
                        </p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isPaid && !reservation?.allowCancellationsAfterPayment}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the game
                                and its associated reservation, and refund/cancel any related payments.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteGame}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}

    