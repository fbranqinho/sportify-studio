
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, PlayerProfile, MatchEvent, Pitch } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Star, Goal, Square, CirclePlus, Trophy } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EventTimeline } from "../page";
import { getGameDuration } from "@/lib/utils";

// Helper type for enriched player stats in a match
interface MatchPlayerStats {
  playerId: string;
  playerName: string;
  teamId: "A" | "B";
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  mvpScore: number;
}


export default function MatchReportPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.gameId as string;
    
    const [match, setMatch] = React.useState<Match | null>(null);
    const [teamA, setTeamA] = React.useState<Team | null>(null);
    const [teamB, setTeamB] = React.useState<Team | null>(null);
    const [pitch, setPitch] = React.useState<Pitch | null>(null);
    const [playerStats, setPlayerStats] = React.useState<MatchPlayerStats[]>([]);
    const [mvp, setMvp] = React.useState<MatchPlayerStats | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchMatchReportData = React.useCallback(async () => {
        if (!gameId) return;
        setLoading(true);
        try {
            const matchRef = doc(db, "matches", gameId);
            const matchSnap = await getDoc(matchRef);

            if (!matchSnap.exists()) {
                toast({ variant: "destructive", title: "Error", description: "Match not found." });
                router.push("/dashboard/my-games");
                return;
            }
            const matchData = { id: matchSnap.id, ...matchSnap.data() } as Match;
            setMatch(matchData);

            // Fetch related data
            const promises = [];
            if (matchData.teamARef) {
                promises.push(getDoc(doc(db, "teams", matchData.teamARef)).then(snap => {
                    if (snap.exists()) setTeamA({ id: snap.id, ...snap.data() } as Team);
                }));
            }
            if (matchData.teamBRef) {
                promises.push(getDoc(doc(db, "teams", matchData.teamBRef)).then(snap => {
                     if (snap.exists()) setTeamB({ id: snap.id, ...snap.data() } as Team);
                }));
            }
            if (matchData.pitchRef) {
                promises.push(getDoc(doc(db, "pitches", matchData.pitchRef)).then(snap => {
                     if (snap.exists()) setPitch({ id: snap.id, ...snap.data() } as Pitch);
                }));
            }

            await Promise.all(promises);


            // Process player stats from events
            const stats: { [key: string]: MatchPlayerStats } = {};
            const allPlayerIds = new Set([...(matchData.teamAPlayers || []), ...(matchData.teamBPlayers || [])]);

            allPlayerIds.forEach(id => {
                stats[id] = {
                    playerId: id,
                    playerName: "Unknown", // Placeholder name
                    teamId: (matchData.teamAPlayers || []).includes(id) ? "A" : "B",
                    goals: 0, assists: 0, yellowCards: 0, redCards: 0, mvpScore: 0
                };
            });

            (matchData.events || []).forEach(event => {
                if (!stats[event.playerId]) return;
                switch(event.type) {
                    case "Goal": stats[event.playerId].goals++; stats[event.playerId].mvpScore += 3; break;
                    case "Assist": stats[event.playerId].assists++; stats[event.playerId].mvpScore += 2; break;
                    case "YellowCard": stats[event.playerId].yellowCards++; stats[event.playerId].mvpScore -= 1; break;
                    case "RedCard": stats[event.playerId].redCards++; stats[event.playerId].mvpScore -= 3; break;
                }
            });
            
            // Fetch player names
            if (allPlayerIds.size > 0) {
                const usersQuery = query(collection(db, "users"), where(documentId(), "in", Array.from(allPlayerIds)));
                const usersSnap = await getDocs(usersQuery);
                usersSnap.forEach(userDoc => {
                    if (stats[userDoc.id]) {
                        stats[userDoc.id].playerName = userDoc.data().name;
                    }
                });
            }

            const processedStats = Object.values(stats);
            setPlayerStats(processedStats);
            
            // Determine MVP
            if (processedStats.length > 0) {
                const sortedByMvp = [...processedStats].sort((a, b) => b.mvpScore - a.mvpScore);
                setMvp(sortedByMvp[0]);
            }

        } catch (error) {
            console.error("Error fetching match report:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load match report." });
        } finally {
            setLoading(false);
        }
    }, [gameId, router, toast]);

    React.useEffect(() => {
        fetchMatchReportData();
    }, [fetchMatchReportData]);

    if (loading) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (!match || !pitch) {
        return <div>Match data could not be loaded.</div>;
    }
    
    const isPracticeMatch = !!teamA && !teamB;
    const teamAName = isPracticeMatch ? `${teamA?.name} A` : teamA?.name || "Team A";
    const teamBName = isPracticeMatch ? `${teamA?.name} B` : teamB?.name || "Vests B";
    const gameDuration = getGameDuration(pitch.sport);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                     <Button variant="outline" size="sm" asChild className="mb-4">
                        <Link href="/dashboard/my-games">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back to My Games
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline">Match Report</h1>
                </div>
            </div>

             <Card>
                <CardHeader className="text-center">
                    <CardDescription>{format(new Date(match.date), "EEEE, MMMM d, yyyy")} at {pitch?.name}</CardDescription>
                    <CardTitle className="text-4xl md:text-5xl font-bold font-headline flex items-center justify-center gap-4">
                        <span>{teamAName}</span>
                        <span className="text-primary">{match.scoreA} - {match.scoreB}</span>
                        <span>{teamBName}</span>
                    </CardTitle>
                </CardHeader>
            </Card>

            {mvp && (
                <Card className="bg-gradient-to-r from-primary/10 to-transparent">
                    <CardHeader className="text-center">
                        <div className="flex justify-center items-center gap-2 text-primary">
                            <Star className="h-6 w-6" />
                            <CardTitle className="font-headline text-2xl">Man of the Match</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="text-center">
                        <h3 className="text-3xl font-bold">{mvp.playerName}</h3>
                        <div className="flex justify-center items-center gap-4 mt-2 text-muted-foreground">
                            <span>{mvp.goals} <span className="text-xs">Goals</span></span>
                            <span>{mvp.assists} <span className="text-xs">Assists</span></span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {match.events && match.events.length > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Event Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EventTimeline events={match.events} teamAName={teamAName} teamBName={teamBName} duration={gameDuration}/>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Player Statistics</CardTitle>
                    <CardDescription>Performance of all players in this match.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Player</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead className="text-center">Goals</TableHead>
                                <TableHead className="text-center">Assists</TableHead>
                                <TableHead className="text-center">Cards</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {playerStats.sort((a, b) => b.mvpScore - a.mvpScore).map(p => (
                                <TableRow key={p.playerId}>
                                    <TableCell className="font-medium">{p.playerName}</TableCell>
                                    <TableCell>
                                        <Badge variant={p.teamId === 'A' ? "default" : "secondary"}>
                                            {p.teamId === 'A' ? teamAName : teamBName}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-mono">{p.goals}</TableCell>
                                    <TableCell className="text-center font-mono">{p.assists}</TableCell>
                                    <TableCell className="text-center flex justify-center gap-1">
                                        {p.yellowCards > 0 && <Square className="h-4 w-4 text-yellow-500 fill-current" />}
                                        {p.redCards > 0 && <Square className="h-4 w-4 text-red-600 fill-current" />}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
