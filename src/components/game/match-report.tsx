
"use client";

import * as React from "react";
import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Pitch, User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Star, Goal, Square } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getGameDuration } from "@/lib/utils";
import { MvpVoting } from "@/components/mvp-voting";
import { EventTimeline } from "./event-timeline";

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

export function MatchReport({ match, teamA, teamB, pitch, user, onMvpUpdate }: { match: Match, teamA: Team | null, teamB: Team | null, pitch: Pitch, user: User, onMvpUpdate: () => void }) {
    const [playerStats, setPlayerStats] = React.useState<MatchPlayerStats[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const processStats = async () => {
            setLoading(true);
            const stats: { [key: string]: MatchPlayerStats } = {};
            const allPlayerIds = new Set([...(match.teamAPlayers || []), ...(match.teamBPlayers || [])]);

            allPlayerIds.forEach(id => {
                stats[id] = {
                    playerId: id,
                    playerName: "Unknown",
                    teamId: (match.teamAPlayers || []).includes(id) ? "A" : "B",
                    goals: 0, assists: 0, yellowCards: 0, redCards: 0, mvpScore: 0
                };
            });

            (match.events || []).forEach(event => {
                if (!stats[event.playerId]) return;
                switch(event.type) {
                    case "Goal": stats[event.playerId].goals++; stats[event.playerId].mvpScore += 3; break;
                    case "Assist": stats[event.playerId].assists++; stats[event.playerId].mvpScore += 2; break;
                    case "YellowCard": stats[event.playerId].yellowCards++; stats[event.playerId].mvpScore -= 1; break;
                    case "RedCard": stats[event.playerId].redCards++; stats[event.playerId].mvpScore -= 3; break;
                }
            });
            
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
            setLoading(false);
        };
        processStats();
    }, [match]);
    
    const isPracticeMatch = !!teamA && !teamB;
    const teamAName = isPracticeMatch ? `${teamA?.name} A` : teamA?.name || "Team A";
    const teamBName = isPracticeMatch ? `${teamA?.name} B` : (teamB?.name || "Vests B");
    const gameDuration = getGameDuration(pitch.sport);

    const teamAPlayers = playerStats.filter(p => p.teamId === 'A').sort((a, b) => b.mvpScore - a.mvpScore);
    const teamBPlayers = playerStats.filter(p => p.teamId === 'B').sort((a, b) => b.mvpScore - a.mvpScore);

    if(loading) {
        return <Skeleton className="h-64" />;
    }

    const PlayerStatsTable = ({ players }: { players: MatchPlayerStats[] }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">G</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead className="text-center">Cards</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {players.map(p => (
                    <TableRow key={p.playerId}>
                        <TableCell className="font-medium flex items-center gap-2">
                            {p.playerName}
                            {match.mvpPlayerId === p.playerId && <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800"><Star className="h-3 w-3 text-amber-500" /> MVP</Badge>}
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
    );

    return (
        <div className="space-y-6">
            <MvpVoting match={match} user={user} onMvpUpdated={onMvpUpdate} />
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
             <div className="space-y-2">
                 <h3 className="text-xl font-bold font-headline px-2">Player Statistics</h3>
                 <p className="text-muted-foreground px-2">Performance of all players in this match.</p>
                <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{teamAName}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PlayerStatsTable players={teamAPlayers} />
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>{teamBName}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PlayerStatsTable players={teamBPlayers} />
                        </CardContent>
                    </Card>
                </div>
             </div>
        </div>
    )
}
