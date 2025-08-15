

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, updateDoc, getDoc, addDoc } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Payment, Reservation, Notification, Team, Match } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, Clock, History, Ban, CreditCard, Send } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


const PlayerPaymentButton = ({ payment, onPaymentProcessed }: { payment: Payment, onPaymentProcessed: () => void }) => {
    const { toast } = useToast();

    const handlePayNow = async () => {
        if (!payment.reservationRef) {
            toast({ variant: "destructive", title: "Error", description: "This payment is not linked to a reservation." });
            return;
        }

        const batch = writeBatch(db);
        const paymentRef = doc(db, "payments", payment.id);
        
        batch.update(paymentRef, { status: "Paid" });
        
        try {
            await batch.commit();

            const reservationRef = doc(db, "reservations", payment.reservationRef);
            const paymentsQuery = query(
                collection(db, "payments"), 
                where("reservationRef", "==", payment.reservationRef), 
                where("status", "==", "Pending")
            );
            
            const pendingPaymentsSnap = await getDocs(paymentsQuery);

            if (pendingPaymentsSnap.empty) {
                const reservationDoc = await getDoc(reservationRef);
                if (reservationDoc.exists()) {
                    const reservation = reservationDoc.data() as Reservation;
                    const finalBatch = writeBatch(db);
                    finalBatch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });
                    
                    const matchQuery = query(collection(db, 'matches'), where('reservationRef', '==', reservation.id));
                    const matchSnap = await getDocs(matchQuery);
                    if(!matchSnap.empty) {
                        const matchRef = matchSnap.docs[0].ref;
                        finalBatch.update(matchRef, { status: 'Scheduled' });
                    }

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
            onPaymentProcessed();
        } catch (error: any) {
            console.error("Error processing payment:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
        }
    }

    return (
        <Button size="sm" onClick={handlePayNow}><CreditCard className="mr-2"/> Pay Your Share</Button>
    )
}

const ManagerRemindButton = ({ payment }: { payment: Payment }) => {
    const { toast } = useToast();
    const [isSending, setIsSending] = React.useState(false);

    const handleRemind = async () => {
        if (!payment.playerRef || !payment.teamName || !payment.pitchName) {
            toast({ variant: "destructive", title: "Error", description: "Payment details are incomplete." });
            return;
        }
        setIsSending(true);
        try {
            const notification: Omit<Notification, 'id'> = {
                userId: payment.playerRef,
                message: `Reminder: You have a pending payment to your manager for the game with ${payment.teamName}.`,
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

export default function PaymentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchPayments = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
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

    const unsubscribe = onSnapshot(paymentsQuery, (querySnapshot) => {
      const paymentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      // Sort payments client-side
      paymentsData.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setPayments(paymentsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching payments:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch payment information." });
      setLoading(false);
    });

    return unsubscribe;
  }, [user, toast]);

  React.useEffect(() => {
    const unsubscribePromise = fetchPayments();
    return () => {
      unsubscribePromise.then(unsub => unsub && unsub());
    }
  }, [fetchPayments]);
  

  const getStatusBadge = (status: Payment["status"]) => {
    switch(status) {
      case "Paid": return <Badge variant="default" className="bg-green-600">Paid</Badge>;
      case "Pending": return <Badge variant="destructive">Pending</Badge>;
      case "Cancelled": return <Badge variant="outline">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  }

  const getPaymentTitle = (payment: Payment) => {
    if (payment.type === 'booking_split') return `Game fee: ${payment.teamName} @ ${payment.pitchName}`;
    if (payment.type === 'reimbursement') return `Reimbursement to Manager for game at ${payment.pitchName}`;
    return 'Payment';
  }


  const PaymentsTable = ({ payments, showActions }: { payments: Payment[], showActions: boolean }) => (
    <Card>
        <CardContent className="p-0">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[150px]">Date</TableHead>
                        <TableHead className="w-[120px] text-center">Status</TableHead>
                        <TableHead className="w-[120px] text-right">Amount</TableHead>
                        {showActions && <TableHead className="w-[150px] text-right">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payments.map((p) => (
                        <TableRow key={p.id}>
                            <TableCell className="font-medium">{getPaymentTitle(p)}</TableCell>
                            <TableCell>{p.date ? format(new Date(p.date), "dd/MM/yyyy") : '-'}</TableCell>
                            <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                            <TableCell className="text-right font-mono">{p.amount.toFixed(2)}€</TableCell>
                             {showActions && (
                                 <TableCell className="text-right">
                                    {p.status === 'Pending' && user?.role === 'PLAYER' && (
                                        <PlayerPaymentButton payment={p} onPaymentProcessed={() => fetchPayments()} />
                                    )}
                                    {p.status === 'Pending' && user?.role === 'MANAGER' && p.type === 'reimbursement' && (
                                        <ManagerRemindButton payment={p} />
                                    )}
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  )

  const LoadingSkeleton = () => (
      <div className="space-y-4">
         <Skeleton className="h-10 w-1/4" />
         <Skeleton className="h-48 w-full" />
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
          View your payment history and pending game fees.
        </p>
      </div>

       <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline text-primary">Pending Payments ({pendingPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : pendingPayments.length > 0 ? (
          <PaymentsTable payments={pendingPayments} showActions={true} />
        ) : (
          <EmptyState icon={CheckCircle} title="All Caught Up!" description="You have no pending payments." />
        )}
      </div>

      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Payment History ({historyPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : historyPayments.length > 0 ? (
          <PaymentsTable payments={historyPayments} showActions={false}/>
        ) : (
          <EmptyState icon={History} title="No Payment History" description="Your past payments will appear here." />
        )}
      </div>
    </div>
  );
}
