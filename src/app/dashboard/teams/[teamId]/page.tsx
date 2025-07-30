
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Team, PlayerProfile, TeamPlayer, User } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Trash2, UserPlus, Users } from "lucide-react";
import { useUser } from "@/hooks/use-user";

interface EnrichedTeamPlayer extends TeamPlayer {
  profile?: PlayerProfile;
}

export default function ManageTeamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const teamId = params.teamId as string;

  const [team, setTeam] = React.useState<Team | null>(null);
  const [players, setPlayers] = React.useState<EnrichedTeamPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newPlayerEmail, setNewPlayerEmail] = React.useState("");

  const fetchTeamData = React.useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      // Fetch team document
      const teamDocRef = doc(db, "teams", teamId);
      const teamDoc = await getDoc(teamDocRef);

      if (!teamDoc.exists()) {
        toast({ variant: "destructive", title: "Error", description: "Team not found." });
        router.push("/dashboard/teams");
        return;
      }
      
      const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
      setTeam(teamData);

      // Fetch player profiles
      if (teamData.players.length > 0) {
        const playerIds = teamData.players.map(p => p.playerId);
        if (playerIds.length === 0) {
            setPlayers([]);
        } else {
            const playerProfilesQuery = query(collection(db, "playerProfiles"), where("userRef", "in", playerIds));
            const playerProfilesSnapshot = await getDocs(playerProfilesQuery);
            const playerProfilesMap = new Map<string, PlayerProfile>();
            playerProfilesSnapshot.forEach(doc => {
                const profile = {id: doc.id, ...doc.data()} as PlayerProfile;
                playerProfilesMap.set(profile.userRef, profile);
            });
            
            const enrichedPlayers = teamData.players.map(p => ({
                ...p,
                profile: playerProfilesMap.get(p.playerId)
            }));
            setPlayers(enrichedPlayers);
        }
      } else {
        setPlayers([]);
      }

    } catch (error) {
      console.error("Error fetching team data:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch team data." });
    } finally {
      setLoading(false);
    }
  }, [teamId, router, toast]);

  React.useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const handleUpdateNumber = async (playerId: string, newNumber: number | null) => {
    if (!team) return;
    const updatedPlayers = team.players.map(p => 
      p.playerId === playerId ? { ...p, number: newNumber } : p
    );
    try {
      const teamDocRef = doc(db, "teams", teamId);
      await updateDoc(teamDocRef, { players: updatedPlayers });
      setTeam(prev => prev ? { ...prev, players: updatedPlayers } : null);
      setPlayers(current => current.map(p => p.playerId === playerId ? { ...p, number: newNumber } : p));
      toast({ title: "Success", description: "Player number updated." });
    } catch (error) {
      console.error("Error updating player number:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update player number." });
    }
  };

  const handleRemovePlayer = async (playerIdToRemove: string) => {
     if (!team) return;
     const updatedPlayers = team.players.filter(p => p.playerId !== playerIdToRemove);
     try {
        const teamDocRef = doc(db, "teams", teamId);
        await updateDoc(teamDocRef, { players: updatedPlayers });
        setPlayers(current => current.filter(p => p.playerId !== playerIdToRemove));
        setTeam(prev => prev ? { ...prev, players: updatedPlayers } : null);
        toast({ title: "Player Removed", description: "The player has been removed from the team." });
     } catch (error) {
        console.error("Error removing player:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to remove player." });
     }
  };

  const handleInvitePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerEmail.trim() || !team || !user) return;

    try {
        // 1. Find user by email
        const userQuery = query(collection(db, "users"), where("email", "==", newPlayerEmail.trim()), where("role", "==", "PLAYER"));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            toast({ variant: "destructive", title: "Not Found", description: "No player found with that email." });
            return;
        }

        const invitedUserDoc = userSnapshot.docs[0];
        const invitedUserId = invitedUserDoc.id;
        const invitedUserData = invitedUserDoc.data() as User;


        // 2. Check if player is already in the team
        if (team.players.some(p => p.playerId === invitedUserId)) {
            toast({ variant: "destructive", title: "Already on Team", description: "This player is already on your team." });
            return;
        }
        
        // 3. Check for existing pending invitation
        const invitationQuery = query(
            collection(db, "teamInvitations"),
            where("teamId", "==", teamId),
            where("playerId", "==", invitedUserId),
            where("status", "==", "pending")
        );
        const invitationSnapshot = await getDocs(invitationQuery);
        if (!invitationSnapshot.empty) {
            toast({ variant: "destructive", title: "Invitation exists", description: "An invitation has already been sent to this player." });
            return;
        }

        // 4. Create invitation document
        await addDoc(collection(db, "teamInvitations"), {
            teamId: teamId,
            teamName: team.name, // denormalize for easier display
            playerId: invitedUserId,
            playerName: invitedUserData.name, // denormalize
            managerId: user.id,
            status: "pending",
            invitedAt: serverTimestamp(),
        });


        toast({ title: "Invitation Sent!", description: `An invitation has been sent to ${invitedUserData.name}.` });
        setNewPlayerEmail("");

    } catch (error) {
         console.error("Error inviting player:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to send invitation." });
    }
  };


  if (loading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
  }

  if (!team) {
    return <div>Team not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/teams">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Teams
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center justify-between">
            <span>Manage: {team.name}</span>
            <div className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                <Users className="h-5 w-5" />
                <span>{players.length} Players</span>
            </div>
          </CardTitle>
          <CardDescription>Invite players, edit their numbers, and view their status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            {/* Player List */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Player Name</TableHead>
                        <TableHead className="w-[120px]">Number</TableHead>
                        <TableHead className="w-[180px]">Payment Status</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {players.length > 0 ? players.map(({ playerId, number, profile }) => (
                        <TableRow key={playerId}>
                            <TableCell className="font-medium">{profile?.nickname ?? "Unknown Player"}</TableCell>
                            <TableCell>
                                <Input 
                                    type="number" 
                                    defaultValue={number ?? ""}
                                    onBlur={(e) => handleUpdateNumber(playerId, e.target.value ? parseInt(e.target.value) : null)}
                                    className="h-8"
                                />
                            </TableCell>
                            <TableCell>
                                {/* Placeholder */}
                                <Badge variant="outline">Up to date</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRemovePlayer(playerId)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                No players on this team yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            
            {/* Invite Player Form */}
            <div>
                <h3 className="text-lg font-semibold font-headline mb-2">Invite New Player</h3>
                <form onSubmit={handleInvitePlayer} className="flex items-center gap-2">
                    <Input 
                        type="email" 
                        placeholder="Enter player's email address..."
                        value={newPlayerEmail}
                        onChange={(e) => setNewPlayerEmail(e.target.value)}
                    />
                    <Button type="submit">
                        <UserPlus className="mr-2" /> Invite Player
                    </Button>
                </form>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
