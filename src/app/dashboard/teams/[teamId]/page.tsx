
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Team, PlayerProfile, TeamPlayer, User, EnrichedPlayerSearchResult } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Trash2, UserPlus, Users, Search, X, ShieldCheck, Goal, Square, MapPin } from "lucide-react";
import { useUser } from "@/hooks/use-user";

interface EnrichedTeamPlayer extends TeamPlayer {
  profile?: PlayerProfile;
}

// --- Shared Components ---

function TeamHeader({ team }: { team: Team }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-3xl">{team.name}</CardTitle>
        <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 pt-2">
            <span>Motto: &quot;{team.motto}&quot;</span>
            <span className="hidden sm:inline">|</span>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{team.city}</span>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function TeamStats({ team }: { team: Team }) {
   return (
    <div className="grid gap-4 md:grid-cols-3">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Form</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-1">
                    <Badge className="bg-green-500 hover:bg-green-500 text-white">W</Badge>
                    <Badge className="bg-red-500 hover:bg-red-500 text-white">L</Badge>
                    <Badge className="bg-green-500 hover:bg-green-500 text-white">W</Badge>
                    <Badge className="bg-gray-400 hover:bg-gray-400 text-white">D</Badge>
                    <Badge className="bg-green-500 hover:bg-green-500 text-white">W</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Last 5 matches</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Team Goals</CardTitle>
            <Goal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{team.wins * 3 + team.draws}</div>
            <p className="text-xs text-muted-foreground">Goals Scored this season</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Discipline</CardTitle>
            <Square className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-xl font-bold">{team.yellowCards} <span className="text-sm font-normal">Yellows</span></div>
            <div className="text-xl font-bold">{team.redCards} <span className="text-sm font-normal">Reds</span></div>
            </CardContent>
        </Card>
    </div>
  )
}

// --- Player-focused View Component ---
function PlayerTeamView({ team, players }: { team: Team, players: EnrichedTeamPlayer[] }) {
  return (
    <div className="space-y-6">
       <TeamHeader team={team} />
       <TeamStats team={team} />

       <Card>
          <CardHeader>
             <CardTitle className="font-headline">Team Roster</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
                <TableHeader>
                   <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="w-[100px] text-center">Number</TableHead>
                      <TableHead className="text-right">Position</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {players.map(({ playerId, number, profile }) => (
                      <TableRow key={playerId}>
                         <TableCell className="font-medium">{profile?.nickname ?? "Unknown"}</TableCell>
                         <TableCell className="text-center font-mono">{number ?? "-"}</TableCell>
                         <TableCell className="text-right">{profile?.position ?? "N/A"}</TableCell>
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
          </CardContent>
       </Card>
    </div>
  )
}


// --- Manager-focused View Component ---
function ManagerTeamView({ team, players, onPlayerRemoved, onNumberUpdated, onPlayerInvited, teamId }: { 
    team: Team, 
    players: EnrichedTeamPlayer[],
    onPlayerRemoved: (playerId: string) => void,
    onNumberUpdated: (playerId: string, newNumber: number | null) => void,
    onPlayerInvited: (player: EnrichedPlayerSearchResult) => void,
    teamId: string
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<EnrichedPlayerSearchResult[]>([]);
  const { toast } = useToast();
  
  const handleSearchPlayers = async (queryText: string) => {
    setSearchQuery(queryText);
    const searchTerm = queryText.trim().toLowerCase();

    if (searchTerm.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    try {
        const profilesQuery = query(
            collection(db, "playerProfiles"),
            where("nickname", ">=", searchTerm),
            where("nickname", "<=", searchTerm + '\uf8ff')
        );
        const profilesSnapshot = await getDocs(profilesQuery);
        
        if (profilesSnapshot.empty) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const playerUserRefs = profilesSnapshot.docs.map(d => d.data().userRef);
        if(playerUserRefs.length === 0){
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        
        const usersQuery = query(collection(db, "users"), where(documentId(), "in", playerUserRefs));
        const usersSnapshot = await getDocs(usersQuery);
        const usersMap = new Map<string, User>();
        usersSnapshot.forEach(doc => usersMap.set(doc.id, {id: doc.id, ...doc.data()} as User));

        const results: EnrichedPlayerSearchResult[] = profilesSnapshot.docs.map(doc => {
            const profile = { id: doc.id, ...doc.data() } as PlayerProfile;
            return {
                profile,
                user: usersMap.get(profile.userRef)
            }
        }).filter(item => item.user);

        setSearchResults(results as EnrichedPlayerSearchResult[]);

    } catch (error) {
        console.error("Error searching players:", error);
        toast({ variant: "destructive", title: "Search Error", description: "Could not perform search." });
    } finally {
        setIsSearching(false);
    }
  };
  
  return (
    <div className="space-y-6">
        <TeamHeader team={team} />
        <TeamStats team={team} />
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center justify-between">
                <span>Manage Roster</span>
                <div className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                    <Users className="h-5 w-5" />
                    <span>{players.length} Players</span>
                </div>
                </CardTitle>
                <CardDescription>Invite players, edit their numbers, and view their status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
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
                                        onBlur={(e) => onNumberUpdated(playerId, e.target.value ? parseInt(e.target.value) : null)}
                                        className="h-8"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">Up to date</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onPlayerRemoved(playerId)}>
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
                
                <div>
                    <h3 className="text-lg font-semibold font-headline mb-2">Invite New Player</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search for players by nickname..."
                            value={searchQuery}
                            onChange={(e) => handleSearchPlayers(e.target.value)}
                            className="pl-10"
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSearchResults([]);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {isSearching ? (
                        <div className="mt-2 text-sm text-muted-foreground">Searching...</div>
                    ) : searchResults.length > 0 ? (
                        <div className="mt-2 border rounded-md max-h-60 overflow-y-auto">
                            <Table>
                                <TableBody>
                                    {searchResults.map((result) => (
                                        <TableRow key={result.user.id}>
                                            <TableCell>
                                                <div className="font-medium">{result.profile.nickname}</div>
                                                <div className="text-xs text-muted-foreground">{result.user.name} ({result.user.email})</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => onPlayerInvited(result)}>
                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                    Invite
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : searchQuery && !isSearching ? (
                        <div className="mt-2 text-sm text-muted-foreground text-center py-4">No players found.</div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    </div>
  )
}

// --- Main Page Component ---
export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const teamId = params.teamId as string;

  const [team, setTeam] = React.useState<Team | null>(null);
  const [players, setPlayers] = React.useState<EnrichedTeamPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const fetchTeamData = React.useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const teamDocRef = doc(db, "teams", teamId);
      const teamDoc = await getDoc(teamDocRef);

      if (!teamDoc.exists()) {
        toast({ variant: "destructive", title: "Error", description: "Team not found." });
        router.push("/dashboard/teams");
        return;
      }
      
      const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
      setTeam(teamData);

      if (teamData.playerIds && teamData.playerIds.length > 0) {
          const playerProfilesQuery = query(collection(db, "playerProfiles"), where("userRef", "in", teamData.playerIds));
          const playerProfilesSnapshot = await getDocs(playerProfilesQuery);
          const playerProfilesMap = new Map<string, PlayerProfile>();
          playerProfilesSnapshot.forEach(doc => {
              const profile = {id: doc.id, ...doc.data()} as PlayerProfile;
              playerProfilesMap.set(profile.userRef, profile);
          });
          
          const enrichedPlayers = teamData.players.map(p => ({
              ...p,
              profile: playerProfilesMap.get(p.playerId)
          })).sort((a,b) => (a.number ?? 999) - (b.number ?? 999));
          setPlayers(enrichedPlayers);
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
      setPlayers(current => current.map(p => p.playerId === playerId ? { ...p, number: newNumber } : p).sort((a,b) => (a.number ?? 999) - (b.number ?? 999)));
      setTeam(prev => prev ? { ...prev, players: updatedPlayers } : null);
      toast({ title: "Success", description: "Player number updated." });
    } catch (error) {
      console.error("Error updating player number:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update player number." });
    }
  };

  const handleRemovePlayer = async (playerIdToRemove: string) => {
     if (!team) return;
     const updatedPlayers = team.players.filter(p => p.playerId !== playerIdToRemove);
     const updatedPlayerIds = team.playerIds.filter(id => id !== playerIdToRemove);
     try {
        const teamDocRef = doc(db, "teams", teamId);
        await updateDoc(teamDocRef, { 
            players: updatedPlayers,
            playerIds: updatedPlayerIds 
        });
        setPlayers(current => current.filter(p => p.playerId !== playerIdToRemove));
        setTeam(prev => prev ? { ...prev, players: updatedPlayers, playerIds: updatedPlayerIds } : null);
        toast({ title: "Player Removed", description: "The player has been removed from the team." });
     } catch (error) {
        console.error("Error removing player:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to remove player." });
     }
  };

  const handleInvitePlayer = async (playerToInvite: EnrichedPlayerSearchResult) => {
    if (!team || !user) return;
    const invitedUserId = playerToInvite.user.id;
    try {
        if (team.playerIds?.includes(invitedUserId)) {
            toast({ variant: "destructive", title: "Already on Team", description: `${playerToInvite.user.name} is already on your team.` });
            return;
        }
        const invitationQuery = query(
            collection(db, "teamInvitations"),
            where("teamId", "==", teamId),
            where("playerId", "==", invitedUserId),
            where("status", "==", "pending")
        );
        const invitationSnapshot = await getDocs(invitationQuery);
        if (!invitationSnapshot.empty) {
            toast({ variant: "destructive", title: "Invitation Exists", description: `An invitation has already been sent to ${playerToInvite.user.name}.` });
            return;
        }
        await addDoc(collection(db, "teamInvitations"), {
            teamId: teamId,
            teamName: team.name,
            playerId: invitedUserId,
            playerName: playerToInvite.user.name,
            managerId: user.id,
            status: "pending",
            invitedAt: serverTimestamp(),
        });
        toast({ title: "Invitation Sent!", description: `An invitation has been sent to ${playerToInvite.user.name}.` });
    } catch (error) {
         console.error("Error inviting player:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to send invitation." });
    }
  };

  if (loading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full" />
            <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  if (!team) {
    return <div>Team not found.</div>;
  }

  // Determine which view to render based on user role
  const isManager = user?.id === team.managerId;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/teams">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Teams
        </Link>
      </Button>

      {isManager ? (
        <ManagerTeamView 
            team={team} 
            players={players} 
            onPlayerRemoved={handleRemovePlayer} 
            onNumberUpdated={handleUpdateNumber}
            onPlayerInvited={handleInvitePlayer}
            teamId={teamId}
        />
      ) : (
        <PlayerTeamView team={team} players={players} />
      )}
    </div>
  );
}

    