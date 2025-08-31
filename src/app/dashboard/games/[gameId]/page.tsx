
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, documentId, updateDoc, serverTimestamp, writeBatch, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Notification, Pitch, OwnerProfile, User, MatchEvent, Reservation } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Play, Shirt, Send } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn, getPlayerCapacity } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// Import individual components
import { GameFlowManager } from "@/components/game/game-flow-manager";
import { PlayerRoster } from "@/components/game/player-roster";
import { PlayerApplications } from "@/components/game/player-applications";
import { ChallengeInvitations } from "@/components/game/challenge-invitations";
import { ManageGame } from "@/components/game/manage-game";
import { MatchReport } from "@/components/game/match-report";
import { MatchDetailsCard } from "@/components/game/match-details-card";
import { DressingRoom } from "@/components/game/dressing-room";
import { KudosVoting } from "@/components/kudos-voting";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useMyGames } from "@/hooks/use-my-games";


export default function GameDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useUser();
    const gameId = params.gameId as string;
    
    // Use the central hook to get all game-related data
    const { 
        matches, teams, pitches, owners, reservations, 
        loading: hookLoading, fetchGameData 
    } = useMyGames(user);

    const [match, setMatch] = React.useState<Match | null>(null);
    const [teamA, setTeamA] = React.useState<Team | null>(null);
    const [teamB, setTeamB] = React.useState<Team | null>(null);
    const [pitch, setPitch] = React.useState<Pitch | null>(null);
    const [owner, setOwner] = React.useState<OwnerProfile | null>(null);
    const [reservation, setReservation] = React.useState<Reservation | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [isDressingRoomOpen, setIsDressingRoomOpen] = React.useState(false);
    const { toast } = useToast();

    const fetchGameDetails = React.useCallback(async () => {
        try {
            setLoading(true);
            const currentMatch = matches.find(m => m.id === gameId);

            if (!currentMatch) {
                toast({ variant: "destructive", title: "Error", description: "Match not found." });
                router.push("/dashboard/my-games");
                return;
            }
            
            setMatch(currentMatch);

            if (currentMatch.teamARef) setTeamA(teams.get(currentMatch.teamARef) || null);
            const teamBId = currentMatch.teamBRef || currentMatch.invitedTeamId;
            if (teamBId) setTeamB(teams.get(teamBId) || null);
            
            if (currentMatch.pitchRef) {
                const currentPitch = pitches.get(currentMatch.pitchRef) || null;
                setPitch(currentPitch);
                if (currentPitch?.ownerRef) {
                    setOwner(owners.get(currentPitch.ownerRef) || null);
                }
            }

            if (currentMatch.reservationRef) {
                setReservation(reservations.get(currentMatch.reservationRef) || null);
            }
            
        } catch (error) {
            console.error("Error fetching game details: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load game details." });
        } finally {
            setLoading(false);
        }
    }, [gameId, matches, teams, pitches, owners, reservations, router, toast]);

    React.useEffect(() => {
        if (gameId && !hookLoading) {
            fetchGameDetails();
        }
    }, [gameId, hookLoading, fetchGameDetails]);
    
    const handleMatchUpdate = (data: Partial<Match>) => {
        setMatch(prev => prev ? {...prev, ...data} : null);
        // Also update the match in the central hook's state
        const updatedMatch = { ...match!, ...data };
        const matchIndex = matches.findIndex(m => m.id === gameId);
        if (matchIndex !== -1) {
            const newMatches = [...matches];
            newMatches[matchIndex] = updatedMatch;
        }
    }
    
    const onActionSuccess = () => {
        // Trigger a refetch in the central hook to get the latest state for everything
        fetchGameData();
    }

    const handleInviteTeam = async () => {
        if (!teamA || !teamA.playerIds || teamA.playerIds.length === 0) {
            toast({ variant: "destructive", title: "No players in team", description: "Your team has no players to invite." });
            return;
        }

        const batch = writeBatch(db);

        for (const playerId of teamA.playerIds) {
            const invitationRef = doc(collection(db, "matchInvitations"));
            batch.set(invitationRef, {
                matchId: gameId,
                teamId: teamA.id,
                playerId: playerId,
                managerId: user?.id,
                status: "pending",
                invitedAt: serverTimestamp(),
            });

            // Create notification for the player
             const notificationRef = doc(collection(db, "users", playerId, "notifications"));
             batch.set(notificationRef, {
                userId: playerId,
                message: `You've been invited to a game with ${teamA.name}.`,
                link: '/dashboard/my-games',
                read: false,
                createdAt: serverTimestamp() as any,
            });
        }
        
        try {
            await batch.commit();
            toast({ title: "Invitations Sent!", description: `All ${teamA.playerIds.length} players will be invited to the game.` });
            onActionSuccess();
        } catch (error) {
            console.error("Error sending invitations:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not send invitations." });
        }
    }

    const handleStartGame = async () => {
        if (!match || !pitch) return;
        
        const matchRef = doc(db, "matches", match.id);
        const minPlayers = getPlayerCapacity(pitch?.sport);
        const totalPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);

        if (totalPlayers < minPlayers && !pitch.allowPostGamePayments) {
            toast({
                variant: "destructive",
                title: "Not Enough Players",
                description: `You need at least ${minPlayers} confirmed players to start the game.`,
            });
            return;
        }

        try {
            await updateDoc(matchRef, {
                status: "InProgress",
                startTime: serverTimestamp(),
            });
            handleMatchUpdate({ status: "InProgress", startTime: new Date() as any });
            toast({ title: "Game Started!", description: "The game is now live. Good luck!" });
        } catch (error) {
            console.error("Error starting game: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not start the game." });
        }
    };


    if (loading || hookLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
        </div>
    }

    if (!match || !user) {
        return <div>Match not found or user not logged in.</div>;
    }
    
    const isManagerA = user?.id === teamA?.managerId;
    const isManagerB = user?.id === teamB?.managerId;
    const isManager = isManagerA || isManagerB;
    const isFinished = match.status === 'Finished';
    const isLive = match.status === 'InProgress';
    const canStartGame = match.status === 'Scheduled' && isManager && reservation?.paymentStatus === 'Paid';
    const showInviteTeamButton = isManagerA && match.status === 'Collecting players' && (!match.teamAPlayers || match.teamAPlayers.length === 0);


    const getMatchTitle = () => {
        const teamAName = teamA?.name || 'Team A';
        if (isFinished) return `${teamA?.name || 'Team A'} ${match.scoreA} - ${match.scoreB} ${teamB?.name || 'Team B'}`;
        if (teamA && !teamB && !match.invitedTeamId && (match.status === 'Collecting players' || match.status === 'Scheduled')) return `${teamA.name} (Practice)`;
        if (teamA && teamB) return `${teamA.name} vs ${teamB.name}`;
        if (teamA && match.invitedTeamId && !teamB) {
             const invitedTeam = teams.get(match.invitedTeamId); 
             return `${teamA.name} vs ${invitedTeam?.name || 'Invited Team'} (Pending)`;
        }
        return 'Match Details';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold font-headline">{getMatchTitle()}</h1>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/my-games">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to My Games
                    </Link>
                </Button>
            </div>
            
            <MatchDetailsCard
                match={match}
                pitch={pitch}
                owner={owner}
            />
            
            {showInviteTeamButton && (
                <Card className="bg-primary/10 border-primary/20">
                    <CardHeader className="flex-row items-center justify-between">
                         <div>
                            <CardTitle>Ready to Play?</CardTitle>
                            <CardDescription>Invite your team members to join this game.</CardDescription>
                         </div>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button><Send className="mr-2 h-4 w-4"/>Invite Team</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Invite Your Team?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will send a game invitation to all players currently on your roster for {teamA?.name}. Are you sure?
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleInviteTeam}>Yes, Send Invitations</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardHeader>
                </Card>
            )}

            {isManager && !isFinished && !isLive && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Dialog open={isDressingRoomOpen} onOpenChange={setIsDressingRoomOpen}>
                        <DialogTrigger asChild>
                           <Button variant="outline" size="lg" className="font-bold py-8 text-lg"><Shirt className="mr-2"/>Dressing Room</Button>
                        </DialogTrigger>
                        <DressingRoom 
                            match={match} 
                            onUpdate={handleMatchUpdate}
                            onClose={() => setIsDressingRoomOpen(false)}
                            teamA={teamA}
                            teamB={teamB}
                            pitch={pitch}
                            currentUserIsManagerFor={isManagerA ? 'A' : (isManagerB ? 'B' : 'none')}
                        />
                    </Dialog>
                    <Button size="lg" disabled={!canStartGame} onClick={handleStartGame} className="font-bold py-8 text-lg">
                        <Play className="mr-2"/> Start Game
                    </Button>
                </div>
            )}
            
            {isFinished ? (
                 <div className="space-y-6">
                    {pitch && <MatchReport match={match} teamA={teamA} teamB={teamB} pitch={pitch} user={user} onMvpUpdate={onActionSuccess} />}
                    <KudosVoting match={match} user={user} />
                </div>
            ) : (
                <div className="space-y-6">
                    {isLive && <GameFlowManager match={match} onMatchUpdate={handleMatchUpdate} teamA={teamA} teamB={teamB} pitch={pitch} reservation={reservation} />}
                    
                    <PlayerRoster 
                        match={match} 
                        isManager={isManager} 
                        reservation={reservation}
                        teamA={teamA}
                        teamB={teamB}
                    />

                    {isManagerA && <PlayerApplications match={match} onUpdate={onActionSuccess} />}
                    {isManagerA && <ChallengeInvitations match={match} onUpdate={onActionSuccess} />}
                    
                    {isManager && !isLive && <ManageGame match={match} onMatchUpdate={handleMatchUpdate} reservation={reservation} pitch={pitch} />}
                </div>
            )}
        </div>
    );
}

    