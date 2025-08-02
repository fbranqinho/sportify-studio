

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, updateDoc } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Payment, Reservation, Notification, Team } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, Clock, History, Ban, CreditCard, Users, Shield } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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
      toast({ variant: "destructive", title: "Error", description: "Could not fetch payment information." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);
  

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

                 const ownerProfileQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", reservation.ownerProfileId));
                 const ownerProfileSnapshot = await getDocs(ownerProfileQuery);
                 if(!ownerProfileSnapshot.empty) {
                     const ownerProfileId = ownerProfileSnapshot.docs[0].id;
                     const ownerNotificationRef = doc(collection(db, "notifications"));
                     const notification: Omit<Notification, 'id'> = {
                         ownerProfileId: ownerProfileId,
                         message: `Payment received for booking at ${reservation.pitchName}. The game is confirmed.`,
                         link: `/dashboard/schedule`,
                         read: false,
                         createdAt: serverTimestamp() as any,
                     };
                     finalBatch.set(ownerNotificationRef, notification);
                     await finalBatch.commit();
                 }
                
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
      case "Cancelled": return { text: "Cancelled", icon: Ban, color: "text-muted-foreground" };
      default: return { text: "N/A", icon: DollarSign, color: "text-primary" };
    }
  }

  const PaymentCard = ({ payment }: { payment: Payment }) => {
    const statusInfo = getStatusInfo(payment.status);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex justify-between items-center">
            <span>{payment.type === 'booking_split' ? `Game fee: ${payment.teamName}`: 'Payment'}</span>
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
          {payment.pitchName && <p className="text-xs text-center text-muted-foreground">For: {payment.pitchName}</p>}
        </CardContent>
        {payment.status === 'Pending' && user?.role === 'PLAYER' && (
          <CardFooter>
             <Button className="w-full" onClick={() => handlePayNow(payment)}><CreditCard className="mr-2"/> Pay Now</Button>
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
  
  const pendingPayments = payments.filter(r => r.status === 'Pending');
  const historyPayments = payments.filter(r => r.status !== 'Pending');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Payments</h1>
        <p className="text-muted-foreground">
          View your payment history and pay for pending game fees.
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
        <h2 className="text-2xl font-bold font-headline">Payment History ({historyPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : historyPayments.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {historyPayments.map(p => <PaymentCard key={p.id} payment={p} />)}
          </div>
        ) : (
          <EmptyState icon={History} title="No Payment History" description="Your past payments will appear here." />
        )}
      </div>
    </div>
  );
}
