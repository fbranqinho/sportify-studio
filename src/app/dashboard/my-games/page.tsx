

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
import { Calendar, Users, Shield, MapPin, Building, Gamepad2, Check, X, Mail, History, Trophy, DollarSign, CreditCard, ArrowRight, Ban } from "lucide-react";
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
        
        // 3. Fetch all secondary details (teams, pitches, reservations)
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
    const isFuture = new Date(m.date) >= now;
    const isNotFinishedOrCancelled = m.status !== 'Finished' && m.status !== 'Cancelled';
    return isFuture && isNotFinishedOrCancelled;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastMatches = matches.filter(m => m.status === 'Finished')
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  

  const MatchCard = ({ match }: { match: Match }) => {
    const teamA = match.teamARef ? teams.get(match.teamARef) : null;
    const teamB = match.teamBRef ? teams.get(match.teamBRef) : (match.invitedTeamId ? teams.get(match.invitedTeamId) : null);
    const pitch = match.pitchRef ? pitches.get(match.pitchRef) : null;
    const owner = pitch ? owners.get(pitch.ownerRef) : null;
    const reservation = match.reservationRef ? reservations.get(match.reservationRef) : null;

    const isFinished = match.status === "Finished";
    const isPlayer = user?.role === 'PLAYER';

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
                 {reservation?.paymentStatus && reservation.paymentStatus !== 'Paid' && (
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Payment Status: <span className="font-semibold">{reservation.paymentStatus}</span></span>
                    </div>
                 )}
            </CardContent>
             <CardFooter className="flex-col items-start gap-4">
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
          View your upcoming games and past matches.
        </p>
      </div>

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



    
