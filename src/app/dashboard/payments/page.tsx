
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Payment, Notification, PaymentStatus, Reservation } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, Clock, History, Ban, CreditCard, Send, CircleSlash, Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";


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
                    const reservation = reservationDoc.data() as any;
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

export default function PaymentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    if (!user) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    const roleField = user.role === 'PLAYER' ? 'playerRef' : 'managerRef';
    const q = query(collection(db, "payments"), where(roleField, "==", user.id));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setAllPayments(paymentsData);

        if (paymentsData.length > 0) {
            const reservationIds = [...new Set(paymentsData.map(p => p.reservationRef).filter(id => id))];
            if (reservationIds.length > 0) {
                const reservationsQuery = query(collection(db, "reservations"), where(documentId(), "in", reservationIds));
                const reservationsSnap = await getDocs(reservationsQuery);
                const reservationsMap = new Map<string, Reservation>();
                reservationsSnap.forEach(doc => {
                    reservationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Reservation);
                });
                setReservations(reservationsMap);
            }
        }
        
        setLoading(false);
    }, (error) => {
        console.error("Error fetching payments:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch payments." });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const filteredPayments = React.useMemo(() => {
    return allPayments.filter(p => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        const teamMatch = p.teamName?.toLowerCase().includes(lowerCaseSearch);
        const pitchMatch = p.pitchName?.toLowerCase().includes(lowerCaseSearch);
        return teamMatch || pitchMatch;
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [allPayments, searchTerm]);

  const pendingPayments = filteredPayments.filter(p => p.status === 'Pending');
  const historyPayments = filteredPayments.filter(p => p.status !== 'Pending');

  const getStatusBadge = (status: PaymentStatus) => {
    switch(status) {
      case "Paid": return <Badge variant="default" className="bg-green-600 gap-1.5"><CheckCircle className="h-3 w-3"/>Paid</Badge>;
      case "Pending": return <Badge variant="destructive" className="gap-1.5"><Clock className="h-3 w-3"/>Pending</Badge>;
      case "Cancelled": return <Badge variant="outline" className="gap-1.5"><Ban className="h-3 w-3"/>Cancelled</Badge>;
      case "Refunded": return <Badge variant="secondary" className="bg-blue-500 text-white gap-1.5"><CircleSlash className="h-3 w-3"/>Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  }

  const PaymentsTable = ({ payments, showActions }: { payments: Payment[], showActions: boolean }) => (
    <Card>
        <CardContent className="p-0">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Pitch</TableHead>
                        <TableHead className="w-[150px]">Game Date</TableHead>
                        <TableHead className="w-[150px]">Payment Date</TableHead>
                        <TableHead className="w-[120px] text-center">Status</TableHead>
                        <TableHead className="w-[120px] text-right">Amount</TableHead>
                        {showActions && <TableHead className="w-[150px] text-right">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payments.length > 0 ? payments.map((p) => {
                        const reservation = p.reservationRef ? reservations.get(p.reservationRef) : null;
                        return (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.teamName || '-'}</TableCell>
                                <TableCell>{p.pitchName || '-'}</TableCell>
                                <TableCell>{reservation ? format(new Date(reservation.date), "dd/MM/yyyy") : '-'}</TableCell>
                                <TableCell>{p.date ? format(new Date(p.date), "dd/MM/yyyy") : '-'}</TableCell>
                                <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                                <TableCell className="text-right font-mono">{p.amount.toFixed(2)}€</TableCell>
                                {showActions && (
                                    <TableCell className="text-right">
                                        {p.status === 'Pending' && user?.role === 'PLAYER' && (
                                            <PlayerPaymentButton payment={p} onPaymentProcessed={() => {}} />
                                        )}
                                        {p.status === 'Pending' && user?.role === 'MANAGER' && p.type === 'reimbursement' && (
                                            <ManagerRemindButton payment={p} />
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        )
                    }) : (
                        <TableRow>
                            <TableCell colSpan={showActions ? 7 : 6} className="h-24 text-center">
                                No payments match your criteria.
                            </TableCell>
                        </TableRow>
                    )}
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
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Payments</h1>
        <p className="text-muted-foreground">
          View your payment history and pending game fees.
        </p>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="Search by team or pitch name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>
        </CardContent>
      </Card>

       <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline text-primary">Pending Payments ({pendingPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : (
          <PaymentsTable payments={pendingPayments} showActions={true} />
        )}
      </div>

      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Payment History ({historyPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : (
          <PaymentsTable payments={historyPayments} showActions={false}/>
        )}
      </div>
    </div>
  );
}

    