
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, arrayUnion, arrayRemove, writeBatch, documentId, increment, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Notification, Pitch, OwnerProfile, User, MatchEvent, MatchEventType, MatchInvitation, InvitationStatus, PitchSport, PlayerProfile, Reservation, Payment, PaymentStatus } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Search, UserPlus, X, Trash2, Building, MapPin, Shield, Users, CheckCircle, XCircle, Inbox, Play, Flag, Trophy, Clock, Shuffle, Goal, Square, CirclePlus, MailQuestion, UserCheck, UserX, UserMinus, DollarSign, Lock, Star, CreditCard, Send } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge";
import { cn, getGameDuration, getPlayerCapacity } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { v4 as uuidv4 } from 'uuid';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MvpVoting } from "@/components/mvp-voting";


export function EventTimeline({ events, teamAName, teamBName, duration }: { events: MatchEvent[], teamAName?: string, teamBName?: string, duration: number }) {
    if (!events || events.length === 0) {
        return (
            <div className="text-center text-sm text-muted-foreground py-4">
                No events recorded yet.
            </div>
        );
    }

    const sortedEvents = [...events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
    const halfTime = duration / 2;

    const getEventIcon = (type: MatchEventType) => {
        switch (type) {
            case 'Goal': return <Goal className="h-4 w-4" />;
            case 'Assist': return <CirclePlus className="h-4 w-4" />;
            case 'YellowCard': return <Square className="h-4 w-4 text-yellow-500 fill-current" />;
            case 'RedCard': return <Square className="h-4 w-4 text-red-600 fill-current" />;
            default: return null;
        }
    };

    const getEventColor = (type: MatchEventType) => {
        switch (type) {
            case 'Goal': return 'bg-green-500';
            case 'Assist': return 'bg-blue-500';
            case 'YellowCard': return 'bg-yellow-500';
            case 'RedCard': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };
    
    const getTeamName = (teamId: string) => {
        if (teamId === 'A') return teamAName || 'Vests A';
        if (teamId === 'B') return teamBName || 'Vests B';
        return 'Unknown Team';
    }

    return (
         <TooltipProvider>
            <div className="w-full py-8 px-4">
                <div className="relative h-1 bg-muted rounded-full">
                {/* Timeline Axis Labels */}
                <div className="absolute -top-5 w-full flex justify-between text-xs text-muted-foreground">
                    <span>0'</span>
                    <span>{halfTime}'</span>
                    <span>{duration}'</span>
                </div>
                <div className="absolute top-1/2 h-4 w-px bg-muted-foreground" style={{ left: '50%' }} />

                {/* Events */}
                {sortedEvents.map(event => (
                    <Tooltip key={event.id}>
                    <TooltipTrigger asChild>
                        <div
                        className={cn("absolute -top-1/2 w-4 h-4 rounded-full border-2 border-background cursor-pointer hover:scale-125 transition-transform", getEventColor(event.type))}
                        style={{ left: `calc(${(event.minute ?? 0) / duration * 100}% - 8px)` }}
                        />
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="flex items-center gap-2 p-1">
                            {getEventIcon(event.type)}
                            <div className="font-bold">{event.minute}'</div>
                            <div>
                                <p className="font-semibold capitalize">{event.type} - {event.playerName}</p>
                                <p className="text-xs text-muted-foreground">{getTeamName(event.teamId)}</p>
                            </div>
                        </div>
                    </TooltipContent>
                    </Tooltip>
                ))}
                </div>
            </div>
        </TooltipProvider>
    );
}

function GameFlowManager({ match, onMatchUpdate, teamA, teamB, pitch, reservation }: { match: Match, onMatchUpdate: (data: Partial<Match>) => void, teamA?: Team | null, teamB?: Team | null, pitch: Pitch | null, reservation: Reservation | null }) {
    const { toast } = useToast();
    const [isEndGameOpen, setIsEndGameOpen] = React.useState(false);
    const [scoreA, setScoreA] = React.useState(match.scoreA);
    const [scoreB, setScoreB] = React.useState(match.scoreB);
    const isPracticeMatch = !!match.teamARef && !match.teamBRef && !match.invitedTeamId;
    const gameDuration = pitch ? getGameDuration(pitch.sport) : 90;

    const handleStartGame = async () => {
        const matchRef = doc(db, "matches", match.id);
        const batch = writeBatch(db);

        try {
             // Enforce minimum players to start
            const minPlayers = getPlayerCapacity(pitch?.sport);
            const confirmedPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
            if (confirmedPlayers < minPlayers) {
                toast({ variant: "destructive", title: "Cannot Start Game", description: `You need at least ${minPlayers} confirmed players to start.` });
                return;
            }

            let updateData: Partial<Match> = { status: "InProgress" };

            // Auto-shuffle for practice matches if teams are not set
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
        } catch (error) {
            console.error("Error starting game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not start the game." });
        }
    };

    const handleEndGame = async () => {
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", match.id);

        // --- Step 1: Update match status and final score ---
        batch.update(matchRef, {
            status: "Finished",
            scoreA: scoreA,
            scoreB: scoreB,
            finishTime: serverTimestamp(),
        });

        // --- Step 2: Aggregate player stats from match events ---
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
            // --- Step 3: Fetch player profiles to update them ---
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

            // --- Step 4: Update team stats (wins, losses, draws) ---
            if (match.teamARef && match.teamBRef) {
                const teamARef = doc(db, "teams", match.teamARef);
                const teamBRef = doc(db, "teams", match.teamBRef);

                batch.update(teamARef, { wins: increment(teamAResult === 'W' ? 1 : 0), losses: increment(teamAResult === 'L' ? 1 : 0), draws: increment(teamAResult === 'D' ? 1 : 0), recentForm: arrayUnion(teamAResult) });
                batch.update(teamBRef, { wins: increment(teamBResult === 'W' ? 1 : 0), losses: increment(teamBResult === 'L' ? 1 : 0), draws: increment(teamBResult === 'D' ? 1 : 0), recentForm: arrayUnion(teamBResult) });
            }

            // --- Step 5: Commit all updates ---
            await batch.commit();
            onMatchUpdate({ status: "Finished", scoreA, scoreB, finishTime: Timestamp.now() });
            toast({ title: "Game Finished", description: "The final score and all stats have been recorded." });
            setIsEndGameOpen(false);

        } catch (error) {
            console.error("Error ending game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not end the game and update stats." });
        }
    };
    
    // Automatically calculate scores when opening the dialog
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
    const canStartGame = (match.status === 'Scheduled' || match.status === 'PendingOpponent') && (isPaid || !!allowPostGamePay) && hasEnoughPlayers;
    
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
                    {(match.status === 'Scheduled' || match.status === 'PendingOpponent') && (
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    {/* The div wrapper is necessary for the tooltip to work on a disabled button */}
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

function ManageGame({ match, onMatchUpdate }: { match: Match, onMatchUpdate: (data: Partial<Match>) => void}) {
    const { toast } = useToast();
    const router = useRouter();

    const handleToggleExternalPlayers = async (checked: boolean) => {
        const matchRef = doc(db, "matches", match.id);
        try {
            await updateDoc(matchRef, { allowExternalPlayers: checked });
            onMatchUpdate({ allowExternalPlayers: checked });
            toast({ title: "Settings updated", description: `Players can ${checked ? 'now' : 'no longer'} apply to this game.`});
        } catch (error) {
            console.error("Error updating match settings:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not update match settings." });
        }
    }
    
    const handleDeleteGame = async () => {
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", match.id);
        
        try {
            // If there's an associated reservation, handle payment refunds/cancellations
            if (match.reservationRef) {
                const reservationRef = doc(db, "reservations", match.reservationRef);
                const paymentsQuery = query(collection(db, "payments"), where("reservationRef", "==", match.reservationRef));
                const paymentsSnap = await getDocs(paymentsQuery);

                let playerIdsToNotify: string[] = [];

                if (!paymentsSnap.empty) {
                    paymentsSnap.forEach(paymentDoc => {
                        const payment = paymentDoc.data() as Payment;
                        const playerRef = payment.playerRef || (payment.managerRef && payment.type === 'booking_split' ? payment.managerRef : undefined);
                        
                        if (playerRef) playerIdsToNotify.push(playerRef);

                        if (payment.status === 'Paid') {
                            batch.update(paymentDoc.ref, { status: 'Refunded' });
                        } else if (payment.status === 'Pending') {
                            batch.update(paymentDoc.ref, { status: 'Cancelled' });
                        }
                    });
                }
                
                // Add manager to notification list if not already there
                if (match.managerRef && !playerIdsToNotify.includes(match.managerRef)) {
                    playerIdsToNotify.push(match.managerRef);
                }

                // Create notifications
                playerIdsToNotify.forEach(userId => {
                    const notificationRef = doc(collection(db, 'notifications'));
                    batch.set(notificationRef, {
                        userId: userId,
                        message: `The game on ${format(new Date(match.date), 'MMM d')} has been cancelled. Payments have been refunded/cancelled.`,
                        link: '/dashboard/payments',
                        read: false,
                        createdAt: serverTimestamp() as any,
                    });
                });

                batch.delete(reservationRef);
            }

            batch.delete(matchRef);

            await batch.commit();
            toast({ title: "Game Deleted", description: "The game, reservation, and associated payments have been removed or updated."});
            router.push('/dashboard/my-games');
        } catch (error) {
            console.error("Error deleting game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete the game." });
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Game Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="allow-external" className="text-base font-semibold">
                            Accept External Players
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Allow players who are not in a team to apply to fill empty slots in this game.
                        </p>
                    </div>
                    <Switch
                        id="allow-external"
                        checked={!!match.allowExternalPlayers}
                        onCheckedChange={handleToggleExternalPlayers}
                    />
                </div>
                 <div className="flex items-center justify-between space-x-2 rounded-lg border border-destructive/50 p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="delete-game" className="text-base font-semibold text-destructive">
                            Delete Game
                        </Label>
                        <p className="text-sm text-muted-foreground">
                           This will permanently delete the game and its associated field reservation. This action cannot be undone.
                        </p>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the game
                                and its associated reservation, and refund/cancel any related payments.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteGame}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    )
}

