
"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, arrayUnion, getDocs, arrayRemove } from "firebase/firestore";
import type { Team, TeamInvitation, ManagerProfile, User } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users, MapPin, ChevronRight, Check, X, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// --- Sub-components for different roles ---

function ManagerTeamsView() {
  const { user } = useUser();
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || user.role !== 'MANAGER') {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "teams"), where("managerId", "==", user.id));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const teamsData: Team[] = [];
      querySnapshot.forEach((doc) => {
        teamsData.push({ id: doc.id, ...doc.data() } as Team);
      });
      setTeams(teamsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teams:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">My Teams</h1>
          <p className="text-muted-foreground">View, create, and manage your teams.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/teams/new">
            <PlusCircle className="mr-2" />
            Create New Team
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : teams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline">{team.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                  <MapPin className="h-4 w-4" /> {team.city}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>
                    <span className="font-semibold">{team.playerIds.length}</span> players
                  </span>
                </div>
                 <p className="text-muted-foreground italic">&quot;{team.motto}&quot;</p>
              </CardContent>
              <CardFooter>
                 <Button asChild variant="outline" className="w-full justify-between">
                    <Link href={`/dashboard/teams/${team.id}`}>
                      Manage Team <ChevronRight className="h-4 w-4" />
                    </Link>
                 </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <CardHeader>
            <CardTitle className="font-headline">No Teams Found</CardTitle>
            <CardDescription>You haven't created any teams yet. Get started now!</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href="/dashboard/teams/new">
                    <PlusCircle className="mr-2" />
                    Create Your First Team
                </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function PlayerTeamsView() {
  const { user } = useUser();
  const { toast } = useToast();
  const [invitations, setInvitations] = React.useState<TeamInvitation[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch Invitations
  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "teamInvitations"),
      where("playerId", "==", user.id),
      where("status", "==", "pending")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamInvitation)));
    });
    return unsubscribe;
  }, [user]);

  // Fetch Teams
  React.useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q2 = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));

    const unsubscribe = onSnapshot(q2, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, [user]);


  const handleInvitationResponse = async (invitation: TeamInvitation, accepted: boolean) => {
    if (!user) return;
    const { id: invitationId, teamId } = invitation;
    const invitationRef = doc(db, "teamInvitations", invitationId);
    const teamRef = doc(db, "teams", teamId);
    
    try {
      const batch = writeBatch(db);
      
      batch.update(invitationRef, { status: accepted ? "accepted" : "declined", respondedAt: new Date() });

      if (accepted) {
        batch.update(teamRef, {
          playerIds: arrayUnion(user.id),
          players: arrayUnion({playerId: user.id, number: null})
        });
        toast({ title: "Invitation Accepted!", description: `You have joined ${invitation.teamName}.` });
      } else {
        toast({ title: "Invitation Declined", description: `You have declined the invitation to join ${invitation.teamName}.` });
      }
      
      await batch.commit();

    } catch (error) {
      console.error("Error responding to invitation:", error);
      toast({ variant: "destructive", title: "Error", description: "There was a problem responding." });
    }
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
        <p className="text-sm">You have been invited by the manager to join this team.</p>
      </CardContent>
       <CardFooter className="gap-2">
          <Button size="sm" onClick={() => handleInvitationResponse(invitation, true)}>
             <Check className="mr-2 h-4 w-4" /> Accept
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleInvitationResponse(invitation, false)}>
             <X className="mr-2 h-4 w-4" /> Decline
          </Button>
        </CardFooter>
    </Card>
  )

  return (
    <div className="space-y-8">
        {/* Invitations Section */}
        <div>
            <h1 className="text-3xl font-bold font-headline">Team Invitations</h1>
            <p className="text-muted-foreground">Respond to invitations to join new teams.</p>
            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
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

        <div className="border-t pt-8">
             <h1 className="text-3xl font-bold font-headline">My Teams</h1>
             <p className="text-muted-foreground">All the teams you are currently a part of.</p>
             {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
             ) : teams.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                    {teams.map((team) => (
                         <Card key={team.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="font-headline">{team.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2 pt-1">
                                <MapPin className="h-4 w-4" /> {team.city}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                <span>
                                    <span className="font-semibold">{team.playerIds.length}</span> players
                                </span>
                                </div>
                                <p className="text-muted-foreground italic">&quot;{team.motto}&quot;</p>
                            </CardContent>
                            <CardFooter>
                                 <Button variant="outline" className="w-full">View Team</Button>
                            </CardFooter>
                         </Card>
                    ))}
                </div>
             ) : (
                 <Card className="mt-4 flex flex-col items-center justify-center p-12 text-center">
                    <CardHeader>
                        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                        <CardTitle className="font-headline mt-4">No Teams Yet</CardTitle>
                        <CardDescription>You are not yet part of any team. Accept an invitation or ask a manager to invite you.</CardDescription>
                    </CardHeader>
                </Card>
             )}
        </div>
    </div>
  )
}

export default function TeamsPage() {
  const { user, loading } = useUser();

  if (loading) {
     return (
         <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full" />
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
     )
  }

  if (user?.role === 'PLAYER') {
    return <PlayerTeamsView />;
  }
  
  if(user?.role === 'MANAGER'){
    return <ManagerTeamsView />;
  }

  // Fallback for other roles or if user is not loaded
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Teams</CardTitle>
        <CardDescription>This section is for Players and Managers.</CardDescription>
      </CardHeader>
    </Card>
  )
}
