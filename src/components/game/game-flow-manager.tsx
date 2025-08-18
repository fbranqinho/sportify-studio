
"use client";

import * as React from "react";
import { doc, writeBatch, serverTimestamp, getDocs, query, collection, where, increment, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Pitch, PlayerProfile, Reservation } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Flag, Trophy, Lock } from "lucide-react";
import { cn, getGameDuration, getPlayerCapacity } from "@/lib/utils";
import { EventTimeline } from "./event-timeline";
import { useRouter } from "next/navigation";

export function GameFlowManager({ match, onMatchUpdate, teamA, teamB, pitch, reservation }: { match: Match, onMatchUpdate: (data: Partial<Match>) => void, teamA?: Team | null, teamB?: Team | null, pitch: Pitch | null, reservation: Reservation | null }) {
    const { toast } = useToast();
    const router = useRouter();
    const [isEndGameOpen, setIsEndGameOpen] = React.useState(false);
    const [scoreA, setScoreA] = React.useState(match.scoreA);
    const [scoreB, setScoreB] = React.useState(match.scoreB);
    const isPracticeMatch = !!match.teamARef && !match.teamBRef && !match.invitedTeamId;
    const gameDuration = pitch ? getGameDuration(pitch.sport) : 90;

    const handleEndGame = async () => {
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", match.id);

        batch.update(matchRef, {
            status: "Finished",
            scoreA: scoreA,
            scoreB: scoreB,
            finishTime: serverTimestamp(),
        });

        const playerStats: { [playerId: string]: { goals: number, assists: number, yellowCards: number, redCards: number } } = {};
        
        if (match.events) {
            for (const event of match.events) {
                if (!playerStats[event.playerId]) {
                    playerStats[event.playerId] = { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
                }
                switch (event.type) {
                    case 'Goal': playerStats[event.playerId].goals++; break;
                    case 'Assist': playerStats[event.playerId].assists++; break;
                    case 'YellowCard': playerStats[event.playerId].yellowCards++; break;
                    case 'RedCard': playerStats[event.playerId].redCards++; break;
                }
            }
        }
        
        try {
            let teamAResult: "W" | "D" | "L";
            let teamBResult: "W" | "D" | "L";

            if (scoreA > scoreB) { teamAResult = "W"; teamBResult = "L"; } 
            else if (scoreB > scoreA) { teamAResult = "L"; teamBResult = "W"; } 
            else { teamAResult = "D"; teamBResult = "D"; }

            const allGamePlayerIds = new Set([...(match.teamAPlayers || []), ...(match.teamBPlayers || [])]);

            if (allGamePlayerIds.size > 0) {
                 const profilesQuery = query(collection(db, "playerProfiles"), where("userRef", "in", Array.from(allGamePlayerIds)));
                 const profilesSnapshot = await getDocs(profilesQuery);

                 profilesSnapshot.forEach(profileDoc => {
                    const profile = { id: profileDoc.id, ...profileDoc.data() } as PlayerProfile;
                    const stats = playerStats[profile.userRef] || { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
                    const profileRef = doc(db, "playerProfiles", profile.id);

                    let gameResult: "W" | "D" | "L" | undefined = undefined;
                    if(match.teamAPlayers?.includes(profile.userRef)) gameResult = teamAResult;
                    if(match.teamBPlayers?.includes(profile.userRef)) gameResult = teamBResult;
                    
                    const newRecentForm = [...(profile.recentForm || [])];
                    if(gameResult) {
                        newRecentForm.push(gameResult);
                        if (newRecentForm.length > 5) {
                            newRecentForm.shift();
                        }
                    }

                    const updateData: any = {
                        goals: increment(stats.goals),
                        assists: increment(stats.assists),
                        yellowCards: increment(stats.yellowCards),
                        redCards: increment(stats.redCards),
                        recentForm: newRecentForm,
                    };
                    
                    if (gameResult === 'W') updateData.victories = increment(1);
                    if (gameResult === 'L') updateData.defeats = increment(1);
                    if (gameResult === 'D') updateData.draws = increment(1);
                    
                    batch.update(profileRef, updateData);
                 });
            }

            if (match.teamARef && match.teamBRef) {
                const teamARefDoc = await getDoc(doc(db, "teams", match.teamARef));
                const teamBRefDoc = await getDoc(doc(db, "teams", match.teamBRef));
                
                if (teamARefDoc.exists()) {
                    const teamAData = teamARefDoc.data() as Team;
                    const newRecentForm = [...(teamAData.recentForm || [])];
                    newRecentForm.push(teamAResult);
                     if (newRecentForm.length > 5) newRecentForm.shift();
                    batch.update(teamARefDoc.ref, { wins: increment(teamAResult === 'W' ? 1 : 0), losses: increment(teamAResult === 'L' ? 1 : 0), draws: increment(teamAResult === 'D' ? 1 : 0), recentForm: newRecentForm });
                }

                if (teamBRefDoc.exists()) {
                    const teamBData = teamBRefDoc.data() as Team;
                    const newRecentForm = [...(teamBData.recentForm || [])];
                    newRecentForm.push(teamBResult);
                     if (newRecentForm.length > 5) newRecentForm.shift();
                    batch.update(teamBRefDoc.ref, { wins: increment(teamBResult === 'W' ? 1 : 0), losses: increment(teamBResult === 'L' ? 1 : 0), draws: increment(teamBResult === 'D' ? 1 : 0), recentForm: newRecentForm });
                }
            }

            await batch.commit();
            onMatchUpdate({ status: "Finished", scoreA, scoreB });
            toast({ title: "Game Finished", description: "The final score and all stats have been recorded." });
            setIsEndGameOpen(false);

        } catch (error) {
            console.error("Error ending game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not end the game and update stats." });
        }
    };
    
    React.useEffect(() => {
        if (isEndGameOpen && match.events) {
            const goalsA = match.events.filter(e => e.type === 'Goal' && e.teamId === 'A').length;
            const goalsB = match.events.filter(e => e.type === 'Goal' && e.teamId === 'B').length;
            setScoreA(goalsA);
            setScoreB(goalsB);
        }
    }, [isEndGameOpen, match.events]);
    
    if (match.status !== 'InProgress') return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Game Control</CardTitle>
                <CardDescription>Manage the game flow from start to finish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                    <Dialog open={isEndGameOpen} onOpenChange={setIsEndGameOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive" size="lg">
                                <Flag className="mr-2" /> End Game
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Set Final Score</DialogTitle>
                                <DialogDescription>The score is calculated automatically based on recorded goals. Confirm to finish.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 items-center">
                                <div className="space-y-2 text-center">
                                    <Label htmlFor="scoreA" className="text-lg font-bold">{isPracticeMatch ? "Vests A" : (teamA?.name || "Team A")}</Label>
                                    <Input id="scoreA" type="number" value={scoreA} disabled className="text-center text-4xl h-20 font-bold"/>
                                </div>
                                <div className="space-y-2 text-center">
                                    <Label htmlFor="scoreB" className="text-lg font-bold">{isPracticeMatch ? "Vests B" : (teamB?.name || "Team B")}</Label>
                                    <Input id="scoreB" type="number" value={scoreB} disabled className="text-center text-4xl h-20 font-bold"/>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsEndGameOpen(false)}>Cancel</Button>
                                <Button onClick={handleEndGame}><Trophy className="mr-2"/>Confirm & Finish</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                {match.events && (
                    <div className="border-t pt-4">
                        <h4 className="font-semibold mb-2 text-center">Event Timeline</h4>
                        <EventTimeline events={match.events} teamAName={teamA?.name} teamBName={teamB?.name} duration={gameDuration}/>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

    