
"use client";

import * as React from "react";
import { doc, getDocs, collection, query, where, writeBatch, serverTimestamp, deleteDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Notification, Team } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Swords } from "lucide-react";
import { format } from "date-fns";

export function ChallengeInvitations({ match, onUpdate }: { match: Match; onUpdate: () => void }) {
    const [challenges, setChallenges] = React.useState<Notification[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();
    const { user } = useUser();

    React.useEffect(() => {
        if (!user || !user.id || !match.id) return;
        const fetchChallenges = async () => {
            setLoading(true);
            try {
                const challengesQuery = query(
                    collection(db, "notifications"),
                    where("userId", "==", user.id),
                    where("type", "==", "Challenge"),
                    where("payload.matchId", "==", match.id)
                );
                const snapshot = await getDocs(challengesQuery);
                const matchChallenges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));

                setChallenges(matchChallenges);
            } catch (e) {
                console.error("Error fetching challenges (check index)", e);
                toast({ variant: "destructive", title: "Query Error", description: "Could not fetch challenges. The database might need a specific index."});
            } finally {
                setLoading(false);
            }
        };
        fetchChallenges();
    }, [match.id, user, toast]);

    const handleResponse = async (notification: Notification, accepted: boolean) => {
        const { payload } = notification;
        const challengerTeamId = payload?.challengerTeamId;

        if (!payload || !payload.matchId || !challengerTeamId || !payload.challengerManagerId) {
            toast({ variant: "destructive", title: "Invalid Challenge Data", description: "This challenge notification is outdated or corrupted. It will be removed." });
            try {
                await deleteDoc(doc(db, "notifications", notification.id));
                onUpdate(); 
            } catch (error) {
                 console.error("Error deleting invalid notification:", error);
            }
            return;
        }
        
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", payload.matchId);
        
        batch.delete(doc(db, "notifications", notification.id));

        if (accepted) {
            const challengerTeamRef = doc(db, "teams", challengerTeamId);
            const challengerTeamSnap = await getDoc(challengerTeamRef);

            if (!challengerTeamSnap.exists()) {
                toast({ variant: "destructive", title: "Error", description: "Challenging team not found." });
                return;
            }
            const challengerTeam = challengerTeamSnap.data() as Team;

            batch.update(matchRef, {
                teamBRef: challengerTeamId,
                teamBPlayers: [], // Clear team B players as new ones will be invited
                status: "Scheduled",
                allowChallenges: false, 
            });
            
            const responseNotification: Omit<Notification, 'id'> = {
                userId: payload.challengerManagerId,
                message: `Your challenge for the game on ${format(new Date(match.date), 'MMM d')} was accepted!`,
                link: `/dashboard/games/${match.id}`,
                read: false,
                createdAt: serverTimestamp() as any,
                type: 'ChallengeResponse'
            };
            batch.set(doc(collection(db, "notifications")), responseNotification);

            if (challengerTeam.playerIds && challengerTeam.playerIds.length > 0) {
                 for (const playerId of challengerTeam.playerIds) {
                    const invitationRef = doc(collection(db, "matchInvitations"));
                    batch.set(invitationRef, {
                        matchId: match.id,
                        teamId: challengerTeamId, // Ensure this is always defined
                        playerId: playerId,
                        managerId: payload.challengerManagerId,
                        status: "pending",
                        invitedAt: serverTimestamp(),
                    });

                    const inviteNotificationRef = doc(collection(db, "notifications"));
                    batch.set(inviteNotificationRef, {
                        userId: playerId,
                        message: `You've been invited to a game with ${challengerTeam.name} against ${match.teamARef ? 'another team' : 'a team'}.`,
                        link: '/dashboard/my-games',
                        read: false,
                        createdAt: serverTimestamp() as any,
                    });
                }
            }

        } else {
             const responseNotification: Omit<Notification, 'id'> = {
                userId: payload.challengerManagerId,
                message: `Your challenge for the game on ${format(new Date(match.date), 'MMM d')} was not accepted.`,
                link: `/dashboard/my-games`,
                read: false,
                createdAt: serverTimestamp() as any,
                type: 'ChallengeResponse'
            };
            batch.set(doc(collection(db, "notifications")), responseNotification);
        }

        try {
            await batch.commit();
            toast({ title: `Challenge ${accepted ? 'Accepted' : 'Declined'}` });
            onUpdate();
        } catch (error) {
            console.error("Error responding to challenge:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not process challenge response." });
        }
    };
    
    if (!match.allowChallenges || match.teamBRef) {
        return null;
    }

    if (loading) {
        return <Card><CardHeader><CardTitle>Team Challenges</CardTitle></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>;
    }
    
    if (challenges.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2"><Swords /> Team Challenges ({challenges.length})</CardTitle>
                <CardDescription>Other teams want to play against you in this slot. Accept a challenge to schedule the match.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Challenging Team</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {challenges.map(challenge => (
                            <TableRow key={challenge.id}>
                                <TableCell className="font-medium">{challenge.payload?.challengerTeamName || "Unknown Team"}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="sm" variant="outline" onClick={() => handleResponse(challenge, true)}>
                                        <CheckCircle className="mr-2 h-4 w-4 text-green-600"/> Accept
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleResponse(challenge, false)}>
                                            <XCircle className="mr-2 h-4 w-4 text-red-600"/> Decline
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
