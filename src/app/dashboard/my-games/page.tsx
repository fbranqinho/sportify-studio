
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

    const fetchTeamDetails = async (teamIds: string[]): Promise<Map<string, Team>> => {
        const newTeamsMap = new Map<string, Team>();
        if (teamIds.length === 0) return newTeamsMap;
        
        const uniqueTeamIds = [...new Set(teamIds)];
        const teamDocsQuery = query(collection(db, "teams"), where("__name__", "in", uniqueTeamIds));
        const teamsSnapshot = await getDocs(teamDocsQuery);
        
        teamsSnapshot.forEach(doc => {
            newTeamsMap.set(doc.id, { id: doc.id, ...doc.data() } as Team);
        });
        
        return newTeamsMap;
    };

    const setupListeners = async () => {
        try {
            // --- Listener for Match Invitations (for players) ---
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
                }, (error) => {
                    console.error("Error fetching invitations:", error);
                });
                unsubscribes.push(unsubscribeInvitations);
            }

            // --- Listener for Matches ---
            let matchQueries: any[] = [];
            if (user.role === 'MANAGER') {
                matchQueries.push(query(collection(db, "matches"), where("managerRef", "==", user.id)));
            } else if (user.role === 'PLAYER') {
                const playerTeamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));
                const playerTeamsSnapshot = await getDocs(playerTeamsQuery);
                const userTeamIds = playerTeamsSnapshot.docs.map(doc => doc.id);
                
                if (userTeamIds.length > 0) {
                    const teamIdsFromSnapshot = playerTeamsSnapshot.docs.map(doc => doc.id);
                    const teamsMap = await fetchTeamDetails(teamIdsFromSnapshot);
                    setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
                    
                    matchQueries.push(query(collection(db, "matches"), where("teamARef", "in", userTeamIds)));
                    matchQueries.push(query(collection(db, "matches"), where("teamBRef", "in", userTeamIds)));
                }
            }

            if (matchQueries.length > 0) {
                 const combinedMatches = new Map<string, Match>();
                 matchQueries.forEach(q => {
                     const unsubscribe = onSnapshot(q, async (snapshot) => {
                         snapshot.docs.forEach(doc => {
                             combinedMatches.set(doc.id, { id: doc.id, ...doc.data()} as Match);
                         });

                         const teamIdsFromMatches = new Set<string>();
                         combinedMatches.forEach((match: Match) => {
                             if (match.teamARef) teamIdsFromMatches.add(match.teamARef);
                             if (match.teamBRef) teamIdsFromMatches.add(match.teamBRef);
                         });

                         if(teamIdsFromMatches.size > 0) {
                             const teamsMap = await fetchTeamDetails(Array.from(teamIdsFromMatches));
                             setTeams(prev => new Map([...Array.from(prev.entries()), ...Array.from(teamsMap.entries())]));
                         }

                         setMatches(Array.from(combinedMatches.values()));
                     }, (error) => {
                         console.error("Error fetching matches: ", error);
                         toast({ variant: "destructive", title: "Error", description: "Could not fetch matches." });
                     });
                     unsubscribes.push(unsubscribe);
                 });
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

  const handleInvitationResponse = async (invitationId: string, accepted: boolean) => {
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


  const now = new Date();
  const upcomingMatches = matches.filter(m => new Date(m.date) >= now).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

  const InvitationCard = ({ invitation }: { invitation: MatchInvitation }) => {
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
              <Button size="sm" onClick={() => handleInvitationResponse(invitation.id, true)}>
                 <Check className="mr-2 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleInvitationResponse(invitation.id, false)}>
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
      
       {/* Invitations Section (for players) */}
       {user?.role === 'PLAYER' && invitations.length > 0 && (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold font-headline text-primary">Game Invitations ({invitations.length})</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {invitations.map(inv => <InvitationCard key={inv.id} invitation={inv} />)}
            </div>
        </div>
       )}


      {/* Upcoming Games Section */}
      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Upcoming Games ({upcomingMatches.length})</h2>
        {upcomingMatches.length > 0 ? (
            <MatchList matches={upcomingMatches} />
        ) : (
             (user?.role === 'PLAYER' && invitations.length === 0) ? (
                <EmptyState icon={Gamepad2} title="No Upcoming Games" description="You don't have any games scheduled or new invitations." />
             ) : (
                <EmptyState icon={Gamepad2} title="No Upcoming Games" description="You don't have any games scheduled for the future." />
             )
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

    