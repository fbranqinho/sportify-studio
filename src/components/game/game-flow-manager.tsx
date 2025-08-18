
"use client";

import * as React from "react";
import { doc, writeBatch, serverTimestamp, getDocs, query, collection, where, increment, Timestamp, arrayUnion, getDoc } from "firebase/firestore";
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

    const handleStartGame = async () => {
        const matchRef = doc(db, "matches", match.id);
        const batch = writeBatch(db);

        try {
            const minPlayers = getPlayerCapacity(pitch?.sport);
            const confirmedPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
            if (confirmedPlayers < minPlayers) {
                toast({ variant: "destructive", title: "Cannot Start Game", description: `You need at least ${minPlayers} confirmed players to start.` });
                return;
            }

            let updateData: Partial<Match> = { status: "InProgress" };

            if (isPracticeMatch && (!match.teamAPlayers || match.teamAPlayers.length === 0)) {
                 const allConfirmedPlayers = [...(match.teamAPlayers || []), ...(match.teamBPlayers || [])];
                 const shuffled = [...allConfirmedPlayers].sort(() => 0.5 - Math.random());
                 const half = Math.ceil(shuffled.length / 2);
                 const newTeamAPlayers = shuffled.slice(0, half);
                 const newTeamBPlayers = shuffled.slice(half);
                 updateData.teamAPlayers = newTeamAPlayers;
                 updateData.teamBPlayers = newTeamBPlayers;
                 toast({ title: "Teams auto-shuffled!"});
            }

            batch.update(matchRef, updateData);
            await batch.commit();

            onMatchUpdate(updateData);
            toast({ title: "Game Started!", description: "The game is now live." });
            router.push(`/live-game/${match.id}`);
        } catch (error) {
            console.error("Error starting game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not start the game." });
        }
    };

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
            onMatchUpdate({ status: "Finished", scoreA, scoreB, finishTime: Timestamp.now() });
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
    
    const isPaid = reservation?.paymentStatus === 'Paid';
    const allowPostGamePay = pitch?.allowPostGamePayments;
    const minPlayers = getPlayerCapacity(pitch?.sport);
    const hasEnoughPlayers = ((match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0)) >= minPlayers;
    const canStartGame = (match.status === 'Scheduled' || match.status === 'Collecting players') && (isPaid || !!allowPostGamePay) && hasEnoughPlayers;
    
    let disabledTooltipContent = "";
    if (!isPaid && !allowPostGamePay) {
        disabledTooltipContent = "The game must be paid for (or allow post-game payments) before it can start.";
    } else if (!hasEnoughPlayers) {
        disabledTooltipContent = `The game requires at least ${minPlayers} confirmed players to start.`;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Game Control</CardTitle>
                <CardDescription>Manage the game flow from start to finish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center justify-center gap-4">
                    {(match.status === 'Scheduled' || match.status === 'Collecting players') && (
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <Button onClick={handleStartGame} size="lg" disabled={!canStartGame}>
                                            <Play className="mr-2" /> Start Game
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                {!canStartGame && (
                                <TooltipContent>
                                    <p className="flex items-center gap-2"><Lock className="h-4 w-4" /> {disabledTooltipContent}</p>
                                </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {match.status === 'InProgress' && (
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
                    )}
                     {match.status === 'Finished' && (
                        <div className="text-center">
                            <p className="text-muted-foreground">Final Score</p>
                            <p className="text-4xl font-bold font-headline">{match.scoreA} - {match.scoreB}</p>
                        </div>
                    )}
                </div>
                {(match.status === 'InProgress' || match.status === 'Finished') && match.events && (
                     <div className="border-t pt-4">
                        <h4 className="font-semibold mb-2 text-center">Event Timeline</h4>
                        <EventTimeline events={match.events} teamAName={teamA?.name} teamBName={teamB?.name} duration={gameDuration}/>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
