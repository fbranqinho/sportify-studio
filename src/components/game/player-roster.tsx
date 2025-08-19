
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
import { UserCheck, UserX, MailQuestion, CheckCircle, Clock, Send } from "lucide-react";
import { format } from 'date-fns';

interface RosterPlayer extends User {
    status: InvitationStatus | 'confirmed';
    payment?: Payment;
}


export function PlayerRoster({ 
    match, 
    isManager, 
    reservation,
    teamA,
    teamB,
}: { 
    match: Match; 
    isManager: boolean;
    reservation: Reservation | null;
    teamA: Team | null;
    teamB: Team | null;
}) {
    const { user } = useUser();
    const [players, setPlayers] = React.useState<RosterPlayer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();
    
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
                
                const payment = paymentsMap.get(user.id);

                return { ...user, status, payment };
            }).sort((a, b) => a.name.localeCompare(b.name));

            setPlayers(rosterPlayers);
            setLoading(false);
        };

        fetchPlayersAndPayments();
    }, [match]);
    

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
    
    const teamAPlayersList = players.filter(p => match.teamAPlayers?.includes(p.id));
    const teamBPlayersList = players.filter(p => match.teamBPlayers?.includes(p.id));
    
    let currentUserIsManagerFor: 'A' | 'B' | 'both' | 'none' = 'none';
    if(isManager) {
        if(isPracticeMatch) currentUserIsManagerFor = 'both';
        else if (user?.id === teamA?.managerId) currentUserIsManagerFor = 'A';
        else if (user?.id === teamB?.managerId) currentUserIsManagerFor = 'B';
    }


    // A scheduled match for a manager, showing their team vs opponent
    if (isScheduledMatch && !isPracticeMatch) {
        return (
            <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{teamA?.name}</CardTitle>
                            <CardDescription>
                                {isManager && currentUserIsManagerFor === 'A' ? 'Your team roster.' : 'Opponent roster.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Player</TableHead>
                                        {isManager && currentUserIsManagerFor === 'A' && <TableHead>Status</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {teamAPlayersList.map(player => (
                                        <TableRow key={player.id} className={sentOffPlayers.includes(player.id) ? 'opacity-50' : ''}>
                                            <TableCell>{player.name}</TableCell>
                                            {isManager && currentUserIsManagerFor === 'A' && (
                                                <TableCell>
                                                    <Badge variant="outline" className="gap-2">
                                                        {getStatusIcon(player.status)}
                                                        <span className="capitalize">{player.status}</span>
                                                    </Badge>
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
                            <CardDescription>
                                {isManager && currentUserIsManagerFor === 'B' ? 'Your team roster.' : 'Opponent roster.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Player</TableHead>
                                        {isManager && currentUserIsManagerFor === 'B' && <TableHead>Status</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {teamBPlayersList.map(player => (
                                        <TableRow key={player.id} className={sentOffPlayers.includes(player.id) ? 'opacity-50' : ''}>
                                            <TableCell>{player.name}</TableCell>
                                            {isManager && currentUserIsManagerFor === 'B' && (
                                                <TableCell>
                                                    <Badge variant="outline" className="gap-2">
                                                        {getStatusIcon(player.status)}
                                                        <span className="capitalize">{player.status}</span>
                                                    </Badge>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
    
    // Fallback for practice matches or other states
    let title = "Player Roster & Status";
    let description = "Overview of all invited players and their invitation status.";
    if (isLive) description = "Record in-game events as they happen.";
    else if (isPracticeMatch && isManager) description = "Set up teams in the Dressing Room before starting the game.";
    const isReservationPaid = reservation?.paymentStatus === 'Paid';
    const showPaymentStatus = isManager && (match.status === 'Scheduled' || match.status === 'Collecting players' || match.status === 'InProgress');
    
    return (
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
                                    {(showPaymentStatus && !isReservationPaid && player.payment?.status === 'Pending') ? (
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
        </Card>
    );
}
