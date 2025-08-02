

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDoc, addDoc, getDocs, updateDoc } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Payment, Reservation, Notification, Team } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, Clock, History, Ban, CreditCard, Users, Shield } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function PaymentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe = () => {};
    let reservationsQuery;

    if (user.role === 'PLAYER') {
      // Players see reservations they need to pay for (split payments)
      reservationsQuery = query(collection(db, "reservations"), where("playerRef", "==", user.id), where("paymentStatus", "==", "Pending"));
    } else if (user.role === 'MANAGER') {
      // Managers see reservations they made that are pending payment
       reservationsQuery = query(collection(db, "reservations"), where("managerRef", "==", user.id));
    } else if (user.role === 'OWNER') {
        // Owners see all reservations for their pitches
        reservationsQuery = query(collection(db, "reservations"), where("ownerProfileId", "==", user.id));
    } else {
        setReservations([]);
        setLoading(false);
        return;
    }

    unsubscribe = onSnapshot(reservationsQuery, (querySnapshot) => {
      const reservationData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
      setReservations(reservationData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reservations for payment:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch payment information." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);
  

  const ManagerPaymentDialog = ({ reservation }: { reservation: Reservation }) => {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    const handlePayFull = async () => {
        const batch = writeBatch(db);
        const reservationRef = doc(db, "reservations", reservation.id);
        
        try {
            // Update reservation status
            batch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });

            // Notify owner
            const ownerNotificationRef = doc(collection(db, "notifications"));
            const notification: Omit<Notification, 'id'> = {
                ownerProfileId: reservation.ownerProfileId,
                message: `Payment received for booking at ${reservation.pitchName}. The game is confirmed.`,
                link: `/dashboard/schedule`,
                read: false,
                createdAt: serverTimestamp() as any,
            };
            batch.set(ownerNotificationRef, notification);

            await batch.commit();
            setIsDialogOpen(false);
            toast({ title: "Payment Successful!", description: "The reservation is now confirmed." });
        } catch (error: any) {
             console.error("Error processing full payment:", error);
             toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
        }
    }

    const handleSplitPayment = async () => {
        if (!reservation.teamRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Reservation is not associated with a team.' });
            return;
        }

        const batch = writeBatch(db);
        try {
            // 1. Get Team and Players
            const teamRef = doc(db, "teams", reservation.teamRef);
            const teamDoc = await getDoc(teamRef);
            if (!teamDoc.exists()) throw new Error("Team not found to split payment.");
            const team = teamDoc.data() as Team;
            const playerIds = team.playerIds;
            if (playerIds.length === 0) throw new Error("Team has no players to split payment with.");

            // 2. Calculate amount per player
            const amountPerPlayer = reservation.totalAmount / playerIds.length;

            // 3. Create a new payment doc for each player and notify them
            for (const playerId of playerIds) {
                const playerPaymentRef = doc(collection(db, "payments"));
                batch.set(playerPaymentRef, {
                    type: "booking_split",
                    amount: amountPerPlayer,
                    status: "Pending",
                    date: new Date().toISOString(),
                    reservationRef: reservation.id,
                    teamRef: reservation.teamRef,
                    playerRef: playerId,
                });

                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                    userId: playerId,
                    message: `Your share of ${amountPerPlayer.toFixed(2)}€ for the game with ${team.name} is now due.`,
                    link: '/dashboard/payments',
                    read: false,
                    createdAt: serverTimestamp() as any,
                });
            }

            // 4. Update the original reservation to 'Split'
            const originalReservationRef = doc(db, "reservations", reservation.id);
            batch.update(originalReservationRef, { paymentStatus: "Split" });

            // 5. Commit batch
            await batch.commit();
            setIsDialogOpen(false);
            toast({ title: "Payment Split!", description: `Each of the ${playerIds.length} players has been assigned their share.` });

        } catch (error: any) {
            console.error("Error splitting payment:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not split payment: ${error.message}` });
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button className="w-full"><CreditCard className="mr-2"/> Process Payment</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>How do you want to pay?</DialogTitle>
                    <DialogDescription>
                        You can pay the full amount now, or split the cost equally among all players on your team.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-4">
                    <Button size="lg" onClick={handlePayFull}>
                        <DollarSign className="mr-2"/> Pay full amount ({reservation.totalAmount.toFixed(2)}€)
                    </Button>
                     <Button size="lg" variant="outline" onClick={handleSplitPayment}>
                        <Users className="mr-2"/> Split between players
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
  }

  const handlePayNow = async (payment: Payment) => {
    if (!payment.reservationRef) {
        toast({ variant: "destructive", title: "Error", description: "This payment is not linked to a reservation." });
        return;
    }

    const batch = writeBatch(db);
    const paymentRef = doc(db, "payments", payment.id);
    
    batch.update(paymentRef, { status: "Paid" });
    
    try {
        await batch.commit();

        // Check if all player payments for this reservation are now paid
        const reservationRef = doc(db, "reservations", payment.reservationRef);
        const paymentsQuery = query(collection(db, "payments"), where("reservationRef", "==", payment.reservationRef), where("status", "==", "Pending"));
        const pendingPaymentsSnap = await getDocs(paymentsQuery);

        if (pendingPaymentsSnap.empty) {
            // All payments are done, confirm reservation and notify owner
            const reservationDoc = await getDoc(reservationRef);
            if (reservationDoc.exists()) {
                const reservation = reservationDoc.data() as Reservation;
                const finalBatch = writeBatch(db);
                finalBatch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });

                const ownerNotificationRef = doc(collection(db, "notifications"));
                const notification: Omit<Notification, 'id'> = {
                    ownerProfileId: reservation.ownerProfileId,
                    message: `Payment received for booking at ${reservation.pitchName}. The game is confirmed.`,
                    link: `/dashboard/schedule`,
                    read: false,
                    createdAt: serverTimestamp() as any,
                };
                finalBatch.set(ownerNotificationRef, notification);
                await finalBatch.commit();
                
                 toast({
                    title: "Final Payment Received!",
                    description: "The reservation is now confirmed and scheduled.",
                });
            }
        } else {
             toast({
                title: "Payment Successful!",
                description: `Your payment has been registered. Waiting for ${pendingPaymentsSnap.size} other players.`,
            });
        }
    } catch (error: any) {
        console.error("Error processing payment:", error);
        toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
    }
  }

  const getStatusInfo = (status: Reservation["paymentStatus"]) => {
    switch(status) {
      case "Paid": return { text: "Paid", icon: CheckCircle, color: "text-green-600" };
      case "Pending": return { text: "Pending", icon: Clock, color: "text-amber-600" };
      case "Split": return { text: "Split", icon: Users, color: "text-blue-600" };
      case "Cancelled": return { text: "Cancelled", icon: Ban, color: "text-muted-foreground" };
      default: return { text: "N/A", icon: DollarSign, color: "text-primary" };
    }
  }

  const ReservationPaymentCard = ({ reservation }: { reservation: Reservation }) => {
    const statusInfo = getStatusInfo(reservation.paymentStatus);
    const isManagerBooking = user?.role === 'MANAGER';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex justify-between items-center">
            <span>{reservation.pitchName}</span>
            <Badge variant={reservation.paymentStatus === 'Pending' ? 'destructive' : 'outline'}>{reservation.paymentStatus}</Badge>
          </CardTitle>
          <CardDescription>
            {reservation.date ? format(new Date(reservation.date), "PPP 'at' HH:mm") : 'Date not available'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-4xl font-bold text-center">
            {reservation.totalAmount.toFixed(2)}€
          </div>
           <div className="flex items-center justify-center gap-2 text-sm">
            <statusInfo.icon className={`h-4 w-4 ${statusInfo.color}`} />
            <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.text}</span>
          </div>
          <p className="text-xs text-center text-muted-foreground">Booked by: {reservation.actorName}</p>
        </CardContent>
        {reservation.paymentStatus === 'Pending' && (
          <CardFooter>
            {isManagerBooking && <ManagerPaymentDialog reservation={reservation} />}
            {/* Player payment for split fees will be handled separately if we create `payment` docs */}
          </CardFooter>
        )}
      </Card>
    )
  }

  const LoadingSkeleton = () => (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
      </div>
  )

  const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card className="flex flex-col items-center justify-center p-12 text-center mt-4 border-dashed">
        <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold font-headline">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  )
  
  const pendingReservations = reservations.filter(r => r.paymentStatus === 'Pending');
  const historyReservations = reservations.filter(r => r.paymentStatus !== 'Pending');

  if (user?.role === 'OWNER') {
     return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Payments Overview</h1>
                <p className="text-muted-foreground">
                View payment status for all your reservations.
                </p>
            </div>
            <div className="space-y-4">
                <h2 className="text-2xl font-bold font-headline">All Reservations ({reservations.length})</h2>
                 {loading ? <LoadingSkeleton /> : reservations.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {reservations.map(r => <ReservationPaymentCard key={r.id} reservation={r} />)}
                </div>
                ) : (
                <EmptyState icon={Shield} title="No Reservations Yet" description="When you receive reservations, their payment status will appear here." />
                )}
            </div>
        </div>
     )
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Payments</h1>
        <p className="text-muted-foreground">
          Manage your pending payments for reservations.
        </p>
      </div>

       <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline text-primary">Pending Payments ({pendingReservations.length})</h2>
        {loading ? <LoadingSkeleton /> : pendingReservations.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pendingReservations.map(r => <ReservationPaymentCard key={r.id} reservation={r} />)}
          </div>
        ) : (
          <EmptyState icon={CheckCircle} title="All Caught Up!" description="You have no reservations with pending payments." />
        )}
      </div>

      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Payment History ({historyReservations.length})</h2>
        {loading ? <LoadingSkeleton /> : historyReservations.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {historyReservations.map(r => <ReservationPaymentCard key={r.id} reservation={r} />)}
          </div>
        ) : (
          <EmptyState icon={History} title="No Payment History" description="Your past payments will appear here." />
        )}
      </div>
    </div>
  );
}
