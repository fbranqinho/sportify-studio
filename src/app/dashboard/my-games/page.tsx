

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, getDocs, DocumentData, writeBatch, doc, updateDoc, arrayUnion, getDoc, documentId, addDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Match, Team, MatchInvitation, Pitch, OwnerProfile, Notification, Reservation, Payment } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Users, Shield, MapPin, Building, Gamepad2, Check, X, Mail, History, Trophy, DollarSign, CreditCard } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ManagerPaymentDialog = ({ reservation, onPaymentProcessed }: { reservation: Reservation, onPaymentProcessed: () => void }) => {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const { toast } = useToast();

    const handlePayFull = async () => {
        if (!reservation.teamRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Reservation is not associated with a team.' });
            return;
        }

        const batch = writeBatch(db);
        const reservationRef = doc(db, "reservations", reservation.id);
        
        try {
            // Find the associated Match
            const matchQuery = query(collection(db, 'matches'), where('reservationRef', '==', reservation.id));
            const matchSnap = await getDocs(matchQuery);
            if(matchSnap.empty) {
                throw new Error("Associated match not found for this reservation.");
            }
            const matchRef = matchSnap.docs[0].ref;

            // Update reservation and match status
            batch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });
            batch.update(matchRef, { status: "Scheduled" });

            // Notify owner
            const ownerNotificationRef = doc(collection(db, "notifications"));
            const ownerNotification: Omit<Notification, 'id'> = {
                ownerProfileId: reservation.ownerProfileId,
                message: `Payment received for booking at ${reservation.pitchName}. The game is confirmed.`,
                link: `/dashboard/schedule`,
                read: false,
                createdAt: serverTimestamp() as any,
            };
            batch.set(ownerNotificationRef, ownerNotification);
            
            // Get Team and Players to create reimbursement payments
            const teamRef = doc(db, "teams", reservation.teamRef);
            const teamDoc = await getDoc(teamRef);
            if (!teamDoc.exists()) throw new Error("Team not found to create reimbursements.");
            const team = teamDoc.data() as Team;
            const playerIds = team.playerIds.filter(id => id !== reservation.managerRef); // Exclude manager from reimbursement
            
            if (playerIds.length > 0) {
                 const amountPerPlayer = reservation.totalAmount / (playerIds.length + 1); // +1 for the manager
                
                 for (const playerId of playerIds) {
                    const playerPaymentRef = doc(collection(db, "payments"));
                    batch.set(playerPaymentRef, {
                        type: "reimbursement",
                        amount: amountPerPlayer,
                        status: "Pending",
                        date: new Date().toISOString(),
                        reservationRef: reservation.id,
                        teamRef: reservation.teamRef,
                        playerRef: playerId,
                        managerRef: reservation.managerRef,
                        pitchName: reservation.pitchName,
                        teamName: team.name,
                    });

                    const playerNotificationRef = doc(collection(db, 'notifications'));
                    batch.set(playerNotificationRef, {
                        userId: playerId,
                        message: `The manager paid for the game with ${team.name}. Your share of ${amountPerPlayer.toFixed(2)}€ is now due to the manager.`,
                        link: '/dashboard/payments',
                        read: false,
                        createdAt: serverTimestamp() as any,
                    });
                }
            }


            await batch.commit();
            setIsDialogOpen(false);
            onPaymentProcessed();
            toast({ title: "Payment Successful!", description: "The reservation is confirmed, the game is scheduled, and players have been notified to reimburse you." });
        } catch (error: any) {
             console.error("Error processing full payment:", error);
             toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
        }
    }

    const handleSplitPayment = async () => {
        if (!reservation.teamRef || !reservation.managerRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Reservation is not associated with a team or manager.' });
            return;
        }
    
        const batch = writeBatch(db);
        try {
            // Find the associated Match
            const matchQuery = query(collection(db, 'matches'), where('reservationRef', '==', reservation.id));
            const matchSnap = await getDocs(matchQuery);
            if(matchSnap.empty) {
                throw new Error("Associated match not found for this reservation.");
            }
            const matchId = matchSnap.docs[0].id;
    
            // Get Team and Players
            const teamRef = doc(db, "teams", reservation.teamRef);
            const teamDoc = await getDoc(teamRef);
            if (!teamDoc.exists()) throw new Error("Team not found to split payment.");
            const team = teamDoc.data() as Team;
            const playerIds = team.playerIds;
            if (!playerIds || playerIds.length === 0) throw new Error("Team has no players to split payment with.");
    
            // Calculate amount per player
            const amountPerPlayer = reservation.totalAmount / playerIds.length;
    
            // Create a payment doc and match invitation for each player
            for (const playerId of playerIds) {
                // Create Payment
                const playerPaymentRef = doc(collection(db, "payments"));
                batch.set(playerPaymentRef, {
                    type: "booking_split",
                    amount: amountPerPlayer,
                    status: "Pending",
                    date: new Date().toISOString(),
                    reservationRef: reservation.id,
                    teamRef: reservation.teamRef,
                    playerRef: playerId,
                    managerRef: reservation.managerRef,
                    pitchName: reservation.pitchName,
                    teamName: team.name,
                });
    
                // Create Match Invitation
                const invitationRef = doc(collection(db, "matchInvitations"));
                batch.set(invitationRef, {
                    matchId: matchId,
                    teamId: team.id,
                    playerId: playerId,
                    managerId: reservation.managerRef,
                    status: "pending",
                    invitedAt: serverTimestamp(),
                });

                // Create Notification for the invitation
                 const notificationRef = doc(collection(db, 'notifications'));
                 batch.set(notificationRef, {
                     userId: playerId,
                     message: `You've been invited to a game with ${team.name}.`,
                     link: '/dashboard/my-games',
                     read: false,
                     createdAt: serverTimestamp() as any,
                 });
            }
    
            // Update the original reservation to 'Split'
            const originalReservationRef = doc(db, "reservations", reservation.id);
            batch.update(originalReservationRef, { paymentStatus: "Split" });
    
            // Commit batch
            await batch.commit();
            setIsDialogOpen(false);
            onPaymentProcessed();
            toast({ title: "Payment Split!", description: `Each of the ${playerIds.length} players has been invited and assigned their share.` });
    
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
            // Re-fetch pending payments to check if this was the last one.
            const paymentsQuery = query(
                collection(db, "payments"), 
                where("reservationRef", "==", payment.reservationRef), 
                where("status", "==", "Pending")
            );

            const pendingPaymentsSnap = await getDocs(paymentsQuery);

            if (pendingPaymentsSnap.empty) {
                // All payments are done, confirm reservation and notify owner
                const reservationDoc = await getDoc(reservationRef);
                if (reservationDoc.exists()) {
                    const reservation = reservationDoc.data() as Reservation;
                    const finalBatch = writeBatch(db);
                    finalBatch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });
                    
                    // Also update the associated match status
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
        <Button className="w-full mt-4" onClick={handlePayNow}><CreditCard className="mr-2"/> Pay Your Share</Button>
    )
}


