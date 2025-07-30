

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, getDocs, DocumentData, writeBatch, doc, updateDoc } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Match, Team, MatchInvitation } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Users, Shield, MapPin, History, Gamepad2, AlertCircle, Check, X, Mail } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";


export default function MyGamesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [invitations, setInvitations] = React.useState<MatchInvitation[]>([]);
  const [teamMatchInvitations, setTeamMatchInvitations] = React.useState<Match[]>([]);
  const [teams, setTeams] = React.useState<Map<string, Team>>(new Map());
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

    const fetchTeamDetails = async (teamIds: string[]): Promise<Map<string, Team>> => {
        const newTeamsMap = new Map<string, Team>();
        if (teamIds.length === 0) return newTeamsMap;
        
        const uniqueTeamIds = [...new Set(teamIds)];
        // Firestore 'in' query is limited to 30 elements
        const chunks = [];
        for (let i = 0; i < uniqueTeamIds.length; i += 30) {
            chunks.push(uniqueTeamIds.slice(i, i + 30));
        }

        for (const chunk of chunks) {
            if(chunk.length === 0) continue;
            const teamDocsQuery = query(collection(db, "teams"), where("__name__", "in", chunk));
            const teamsSnapshot = await getDocs(teamDocsQuery);
            teamsSnapshot.forEach(doc => {
                newTeamsMap.set(doc.id, { id: doc.id, ...doc.data() } as Team);
            });
        }
        
        return newTeamsMap;
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
                 const teamsMap = await fetchTeamDetails(userTeamIds);
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
                        const teamsMap = await fetchTeamDetails(teamIds);
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
                        const teamsMap = await fetchTeamDetails(hostTeamIds);
                        setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
                    }
                }, (error) => console.error("Error fetching team match invitations:", error));
                unsubscribes.push(unsubscribeTeamInvites);
            }

            // --- Listener for Confirmed Matches ---
            if (userTeamIds.length > 0) {
                 const combinedMatches = new Map<string, Match>();
                 const q1 = query(collection(db, "matches"), where("teamARef", "in", userTeamIds));
                 const q2 = query(collection(db, "matches"), where("teamBRef", "in", userTeamIds));

                 const unsub1 = onSnapshot(q1, (snapshot) => {
                     snapshot.docs.forEach(doc => combinedMatches.set(doc.id, { id: doc.id, ...doc.data()} as Match));
                     setMatches(Array.from(combinedMatches.values()));
                 });
                 const unsub2 = onSnapshot(q2, async (snapshot) => {
                     snapshot.docs.forEach(doc => combinedMatches.set(doc.id, { id: doc.id, ...doc.data()} as Match));
                     const allMatches = Array.from(combinedMatches.values());
                     setMatches(allMatches);

                     const teamIdsFromMatches = new Set<string>();
                     allMatches.forEach((match: Match) => {
                         if (match.teamARef) teamIdsFromMatches.add(match.teamARef);
                         if (match.teamBRef) teamIdsFromMatches.add(match.teamBRef);
                     });
                     if(teamIdsFromMatches.size > 0) {
                         const teamsMap = await fetchTeamDetails(Array.from(teamIdsFromMatches));
                         setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
                     }
                 });
                 unsubscribes.push(unsub1, unsub2);
            }

        } catch (error) {
            console.error("Error setting up listeners: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load page data." });
        } finally {
            setLoading(false);
        }
    };
    
    setupListeners();
    
    return () => {
        unsubscribes.forEach(unsub => unsub());
    };

  }, [user, toast]);

  const handlePlayerInvitationResponse = async (invitationId: string, accepted: boolean) => {
     const invitationRef = doc(db, "matchInvitations", invitationId);
     try {
        await updateDoc(invitationRef, {
            status: accepted ? "accepted" : "declined"
        });
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
                  status: "Scheduled", // Back to original state before invite
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
  const upcomingMatches = matches.filter(m => m.status === 'Scheduled' && new Date(m.date) >= now).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastMatches = matches.filter(m => new Date(m.date) < now).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const MatchCard = ({ match }: { match: Match }) => {
    const teamA = match.teamARef ? teams.get(match.teamARef) : null;
    const teamB = match.teamBRef ? teams.get(match.teamBRef) : null;
    const isFinished = match.status === "Finished";
    const isManager = user?.id === teamA?.managerId;
    
    const getMatchTitle = () => {
      if (teamA && !teamB) {
        return `${teamA.name} (treino)`;
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
            <CardContent className="space-y-2 text-sm">
                 <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Pitch: <span className="font-semibold">Placeholder Pitch Name</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Status: <span className="font-semibold">{match.status}</span></span>
                 </div>
            </CardContent>
            {!isFinished && isManager && !teamB && (
            <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/games/${match.id}`}>Manage Game</Link>
                </Button>
            </CardFooter>
            )}
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
              <Button size="sm" onClick={() => handlePlayerInvitationResponse(invitation.id, true)}>
                 <Check className="mr-2 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handlePlayerInvitationResponse(invitation.id, false)}>
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
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
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
