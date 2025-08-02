

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
        const batch = writeBatch(db);
        const reservationRef = doc(db, "reservations", reservation.id);
        
        try {
            // Update reservation status
            batch.update(reservationRef, { paymentStatus: "Paid", status: "Scheduled" });

            // Notify owner
            const ownerNotificationRef = doc(collection(db, "notifications"));
            const notification: Omit<Notification, 'id'> = {
                ownerProfileId: reservation.ownerProfileId,
                message: `Payment received for booking at ${reservation.pitchName}. The game is confirmed.`,
                link: `/dashboard/schedule`,
                read: false,
                createdAt: serverTimestamp() as any,
            };
            batch.set(ownerNotificationRef, notification);

            await batch.commit();
            setIsDialogOpen(false);
            onPaymentProcessed();
            toast({ title: "Payment Successful!", description: "The reservation is now confirmed." });
        } catch (error: any) {
             console.error("Error processing full payment:", error);
             toast({ variant: "destructive", title: "Error", description: `Could not process payment: ${error.message}` });
        }
    }

    const handleSplitPayment = async () => {
        if (!reservation.teamRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Reservation is not associated with a team.' });
            return;
        }

        const batch = writeBatch(db);
        try {
            // 1. Get Team and Players
            const teamRef = doc(db, "teams", reservation.teamRef);
            const teamDoc = await getDoc(teamRef);
            if (!teamDoc.exists()) throw new Error("Team not found to split payment.");
            const team = teamDoc.data() as Team;
            const playerIds = team.playerIds;
            if (!playerIds || playerIds.length === 0) throw new Error("Team has no players to split payment with.");

            // 2. Calculate amount per player
            const amountPerPlayer = reservation.totalAmount / playerIds.length;

            // 3. Create a new payment doc for each player and notify them
            for (const playerId of playerIds) {
                const playerPaymentRef = doc(collection(db, "payments"));
                batch.set(playerPaymentRef, {
                    type: "booking_split",
                    amount: amountPerPlayer,
                    status: "Pending",
                    date: new Date().toISOString(),
                    reservationRef: reservation.id,
                    teamRef: reservation.teamRef,
                    playerRef: playerId,
                    pitchName: reservation.pitchName,
                    teamName: team.name,
                });

                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                    userId: playerId,
                    message: `Your share of ${amountPerPlayer.toFixed(2)}€ for the game with ${team.name} is now due.`,
                    link: '/dashboard/payments',
                    read: false,
                    createdAt: serverTimestamp() as any,
                });
            }

            // 4. Update the original reservation to 'Split'
            const originalReservationRef = doc(db, "reservations", reservation.id);
            batch.update(originalReservationRef, { paymentStatus: "Split" });

            // 5. Commit batch
            await batch.commit();
            setIsDialogOpen(false);
            onPaymentProcessed();
            toast({ title: "Payment Split!", description: `Each of the ${playerIds.length} players has been assigned their share.` });

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
  const [loading, setLoading] = React.useState(true);

  // Effect to fetch teams and matches based on user role
  React.useEffect(() => {
    if (!user) {
        setLoading(false);
        return;
    }

    setLoading(true);
    const unsubscribes: (() => void)[] = [];
    let userTeamIds: string[] = [];

    const fetchDetails = async (collectionName: 'teams' | 'pitches' | 'ownerProfiles' | 'reservations', ids: string[]): Promise<Map<string, any>> => {
        const newMap = new Map<string, any>();
        if (ids.length === 0) return newMap;
        
        const uniqueIds = [...new Set(ids)].filter(id => id); // Filter out any falsy ids
        if (uniqueIds.length === 0) return newMap;
        
        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 30) {
            chunks.push(uniqueIds.slice(i, i + 30));
        }

        for (const chunk of chunks) {
            if(chunk.length === 0) continue;
            const docsQuery = query(collection(db, collectionName), where(documentId(), "in", chunk));
            const snapshot = await getDocs(docsQuery);
            snapshot.forEach(doc => {
                newMap.set(doc.id, { id: doc.id, ...doc.data() });
            });
        }
        
        return newMap;
    };


    const setupListeners = async () => {
        try {
            // --- Step 1: Get all teams the user is part of (as Player or Manager) ---
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

            // --- Listener for Personal Match Invitations (for players) ---
            if (user.role === 'PLAYER') {
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
            }

            // --- Listener for Team Match Invitations (for managers) ---
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

            // --- Listener for Confirmed Matches ---
            if (userTeamIds.length > 0) {
                 const combinedMatches = new Map<string, Match>();
                 
                 const processMatchesSnapshot = async (snapshot: DocumentData) => {
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
                    }

                     if (pitchIdsToFetch.size > 0) {
                        const pitchesMap = await fetchDetails('pitches', Array.from(pitchIdsToFetch));
                        setPitches(prev => new Map([...Array.from(prev.entries()), ...Array.from(pitchesMap.entries())]));

                        const ownerUserRefsToFetch = new Set<string>();
                        pitchesMap.forEach(pitch => {
                            // The ownerRef on a pitch is the ID of the ownerProfile document.
                            if (pitch.ownerRef) ownerUserRefsToFetch.add(pitch.ownerRef);
                        })

                        if(ownerUserRefsToFetch.size > 0){
                            // This query is slightly different as ownerRef on pitch is ownerProfileID not userID
                             const q = query(collection(db, "ownerProfiles"), where(documentId(), "in", Array.from(ownerUserRefsToFetch)));
                            const ownerSnapshot = await getDocs(q);
                            const ownersMap = new Map<string, OwnerProfile>();
                            ownerSnapshot.forEach(doc => {
                                const ownerData = { id: doc.id, ...doc.data() } as OwnerProfile;
                                ownersMap.set(ownerData.id, ownerData);
                            });
                             setOwners(prev => new Map([...Array.from(prev.entries()), ...Array.from(ownersMap.entries())]));
                        }
                    }
                 };
                 
                 const q1 = query(collection(db, "matches"), where("teamARef", "in", userTeamIds));
                 const q2 = query(collection(db, "matches"), where("teamBRef", "in", userTeamIds));

                 const unsub1 = onSnapshot(q1, processMatchesSnapshot);
                 const unsub2 = onSnapshot(q2, processMatchesSnapshot);
                 
                 unsubscribes.push(unsub1, unsub2);
            } else {
                 setLoading(false);
            }

        } catch (error) {
            console.error("Error setting up listeners: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load page data." });
        } finally {
            if (unsubscribes.length === 0) setLoading(false);
        }
    };
    
    const initialLoad = async () => {
        await setupListeners();
        setLoading(false);
    }

    initialLoad();
    
    return () => {
        unsubscribes.forEach(unsub => unsub());
    };

  }, [user, toast]);
  
  const refreshData = async () => {
    // This function can be called after a payment to refresh the reservation status
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

        // Separate read/write after initial commit
        if (accepted) {
            const matchDoc = await getDoc(matchRef);
            if (matchDoc.exists()) {
                const match = {id: matchDoc.id, ...matchDoc.data()} as Match;
                const pitch = pitches.get(match.pitchRef);
                if(pitch) {
                    const confirmedPlayers = (match.teamAPlayers?.length || 0); // Player was added in batch, so count is up to date
                    const playerCapacity = getPlayerCapacity(pitch.sport);
                    if (playerCapacity > 0 && confirmedPlayers >= playerCapacity) {
                        const gameFullBatch = writeBatch(db);
                        gameFullBatch.update(matchRef, { status: "Scheduled" });

                        // Notify owner that the game is now full
                         const ownerProfileQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", pitch.ownerRef));
                         const ownerProfileSnapshot = await getDocs(ownerProfileQuery);
                         if(!ownerProfileSnapshot.empty) {
                             const ownerProfileId = ownerProfileSnapshot.docs[0].id;
                             const newNotificationRef = doc(collection(db, "notifications"));
                             const notification: Omit<Notification, 'id'> = {
                                ownerProfileId: ownerProfileId,
                                message: `The game scheduled for ${format(new Date(match.date), 'PPp')} on '${pitch.name}' is now full.`,
                                link: `/dashboard/schedule`,
                                read: false,
                                createdAt: serverTimestamp() as any,
                            };
                            gameFullBatch.set(newNotificationRef, notification);
                         }
                        
                        await gameFullBatch.commit();
                    }
                }
            }
        }

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

    const isFinished = match.status === "Finished";
    const isManager = user?.id === teamA?.managerId;

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
                 {isManager && reservation && reservation.paymentStatus === 'Pending' && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                         <div className="flex justify-between items-center text-base">
                            <span className="font-semibold text-destructive">Payment Due</span>
                            <span className="font-bold text-destructive">{reservation.totalAmount.toFixed(2)}€</span>
                        </div>
                        <ManagerPaymentDialog reservation={reservation} onPaymentProcessed={refreshData} />
                    </div>
                 )}
            </CardContent>
             <CardFooter className="gap-2">
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/games/${match.id}`}>
                        {isManager && !isFinished ? "Manage Game" : "View Details"}
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
              Invited {invitation.invitedAt ? formatDistanceToNow(new Date(invitation.invitedAt.seconds * 1000), { addSuffix: true }) : 'recently'}
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
