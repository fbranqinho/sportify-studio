
"use client";

import * as React from "react";
import { doc, getDocs, collection, query, where, writeBatch, serverTimestamp, arrayRemove, arrayUnion, documentId, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, User, Notification, Pitch } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Inbox } from "lucide-react";
import { format } from "date-fns";
import { getPlayerCapacity } from "@/lib/utils";

export function PlayerApplications({ match, onUpdate }: { match: Match; onUpdate: () => void }) {
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

        batch.update(matchRef, { playerApplications: arrayRemove(applicantId) });
        
        let notificationMessage = `Your application for the game on ${format(new Date(match.date), "MMM d")} was not accepted.`;
        let notificationLink = '/dashboard/my-games';
        
        if (accepted) {
            batch.update(matchRef, { teamAPlayers: arrayUnion(applicantId) });
            notificationMessage = `You're in! Your application for the game on ${format(new Date(match.date), "MMM d")} was accepted.`;
        }

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

            // --- NEW: Check if the match is now full and update its status ---
            if (accepted) {
                const updatedMatchSnap = await getDoc(matchRef);
                const updatedMatchData = updatedMatchSnap.data() as Match;
                const pitchSnap = await getDoc(doc(db, "pitches", updatedMatchData.pitchRef));
                const pitchData = pitchSnap.data() as Pitch;

                const minPlayers = getPlayerCapacity(pitchData?.sport);
                const currentPlayers = (updatedMatchData.teamAPlayers?.length || 0) + (updatedMatchData.teamBPlayers?.length || 0);

                if (currentPlayers >= minPlayers) {
                    await updateDoc(matchRef, { status: 'Scheduled' });
                    toast({ title: "Team is ready!", description: "Minimum player count reached. The game is now scheduled." });
                } else {
                    toast({ title: `Application ${accepted ? 'Accepted' : 'Declined'}`, description: `The player has been notified.` });
                }
            } else {
                 toast({ title: "Application Declined", description: `The player has been notified.` });
            }
            onUpdate();

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
