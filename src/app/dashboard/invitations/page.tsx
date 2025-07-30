
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, arrayUnion, writeBatch } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { TeamInvitation } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function InvitationsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [invitations, setInvitations] = React.useState<TeamInvitation[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || user.role !== 'PLAYER') {
        setLoading(false);
        return;
    };

    setLoading(true);
    const q = query(
        collection(db, "teamInvitations"), 
        where("playerId", "==", user.id),
        where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const invitationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamInvitation));
      setInvitations(invitationsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching invitations: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch your invitations." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleInvitationResponse = async (invitationId: string, teamId: string, accepted: boolean) => {
    if (!user) return;

    const invitationRef = doc(db, "teamInvitations", invitationId);
    const teamRef = doc(db, "teams", teamId);

    try {
        if (accepted) {
            // Use a batch write to perform both updates atomically
            const batch = writeBatch(db);

            // 1. Add player to the team's player list
            batch.update(teamRef, { 
                players: arrayUnion({ playerId: user.id, number: null }) 
            });

            // 2. Update the invitation status
            batch.update(invitationRef, { status: "accepted" });

            await batch.commit();

            toast({
                title: "Invitation Accepted!",
                description: "You have successfully joined the team.",
            });
        } else {
            // Just update the invitation status to declined
            await updateDoc(invitationRef, { status: "declined" });
            toast({
                title: "Invitation Declined",
                description: "You have declined the invitation to join the team.",
            });
        }
    } catch (error) {
        console.error("Error responding to invitation:", error);
        toast({ variant: "destructive", title: "Error", description: "There was a problem responding to the invitation." });
    }
    // The onSnapshot listener will automatically remove the invitation from the list
  };
  
  const InvitationCard = ({ invitation }: { invitation: TeamInvitation }) => (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Invitation to join {invitation.teamName}</CardTitle>
        <CardDescription>
          Invited {invitation.invitedAt ? formatDistanceToNow(new Date(invitation.invitedAt.seconds * 1000), { addSuffix: true }) : 'recently'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">You have been invited to become a member of this team. Do you want to accept?</p>
      </CardContent>
       <CardFooter className="gap-2">
          <Button size="sm" onClick={() => handleInvitationResponse(invitation.id, invitation.teamId, true)}>
             <Check className="mr-2 h-4 w-4" /> Accept
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleInvitationResponse(invitation.id, invitation.teamId, false)}>
             <X className="mr-2 h-4 w-4" /> Decline
          </Button>
        </CardFooter>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Invitations</h1>
        <p className="text-muted-foreground">
          View and respond to team invitations.
        </p>
      </div>

       {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </div>
        ) : invitations.length > 0 ? (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
              {invitations.map(inv => <InvitationCard key={inv.id} invitation={inv} />)}
             </div>
        ) : (
            <Card className="mt-4 flex flex-col items-center justify-center p-12 text-center">
                <CardHeader>
                    <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                    <CardTitle className="font-headline mt-4">No Pending Invitations</CardTitle>
                    <CardDescription>You don't have any team invitations at the moment.</CardDescription>
                </CardHeader>
            </Card>
        )}
    </div>
  );
}
