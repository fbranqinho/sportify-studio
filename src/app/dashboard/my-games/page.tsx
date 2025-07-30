
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, getDocs, DocumentData } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Match, Team } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Users, Shield, MapPin, History, Gamepad2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";


export default function MyGamesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [teams, setTeams] = React.useState<Map<string, Team>>(new Map());
  const [loading, setLoading] = React.useState(true);

  // Effect to fetch teams and matches based on user role
  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchTeamDetails = async (teamIds: string[]) => {
        if (teamIds.length === 0) return new Map();
        const teamsQuery = query(collection(db, "teams"), where("__name__", "in", teamIds));
        const teamsSnapshot = await getDocs(teamsQuery);
        const teamsMap = new Map<string, Team>();
        teamsSnapshot.forEach(doc => {
            teamsMap.set(doc.id, { id: doc.id, ...doc.data() } as Team);
        });
        return teamsMap;
    }

    const setupListeners = async () => {
        let matchesQuery;

        if (user.role === 'MANAGER') {
            matchesQuery = query(collection(db, "matches"), where("managerRef", "==", user.id));
        } else if (user.role === 'PLAYER') {
            // First, get the teams the player is in
            const playerTeamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));
            const playerTeamsSnapshot = await getDocs(playerTeamsQuery);
            const playerTeamIds = playerTeamsSnapshot.docs.map(doc => doc.id);
            
            if (playerTeamIds.length === 0) {
                setMatches([]);
                setLoading(false);
                return () => {}; // No teams, no matches
            }
            // Then, get matches for those teams
            matchesQuery = query(collection(db, "matches"), where("teamARef", "in", playerTeamIds));
             // Note: Firestore doesn't support 'OR' queries on different fields, so we can't easily query for teamBRef at the same time.
             // A more complex solution (e.g., duplicating data) would be needed for games where the user is team B.
             // For now, this will show games where the user's team is Team A.
        } else {
            setLoading(false);
            return () => {}; // No query for other roles yet
        }

        const unsubscribe = onSnapshot(matchesQuery, async (querySnapshot) => {
            const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
            const teamIds = new Set<string>();
            matchesData.forEach(match => {
                if (match.teamARef) teamIds.add(match.teamARef);
                if (match.teamBRef) teamIds.add(match.teamBRef);
            });
            
            const teamsMap = await fetchTeamDetails(Array.from(teamIds));
            setTeams(teamsMap);
            setMatches(matchesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching matches: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch matches." });
            setLoading(false);
        });
        
        return unsubscribe;
    }

    const unsubscribePromise = setupListeners();
    
    return () => {
        unsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
    };

  }, [user, toast]);


  const now = new Date();
  const upcomingMatches = matches.filter(m => new Date(m.date) >= now).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastMatches = matches.filter(m => new Date(m.date) < now).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const MatchCard = ({ match }: { match: Match }) => {
    const teamA = match.teamARef ? teams.get(match.teamARef) : null;
    const teamB = match.teamBRef ? teams.get(match.teamBRef) : { name: "To Be Defined" };
    const isFinished = match.status === "Finished";
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex justify-between items-center">
                    <span>{teamA?.name || 'Team A'} vs {teamB?.name || 'Team B'}</span>
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
            {!isFinished && (
            <CardFooter>
                <Button variant="outline" className="w-full" asChild>
                    <Link href="#">View Game Details</Link>
                </Button>
            </CardFooter>
            )}
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

      {user.role === 'PLAYER' && (
        <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="flex flex-row items-center gap-4">
                <AlertCircle className="h-6 w-6 text-blue-600" />
                <div>
                    <CardTitle className="text-blue-900">Player View Limitation</CardTitle>
                    <CardDescription className="text-blue-800">
                        For now, only games where your team is listed as Team A are shown. This will be improved in a future update.
                    </CardDescription>
                </div>
            </CardHeader>
        </Card>
      )}

      {/* Upcoming Games Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline text-primary">Upcoming Games ({upcomingMatches.length})</h2>
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
