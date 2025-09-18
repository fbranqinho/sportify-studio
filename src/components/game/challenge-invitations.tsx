

"use client";

import * as React from "react";
import { doc, getDocs, collection, query, where, writeBatch, serverTimestamp, deleteDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Notification, Team, TeamInvitation } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Swords } from "lucide-react";
import { format } from "date-fns";

export function ChallengeInvitations({ match, onUpdate }: { match: Match; onUpdate: () => void }) {
    const [invitations, setInvitations] = React.useState<TeamInvitation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();
    const { user } = useUser();

    React.useEffect(() => {
        if (!user || !user.id || !match.id) return;
        const fetchChallenges = async () => {
            setLoading(true);
            try {
                // This is a secure query: it only fetches invitations for the current manager's team for this specific match.
                const q = query(
                    collection(db, "teamInvitations"),
                    where("matchId", "==", match.id),
                    where("managerId", "==", user.id),
                    where("status", "==", "pending")
                );
                const snapshot = await getDocs(q);
                const teamChallenges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamInvitation));
                setInvitations(teamChallenges);
            } catch (e) {
                console.error("Error fetching team challenges:", e);
                toast({ variant: "destructive", title: "Query Error", description: "Could not fetch team challenges."});
            } finally {
                setLoading(false);
            }
        };
        if (match.status === 'Collecting players') {
            fetchChallenges();
        } else {
             setLoading(false);
        }
    }, [match.id, match.status, user, toast]);

    const handleResponse = async (invitation: TeamInvitation, accepted: boolean) => {
        if (!user?.id) return;
        
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", match.id);
        const invitationRef = doc(db, "teamInvitations", invitation.id);

        batch.update(invitationRef, { status: accepted ? "accepted" : "declined" });

        if (accepted) {
             batch.update(matchRef, {
                teamBRef: invitation.teamId,
                status: "Scheduled",
            });
            // Here you could notify the inviting manager that their challenge was accepted.
        } else {
            // If declined, simply update the invitation. The inviting manager can see the status.
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
    
    if (loading) {
        return <Card><CardHeader><CardTitle>Team Challenges</CardTitle></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>;
    }
    
    if (invitations.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2"><Swords /> Team Challenges ({invitations.length})</CardTitle>
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
                        {invitations.map(invitation => (
                            <TableRow key={invitation.id}>
                                <TableCell className="font-medium">{invitation.teamName || "Unknown Team"}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="sm" variant="outline" onClick={() => handleResponse(invitation, true)}>
                                        <CheckCircle className="mr-2 h-4 w-4 text-green-600"/> Accept
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleResponse(invitation, false)}>
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