export default function MyGamesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [invitations, setInvitations] = React.useState<MatchInvitation[]>([]);
  const [teamMatchInvitations, setTeamMatchInvitations] = React.useState<Match[]>([]);
  const [teams, setTeams] = React.useState<Map<string, Team>>(new Map());
  const [pitches, setPitches] = React.useState<Map<string, Pitch>>(new Map());
  const [owners, setOwners] = React.useState<Map<string, OwnerProfile>>(new Map());
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [payments, setPayments] = React.useState<Map<string, Payment>>(new Map());
  const [splitPaymentCounts, setSplitPaymentCounts] = React.useState<Map<string, {paid: number, total: number}>>(new Map());
  const [loading, setLoading] = React.useState(true);

  // Helper to fetch details for a list of IDs from a given collection
  const fetchDetails = async (collectionName: 'teams' | 'pitches' | 'ownerProfiles' | 'reservations', ids: string[]): Promise<Map<string, any>> => {
      const newMap = new Map<string, any>();
      const uniqueIds = [...new Set(ids)].filter(id => id);
      if (uniqueIds.length === 0) return newMap;
      
      const chunks = [];
      for (let i = 0; i < uniqueIds.length; i += 30) {
          chunks.push(uniqueIds.slice(i, i + 30));
      }

      for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          let docsQuery;
          // The owner ref on a pitch is the owner *profile* ID, not user ID.
          if (collectionName === 'ownerProfiles') {
              docsQuery = query(collection(db, collectionName), where(documentId(), "in", chunk));
          } else {
              docsQuery = query(collection(db, collectionName), where(documentId(), "in", chunk));
          }
          const snapshot = await getDocs(docsQuery);
          snapshot.forEach(doc => newMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }
      
      return newMap;
  };


  // Effect to fetch teams and matches based on user role
  React.useEffect(() => {
    if (!user) {
        setLoading(false);
        return;
    }

    setLoading(true);
    const unsubscribes: (() => void)[] = [];
    let userTeamIds: string[] = [];

    const setupListeners = async () => {
        try {
            if (user.role === 'PLAYER') {
                const playerTeamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));
                const playerTeamsSnapshot = await getDocs(playerTeamsQuery);
                userTeamIds = playerTeamsSnapshot.docs.map(doc => doc.id);
            } else if (user.role === 'MANAGER') {
                const managerTeamsQuery = query(collection(db, "teams"), where("managerId", "==", user.id));
                const managerTeamsSnapshot = await getDocs(managerTeamsQuery);
                userTeamIds = managerTeamsSnapshot.docs.map(doc => doc.id);
            }
            if (userTeamIds.length > 0) {
                 const teamsMap = await fetchDetails('teams', userTeamIds);
                 setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
            }
            
            // Player-specific listeners
            if (user.role === 'PLAYER') {
                // Individual match invitations for players
                const invQuery = query(collection(db, "matchInvitations"), where("playerId", "==", user.id), where("status", "==", "pending"));
                const unsubscribeInvitations = onSnapshot(invQuery, async (snapshot) => {
                    const invs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as MatchInvitation);
                    setInvitations(invs);
                    if (invs.length > 0) {
                        const teamIds = invs.map(inv => inv.teamId);
                        const teamsMap = await fetchDetails('teams', teamIds);
                        setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
                    }
                }, (error) => console.error("Error fetching invitations:", error));
                unsubscribes.push(unsubscribeInvitations);

                // Split payments for players
                const playerPaymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id), where("status", "==", "Pending"));
                const unsubPayments = onSnapshot(playerPaymentsQuery, (snap) => {
                    const playerPayments = new Map<string, Payment>();
                    snap.forEach(doc => {
                        const payment = { id: doc.id, ...doc.data() } as Payment;
                        if(payment.reservationRef) {
                            playerPayments.set(payment.reservationRef, payment);
                        }
                    });
                    setPayments(playerPayments);
                });
                unsubscribes.push(unsubPayments);
            }

            // Manager-specific listeners
            if (user.role === 'MANAGER' && userTeamIds.length > 0) {
                const teamInvQuery = query(collection(db, "matches"), where("invitedTeamId", "in", userTeamIds), where("status", "==", "PendingOpponent"));
                const unsubscribeTeamInvites = onSnapshot(teamInvQuery, async (snapshot) => {
                    const teamInvs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Match);
                    setTeamMatchInvitations(teamInvs);
                     if (teamInvs.length > 0) {
                        const hostTeamIds = teamInvs.map(inv => inv.teamARef).filter((id): id is string => !!id);
                        const teamsMap = await fetchDetails('teams', hostTeamIds);
                        setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
                    }
                }, (error) => console.error("Error fetching team match invitations:", error));
                unsubscribes.push(unsubscribeTeamInvites);
            }
            
            // Common match listeners
            if (userTeamIds.length > 0) {
                 const combinedMatches = new Map<string, Match>();
                 
                 const processMatchesSnapshot = async (snapshot: DocumentData, initialLoadDone: () => void) => {
                    snapshot.docs.forEach((doc: DocumentData) => combinedMatches.set(doc.id, { id: doc.id, ...doc.data()} as Match));
                    const allMatches = Array.from(combinedMatches.values());
                    setMatches(allMatches);

                    const teamIdsToFetch = new Set<string>();
                    const pitchIdsToFetch = new Set<string>();
                    const reservationIdsToFetch = new Set<string>();
                    
                    allMatches.forEach((match: Match) => {
                        if (match.teamARef) teamIdsToFetch.add(match.teamARef);
                        if (match.teamBRef) teamIdsToFetch.add(match.teamBRef);
                        if (match.pitchRef) pitchIdsToFetch.add(match.pitchRef);
                        if (match.reservationRef) reservationIdsToFetch.add(match.reservationRef);
                    });
                     
                    if (teamIdsToFetch.size > 0) {
                        const teamsMap = await fetchDetails('teams', Array.from(teamIdsToFetch));
                        setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
                    }

                    if (reservationIdsToFetch.size > 0) {
                        const reservationsMap = await fetchDetails('reservations', Array.from(reservationIdsToFetch));
                        setReservations(prev => new Map([...Array.from(prev.entries()), ...Array.from(reservationsMap.entries())]));
                        
                        const splitReservationIds = Array.from(reservationsMap.values())
                            .filter(r => r.paymentStatus === 'Split')
                            .map(r => r.id);

                        if(splitReservationIds.length > 0) {
                           const paymentCounts = new Map<string, { paid: number, total: number }>();
                           for (const resId of splitReservationIds) {
                               const paymentsQuery = query(collection(db, "payments"), where("reservationRef", "==", resId));
                               const paymentsSnap = await getDocs(paymentsQuery);
                               const total = paymentsSnap.size;
                               const paid = paymentsSnap.docs.filter(d => d.data().status === 'Paid').length;
                               paymentCounts.set(resId, { paid, total });
                           }
                           setSplitPaymentCounts(paymentCounts);
                        }
                    }

                     if (pitchIdsToFetch.size > 0) {
                        const pitchesMap = await fetchDetails('pitches', Array.from(pitchIdsToFetch));
                        setPitches(prev => new Map([...Array.from(prev.entries()), ...Array.from(pitchesMap.entries())]));

                        const ownerProfileIdsToFetch = new Set<string>();
                        pitchesMap.forEach(pitch => {
                            if (pitch.ownerRef) ownerProfileIdsToFetch.add(pitch.ownerRef);
                        })

                        if(ownerProfileIdsToFetch.size > 0){
                             const ownersMap = await fetchDetails('ownerProfiles', Array.from(ownerProfileIdsToFetch));
                             setOwners(prev => new Map([...Array.from(prev.entries()), ...Array.from(ownersMap.entries())]));
                        }
                    }
                    initialLoadDone();
                 };
                 
                 const q1 = query(collection(db, "matches"), where("teamARef", "in", userTeamIds));
                 const q2 = query(collection(db, "matches"), where("teamBRef", "in", userTeamIds));
                 
                 let initLoads = 2;
                 const initialLoadDone = () => {
                     initLoads--;
                     if(initLoads === 0) setLoading(false);
                 }

                 const unsub1 = onSnapshot(q1, (snap) => processMatchesSnapshot(snap, initialLoadDone));
                 const unsub2 = onSnapshot(q2, (snap) => processMatchesSnapshot(snap, initialLoadDone));
                 
                 unsubscribes.push(unsub1, unsub2);
            } else {
                 setLoading(false);
            }

        } catch (error) {
            console.error("Error setting up listeners: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load page data." });
            setLoading(false);
        }
    };
    
    setupListeners();
    
    return () => {
        unsubscribes.forEach(unsub => unsub());
    };

  }, [user, toast]);
  
  const refreshData = async () => {
    // This function can be simplified or expanded based on what needs refreshing
    // For now, it re-fetches reservations and payments
    if (user?.role === 'PLAYER') {
        const playerPaymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id), where("status", "==", "Pending"));
        const snap = await getDocs(playerPaymentsQuery);
        const playerPayments = new Map<string, Payment>();
        snap.forEach(doc => {
            const payment = { id: doc.id, ...doc.data() } as Payment;
            if(payment.reservationRef) {
                playerPayments.set(payment.reservationRef, payment);
            }
        });
        setPayments(playerPayments);
    }
     const reservationIds = Array.from(reservations.keys());
    if(reservationIds.length > 0) {
        const reservationsMap = await fetchDetails('reservations', reservationIds);
        setReservations(prev => new Map([...Array.from(prev.entries()), ...Array.from(reservationsMap.entries())]));
    }
  }

  const handlePlayerInvitationResponse = async (invitation: MatchInvitation, accepted: boolean) => {
     if (!user) return;
     const batch = writeBatch(db);
     const invitationRef = doc(db, "matchInvitations", invitation.id);
     const matchRef = doc(db, "matches", invitation.matchId);

     try {
        batch.update(invitationRef, { status: accepted ? "accepted" : "declined" });

        if (accepted) {
            batch.update(matchRef, { teamAPlayers: arrayUnion(user.id) });
        }
        
        await batch.commit();
        toast({ title: "Response Recorded", description: "Your response to the game invitation has been saved." });
     } catch (error) {
        console.error("Error responding to invitation:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not save your response." });
     }
  }

  const handleTeamInvitationResponse = async (match: Match, accepted: boolean) => {
      const matchRef = doc(db, "matches", match.id);
      try {
          if (accepted) {
              await updateDoc(matchRef, {
                  status: "Scheduled",
                  teamBRef: match.invitedTeamId,
                  invitedTeamId: null,
              });
              toast({ title: "Match Accepted!", description: "The match is now scheduled."});
          } else {
              await updateDoc(matchRef, {
                  status: "PendingOpponent", 
                  invitedTeamId: null,
              });
              toast({ title: "Match Declined", description: "The match invitation has been declined."});
          }
      } catch (error) {
          console.error("Error responding to team invitation:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not save your response." });
      }
  }


  const now = new Date();
  const upcomingMatches = matches.filter(m => (m.status === 'Scheduled' || m.status === 'PendingOpponent') && new Date(m.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastMatches = matches.filter(m => m.status === 'Finished' || (new Date(m.date) < now && m.status !== 'Scheduled' && m.status !== 'PendingOpponent')).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  
  const getPlayerCapacity = (sport?: Pitch["sport"]): number => {
    if (!sport) return 0;
    switch (sport) {
        case 'fut5':
        case 'futsal':
            return 10;
        case 'fut7':
            return 14;
        case 'fut11':
            return 22;
        default:
            return 0; // Should not happen
    }
  };

  const MatchCard = ({ match }: { match: Match }) => {
    const teamA = match.teamARef ? teams.get(match.teamARef) : null;
    const teamB = match.teamBRef ? teams.get(match.teamBRef) : null;
    const pitch = match.pitchRef ? pitches.get(match.pitchRef) : null;
    const owner = pitch ? owners.get(pitch.ownerRef) : null;
    const reservation = match.reservationRef ? reservations.get(match.reservationRef) : null;
    const payment = match.reservationRef ? payments.get(match.reservationRef) : null;
    const paymentCount = match.reservationRef ? splitPaymentCounts.get(match.reservationRef) : null;

    const isFinished = match.status === "Finished";
    const isManager = user?.id === teamA?.managerId;
    const isPlayer = user?.role === 'PLAYER';
    const playerIsConfirmed = isPlayer && user ? (match.teamAPlayers?.includes(user.id) || match.teamBPlayers?.includes(user.id)): false;

    const confirmedPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
    
    const playerCapacity = getPlayerCapacity(pitch?.sport);
    const missingPlayers = playerCapacity > 0 ? playerCapacity - confirmedPlayers : 0;
    
    const getMatchTitle = () => {
      if (teamA && !teamB) {
        return `${teamA.name} (Practice)`;
      }
      if (teamA && teamB) {
        return `${teamA.name} vs ${teamB.name}`;
      }
      return 'Match Details';
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex justify-between items-center">
                    <span>{getMatchTitle()}</span>
                    {isFinished && (
                        <span className="text-2xl font-bold">{match.scoreA} - {match.scoreB}</span>
                    )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <Calendar className="h-4 w-4" /> {format(new Date(match.date), "PPP 'at' HH:mm")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                 <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span><span className="font-semibold">{pitch?.name || "Loading..."}</span> ({pitch?.sport.toUpperCase()})</span>
                 </div>
                 {owner && (
                    <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-primary" />
                        <span>Managed by: <span className="font-semibold">{owner.companyName}</span></span>
                    </div>
                 )}
                 <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Status: <span className="font-semibold">{match.status}</span></span>
                 </div>
                 {playerCapacity > 0 && (
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>Players: <span className="font-semibold">{confirmedPlayers} / {playerCapacity}</span> ({missingPlayers > 0 ? `${missingPlayers} missing` : 'Full'})</span>
                    </div>
                 )}
                 {paymentCount && (
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Payments: <span className="font-semibold">{paymentCount.paid} / {paymentCount.total}</span></span>
                    </div>
                 )}
                 {isManager && reservation?.paymentStatus === 'Pending' && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                         <div className="flex justify-between items-center text-base">
                            <span className="font-semibold text-destructive">Payment Due</span>
                            <span className="font-bold text-destructive">{reservation.totalAmount.toFixed(2)}€</span>
                        </div>
                        <ManagerPaymentDialog reservation={reservation} onPaymentProcessed={refreshData} />
                    </div>
                 )}
                  {isPlayer && playerIsConfirmed && payment && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                         <div className="flex justify-between items-center text-base">
                            <span className="font-semibold text-destructive">Your Share Due</span>
                            <span className="font-bold text-destructive">{payment.amount.toFixed(2)}€</span>
                        </div>
                        <PlayerPaymentButton payment={payment} onPaymentProcessed={refreshData} />
                    </div>
                 )}
            </CardContent>
             <CardFooter className="gap-2">
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/games/${match.id}`}>
                        {(isManager || isPlayer) && !isFinished ? "Manage Game" : "View Details"}
                    </Link>
                </Button>
                {isFinished && (
                     <Button variant="secondary" disabled>
                        <Trophy className="mr-2" /> Match Report
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
  }

  const PlayerInvitationCard = ({ invitation }: { invitation: MatchInvitation }) => {
      const team = teams.get(invitation.teamId);
      if (!team) return null; // Don't render if team data isn't loaded yet

      return (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Game Invitation: {team.name}</CardTitle>
            <CardDescription>
              Invited {invitation.invitedAt ? formatDistanceToNow(new Date((invitation.invitedAt as Timestamp).seconds * 1000), { addSuffix: true }) : 'recently'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">You have been invited to play in an upcoming game.</p>
          </CardContent>
           <CardFooter className="gap-2">
              <Button size="sm" onClick={() => handlePlayerInvitationResponse(invitation, true)}>
                 <Check className="mr-2 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handlePlayerInvitationResponse(invitation, false)}>
                 <X className="mr-2 h-4 w-4" /> Decline
              </Button>
            </CardFooter>
        </Card>
      )
  }

    const TeamMatchInvitationCard = ({ match }: { match: Match }) => {
      const invitingTeam = teams.get(match.teamARef!);
      const invitedTeam = teams.get(match.invitedTeamId!);
      
      if (!invitingTeam || !invitedTeam) return <Skeleton className="h-56" />;

      return (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Match Invitation</CardTitle>
            <CardDescription>
              From team: {invitingTeam.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Your team, <b>{invitedTeam.name}</b>, has been invited to a match.</p>
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> 
                <span>{format(new Date(match.date), "PPP 'at' HH:mm")}</span>
            </div>
          </CardContent>
           <CardFooter className="gap-2">
              <Button size="sm" onClick={() => handleTeamInvitationResponse(match, true)}>
                 <Check className="mr-2 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleTeamInvitationResponse(match, false)}>
                 <X className="mr-2 h-4 w-4" /> Decline
              </Button>
            </CardFooter>
        </Card>
      )
  }


  const MatchList = ({ matches }: { matches: Match[] }) => (
     <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
      {matches.map(m => <MatchCard key={m.id} match={m} />)}
     </div>
  )

  const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card className="flex flex-col items-center justify-center p-12 text-center mt-4 border-dashed">
        <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold font-headline">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  )

  const LoadingSkeleton = () => (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
        </div>
      </div>
  )

  if (loading) {
    return (
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold font-headline">My Games</h1>
                <p className="text-muted-foreground">
                View your upcoming and past games.
                </p>
            </div>
            <LoadingSkeleton />
        </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Games</h1>
        <p className="text-muted-foreground">
          View your upcoming and past games.
        </p>
      </div>
      
       {/* Invitations Section (for players and managers) */}
       {(invitations.length > 0 || teamMatchInvitations.length > 0) && (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold font-headline text-primary">Game Invitations ({invitations.length + teamMatchInvitations.length})</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {user?.role === 'PLAYER' && invitations.map(inv => <PlayerInvitationCard key={inv.id} invitation={inv} />)}
                {user?.role === 'MANAGER' && teamMatchInvitations.map(match => <TeamMatchInvitationCard key={match.id} match={match} />)}
            </div>
        </div>
       )}


      {/* Upcoming Games Section */}
      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Upcoming Games ({upcomingMatches.length})</h2>
        {upcomingMatches.length > 0 ? (
            <MatchList matches={upcomingMatches} />
        ) : (
            <EmptyState icon={Gamepad2} title="No Upcoming Games" description="You don't have any games scheduled for the future." />
        )}
      </div>

       <div className="border-t pt-8">
        <Accordion type="single" collapsible>
            <AccordionItem value="history">
                <AccordionTrigger>
                    <h2 className="text-2xl font-bold font-headline">Game History ({pastMatches.length})</h2>
                </AccordionTrigger>
                <AccordionContent>
                    {pastMatches.length > 0 ? (
                        <MatchList matches={pastMatches} />
                    ) : (
                        <EmptyState icon={History} title="No Game History" description="Your past games will appear here." />
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
