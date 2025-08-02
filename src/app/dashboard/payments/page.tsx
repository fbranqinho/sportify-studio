

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDoc, addDoc, getDocs } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Payment, Reservation, Notification, Team } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, Clock, History, Ban, CreditCard, Users } from "lucide-react";
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
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe = () => {};
    let paymentsQuery;

    if (user.role === 'PLAYER') {
      paymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id));
    } else if (user.role === 'MANAGER') {
      paymentsQuery = query(collection(db, "payments"), where("managerRef", "==", user.id));
    } else if (user.role === 'OWNER') {
        const reservationsQuery = query(collection(db, "reservations"), where("ownerProfileId", "==", user.id));
        onSnapshot(reservationsQuery, async (resSnap) => {
            const reservationIds = resSnap.docs.map(d => d.id);
            if (reservationIds.length > 0) {
                 const paymentsForReservationsQuery = query(collection(db, "payments"), where("reservationRef", "in", reservationIds));
                 unsubscribe = onSnapshot(paymentsForReservationsQuery, (paySnap) => {
                     const paymentsData = paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
                     setPayments(paymentsData);
                     setLoading(false);
                 });
            } else {
                setPayments([]);
                setLoading(false);
            }
        });
        return; // Exit early as the logic is different
    } else {
        setPayments([]);
        setLoading(false);
        return;
    }

    unsubscribe = onSnapshot(paymentsQuery, (querySnapshot) => {
      const paymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(paymentsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching payments:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch payments." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);
  

  const ManagerPaymentDialog = ({ payment }: { payment: Payment }) => {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    const handlePayFull = async () => {
        // This is the original logic
        const batch = writeBatch(db);
        const paymentRef = doc(db, "payments", payment.id);
        const reservationRef = doc(db, "reservations", payment.reservationRef!);
        
        try {
            const reservationDoc = await getDoc(reservationRef);
            if (!reservationDoc.exists()) throw new Error("Reservation not found");
            const reservation = reservationDoc.data() as Reservation;
            
            batch.update(paymentRef, { status: "Paid" });
            batch.update(reservationRef, { status: "Scheduled" });

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
        if (!payment.teamRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Payment is not associated with a team.' });
            return;
        }

        const batch = writeBatch(db);
        try {
            // 1. Get Team and Players
            const teamRef = doc(db, "teams", payment.teamRef);
            const teamDoc = await getDoc(teamRef);
            if (!teamDoc.exists()) throw new Error("Team not found to split payment.");
            const team = teamDoc.data() as Team;
            const playerIds = team.playerIds;
            if (playerIds.length === 0) throw new Error("Team has no players to split payment with.");

            // 2. Calculate amount per player
            const amountPerPlayer = payment.amount / playerIds.length;

            // 3. Create a new payment doc for each player and notify them
            for (const playerId of playerIds) {
                const playerPaymentRef = doc(collection(db, "payments"));
                batch.set(playerPaymentRef, {
                    type: "booking_split",
                    amount: amountPerPlayer,
                    status: "Pending",
                    date: new Date().toISOString(),
                    reservationRef: payment.reservationRef,
                    teamRef: payment.teamRef,
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

            // 4. Cancel the original manager's payment
            const originalPaymentRef = doc(db, "payments", payment.id);
            batch.update(originalPaymentRef, { status: "Cancelled", notes: "Split among players" });

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
                        <DollarSign className="mr-2"/> Pay full amount ({payment.amount.toFixed(2)}€)
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
                finalBatch.update(reservationRef, { status: "Scheduled" });

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

  const getStatusInfo = (status: Payment["status"]) => {
    switch(status) {
      case "Paid": return { text: "Paid", icon: CheckCircle, color: "text-green-600" };
      case "Pending": return { text: "Pending", icon: Clock, color: "text-amber-600" };
      case "Overdue": return { text: "Overdue", icon: History, color: "text-red-600" };
      case "Cancelled": return { text: "Cancelled", icon: Ban, color: "text-muted-foreground" };
      default: return { text: status, icon: DollarSign, color: "text-primary" };
    }
  }

  const PaymentCard = ({ payment }: { payment: Payment }) => {
    const statusInfo = getStatusInfo(payment.status);
    const isManagerBooking = user?.role === 'MANAGER' && payment.type === 'booking';
    const isPlayerSplit = user?.role === 'PLAYER' && payment.type === 'booking_split';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex justify-between items-center">
            <span>Payment for Booking</span>
            <Badge variant={payment.status === 'Pending' ? 'destructive' : 'outline'}>{payment.status}</Badge>
          </CardTitle>
          <CardDescription>
            {payment.date ? format(new Date(payment.date), "PPP") : 'Date not available'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-4xl font-bold text-center">
            {payment.amount.toFixed(2)}€
          </div>
           <div className="flex items-center justify-center gap-2 text-sm">
            <statusInfo.icon className={`h-4 w-4 ${statusInfo.color}`} />
            <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.text}</span>
          </div>
          <p className="text-xs text-center text-muted-foreground">Type: {payment.type}</p>
        </CardContent>
        {payment.status === 'Pending' && (
          <CardFooter>
            {isManagerBooking && <ManagerPaymentDialog payment={payment} />}
            {isPlayerSplit && 
                <Button className="w-full" onClick={() => handlePayNow(payment)}>
                    <CreditCard className="mr-2" /> Pay Now
                </Button>
            }
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
  
  const pendingPayments = payments.filter(p => p.status === 'Pending' || p.status === 'Overdue');
  const pastPayments = payments.filter(p => p.status === 'Paid' || p.status === 'Cancelled');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Payments</h1>
        <p className="text-muted-foreground">
          {user?.role === 'OWNER' ? 'View payments received for your bookings.' : 'Manage your pending and past payments.'}
        </p>
      </div>

       <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline text-primary">Pending Payments ({pendingPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : pendingPayments.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pendingPayments.map(p => <PaymentCard key={p.id} payment={p} />)}
          </div>
        ) : (
          <EmptyState icon={CheckCircle} title="All Caught Up!" description="You have no pending payments." />
        )}
      </div>

      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Payment History ({pastPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : pastPayments.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pastPayments.map(p => <PaymentCard key={p.id} payment={p} />)}
          </div>
        ) : (
          <EmptyState icon={History} title="No Payment History" description="Your past payments will appear here." />
        )}
      </div>
    </div>
  );
}
