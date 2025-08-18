
"use client";

import * as React from "react";
import { doc, getDocs, collection, query, where, documentId, updateDoc, writeBatch, serverTimestamp, addDoc, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, User, MatchInvitation, InvitationStatus, Payment, MatchEvent, MatchEventType, Reservation } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserCheck, UserX, MailQuestion, CheckCircle, Clock, Send, Shuffle, Goal, CirclePlus, Square } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

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

export function PlayerRoster({ 
    match, 
    isManager, 
    onUpdate,
    onEventAdded,
    reservation,
    teamA,
    teamB,
}: { 
    match: Match; 
    isManager: boolean;
    onUpdate: (data: Partial<Match>) => void;
    onEventAdded: (event: MatchEvent) => void;
    reservation: Reservation | null;
    teamA: Team | null;
    teamB: Team | null;
}) {
    const { user } = useUser();
    const [players, setPlayers] = React.useState<RosterPlayer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();
    const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
    const [currentEvent, setCurrentEvent] = React.useState<EventState | null>(null);
    const [eventMinute, setEventMinute] = React.useState<number | "">("");

    const isPracticeMatch = !!match.teamARef && !match.teamBRef && !match.invitedTeamId;
    const isScheduledMatch = !!match.teamARef && !!match.teamBRef;
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
                
                const payment = paymentsMap.get(user.id);

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
            const notification = {
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
    
    if (players.length === 0 && !isPracticeMatch) {
        return null;
    }
    
    const teamAPlayers = players.filter(p => p.team === 'A');
    const teamBPlayers = players.filter(p => p.team === 'B');
    const myTeamId = (isManager && user?.id === teamA?.managerId) ? teamA?.id : teamB?.id;
    const isMyTeam = (teamId: string) => teamId === myTeamId;
    
    if (!isScheduledMatch) {
        let title = "Player Roster & Status";
        let description = "Overview of all invited players and their invitation status.";
        if (isLive) description = "Record in-game events as they happen.";
        else if (isPracticeMatch && isManager) description = "Assign confirmed players to a team for this practice match.";

        const showTeamAssignment = isPracticeMatch && isManager && !isLive;
        const isReservationPaid = reservation?.paymentStatus === 'Paid';
        const showPaymentStatus = isManager && (match.status === 'Scheduled' || match.status === 'PendingOpponent' || match.status === 'InProgress');
        const showLiveActions = isManager && isLive;
        
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
                                                    {player.payment?.amount ? `${player.payment.amount.toFixed(2)}€` : <span className="text-sm text-muted-foreground">-</span>}
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
            </>
        )
    }

    return (
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>{teamA?.name}</CardTitle>
                     <CardDescription>{isManager && isMyTeam(teamA?.id || '') ? 'Manage your team roster.' : 'Opponent roster.'}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Player</TableHead>
                                {isManager && isMyTeam(teamA?.id || '') && <TableHead>Status</TableHead>}
                                {isManager && isLive && isMyTeam(teamA?.id || '') && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamAPlayers.map(player => (
                                <TableRow key={player.id} className={sentOffPlayers.includes(player.id) ? 'opacity-50' : ''}>
                                    <TableCell>{player.name}</TableCell>
                                    {isManager && isMyTeam(teamA?.id || '') && (
                                        <TableCell>
                                            <Badge variant="outline" className="gap-2">
                                                {getStatusIcon(player.status)}
                                                <span className="capitalize">{player.status}</span>
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {isManager && isLive && isMyTeam(teamA?.id || '') && (
                                        <TableCell className="text-right">
                                            <PlayerActions player={player} teamId="A" />
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>{teamB?.name}</CardTitle>
                    <CardDescription>{isManager && isMyTeam(teamB?.id || '') ? 'Manage your team roster.' : 'Opponent roster.'}</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Player</TableHead>
                                {isManager && isMyTeam(teamB?.id || '') && <TableHead>Status</TableHead>}
                                {isManager && isLive && isMyTeam(teamB?.id || '') && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamBPlayers.map(player => (
                                <TableRow key={player.id} className={sentOffPlayers.includes(player.id) ? 'opacity-50' : ''}>
                                    <TableCell>{player.name}</TableCell>
                                     {isManager && isMyTeam(teamB?.id || '') && (
                                        <TableCell>
                                            <Badge variant="outline" className="gap-2">
                                                {getStatusIcon(player.status)}
                                                <span className="capitalize">{player.status}</span>
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {isManager && isLive && isMyTeam(teamB?.id || '') && (
                                        <TableCell className="text-right">
                                            <PlayerActions player={player} teamId="B" />
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
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
        </div>
    );
}
