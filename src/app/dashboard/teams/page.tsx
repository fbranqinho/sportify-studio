
"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, arrayUnion, serverTimestamp, getDocs } from "firebase/firestore";
import type { Team, TeamInvitation, PlayerProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users, MapPin, ChevronRight, Check, X, Mail, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

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
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
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
              <CardContent className="flex-grow space-y-4">
                 <div className="text-sm text-muted-foreground italic">&quot;{team.motto}&quot;</div>
                 <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold">Record (W-D-L)</span>
                        <span className="font-mono font-bold">{team.wins}-{team.draws}-{team.losses}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold">Recent Form</span>
                         <div className="flex items-center gap-1">
                            {(team.recentForm && team.recentForm.length > 0) ? (
                                team.recentForm.slice(0, 5).map((form, i) => (
                                    <Badge
                                    key={i}
                                    className={
                                        form === "W"
                                        ? "bg-green-500 hover:bg-green-500 text-white"
                                        : form === "L"
                                        ? "bg-red-500 hover:bg-red-500 text-white"
                                        : "bg-gray-400 hover:bg-gray-400 text-white"
                                    }
                                    >
                                    {form}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground">No games played</span>
                            )}
                        </div>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold">Players</span>
                        <span className="font-bold">{team.playerIds?.length || 0}</span>
                    </div>
                 </div>

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

  React.useEffect(() => {
    if (!user || user.role !== 'PLAYER') {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    
    // Fetch Invitations
    const invitationsQuery = query(
      collection(db, "teamInvitations"),
      where("playerId", "==", user.id),
      where("status", "==", "pending")
    );
    const unsubscribeInvitations = onSnapshot(invitationsQuery, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamInvitation)));
      if (loading) setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });

    // Fetch Teams
    const teamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));
    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      if (loading) setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });
    
    return () => {
        unsubscribeInvitations();
        unsubscribeTeams();
    };
  }, [user, loading]);


  const handleInvitationResponse = async (invitation: TeamInvitation, accepted: boolean) => {
    if (!user) return;
    const { id: invitationId, teamId, teamName } = invitation;

    const batch = writeBatch(db);
    
    // Update invitation status
    const invitationRef = doc(db, "teamInvitations", invitationId);
    batch.update(invitationRef, { status: accepted ? "accepted" : "declined", respondedAt: serverTimestamp() });
    
    // If accepted, add player to team
    if (accepted) {
      try {
        const teamRef = doc(db, "teams", teamId);
        batch.update(teamRef, {
          playerIds: arrayUnion(user.id),
          players: arrayUnion({ playerId: user.id, number: null })
        });
        
        await batch.commit();
        toast({ title: "Invitation Accepted!", description: `You have joined ${teamName}.` });

      } catch (error) {
        console.error("Error accepting invitation:", error);
        toast({ variant: "destructive", title: "Error", description: "There was a problem accepting the invitation." });
      }
    } else {
        // Just decline the invitation
        await batch.commit();
        toast({ title: "Invitation Declined", description: `You have declined the invitation to join ${teamName}.` });
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {loading ? (
              <Skeleton className="h-48" />
          ) : invitations.length > 0 ? (
              invitations.map(inv => <InvitationCard key={inv.id} invitation={inv} />)
          ) : (
            <Card className="md:col-span-3 flex flex-col items-center justify-center p-12 text-center">
                <CardHeader>
                    <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                    <CardTitle className="font-headline mt-4">No Pending Invitations</CardTitle>
                    <CardDescription>You don't have any team invitations at the moment.</CardDescription>
                </CardHeader>
            </Card>
          )}
        </div>
      </div>

      {/* My Teams Section */}
      <div className="border-t pt-8">
        <h1 className="text-3xl font-bold font-headline">My Teams</h1>
        <p className="text-muted-foreground">All the teams you are currently a part of.</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {loading ? (
            <>
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </>
          ) : teams.length > 0 ? (
              teams.map((team) => (
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
                              <span className="font-semibold">{team.playerIds?.length || 0}</span> players
                          </span>
                          </div>
                          <p className="text-muted-foreground italic">&quot;{team.motto}&quot;</p>
                      </CardContent>
                      <CardFooter>
                            <Button asChild variant="outline" className="w-full">
                              <Link href={`/dashboard/teams/${team.id}`}>View Team</Link>
                            </Button>
                      </CardFooter>
                    </Card>
              ))
          ) : (
            <Card className="md:col-span-3 flex flex-col items-center justify-center p-12 text-center">
              <CardHeader>
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <CardTitle className="font-headline mt-4">No Teams Yet</CardTitle>
                  <CardDescription>You are not yet part of any team. Accept an invitation or ask a manager to invite you.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
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
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
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
