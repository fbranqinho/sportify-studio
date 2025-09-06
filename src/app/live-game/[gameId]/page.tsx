
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, documentId, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Pitch, User } from "@/types";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventTimeline } from "@/components/game/event-timeline";
import { getGameDuration } from "@/lib/utils";

interface LivePlayer {
    id: string;
    name: string;
}

export default function LiveGamePage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.gameId as string;
    const [match, setMatch] = React.useState<Match | null>(null);
    const [teamA, setTeamA] = React.useState<Team | null>(null);
    const [teamB, setTeamB] = React.useState<Team | null>(null);
    const [pitch, setPitch] = React.useState<Pitch | null>(null);
    const [teamAPlayers, setTeamAPlayers] = React.useState<LivePlayer[]>([]);
    const [teamBPlayers, setTeamBPlayers] = React.useState<LivePlayer[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!gameId) {
            setLoading(false);
            return;
        };

        const fetchGameData = async () => {
            setLoading(true);
            try {
                const matchSnap = await getDoc(doc(db, "matches", gameId));

                if (matchSnap.exists()) {
                    const matchData = { id: matchSnap.id, ...matchSnap.data() } as Match;
                    setMatch(matchData);

                    // Fetch supporting details
                    const detailsToFetch: Promise<any>[] = [];
                    if (matchData.teamARef) detailsToFetch.push(getDoc(doc(db, "teams", matchData.teamARef)));
                    if (matchData.teamBRef) detailsToFetch.push(getDoc(doc(db, "teams", matchData.teamBRef)));
                    if (matchData.pitchRef) detailsToFetch.push(getDoc(doc(db, "pitches", matchData.pitchRef)));

                    const [teamADoc, teamBDoc, pitchDoc] = await Promise.all(detailsToFetch);

                    if (teamADoc?.exists()) setTeamA({ id: teamADoc.id, ...teamADoc.data() } as Team);
                    if (teamBDoc?.exists()) setTeamB({ id: teamBDoc.id, ...teamBDoc.data() } as Team);
                    if (pitchDoc?.exists()) setPitch(pitchDoc.data() as Pitch);

                    const fetchPlayers = async (playerIds: string[], setPlayers: React.Dispatch<React.SetStateAction<LivePlayer[]>>) => {
                        if (playerIds.length === 0) {
                            setPlayers([]);
                            return;
                        }
                        const usersQuery = query(collection(db, "users"), where(documentId(), "in", playerIds));
                        const usersSnap = await getDocs(usersQuery);
                        setPlayers(usersSnap.docs.map(d => ({id: d.id, name: d.data().name})));
                    }

                    if (matchData.teamAPlayers) await fetchPlayers(matchData.teamAPlayers, setTeamAPlayers);
                    if (matchData.teamBPlayers) await fetchPlayers(matchData.teamBPlayers, setTeamBPlayers);

                } else {
                    router.push("/dashboard/my-games");
                }
            } catch (error) {
                console.error("Error fetching live game data:", error);
                 router.push("/dashboard/my-games");
            } finally {
                setLoading(false);
            }
        };

        fetchGameData();
    }, [gameId, router]);


    if (loading || !match) {
        return (
            <div className="container mx-auto p-4 md:p-6 space-y-6">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-24 w-full" />
                <div className="grid md:grid-cols-2 gap-6">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        )
    }
    
    const gameDuration = pitch ? getGameDuration(pitch.sport) : 90;

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/my-games">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to My Games
                    </Link>
                </Button>
                <div className="text-right">
                    <h1 className="text-xl font-bold font-headline">{pitch?.name}</h1>
                    <p className="text-sm text-muted-foreground">{format(new Date(match.date), "EEEE, MMMM d, yyyy 'at' HH:mm")}</p>
                </div>
            </div>

            {/* Scoreboard */}
            <Card className="text-center bg-muted/30">
                <CardContent className="p-6">
                    <div className="flex justify-around items-center">
                        <span className="text-2xl md:text-4xl font-bold font-headline">{teamA?.name || 'Vests A'}</span>
                        <span className="text-5xl md:text-7xl font-bold font-mono tracking-tighter">{match.scoreA} - {match.scoreB}</span>
                         <span className="text-2xl md:text-4xl font-bold font-headline">{teamB?.name || 'Vests B'}</span>
                    </div>
                    <div className="mt-2">
                         {match.status === "InProgress" && (
                            <div className="inline-flex items-center gap-2 text-green-600 font-bold animate-pulse">
                                <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-600"></span>
                                </span>
                                LIVE
                            </div>
                         )}
                         {match.status === "Finished" && (
                             <p className="font-bold text-primary">FINAL</p>
                         )}
                    </div>
                </CardContent>
            </Card>

            {/* Event Timeline */}
            {(match.status === 'InProgress' || match.status === 'Finished') && match.events && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-center">Event Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EventTimeline events={match.events} teamAName={teamA?.name} teamBName={teamB?.name} duration={gameDuration}/>
                    </CardContent>
                </Card>
            )}

            {/* Team Rosters */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>{teamA?.name || 'Vests A'}</CardTitle></CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                           {teamAPlayers.map(p => <li key={p.id} className="p-2 bg-background rounded-md">{p.name}</li>)}
                        </ul>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>{teamB?.name || 'Vests B'}</CardTitle></CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                           {teamBPlayers.map(p => <li key={p.id} className="p-2 bg-background rounded-md">{p.name}</li>)}
                        </ul>
                    </CardContent>
                </Card>
            </div>

        </div>
    )

}