function PlayerApplications({ match, onUpdate }: { match: Match; onUpdate: () => void }) {
    const [applicants, setApplicants] = React.useState<User[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchApplicants = async () => {
            if (!match.playerApplications || match.playerApplications.length === 0) {
                setApplicants([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const usersQuery = query(collection(db, "users"), where(documentId(), "in", match.playerApplications));
                const usersSnapshot = await getDocs(usersQuery);
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
                setApplicants(usersData);
            } catch (error) {
                console.error("Error fetching applicants:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load player applications." });
            } finally {
                setLoading(false);
            }
        };

        fetchApplicants();
    }, [match.playerApplications, toast]);

    const handleResponse = async (applicantId: string, accepted: boolean) => {
        const matchRef = doc(db, "matches", match.id);
        const batch = writeBatch(db);

        // Operation 1: Remove from applications list
        batch.update(matchRef, { playerApplications: arrayRemove(applicantId) });
        
        let notificationMessage = `Your application for the game on ${format(new Date(match.date), "MMM d")} was not accepted.`;
        let notificationLink = '/dashboard/my-games';
        
        if (accepted) {
            // Operation 2: Add to confirmed players list (assuming Team A)
            batch.update(matchRef, { teamAPlayers: arrayUnion(applicantId) });
            notificationMessage = `You're in! Your application for the game on ${format(new Date(match.date), "MMM d")} was accepted.`;
        }

        // Operation 3: Send notification to the player
        const notification: Omit<Notification, 'id'> = {
            userId: applicantId,
            message: notificationMessage,
            link: notificationLink,
            read: false,
            createdAt: serverTimestamp() as any,
        };
        const newNotificationRef = doc(collection(db, "notifications"));
        batch.set(newNotificationRef, notification);

        try {
            await batch.commit();
            toast({ title: `Application ${accepted ? 'Accepted' : 'Declined'}`, description: `The player has been notified.` });
            onUpdate(); // Re-fetch all data to update UI
        } catch (error) {
            console.error("Error responding to application:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not process the application." });
        }
    };


    if (!match.allowExternalPlayers || (!match.playerApplications || match.playerApplications.length === 0 && applicants.length === 0)) {
        return null;
    }


    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Player Applications</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Player Applications ({applicants.length})</CardTitle>
                <CardDescription>Review and respond to players who want to join this game.</CardDescription>
            </CardHeader>
            <CardContent>
                {applicants.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Player</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {applicants.map(player => (
                                <TableRow key={player.id}>
                                    <TableCell className="font-medium">{player.name}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="outline" onClick={() => handleResponse(player.id, true)}>
                                            <CheckCircle className="mr-2 h-4 w-4 text-green-600"/> Accept
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleResponse(player.id, false)}>
                                             <XCircle className="mr-2 h-4 w-4 text-red-600"/> Decline
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                     <div className="text-center py-10">
                        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No pending applications</h3>
                        <p className="mt-1 text-sm text-muted-foreground">When players apply to join, you'll see them here.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

interface RosterPlayer extends User {
    status: InvitationStatus | 'confirmed';
    team: 'A' | 'B' | null;
    payment?: Payment;
}

interface EventState {
  player: User;
  type: MatchEventType;
  teamId: string;
}

function PlayerRoster({ 
    match, 
    isManager, 
    onUpdate,
    onEventAdded,
    reservation,
}: { 
    match: Match; 
    isManager: boolean;
    onUpdate: (data: Partial<Match>) => void;
    onEventAdded: (event: MatchEvent) => void;
    reservation: Reservation | null;
}) {
    const [players, setPlayers] = React.useState<RosterPlayer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();
    const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
    const [currentEvent, setCurrentEvent] = React.useState<EventState | null>(null);
    const [eventMinute, setEventMinute] = React.useState<number | "">("");

    const isPracticeMatch = !!match.teamARef && !match.teamBRef && !match.invitedTeamId;
    const isLive = match.status === 'InProgress';
    
    const sentOffPlayers = React.useMemo(() => {
        return match.events?.filter(e => e.type === 'RedCard').map(e => e.playerId) || [];
    }, [match.events]);


    React.useEffect(() => {
        const fetchPlayersAndPayments = async () => {
            setLoading(true);
            const invQuery = query(collection(db, "matchInvitations"), where("matchId", "==", match.id));
            const invSnapshot = await getDocs(invQuery);
            const invitations = invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MatchInvitation));
            const invitationMap = new Map(invitations.map(inv => [inv.playerId, inv]));

            const allPlayerIds = [...new Set([
                ...invitations.map(inv => inv.playerId), 
                ...(match.teamAPlayers || []), 
                ...(match.teamBPlayers || [])
            ])];

            if (allPlayerIds.length === 0) {
                setPlayers([]);
                setLoading(false);
                return;
            }

            const usersQuery = query(collection(db, "users"), where(documentId(), "in", allPlayerIds));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

            let paymentsMap = new Map<string, Payment>();
            if (match.reservationRef) {
                const paymentsQuery = query(collection(db, 'payments'), where('reservationRef', '==', match.reservationRef));
                const paymentsSnap = await getDocs(paymentsQuery);
                paymentsSnap.forEach(doc => {
                    const payment = { id: doc.id, ...doc.data()} as Payment;
                    if(payment.playerRef) {
                        paymentsMap.set(payment.playerRef, payment);
                    }
                });
            }

            const rosterPlayers = usersData.map(user => {
                const invitation = invitationMap.get(user.id);
                const isConfirmedA = match.teamAPlayers?.includes(user.id);
                const isConfirmedB = match.teamBPlayers?.includes(user.id);
                let status: InvitationStatus | 'confirmed' = 'pending';
                if (isConfirmedA || isConfirmedB) {
                    status = 'confirmed';
                } else if (invitation) {
                    status = invitation.status;
                }
                
                let team: 'A' | 'B' | null = null;
                if(isConfirmedA) team = 'A';
                if(isConfirmedB) team = 'B';
                
                let payment: Payment | undefined;
                if (isConfirmedA || isConfirmedB) {
                    payment = paymentsMap.get(user.id);
                }


                return { ...user, status, team, payment };
            }).sort((a, b) => a.name.localeCompare(b.name));

            setPlayers(rosterPlayers);
            setLoading(false);
        };

        fetchPlayersAndPayments();
    }, [match, reservation]);

     const handleTeamChange = (playerId: string, team: 'A' | 'B' | 'unassigned') => {
        setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: team === 'unassigned' ? null : team } : p));
    };
    
    const handleShuffle = () => {
        const confirmedPlayers = players.filter(p => p.status === 'confirmed');
        const shuffled = [...confirmedPlayers].sort(() => 0.5 - Math.random());
        const half = Math.ceil(shuffled.length / 2);
        const teamAPlayers = shuffled.slice(0, half);
        
        const newAssignments = players.map(player => {
            if (player.status !== 'confirmed') return player;
            if (teamAPlayers.some(p => p.id === player.id)) return { ...player, team: 'A' as const };
            return { ...player, team: 'B' as const };
        });

        setPlayers(newAssignments);
        toast({ title: "Teams Shuffled!", description: "Review the new teams and click Save."});
    };

    const handleSaveChanges = async () => {
        const teamAPlayers = players.filter(p => p.team === 'A').map(p => p.id);
        const teamBPlayers = players.filter(p => p.team === 'B').map(p => p.id);
        
        const matchRef = doc(db, "matches", match.id);
        try {
            await updateDoc(matchRef, { teamAPlayers, teamBPlayers });
            toast({ title: "Teams Saved", description: "The practice teams have been updated." });
            onUpdate({ teamAPlayers, teamBPlayers });
        } catch (error) {
            console.error("Error saving teams:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not save team assignments." });
        }
    };
    
    const openEventDialog = (player: User, type: MatchEventType, teamId: string | null) => {
        if (!teamId) {
            toast({ variant: "destructive", title: "Error", description: "Cannot add event, player team is not identified."});
            return;
        }
        setCurrentEvent({ player, type, teamId });
        setIsEventDialogOpen(true);
    };

    const handleConfirmEvent = async () => {
        if (!currentEvent || typeof eventMinute !== 'number' || eventMinute < 0) {
            toast({ variant: "destructive", title: "Error", description: "Please enter a valid minute." });
            return;
        }

        const { player, type, teamId } = currentEvent;
        
        const newEvent: MatchEvent = {
            id: uuidv4(),
            type,
            playerId: player.id,
            playerName: player.name,
            teamId,
            timestamp: Timestamp.now(),
            minute: eventMinute,
        };
        
        const matchRef = doc(db, "matches", match.id);

        try {
            await updateDoc(matchRef, {
                events: arrayUnion(newEvent)
            });
            onEventAdded(newEvent);
            toast({ title: "Event Added", description: `${type} at ${eventMinute}' added for ${player.name}.` });
        } catch (error) {
            console.error("Error adding event:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not add the event." });
        } finally {
            setIsEventDialogOpen(false);
            setCurrentEvent(null);
            setEventMinute("");
        }
    };

    const handleRemindPlayer = async (player: RosterPlayer) => {
        if (!player.id) return;
        try {
            const notification: Omit<Notification, 'id'> = {
                userId: player.id,
                message: `Reminder: You have a pending payment for the game on ${format(new Date(match.date), "MMM d")}.`,
                link: '/dashboard/payments',
                read: false,
                createdAt: serverTimestamp() as any,
            };
            await addDoc(collection(db, "notifications"), notification);
            toast({ title: "Reminder Sent!", description: `A notification has been sent to ${player.name}.` });
        } catch (error) {
            console.error("Error sending reminder:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not send reminder." });
        }
    };

    const PlayerActions = ({ player, teamId }: { player: User, teamId: string | null }) => {
        const isSentOff = sentOffPlayers.includes(player.id);
        return (
            <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isSentOff} onClick={() => openEventDialog(player, 'Goal', teamId)}><Goal className="h-4 w-4 text-green-600"/></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isSentOff} onClick={() => openEventDialog(player, 'Assist', teamId)}><CirclePlus className="h-4 w-4 text-blue-600"/></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isSentOff} onClick={() => openEventDialog(player, 'YellowCard', teamId)}><Square className="h-4 w-4 text-yellow-500 fill-yellow-500"/></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={isSentOff} onClick={() => openEventDialog(player, 'RedCard', teamId)}><Square className="h-4 w-4 text-red-600 fill-red-600"/></Button>
            </div>
        );
    }

    const getStatusIcon = (status: InvitationStatus | 'confirmed') => {
        switch (status) {
            case 'confirmed': return <UserCheck className="h-5 w-5 text-green-600" />;
            case 'declined': return <UserX className="h-5 w-5 text-red-600" />;
            case 'pending': return <MailQuestion className="h-5 w-5 text-amber-600" />;
            default: return null;
        }
    }
    
    if (loading) {
        return <Card><CardContent><Skeleton className="h-48" /></CardContent></Card>;
    }
    
    if (players.length === 0) {
        return null;
    }
    
    const title = "Player Roster & Status";
    let description = "Overview of all invited players and their invitation status.";

    if (isLive) {
        description = "Record in-game events as they happen.";
    } else if (isPracticeMatch && isManager) {
        description = "Assign confirmed players to a team for this practice match.";
    }

    const showTeamAssignment = isPracticeMatch && isManager && !isLive;
    const showPaymentStatus = isManager && (match.status === 'Scheduled' || match.status === 'PendingOpponent' || match.status === 'InProgress');
    const showLiveActions = isManager && isLive;
    const isReservationPaid = reservation?.paymentStatus === 'Paid';

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead>Status</TableHead>
                            {showTeamAssignment && <TableHead>Team</TableHead>}
                            {showPaymentStatus && <>
                                <TableHead>Payment</TableHead>
                                <TableHead>Amount</TableHead>
                            </>}
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {players.map(player => (
                            <TableRow key={player.id} className={sentOffPlayers.includes(player.id) ? 'opacity-50' : ''}>
                                <TableCell className="font-medium">{player.name}</TableCell>
                                <TableCell>
                                     <Badge variant="outline" className="gap-2">
                                        {getStatusIcon(player.status)}
                                        <span className="capitalize">{player.status}</span>
                                    </Badge>
                                </TableCell>
                                {showTeamAssignment &&
                                    <TableCell>
                                        {player.status !== 'confirmed' ? <span className="text-sm text-muted-foreground">-</span> :
                                        (
                                            <Select onValueChange={(value) => handleTeamChange(player.id, value as any)} value={player.team || 'unassigned'}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Unassigned" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    <SelectItem value="A">Vests A</SelectItem>
                                                    <SelectItem value="B">Vests B</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )
                                        }
                                    </TableCell>
                                }
                                {showPaymentStatus && (
                                    <>
                                        <TableCell>
                                            {isReservationPaid ? (<Badge variant="default" className="bg-green-600 gap-1.5"><CheckCircle className="h-3 w-3"/>Paid</Badge>) :
                                                player.payment?.status === 'Paid' ? (<Badge variant="default" className="bg-green-600 gap-1.5"><CheckCircle className="h-3 w-3"/>Paid</Badge>) : 
                                                player.payment?.status === 'Pending' ? (<Badge variant="destructive" className="gap-1.5"><Clock className="h-3 w-3"/>Pending</Badge>) :
                                                (<span className="text-sm text-muted-foreground">-</span>)
                                            }
                                        </TableCell>
                                        <TableCell className="font-mono">
                                             {player.payment?.status === 'Paid' ? `${player.payment.amount.toFixed(2)}€` : <span className="text-sm text-muted-foreground">-</span>}
                                        </TableCell>
                                    </>
                                )}
                                <TableCell className="text-right">
                                    {showLiveActions && player.team && player.status === 'confirmed' ? (
                                        <PlayerActions player={player} teamId={player.team} />
                                    ) : (showPaymentStatus && !isReservationPaid && player.payment?.status === 'Pending') ? (
                                        <Button size="sm" variant="outline" onClick={() => handleRemindPlayer(player)}>
                                            <Send className="mr-2 h-3 w-3" /> Remind
                                        </Button>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {showTeamAssignment && (
                 <CardFooter className="gap-2">
                    <Button onClick={handleSaveChanges}>Save Teams</Button>
                    <Button variant="outline" onClick={handleShuffle}><Shuffle className="mr-2 h-4 w-4"/>Shuffle Teams</Button>
                </CardFooter>
            )}
        </Card>
        
         <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record Event: {currentEvent?.type}</DialogTitle>
                    <DialogDescription>
                        Enter the game minute for the {currentEvent?.type.toLowerCase()} by {currentEvent?.player.name}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="eventMinute">Game Minute</Label>
                    <Input
                        id="eventMinute"
                        type="number"
                        placeholder="e.g., 42"
                        value={eventMinute}
                        onChange={(e) => setEventMinute(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmEvent}>Save Event</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

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

function MatchReport({ match, teamA, teamB, pitch, user, onMvpUpdate }: { match: Match, teamA: Team | null, teamB: Team | null, pitch: Pitch, user: User, onMvpUpdate: () => void }) {
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
                    playerName: "Unknown", // Placeholder name
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

export default function GameDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useUser();
    const gameId = params.gameId as string;
    const [match, setMatch] = React.useState<Match | null>(null);
    const [teamA, setTeamA] = React.useState<Team | null>(null);
    const [teamB, setTeamB] = React.useState<Team | null>(null);
    const [pitch, setPitch] = React.useState<Pitch | null>(null);
    const [owner, setOwner] = React.useState<OwnerProfile | null>(null);
    const [reservation, setReservation] = React.useState<Reservation | null>(null);
    const [invitationCounts, setInvitationCounts] = React.useState<{ pending: number, declined: number }>({ pending: 0, declined: 0 });
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchGameDetails = React.useCallback(async () => {
        try {
            setLoading(true);
            const matchRef = doc(db, "matches", gameId);
            const matchSnap = await getDoc(matchRef);

            if (!matchSnap.exists()) {
                toast({ variant: "destructive", title: "Error", description: "Match not found." });
                router.push("/dashboard/my-games");
                return;
            }

            const matchData = { id: matchSnap.id, ...matchSnap.data() } as Match;
            setMatch(matchData);

            const promises = [];

            if (matchData.teamARef) {
                promises.push(getDoc(doc(db, "teams", matchData.teamARef)).then(d => d.exists() ? setTeamA({id: d.id, ...d.data()} as Team) : null));
            }

            const teamBId = matchData.teamBRef || matchData.invitedTeamId;
            if (teamBId) {
                promises.push(getDoc(doc(db, "teams", teamBId)).then(d => d.exists() ? setTeamB({id: d.id, ...d.data()} as Team) : null));
            }
            
            if (matchData.pitchRef) {
                const pitchRef = doc(db, "pitches", matchData.pitchRef);
                const pitchPromise = getDoc(pitchRef).then(async (pitchDoc) => {
                    if (pitchDoc.exists()) {
                        const pitchData = { id: pitchDoc.id, ...pitchDoc.data() } as Pitch;
                        setPitch(pitchData);
                        if (pitchData.ownerRef) {
                             const ownerDocRef = doc(db, "ownerProfiles", pitchData.ownerRef);
                             const ownerDoc = await getDoc(ownerDocRef);
                             if (ownerDoc.exists()) {
                                 setOwner({ id: ownerDoc.id, ...ownerDoc.data() } as OwnerProfile);
                             }
                        }
                    }
                });
                promises.push(pitchPromise);
            }

            if (matchData.reservationRef) {
                const reservationPromise = getDoc(doc(db, "reservations", matchData.reservationRef)).then(resSnap => {
                     if (resSnap.exists()) {
                        setReservation({id: resSnap.id, ...resSnap.data()} as Reservation);
                    }
                });
                promises.push(reservationPromise);
            }

            const invQuery = query(collection(db, "matchInvitations"), where("matchId", "==", gameId));
            const invPromise = getDocs(invQuery).then(snapshot => {
                let pending = 0;
                let declined = 0;
                snapshot.forEach(doc => {
                    const status = doc.data().status as InvitationStatus;
                    if (status === 'pending') pending++;
                    if (status === 'declined') declined++;
                });
                setInvitationCounts({ pending, declined });
            });
            promises.push(invPromise);


            await Promise.all(promises);

        } catch (error) {
            console.error("Error fetching game details: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load game details." });
        } finally {
            setLoading(false);
        }
    }, [gameId, router, toast]);

    React.useEffect(() => {
        if (gameId) {
            fetchGameDetails();
        }
    }, [gameId, fetchGameDetails]);

    const handleMatchUpdate = (data: Partial<Match>) => {
        setMatch(prev => prev ? {...prev, ...data} : null);
        if (data.teamAPlayers || data.teamBPlayers || data.events || data.status === 'Finished') {
            fetchGameDetails(); // Re-fetch to get correct player states
        }
    }
    
    const handleEventAdded = (event: MatchEvent) => {
        setMatch(prev => {
            if (!prev) return null;
            const newEvents = [...(prev.events || []), event];
            return { ...prev, events: newEvents };
        });
    }

    if (loading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
        </div>
    }

    if (!match || !user) {
        return <div>Match not found or user not logged in.</div>;
    }
    
    const isManager = user?.id === teamA?.managerId;
    const isFinished = match.status === 'Finished';

    const getMatchTitle = () => {
        const teamAName = teamA?.name || 'Team A';
        if (isFinished) return `${teamA?.name || 'Team A'} ${match.scoreA} - ${match.scoreB} ${teamB?.name || 'Team B'}`;
        if (teamA && !teamB && !match.invitedTeamId && (match.status === 'PendingOpponent' || match.status === 'Scheduled')) return `${teamA.name} (Practice)`;
        if (teamA && teamB) return `${teamA.name} vs ${teamB.name}`;
        if (teamA && match.invitedTeamId && !teamB) {
             const invitedTeam = teamB; 
             return `${teamA.name} vs ${invitedTeam?.name || 'Invited Team'} (Pending)`;
        }
        return 'Match Details';
    };

    const confirmedPlayersCount = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
    const playerCapacity = pitch ? getPlayerCapacity(pitch.sport) : 0;
    const missingPlayers = playerCapacity > 0 ? playerCapacity - confirmedPlayersCount : 0;


    const getStatusInfo = () => {
        switch (match.status) {
            case 'PendingOpponent':
                if (match.invitedTeamId) return { text: 'Awaiting Opponent', icon: Clock, color: 'text-amber-600' };
                return { text: `Waiting players... ${missingPlayers > 0 ? `${missingPlayers} missing` : 'Full'}`, icon: Users, color: 'text-amber-600' };
            case 'Scheduled':
                 return { text: 'Scheduled', icon: CheckCircle, color: 'text-blue-600' };
            case 'InProgress':
                 return { text: 'In Progress', icon: Play, color: 'text-green-600 animate-pulse' };
            case 'Finished':
                 return { text: 'Finished', icon: Trophy, color: 'text-primary' };
            default:
                return { text: match.status, icon: Shield, color: 'text-muted-foreground' };
        }
    };

    const statusInfo = getStatusInfo();

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

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>{isFinished ? 'Match Summary' : 'Match Details'}</CardTitle>
                        <CardDescription>{format(new Date(match.date), "EEEE, MMMM d, yyyy 'at' HH:mm")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <statusInfo.icon className={cn("h-4 w-4", statusInfo.color)}/>
                                <span>Status: <span className="font-semibold">{statusInfo.text}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground"/>
                                <span>Confirmed: <span className="font-semibold">{confirmedPlayersCount}</span></span>
                            </div>
                             <div className="flex items-center gap-2">
                                <MailQuestion className="h-4 w-4 text-muted-foreground"/>
                                <span>Pending: <span className="font-semibold">{invitationCounts.pending}</span></span>
                            </div>
                              <div className="flex items-center gap-2">
                                <UserMinus className="h-4 w-4 text-muted-foreground"/>
                                <span>Declined: <span className="font-semibold">{invitationCounts.declined}</span></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {pitch && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Venue Information</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3">
                             <div className="flex items-start gap-3">
                                <Shield className="h-4 w-4 text-muted-foreground mt-0.5"/>
                                <div>
                                    <p className="font-semibold">{pitch.name}</p>
                                    <p className="text-xs text-muted-foreground">Pitch</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5"/>
                                 <div>
                                    <p className="font-semibold">{pitch.address}</p>
                                    <p className="text-xs text-muted-foreground">Address</p>
                                </div>
                            </div>
                              {owner && <div className="flex items-start gap-3">
                                <Building className="h-4 w-4 text-muted-foreground mt-0.5"/>
                                 <div>
                                    <p className="font-semibold">{owner.companyName}</p>
                                    <p className="text-xs text-muted-foreground">Managed by</p>
                                </div>
                            </div>}
                        </CardContent>
                    </Card>
                )}
            </div>
            
            {isFinished ? (
                 pitch && <MatchReport match={match} teamA={teamA} teamB={teamB} pitch={pitch} user={user} onMvpUpdate={fetchGameDetails} />
            ) : (
                <>
                    {isManager && <GameFlowManager match={match} onMatchUpdate={handleMatchUpdate} teamA={teamA} teamB={teamB} pitch={pitch} reservation={reservation} />}
                    <PlayerRoster match={match} isManager={isManager} onUpdate={handleMatchUpdate} onEventAdded={handleEventAdded} reservation={reservation}/>
                    {isManager && <PlayerApplications match={match} onUpdate={fetchGameDetails} />}
                    {isManager && match.status !== "InProgress" && match.status !== "Finished" && <ManageGame match={match} onMatchUpdate={handleMatchUpdate} />}
                </>
            )}
        </div>
    );
}

    