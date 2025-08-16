

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
import { Calendar, Users, Shield, MapPin, Building, Gamepad2, Check, X, Mail, History, Trophy, DollarSign, CreditCard, ArrowRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import { getPlayerCapacity } from "@/lib/utils";
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
} from "@/components/ui/alert-dialog"


const StartSplitPaymentButton = ({ reservation, onPaymentProcessed }: { reservation: Reservation, onPaymentProcessed: () => void }) => {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [associatedMatch, setAssociatedMatch] = React.useState<Match | null>(null);

    React.useEffect(() => {
        const fetchMatch = async () => {
            if (reservation.id) {
                const matchQuery = query(collection(db, "matches"), where("reservationRef", "==", reservation.id));
                const matchSnap = await getDocs(matchQuery);
                if (!matchSnap.empty) {
                    const matchDoc = matchSnap.docs[0];
                    setAssociatedMatch({ id: matchDoc.id, ...matchDoc.data() } as Match);
                }
            }
        };
        fetchMatch();
    }, [reservation.id]);

    const handleSplitPayment = async () => {
        setIsProcessing(true);
        if (!associatedMatch) {
            toast({ variant: 'destructive', title: 'Error', description: 'Associated match not found.' });
            setIsProcessing(false);
            return;
        }

        const confirmedPlayers = [...new Set([...(associatedMatch.teamAPlayers || []), ...(associatedMatch.teamBPlayers || [])])];
        if (confirmedPlayers.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'No confirmed players to split the payment with.' });
            setIsProcessing(false);
            return;
        }

        const batch = writeBatch(db);
        const reservationRef = doc(db, "reservations", reservation.id);
    
        try {
            const amountPerPlayer = reservation.totalAmount / confirmedPlayers.length;

            batch.update(reservationRef, { paymentStatus: "Split" });
    
            for (const playerId of confirmedPlayers) {
                const newPaymentRef = doc(collection(db, "payments"));
                batch.set(newPaymentRef, {
                    type: "booking_split",
                    amount: amountPerPlayer,
                    status: "Pending",
                    date: new Date().toISOString(),
                    reservationRef: reservation.id,
                    teamRef: reservation.teamRef,
                    playerRef: playerId,
                    ownerRef: reservation.ownerProfileId,
                    pitchName: reservation.pitchName,
                    teamName: reservation.actorName,
                });

                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                    userId: playerId,
                    message: `Your share of ${amountPerPlayer.toFixed(2)}€ for the game at ${reservation.pitchName} is due.`,
                    link: '/dashboard/payments',
                    read: false,
                    createdAt: serverTimestamp() as any,
                });
            }

            await batch.commit();

            toast({ title: "Payment Split!", description: `Each of the ${confirmedPlayers.length} confirmed players has been notified.` });
            onPaymentProcessed();
    
        } catch (error: any) {
            console.error("Error splitting payment:", error);
            toast({ variant: "destructive", title: "Error", description: `Could not split payment: ${error.message}` });
        } finally {
            setIsProcessing(false);
        }
    }
    
    if (!associatedMatch) return <Skeleton className="h-10 w-full" />;

    const confirmedPlayersCount = (associatedMatch.teamAPlayers?.length || 0) + (associatedMatch.teamBPlayers?.length || 0);
    const amountPerPlayer = confirmedPlayersCount > 0 ? (reservation.totalAmount / confirmedPlayersCount).toFixed(2) : '0.00';

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={isProcessing || confirmedPlayersCount === 0}>
                    <CreditCard className="mr-2"/> 
                    {isProcessing ? "Processing..." : "Split Payment"}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will send a payment request of <strong>{amountPerPlayer}€</strong> to each of the <strong>{confirmedPlayersCount}</strong> confirmed players for this game. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSplitPayment}>Continue</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
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
  const [invitations, setInvitations] = React.useState<Map<string, MatchInvitation>>(new Map());
  const [teamMatchInvitations, setTeamMatchInvitations] = React.useState<Map<string, Match>>(new Map());
  const [teams, setTeams] = React.useState<Map<string, Team>>(new Map());
  const [pitches, setPitches] = React.useState<Map<string, Pitch>>(new Map());
  const [owners, setOwners] = React.useState<Map<string, OwnerProfile>>(new Map());
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [payments, setPayments] = React.useState<Map<string, Payment>>(new Map());
  const [splitPaymentCounts, setSplitPaymentCounts] = React.useState<Map<string, {paid: number, total: number}>>(new Map());
  const [loading, setLoading] = React.useState(true);

  // Helper to fetch details for a list of IDs from a given collection
  const fetchDetails = async (collectionName: 'teams' | 'pitches' | 'ownerProfiles' | 'reservations' | 'matches', ids: string[]): Promise<Map<string, any>> => {
      const newMap = new Map<string, any>();
      const uniqueIds = [...new Set(ids)].filter(id => id);
      if (uniqueIds.length === 0) return newMap;
      
      const chunks = [];
      for (let i = 0; i < uniqueIds.length; i += 30) {
          chunks.push(uniqueIds.slice(i, i + 30));
      }

      for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          const docsQuery = query(collection(db, collectionName), where(documentId(), "in", chunk));
          const snapshot = await getDocs(docsQuery);
          snapshot.forEach(doc => newMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }
      
      return newMap;
  };

  const fetchGameDetails = React.useCallback(async () => {
    if (!user) {
        setLoading(false);
        return;
    }
     setLoading(true);
     try {
        let userTeamIds: string[] = [];
        let teamIdToNameMap = new Map<string, string>();

        // 1. Get User's teams
        if (user.role === 'PLAYER') {
            const playerTeamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));
            const playerTeamsSnapshot = await getDocs(playerTeamsQuery);
            userTeamIds = playerTeamsSnapshot.docs.map(doc => doc.id);
        } else if (user.role === 'MANAGER') {
            const managerTeamsQuery = query(collection(db, "teams"), where("managerId", "==", user.id));
            const managerTeamsSnapshot = await getDocs(managerTeamsQuery);
            managerTeamsSnapshot.forEach(doc => {
                userTeamIds.push(doc.id);
                teamIdToNameMap.set(doc.id, doc.data().name);
            })
        }
        
        // 2. Fetch all matches the user might be involved in
        let allMatchesMap = new Map<string, Match>();

        if (userTeamIds.length > 0) {
            const matchesAQuery = query(collection(db, "matches"), where("teamARef", "in", userTeamIds));
            const matchesBQuery = query(collection(db, "matches"), where("teamBRef", "in", userTeamIds));
            const teamInvQuery = query(collection(db, "matches"), where("invitedTeamId", "in", userTeamIds), where("status", "==", "PendingOpponent"));
            const [matchesASnap, matchesBSnap, teamInvSnap] = await Promise.all([getDocs(matchesAQuery), getDocs(matchesBQuery), getDocs(teamInvQuery)]);
            
            matchesASnap.forEach(doc => allMatchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
            matchesBSnap.forEach(doc => allMatchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
            teamInvSnap.forEach(doc => allMatchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
             const teamInvites = new Map(teamInvSnap.docs.map(doc => [doc.id, {id: doc.id, ...doc.data()} as Match]));
            setTeamMatchInvitations(teamInvites);
        }

        if (user.role === 'PLAYER') {
            const invQuery = query(collection(db, "matchInvitations"), where("playerId", "==", user.id), where("status", "==", "pending"));
            const invSnapshot = await getDocs(invQuery);
            const invs = invSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as MatchInvitation);
            const matchIdsFromInvs = invs.map(inv => inv.matchId).filter(id => id);

            if (matchIdsFromInvs.length > 0) {
                const matchesFromInvsMap = await fetchDetails('matches', matchIdsFromInvs);
                matchesFromInvsMap.forEach((match, id) => allMatchesMap.set(id, match));
            }
             const validInvs = new Map(invs.filter(inv => allMatchesMap.has(inv.matchId)).map(inv => [inv.matchId, inv]));
             setInvitations(validInvs);
        }
        
        // Also fetch matches where player is directly confirmed
         if (user.role === 'PLAYER') {
            const confirmedAQuery = query(collection(db, "matches"), where("teamAPlayers", "array-contains", user.id));
            const confirmedBQuery = query(collection(db, "matches"), where("teamBPlayers", "array-contains", user.id));
            const [confirmedASnap, confirmedBSnap] = await Promise.all([getDocs(confirmedAQuery), getDocs(confirmedBQuery)]);
            confirmedASnap.forEach(doc => allMatchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
            confirmedBSnap.forEach(doc => allMatchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
        }


        const allMatches = Array.from(allMatchesMap.values());
        setMatches(allMatches);
        
        // 3. Fetch all secondary details (teams, pitches, etc.)
        const teamIdsToFetch = new Set<string>();
        const pitchIdsToFetch = new Set<string>();
        const reservationIdsToFetch = new Set<string>();
        
        allMatches.forEach((match: Match) => {
            if (match.teamARef) teamIdsToFetch.add(match.teamARef);
            if (match.teamBRef) teamIdsToFetch.add(match.teamBRef);
            if (match.invitedTeamId) teamIdsToFetch.add(match.invitedTeamId);
            if (match.pitchRef) pitchIdsToFetch.add(match.pitchRef);
            if (match.reservationRef) reservationIdsToFetch.add(match.reservationRef);
        });

        if (teamIdsToFetch.size > 0) {
            const teamsMap = await fetchDetails('teams', Array.from(teamIdsToFetch));
            setTeams(teamsMap);
        }
        
        if (pitchIdsToFetch.size > 0) {
            const pitchesMap = await fetchDetails('pitches', Array.from(pitchIdsToFetch));
            setPitches(pitchesMap);

            const ownerProfileIdsToFetch = new Set<string>();
            pitchesMap.forEach(pitch => { if (pitch.ownerRef) ownerProfileIdsToFetch.add(pitch.ownerRef); });

            if(ownerProfileIdsToFetch.size > 0){
                const ownersMap = await fetchDetails('ownerProfiles', Array.from(ownerProfileIdsToFetch));
                setOwners(ownersMap);
            }
        }

        if (reservationIdsToFetch.size > 0) {
            const reservationsMap = await fetchDetails('reservations', Array.from(reservationIdsToFetch));
            setReservations(reservationsMap);
            
            const splitReservationIds = Array.from(reservationsMap.values()).filter(r => r.paymentStatus === 'Split').map(r => r.id);
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
        
         if (user.role === 'PLAYER') {
            const playerPaymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id), where("status", "==", "Pending"));
            const snap = await getDocs(playerPaymentsQuery);
            const playerPayments = new Map<string, Payment>();
            snap.forEach(doc => {
                const payment = { id: doc.id, ...doc.data() } as Payment;
                if(payment.reservationRef) playerPayments.set(payment.reservationRef, payment);
            });
            setPayments(playerPayments);
        }

     } catch (error) {
        console.error("Error setting up listeners: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load page data." });
     } finally {
        setLoading(false);
     }
  }, [user, toast]);

  // Effect to fetch teams and matches based on user role
  React.useEffect(() => {
    fetchGameDetails();
  }, [fetchGameDetails]);

  const handlePlayerInvitationResponse = async (invitation: MatchInvitation, accepted: boolean) => {
     if (!user) return;
     const batch = writeBatch(db);
     const invitationRef = doc(db, "matchInvitations", invitation.id);
     
     try {
        batch.update(invitationRef, { status: accepted ? "accepted" : "declined" });

        if (accepted) {
            const matchRef = doc(db, "matches", invitation.matchId);
            batch.update(matchRef, { teamAPlayers: arrayUnion(user.id) });
        }
        
        await batch.commit();
        toast({ title: `Invitation ${accepted ? 'Accepted' : 'Declined'}` });
        fetchGameDetails(); // Re-fetch all data to update the UI correctly
     } catch (error: any) {
        console.error("Error responding to invitation:", error);
        toast({ variant: "destructive", title: "Error", description: `Could not save your response: ${error.message}` });
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
          fetchGameDetails(); // Re-fetch to update lists
      } catch (error) {
          console.error("Error responding to team invitation:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not save your response." });
      }
  }

  const now = new Date();
  
  const upcomingMatches = matches.filter(m => {
      const isManagerOfTeamA = user?.role === 'MANAGER' && teams.get(m.teamARef || '')?.managerId === user?.id;
      const isManagerOfTeamB = user?.role === 'MANAGER' && teams.get(m.teamBRef || '')?.managerId === user?.id;
      const hasTeamInvite = user?.role === 'MANAGER' && teamMatchInvitations.has(m.id);
      const isPlayerInvolved = user?.role === 'PLAYER' && (invitations.has(m.id) || m.teamAPlayers.includes(user.id) || m.teamBPlayers.includes(user.id));

      const isFuture = new Date(m.date) >= now;
      const isNotFinished = m.status !== 'Finished' && m.status !== 'Cancelled';

      return isFuture && isNotFinished && (isManagerOfTeamA || isManagerOfTeamB || hasTeamInvite || isPlayerInvolved);
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


  const pastMatches = matches.filter(m => {
       const isManagerOfTeamA = user?.role === 'MANAGER' && teams.get(m.teamARef || '')?.managerId === user?.id;
       const isManagerOfTeamB = user?.role === 'MANAGER' && teams.get(m.teamBRef || '')?.managerId === user?.id;
       const isPlayerInvolved = user?.role === 'PLAYER' && (m.teamAPlayers.includes(user.id) || m.teamBPlayers.includes(user.id));
      
       const isFinished = m.status === 'Finished' || m.status === 'Cancelled';
       const isPastDate = new Date(m.date) < now;

       return (isFinished || isPastDate) && (isManagerOfTeamA || isManagerOfTeamB || isPlayerInvolved);
  }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const MatchCard = ({ match }: { match: Match }) => {
    const teamA = match.teamARef ? teams.get(match.teamARef) : null;
    const teamB = match.teamBRef ? teams.get(match.teamBRef) : (match.invitedTeamId ? teams.get(match.invitedTeamId) : null);
    const pitch = match.pitchRef ? pitches.get(match.pitchRef) : null;
    const owner = pitch ? owners.get(pitch.ownerRef) : null;
    const reservation = match.reservationRef ? reservations.get(match.reservationRef) : null;
    const payment = match.reservationRef ? payments.get(match.reservationRef) : null;
    const paymentCount = match.reservationRef ? splitPaymentCounts.get(match.reservationRef) : null;

    const isFinished = match.status === "Finished";
    const isManager = user?.id === teamA?.managerId;
    const isPlayer = user?.role === 'PLAYER';
    const playerIsConfirmed = isPlayer && user ? (match.teamAPlayers?.includes(user.id) || match.teamBPlayers?.includes(user.id)): false;

    // Invitation checks
    const playerInvitation = isPlayer ? invitations.get(match.id) : null;
    const managerInvitation = isManager ? teamMatchInvitations.get(match.id) : null;

    const confirmedPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
    
    const playerCapacity = getPlayerCapacity(pitch?.sport);
    const missingPlayers = playerCapacity > 0 ? playerCapacity - confirmedPlayers : 0;
    
    const getMatchTitle = () => {
      const teamAName = teamA?.name || 'Team A';
      if (teamA && !teamB && !match.invitedTeamId) return `${teamAName} (Practice)`;
      if (teamA && teamB) return `${teamAName} vs ${teamB.name}`;
      if (teamA && match.invitedTeamId && !teamB) return `${teamAName} vs (Invited Team)`;
      return 'Match Details';
    }
    
    let buttonContent;
    if (playerInvitation) {
        buttonContent = (
            <div className="w-full flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-center">You're invited to this game.</p>
                <div className="flex gap-2 w-full">
                    <Button size="sm" className="flex-1" onClick={() => handlePlayerInvitationResponse(playerInvitation, true)}>
                       <Check className="mr-2 h-4 w-4" /> Accept
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handlePlayerInvitationResponse(playerInvitation, false)}>
                       <X className="mr-2 h-4 w-4" /> Decline
                    </Button>
                </div>
            </div>
        );
    } else if (managerInvitation) {
        buttonContent = (
             <div className="w-full flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-center">Your team is invited to this match.</p>
                <div className="flex gap-2 w-full">
                    <Button size="sm" className="flex-1" onClick={() => handleTeamInvitationResponse(managerInvitation, true)}>
                       <Check className="mr-2 h-4 w-4" /> Accept
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleTeamInvitationResponse(managerInvitation, false)}>
                       <X className="mr-2 h-4 w-4" /> Decline
                    </Button>
                </div>
            </div>
        );
    } else {
        buttonContent = (
            <Button variant="outline" className="w-full" asChild>
                <Link href={`/dashboard/games/${match.id}`} className="flex justify-between items-center w-full">
                    <span>{isFinished ? "View Report" : "Manage Game"}</span>
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </Button>
        );
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
                        <StartSplitPaymentButton reservation={reservation} onPaymentProcessed={fetchGameDetails} />
                    </div>
                 )}
                  {isPlayer && playerIsConfirmed && payment && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                         <div className="flex justify-between items-center text-base">
                            <span className="font-semibold text-destructive">Your Share Due</span>
                            <span className="font-bold text-destructive">{payment.amount.toFixed(2)}€</span>
                        </div>
                        <PlayerPaymentButton payment={payment} onPaymentProcessed={fetchGameDetails} />
                    </div>
                 )}
            </CardContent>
             <CardFooter>
                {buttonContent}
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

      {/* Upcoming Games Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline">Upcoming Games ({upcomingMatches.length})</h2>
        {upcomingMatches.length > 0 ? (
            <MatchList matches={upcomingMatches} />
        ) : (
            <EmptyState icon={Gamepad2} title="No Upcoming Games" description="You don't have any games scheduled or any pending invitations." />
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
