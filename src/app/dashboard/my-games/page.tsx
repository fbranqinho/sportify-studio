

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
            
            // Check if this payment completes the total amount
            const paymentsQuery = query(collection(db, 'payments'), where('reservationRef', '==', payment.reservationRef));
            const paymentsSnap = await getDocs(paymentsQuery);
            let totalPaid = payment.amount; // Start with the current payment
            paymentsSnap.forEach(doc => {
                if (doc.id !== payment.id && doc.data().status === 'Paid') {
                    totalPaid += doc.data().amount;
                }
            });

            if (totalPaid >= reservation.totalAmount) {
                batch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });
            }
            
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
                status: reservation.teamRef ? "PendingOpponent" : "Scheduled", // Practice matches are scheduled right away
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
        
        // Also fetch reservations for the user that are confirmed but not yet scheduled (no match created yet)
        const confirmedReservationsQuery = query(collection(db, 'reservations'), where('actorId', '==', user.id), where('status', '==', 'Confirmed'));
        const confirmedResSnap = await getDocs(confirmedReservationsQuery);
        confirmedResSnap.forEach(resDoc => {
            const res = resDoc.data() as Reservation;
            if (res.pitchId) pitchIdsToFetch.add(res.pitchId);
            if (res.teamRef) teamIdsToFetch.add(res.teamRef);
            reservationIdsToFetch.add(res.id);
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
        
         if (user.role === 'PLAYER' || user.role === 'MANAGER') {
            const paymentsQuery = query(collection(db, "payments"), where("actorId", "==", user.id), where("status", "==", "Pending"));
            const snap = await getDocs(paymentsQuery);
            const userPayments = new Map<string, Payment>();
            snap.forEach(doc => {
                const payment = { id: doc.id, ...doc.data() } as Payment;
                if(payment.reservationRef) userPayments.set(payment.reservationRef, payment);
            });
            setPayments(userPayments);
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
            const matchDoc = await getDoc(matchRef);

            if (matchDoc.exists() && matchDoc.data().reservationRef) {
                const reservationDoc = await getDoc(doc(db, "reservations", matchDoc.data().reservationRef));
                 if (reservationDoc.exists() && reservationDoc.data().paymentStatus !== 'Paid') {
                    batch.update(matchRef, { teamAPlayers: arrayUnion(user.id) });
                } else if (!reservationDoc.exists() || reservationDoc.data().paymentStatus === 'Paid') {
                    batch.update(matchRef, { teamAPlayers: arrayUnion(user.id) });
                }
            } else {
                batch.update(matchRef, { teamAPlayers: arrayUnion(user.id) });
            }
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
    const isFuture = new Date(m.date) >= now;
    const isNotFinishedOrCancelled = m.status !== 'Finished' && m.status !== 'Cancelled';
    return isFuture && isNotFinishedOrCancelled;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingReservations = Array.from(reservations.values()).filter(r => r.status === 'Confirmed');


  const pastMatches = matches.filter(m => m.status === 'Finished')
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  

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
    const managerInvitation = (user?.role === 'MANAGER' && teamMatchInvitations.has(match.id)) ? teamMatchInvitations.get(match.id) : null;


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
            </CardContent>
             <CardFooter>
                {buttonContent}
            </CardFooter>
        </Card>
    )
  }

  const ReservationCard = ({ reservation }: { reservation: Reservation }) => {
    const team = reservation.teamRef ? teams.get(reservation.teamRef) : null;
    const pitch = reservation.pitchId ? pitches.get(reservation.pitchId) : null;
    const owner = pitch ? owners.get(pitch.ownerRef) : null;
    const payment = reservation ? payments.get(reservation.id) : null;

    return (
        <Card className="border-amber-500/50">
            <CardHeader>
                <CardTitle className="font-headline flex justify-between items-center">
                    <span>{team?.name || 'Your Booking'} at {pitch?.name}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <Calendar className="h-4 w-4" /> {format(new Date(reservation.date), "PPP 'at' HH:mm")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                 <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <span>Status: <span className="font-semibold">{reservation.status} - Awaiting Payment</span></span>
                 </div>
                 {owner && (
                    <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-primary" />
                        <span>Managed by: <span className="font-semibold">{owner.companyName}</span></span>
                    </div>
                 )}
                 <div className="border-t pt-3 mt-3 space-y-2">
                         <div className="flex justify-between items-center text-base">
                            <span className="font-semibold text-destructive">Payment Required</span>
                            <span className="font-bold text-destructive">{reservation.totalAmount.toFixed(2)}€</span>
                        </div>
                        <p className="text-xs text-muted-foreground">The first team to pay for this time slot will secure the booking.</p>
                        {payment && <PlayerPaymentButton payment={payment} onPaymentProcessed={fetchGameDetails} />}
                    </div>
            </CardContent>
        </Card>
    )
  }

  const MatchList = ({ matches }: { matches: Match[] }) => (
     <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
      {matches.map(m => <MatchCard key={m.id} match={m} />)}
     </div>
  )
  
  const ReservationList = ({ reservations }: { reservations: Reservation[] }) => (
     <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
      {reservations.map(r => <ReservationCard key={r.id} reservation={r} />)}
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
        <h1 className="text-3xl font-bold font-headline">My Games & Bookings</h1>
        <p className="text-muted-foreground">
          View your upcoming bookings, games, and past matches.
        </p>
      </div>

      {/* Upcoming Games Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline">Pending Confirmation ({upcomingReservations.length})</h2>
        {upcomingReservations.length > 0 ? (
            <ReservationList reservations={upcomingReservations} />
        ) : (
            <p className="text-sm text-muted-foreground pt-2">You have no bookings awaiting payment.</p>
        )}
      </div>

      <div className="border-t pt-8 space-y-4">
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



    
