
"use client";

import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, getDocs, DocumentData, writeBatch, doc, updateDoc, arrayUnion, getDoc, documentId, addDoc, serverTimestamp } from "firebase/firestore";
import type { User, Match, Team, MatchInvitation, Pitch, OwnerProfile, Notification, Reservation, Payment, PaymentStatus } from "@/types";
import { getPlayerCapacity } from "@/lib/utils";

export function useMyGames(user: User | null) {
  const { toast } = useToast();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [invitations, setInvitations] = React.useState<Map<string, MatchInvitation>>(new Map());
  const [teamMatchInvitations, setTeamMatchInvitations] = React.useState<Map<string, Match>>(new Map());
  const [teams, setTeams] = React.useState<Map<string, Team>>(new Map());
  const [pitches, setPitches] = React.useState<Map<string, Pitch>>(new Map());
  const [owners, setOwners] = React.useState<Map<string, OwnerProfile>>(new Map());
  const [reservations, setReservations] = React.useState<Map<string, Reservation>>(new Map());
  const [loading, setLoading] = React.useState(true);

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
        const reservationsMap = new Map<string, Reservation>();
        const matchesMap = new Map<string, Match>();

        if (user.role === 'PLAYER') {
            const playerTeamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));
            const playerTeamsSnapshot = await getDocs(playerTeamsQuery);
            userTeamIds = playerTeamsSnapshot.docs.map(doc => doc.id);
        } else if (user.role === 'MANAGER') {
            const managerTeamsQuery = query(collection(db, "teams"), where("managerId", "==", user.id));
            const managerTeamsSnapshot = await getDocs(managerTeamsQuery);
            userTeamIds = managerTeamsSnapshot.docs.map(doc => doc.id);
        }
        
        if (user.role === 'MANAGER') {
            const managerResQuery = query(collection(db, "reservations"), where("managerRef", "==", user.id));
            const managerResSnap = await getDocs(managerResQuery);
            managerResSnap.forEach(doc => reservationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Reservation));
        }
        
        if (userTeamIds.length > 0) {
            const teamResQuery = query(collection(db, "reservations"), where("teamRef", "in", userTeamIds));
            const teamResSnap = await getDocs(teamResQuery);
            teamResSnap.forEach(doc => reservationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Reservation));
        }

        const reservationIds = Array.from(reservationsMap.keys());
        if (reservationIds.length > 0) {
            const matchesFromResQuery = query(collection(db, "matches"), where("reservationRef", "in", reservationIds));
            const matchesFromResSnap = await getDocs(matchesFromResQuery);
            matchesFromResSnap.forEach(doc => matchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
        }
        setReservations(reservationsMap);

        if (userTeamIds.length > 0) {
            const matchesAQuery = query(collection(db, "matches"), where("teamARef", "in", userTeamIds));
            const matchesBQuery = query(collection(db, "matches"), where("teamBRef", "in", userTeamIds));
            const teamInvQuery = query(collection(db, "matches"), where("invitedTeamId", "in", userTeamIds), where("status", "==", "Collecting players"));
            const [matchesASnap, matchesBSnap, teamInvSnap] = await Promise.all([getDocs(matchesAQuery), getDocs(matchesBQuery), getDocs(teamInvQuery)]);
            
            matchesASnap.forEach(doc => matchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
            matchesBSnap.forEach(doc => matchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
            teamInvSnap.forEach(doc => matchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
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
                matchesFromInvsMap.forEach((match, id) => matchesMap.set(id, match));
            }
             const validInvs = new Map(invs.filter(inv => matchesMap.has(inv.matchId)).map(inv => [inv.matchId, inv]));
             setInvitations(validInvs);
            
            const confirmedAQuery = query(collection(db, "matches"), where("teamAPlayers", "array-contains", user.id));
            const confirmedBQuery = query(collection(db, "matches"), where("teamBPlayers", "array-contains", user.id));
            const [confirmedASnap, confirmedBSnap] = await Promise.all([getDocs(confirmedAQuery), getDocs(confirmedBQuery)]);
            confirmedASnap.forEach(doc => matchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
            confirmedBSnap.forEach(doc => matchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
        }

        const allMatches = Array.from(matchesMap.values());
        setMatches(allMatches);
        
        const teamIdsToFetch = new Set<string>();
        const pitchIdsToFetch = new Set<string>();
        
        allMatches.forEach((match: Match) => {
            if (match.teamARef) teamIdsToFetch.add(match.teamARef);
            if (match.teamBRef) teamIdsToFetch.add(match.teamBRef);
            if (match.invitedTeamId) teamIdsToFetch.add(match.invitedTeamId);
            if (match.pitchRef) pitchIdsToFetch.add(match.pitchRef);
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

     } catch (error) {
        console.error("Error setting up listeners: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load page data." });
     } finally {
        setLoading(false);
     }
  }, [user, toast]);

  React.useEffect(() => {
    fetchGameDetails();
  }, [fetchGameDetails]);

  const handlePlayerInvitationResponse = async (invitation: MatchInvitation, accepted: boolean) => {
     if (!user) return;
     const batch = writeBatch(db);
     const invitationRef = doc(db, "matchInvitations", invitation.id);
     const matchRef = doc(db, "matches", invitation.matchId);
     
     try {
        const matchSnap = await getDoc(matchRef);
        if (!matchSnap.exists()) {
            toast({ variant: "destructive", title: "Error", description: "Associated match not found." });
            return;
        }
        const match = matchSnap.data() as Match;

        batch.update(invitationRef, { status: accepted ? 'accepted' : 'declined' });

        if (accepted) {
            const teamSide = invitation.teamId === match.teamARef ? 'teamAPlayers' : 'teamBPlayers';
            batch.update(matchRef, { [teamSide]: arrayUnion(user.id) });
        }
        
        await batch.commit();

        if(accepted) {
            const updatedMatchSnap = await getDoc(matchRef);
            if (updatedMatchSnap.exists()) {
                const updatedMatchData = updatedMatchSnap.data() as Match;
                const pitchSnap = await getDoc(doc(db, "pitches", updatedMatchData.pitchRef));
                const pitchData = pitchSnap.data() as Pitch;

                const minPlayers = getPlayerCapacity(pitchData?.sport);
                const currentPlayers = (updatedMatchData.teamAPlayers?.length || 0) + (updatedMatchData.teamBPlayers?.length || 0);

                if (currentPlayers >= minPlayers) {
                    await updateDoc(matchRef, { status: 'Scheduled' });
                    toast({ title: "Team is ready!", description: "Minimum player count reached. The game is now scheduled." });
                } else {
                     toast({ title: `Invitation ${accepted ? 'Accepted' : 'Declined'}` });
                }
            }
        } else {
            toast({ title: `Invitation Declined` });
        }
        
        fetchGameDetails();
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
                  status: "Collecting players", 
                  invitedTeamId: null,
              });
              toast({ title: "Match Declined", description: "The match invitation has been declined."});
          }
          fetchGameDetails();
      } catch (error) {
          console.error("Error responding to team invitation:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not save your response." });
      }
  }

    const handleStartSplitPayment = async (reservation: Reservation) => {
        if (!reservation) {
            toast({variant: "destructive", title: "Reservation details not found"});
            return;
        }

        const matchDoc = await getDocs(query(collection(db, 'matches'), where('reservationRef', '==', reservation.id)));
        if(matchDoc.empty){
            toast({variant: "destructive", title: "Match details not found"});
            return;
        }
        const currentMatchData = matchDoc.docs[0].data() as Match;

        const confirmedPlayers = currentMatchData.teamAPlayers || [];
        if (confirmedPlayers.length === 0) {
            toast({ variant: "destructive", title: "No Players", description: "Cannot start payment without confirmed players." });
            return;
        }

        const pricePerPlayer = reservation.totalAmount / confirmedPlayers.length;
        const batch = writeBatch(db);
        const teamName = teams.get(currentMatchData.teamARef!)?.name || 'Your Team';

        // First, create a payment document for the manager for the initial booking fee
        const managerPaymentRef = doc(collection(db, "payments"));
        const managerPaymentData: Omit<Payment, 'id'> = {
            managerRef: reservation.actorId,
            reservationRef: reservation.id,
            type: 'booking',
            amount: reservation.totalAmount,
            status: 'Paid', // Mark manager's payment as paid since they initiate
            date: new Date().toISOString(),
            pitchName: reservation.pitchName,
            teamName: teamName,
            teamRef: currentMatchData.teamARef!,
            ownerRef: reservation.ownerProfileId, // Associate with the owner
        };
        batch.set(managerPaymentRef, managerPaymentData);


        confirmedPlayers.forEach(playerId => {
            const paymentRef = doc(collection(db, "payments"));
            const paymentData: Omit<Payment, 'id'> = {
                playerRef: playerId,
                teamRef: currentMatchData.teamARef!,
                reservationRef: reservation.id,
                type: 'booking_split',
                amount: pricePerPlayer,
                status: 'Pending',
                date: new Date().toISOString(),
                pitchName: reservation.pitchName,
                teamName: teamName,
                ownerRef: reservation.ownerProfileId, // Associate with the owner
            };
            batch.set(paymentRef, paymentData);

            const notificationRef = doc(collection(db, "notifications"));
            const notificationData: Omit<Notification, 'id'> = {
                userId: playerId,
                message: `A payment of ${pricePerPlayer.toFixed(2)}€ is required to confirm the game.`,
                link: '/dashboard/payments',
                read: false,
                createdAt: serverTimestamp() as any,
            };
            batch.set(notificationRef, notificationData);
        });

        const reservationRef = doc(db, "reservations", reservation.id);
        batch.update(reservationRef, { paymentStatus: "Split" });

        try {
            await batch.commit();
            toast({ title: "Payment Initiated", description: `Each of the ${confirmedPlayers.length} players has been notified.`});
            fetchGameDetails();
        } catch(error) {
            console.error("Error starting split payment: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not initiate payments." });
        }
  };
  
  const now = new Date();
  
  const upcomingMatches = matches.filter(m => {
    const isFuture = new Date(m.date) >= now;
    const isNotFinishedOrCancelled = m.status !== 'Finished' && m.status !== 'Cancelled';
    return isFuture && isNotFinishedOrCancelled;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastMatches = matches.filter(m => m.status === 'Finished')
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  return {
      user, loading,
      matches, teams, pitches, owners, reservations, invitations, teamMatchInvitations,
      upcomingMatches, pastMatches,
      fetchGameDetails, handlePlayerInvitationResponse, handleTeamInvitationResponse, handleStartSplitPayment
  }
}
