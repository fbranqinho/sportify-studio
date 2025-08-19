
"use client";

import * as React from "react";
import type { Team, EnrichedPlayerSearchResult } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, Users, Search, X } from "lucide-react";

interface EnrichedTeamPlayer {
    playerId: string;
    number: number | null;
    profile?: { nickname?: string };
    user?: { name?: string, email?: string };
}

export function ManagerTeamView({ team, players, onPlayerRemoved, onNumberUpdated, onPlayerInvited }: { 
    team: Team, 
    players: EnrichedTeamPlayer[],
    onPlayerRemoved: (playerId: string) => void,
    onNumberUpdated: (playerId: string, newNumber: number | null) => void,
    onPlayerInvited: (player: EnrichedPlayerSearchResult) => void,
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<EnrichedPlayerSearchResult[]>([]);
  const { toast } = useToast();

  const assignedNumbers = React.useMemo(() => 
    players.map(p => p.number).filter((n): n is number => n !== null),
  [players]);

  const getAvailableNumbers = (currentNumber: number | null) => {
    const available = Array.from({ length: 99 }, (_, i) => i + 1);
    const otherAssignedNumbers = assignedNumbers.filter(n => n !== currentNumber);
    return available.filter(n => !otherAssignedNumbers.includes(n));
  };
  
  const handleSearchPlayers = async (queryText: string) => {
    setSearchQuery(queryText);
    const searchTerm = queryText.trim().toLowerCase();

    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
        const usersSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "PLAYER")));
        const allPlayers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const foundUsers = allPlayers.filter(player => 
            player.name.toLowerCase().includes(searchTerm)
        );

        const playerUserIds = foundUsers.map(u => u.id);
        
        if(playerUserIds.length === 0){
             setSearchResults([]);
             setIsSearching(false);
             return;
        }

        const profilesQuery = query(collection(db, "playerProfiles"), where("userRef", "in", playerUserIds));
        const profilesSnapshot = await getDocs(profilesQuery);

        const profilesMap = new Map<string, any>();
        profilesSnapshot.forEach(doc => {
            const profile = { id: doc.id, ...doc.data() };
            profilesMap.set(profile.userRef, profile);
        });

        const results: EnrichedPlayerSearchResult[] = foundUsers.map(user => {
            const profile = profilesMap.get(user.id);
            return profile ? { user, profile } : null;
        }).filter((item): item is EnrichedPlayerSearchResult => !!item);

        setSearchResults(results);

    } catch (error) {
        console.error("Error searching players:", error);
        toast({ variant: "destructive", title: "Search Error", description: "Could not perform search. The database index might still be building." });
    } finally {
        setIsSearching(false);
    }
  };
  
  const capitalize = (s?: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  
  return (
    <div className="space-y-6">
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
                        {players.length > 0 ? players.map(({ playerId, number, profile, user }) => (
                            <TableRow key={playerId}>
                                <TableCell className="font-medium">{profile?.nickname ? capitalize(profile.nickname) : (user?.name || "Unknown Player")}</TableCell>
                                <TableCell>
                                    <Select
                                        value={number?.toString() ?? "unassigned"}
                                        onValueChange={(value) => onNumberUpdated(playerId, value === "unassigned" ? null : parseInt(value))}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="-" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">-</SelectItem>
                                            {getAvailableNumbers(number).map(n => (
                                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                            placeholder="Search for players by name..."
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
                                                <div className="font-medium">{result.user.name}</div>
                                                <div className="text-xs text-muted-foreground">{capitalize(result.profile.nickname)} ({result.user.email})</div>
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
