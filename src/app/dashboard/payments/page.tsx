

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Payment, Notification, PaymentStatus, Reservation, User, Team } from "@/types";
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
            
            const reservationDoc = await getDoc(reservationRef);
            if (!reservationDoc.exists()) return;

            const reservation = {id: reservationDoc.id, ...reservationDoc.data()} as Reservation;

            const paymentsQuery = query(
                collection(db, "payments"), 
                where("reservationRef", "==", payment.reservationRef),
            );
            
            const paymentsSnap = await getDocs(paymentsQuery);
            const totalPaid = paymentsSnap.docs
                .filter(doc => doc.id === payment.id || doc.data().status === 'Paid') // Include current payment
                .reduce((sum, doc) => sum + doc.data().amount, 0);

            if (totalPaid >= reservation.totalAmount) {
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
            } else {
                 const remainingToPay = paymentsSnap.docs.filter(p => p.data().status === 'Pending' && p.id !== payment.id).length;
                 toast({
                    title: "Payment Successful!",
                    description: `Your payment has been registered. Waiting for ${remainingToPay > 0 ? `${remainingToPay} other players` : 'other payments'}.`,
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
  const [playerUsers, setPlayerUsers] = React.useState<Map<string, User>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  const runConsistencyCheck = React.useCallback(async (reservationsMap: Map<string, Reservation>) => {
        const consistencyBatch = writeBatch(db);
        let hasUpdates = false;

        const reservationsToCheck = Array.from(reservationsMap.values()).filter(r => r.paymentStatus === 'Split');

        for (const res of reservationsToCheck) {
            const paymentsQuery = query(collection(db, "payments"), where("reservationRef", "==", res.id));
            const paymentsSnap = await getDocs(paymentsQuery);
            const totalPaid = paymentsSnap.docs
                .filter(doc => doc.data().status === 'Paid')
                .reduce((sum, doc) => sum + doc.data().amount, 0);
            
            if (totalPaid >= res.totalAmount) {
                const resRef = doc(db, "reservations", res.id);
                consistencyBatch.update(resRef, { paymentStatus: "Paid", status: "Scheduled" });
                
                const matchQuery = query(collection(db, 'matches'), where('reservationRef', '==', res.id));
                const matchSnap = await getDocs(matchQuery);
                if (!matchSnap.empty) {
                    const matchRef = matchSnap.docs[0].ref;
                    consistencyBatch.update(matchRef, { status: 'Scheduled' });
                }
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            try {
              await consistencyBatch.commit();
              toast({ title: "Data Synced", description: "Corrected the status of some pending games." });
              return true; // Indicates an update happened
            } catch(e) {
                console.error("Consistency check failed:", e);
                return false;
            }
        }
        return false;

  }, [toast]);

  const fetchData = React.useCallback(async () => {
    if (!user) {
        setLoading(false);
        return;
    }

    setLoading(true);

    let roleField: string;
    let initialQuery;

    if (user.role === 'PLAYER') {
        roleField = 'playerRef';
        initialQuery = query(collection(db, "payments"), where(roleField, "==", user.id));
    } else if (user.role === 'MANAGER') {
        const teamsQuery = query(collection(db, "teams"), where("managerId", "==", user.id));
        const teamsSnap = await getDocs(teamsQuery);
        const teamIds = teamsSnap.docs.map(d => d.id);
        if (teamIds.length > 0) {
            initialQuery = query(collection(db, "payments"), where("teamRef", "in", teamIds));
        } else {
             setAllPayments([]);
             setLoading(false);
             return;
        }
    } else if (user.role === 'OWNER') {
        const ownerProfileQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
        const ownerProfileSnap = await getDocs(ownerProfileQuery);
        if(!ownerProfileSnap.empty) {
            const ownerProfileId = ownerProfileSnap.docs[0].id;
            initialQuery = query(collection(db, "payments"), where("ownerRef", "==", ownerProfileId));
        } else {
            setAllPayments([]);
            setLoading(false);
            return;
        }
    } else {
        setLoading(false);
        return;
    }

    const unsubscribe = onSnapshot(initialQuery, async (snapshot) => {
        const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setAllPayments(paymentsData);

        const reservationIds = [...new Set(paymentsData.map(p => p.reservationRef).filter(Boolean))];
        const playerIds = [...new Set(paymentsData.map(p => p.playerRef).filter(Boolean))];

        const reservationsMap = new Map<string, Reservation>();
        if (reservationIds.length > 0) {
            const reservationsQuery = query(collection(db, "reservations"), where(documentId(), "in", reservationIds));
            const reservationsSnap = await getDocs(reservationsQuery);
            reservationsSnap.forEach(doc => {
                reservationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Reservation);
            });
            setReservations(reservationsMap);

             // Run consistency check only for managers for now
            if (user.role === 'MANAGER') {
               const updated = await runConsistencyCheck(reservationsMap);
               if (updated) {
                   // If an update happened, the onSnapshot listener will re-trigger with fresh data.
                   return;
               }
            }
        }
        
        if (playerIds.length > 0) {
            const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', playerIds));
            const usersSnap = await getDocs(usersQuery);
            const usersMap = new Map<string, User>();
            usersSnap.forEach(doc => {
                usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
            });
            setPlayerUsers(usersMap);
        }
        
        setLoading(false);
    }, (error) => {
        console.error("Error fetching payments:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch payments." });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast, runConsistencyCheck]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPayments = React.useMemo(() => {
    return allPayments.filter(p => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        const teamMatch = p.teamName?.toLowerCase().includes(lowerCaseSearch);
        const pitchMatch = p.pitchName?.toLowerCase().includes(lowerCaseSearch);
        const playerMatch = user.role === 'MANAGER' && p.playerRef && playerUsers.get(p.playerRef)?.name.toLowerCase().includes(lowerCaseSearch);
        return teamMatch || pitchMatch || playerMatch;
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [allPayments, searchTerm, user.role, playerUsers]);

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
                        {user.role !== 'PLAYER' && <TableHead>Player/Manager</TableHead>}
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
                        const actorId = p.playerRef || p.managerRef;
                        const actorName = actorId ? playerUsers.get(actorId)?.name : "N/A";
                        return (
                            <TableRow key={p.id}>
                                {user.role !== 'PLAYER' && <TableCell className="font-medium">{actorName}</TableCell>}
                                <TableCell className="font-medium">{p.teamName || '-'}</TableCell>
                                <TableCell>{p.pitchName || '-'}</TableCell>
                                <TableCell>{reservation ? format(new Date(reservation.date), "dd/MM/yyyy") : '-'}</TableCell>
                                <TableCell>{p.date ? format(new Date(p.date), "dd/MM/yyyy") : '-'}</TableCell>
                                <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                                <TableCell className="text-right font-mono">{p.amount.toFixed(2)}€</TableCell>
                                {showActions && (
                                    <TableCell className="text-right">
                                        {p.status === 'Pending' && user?.role === 'PLAYER' && (
                                            <PlayerPaymentButton payment={p} onPaymentProcessed={fetchData} />
                                        )}
                                        {p.status === 'Pending' && user?.role === 'MANAGER' && p.type === 'booking_split' && (
                                            <ManagerRemindButton payment={p} />
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        )
                    }) : (
                        <TableRow>
                            <TableCell colSpan={user.role !== 'PLAYER' ? 8 : (showActions ? 7 : 6)} className="h-24 text-center">
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
                    placeholder="Search by team, pitch or player name..."
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

    

    