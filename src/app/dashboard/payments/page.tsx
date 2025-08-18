

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, addDoc, getDoc, documentId, updateDoc } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Payment, Notification, PaymentStatus, Reservation, User, Team, Match } from "@/types";
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

        const reservationRef = doc(db, "reservations", payment.reservationRef);
        const reservationDoc = await getDoc(reservationRef);
        if (!reservationDoc.exists()) throw new Error("Reservation not found.");
        const reservation = reservationDoc.data() as Reservation;

        // --- Critical Check: Ensure the slot is still available ---
        const conflictingReservationsQuery = query(
            collection(db, "reservations"),
            where("pitchId", "==", reservation.pitchId),
            where("date", "==", reservation.date),
            where("status", "==", "Scheduled")
        );
        const conflictingSnap = await getDocs(conflictingReservationsQuery);
        if (!conflictingSnap.empty) {
            toast({ variant: "destructive", title: "Slot Taken", description: "Sorry, another team has just booked this slot. Your reservation has been cancelled." });
            // Cancel this now-obsolete reservation
            await updateDoc(reservationRef, { status: "Canceled", paymentStatus: "Cancelled" });
            onPaymentProcessed();
            return;
        }


        const batch = writeBatch(db);
        const paymentRef = doc(db, "payments", payment.id);
        
        try {
             // --- 1. Update Payment and Reservation to Paid/Scheduled ---
            batch.update(paymentRef, { status: "Paid" });
            batch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });
            
            // --- 2. Create the Match ---
            const newMatchRef = doc(collection(db, "matches"));
            const matchData: Omit<Match, 'id'> = {
                date: reservation.date,
                teamARef: reservation.teamRef || null,
                teamBRef: null,
                teamAPlayers: [],
                teamBPlayers: [],
                scoreA: 0,
                scoreB: 0,
                pitchRef: reservation.pitchId,
                status: reservation.teamRef ? "PendingOpponent" : "Scheduled",
                attendance: 0,
                refereeId: null,
                managerRef: reservation.managerRef || null,
                allowExternalPlayers: true,
                reservationRef: reservation.id,
            };
            batch.set(newMatchRef, matchData);
            
            // --- 3. Notify the Owner ---
            const ownerNotificationRef = doc(collection(db, "notifications"));
            batch.set(ownerNotificationRef, {
                ownerProfileId: reservation.ownerProfileId,
                message: `Booking confirmed for ${reservation.pitchName} on ${format(new Date(reservation.date), 'MMM d')}. Payment received.`,
                link: `/dashboard/schedule`,
                read: false,
                createdAt: serverTimestamp() as any,
            });

            // --- 4. If it's a team booking, invite players ---
            if (reservation.teamRef && reservation.managerRef) {
                const teamDoc = await getDoc(doc(db, "teams", reservation.teamRef));
                if (teamDoc.exists()) {
                    const team = teamDoc.data() as Team;
                    if (team.playerIds?.length > 0) {
                        for (const playerId of team.playerIds) {
                            const invitationRef = doc(collection(db, "matchInvitations"));
                            batch.set(invitationRef, { matchId: newMatchRef.id, teamId: team.id, playerId: playerId, managerId: reservation.managerRef, status: "pending", invitedAt: serverTimestamp() });
                            const inviteNotificationRef = doc(collection(db, 'notifications'));
                            batch.set(inviteNotificationRef, { userId: playerId, message: `You've been invited to a game with ${team.name}.`, link: '/dashboard/my-games', read: false, createdAt: serverTimestamp() as any });
                        }
                    }
                }
            }
            
            // --- 5. Cancel conflicting reservations ---
            const otherReservationsQuery = query(
                collection(db, "reservations"),
                where("pitchId", "==", reservation.pitchId),
                where("date", "==", reservation.date),
                where("status", "==", "Confirmed")
            );
            const otherReservationsSnap = await getDocs(otherReservationsQuery);
            otherReservationsSnap.forEach(otherResDoc => {
                batch.update(otherResDoc.ref, { status: "Canceled", paymentStatus: "Cancelled" });
                const managerId = otherResDoc.data().managerRef || otherResDoc.data().playerRef;
                if(managerId) {
                    const cancellationNotificationRef = doc(collection(db, 'notifications'));
                    batch.set(cancellationNotificationRef, { userId: managerId, message: `The slot you booked for ${format(new Date(reservation.date), 'MMM d, HH:mm')} was secured by another team.`, link: '/dashboard/games', read: false, createdAt: serverTimestamp() as any });
                }
            });


            await batch.commit();
        
            toast({ title: "Game Confirmed!", description: "Your payment was successful and the game is now scheduled." });
            onPaymentProcessed();
            
        } catch (error: any) {
            console.error("Error processing payment:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
        }
    }

    return (
        <Button size="sm" onClick={handlePayNow}><CreditCard className="mr-2"/> Pay To Confirm</Button>
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
            
            if (totalPaid >= res.totalAmount && res.paymentStatus !== 'Paid') {
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

    let roleField: 'actorId' | 'ownerRef' | 'teamRef' ;
    let initialQuery;

    if (user.role === 'PLAYER' || user.role === 'MANAGER') {
        roleField = 'actorId';
        initialQuery = query(collection(db, "payments"), where(roleField, "==", user.id));
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
        const playerIds = [...new Set(paymentsData.map(p => p.playerRef).filter(Boolean)), ...new Set(paymentsData.map(p => p.managerRef).filter(Boolean))];

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
            const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', playerIds.filter(Boolean)));
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
        const playerMatch = user.role !== 'PLAYER' && p.actorId && playerUsers.get(p.actorId)?.name.toLowerCase().includes(lowerCaseSearch);
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
                        <TableHead>Description</TableHead>
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
                        const actorName = p.actorId ? playerUsers.get(p.actorId)?.name : "N/A";
                        const description = p.type === 'booking' ? `Booking at ${p.pitchName}` : `Share for ${p.teamName} at ${p.pitchName}`;
                        
                        return (
                            <TableRow key={p.id}>
                                {user.role !== 'PLAYER' && <TableCell className="font-medium">{actorName}</TableCell>}
                                <TableCell className="font-medium">{description}</TableCell>
                                <TableCell>{reservation ? format(new Date(reservation.date), "dd/MM/yyyy") : '-'}</TableCell>
                                <TableCell>{p.date ? format(new Date(p.date), "dd/MM/yyyy") : '-'}</TableCell>
                                <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                                <TableCell className="text-right font-mono">{p.amount.toFixed(2)}€</TableCell>
                                {showActions && (
                                    <TableCell className="text-right">
                                        {p.status === 'Pending' && user?.id === p.actorId && (
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
                            <TableCell colSpan={user.role !== 'PLAYER' ? 7 : (showActions ? 6 : 5)} className="h-24 text-center">
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

    

    
