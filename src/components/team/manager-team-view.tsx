
"use client";

import * as React from "react";
import type { Team, EnrichedPlayerSearchResult, PlayerProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, documentId, startAt, endAt, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, Users, Search, X, Footprints, Square, Goal, Save } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";


interface EnrichedTeamPlayer {
    playerId: string;
    number: number | null;
    profile: PlayerProfile;
    user: { name?: string, email?: string };
}

export function ManagerTeamView({ team, players, onPlayerRemoved, onBulkNumberUpdate, onPlayerInvited }: { 
    team: Team, 
    players: EnrichedTeamPlayer[],
    onPlayerRemoved: (playerId: string) => void,
    onBulkNumberUpdate: (numberChanges: Map<string, number | null>) => Promise<void>,
    onPlayerInvited: (player: EnrichedPlayerSearchResult) => void,
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<EnrichedPlayerSearchResult[]>([]);
  const { toast } = useToast();
  
  const [numberChanges, setNumberChanges] = React.useState<Map<string, number | null>>(new Map());

  const handleLocalNumberChange = (playerId: string, newNumber: number | null) => {
    setNumberChanges(prev => new Map(prev).set(playerId, newNumber));
  };
  
  const handleSaveChanges = async () => {
    await onBulkNumberUpdate(numberChanges);
    setNumberChanges(new Map());
  };

  const isSaveDisabled = numberChanges.size === 0;

  const assignedNumbers = React.useMemo(() => {
    const currentNumbers = new Map<string, number | null>();
    players.forEach(p => {
        currentNumbers.set(p.playerId, p.number);
    });
    numberChanges.forEach((value, key) => {
        currentNumbers.set(key, value);
    });
    return Array.from(currentNumbers.values()).filter((n): n is number => n !== null);
  }, [players, numberChanges]);


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
        const profilesQuery = query(
            collection(db, "playerProfiles"), 
            orderBy("nickname"),
            startAt(searchTerm),
            endAt(searchTerm + '\uf8ff')
        );
        const profilesSnapshot = await getDocs(profilesQuery);

        const foundProfiles = profilesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as PlayerProfile);
        const playerUserIds = foundProfiles.map(p => p.userRef);
        
        if(playerUserIds.length === 0){
             setSearchResults([]);
             setIsSearching(false);
             return;
        }

        const usersQuery = query(collection(db, "users"), where(documentId(), "in", playerUserIds));
        const usersSnapshot = await getDocs(usersQuery);

        const usersMap = new Map<string, any>();
        usersSnapshot.forEach(doc => {
            usersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const results: EnrichedPlayerSearchResult[] = foundProfiles.map(profile => {
            const user = usersMap.get(profile.userRef);
            return user ? { user, profile } : null;
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
                <div className="flex items-center gap-4">
                    <span>Manage Roster</span>
                    <div className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                        <Users className="h-5 w-5" />
                        <span>{players.length} Players</span>
                    </div>
                </div>
                <Button onClick={handleSaveChanges} disabled={isSaveDisabled}>
                    <Save className="mr-2 h-4 w-4"/>
                    Save Numbers
                </Button>
                </CardTitle>
                <CardDescription>Invite players, edit their numbers, and view their status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead className="w-[100px]">#</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Foot</TableHead>
                            <TableHead>Form</TableHead>
                            <TableHead>Games</TableHead>
                            <TableHead>Goals</TableHead>
                            <TableHead>Asst</TableHead>
                            <TableHead>Cards</TableHead>
                            <TableHead className="text-right w-[60px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {players.length > 0 ? players.map(({ playerId, number, profile, user }) => {
                          const currentNumber = numberChanges.get(playerId) ?? number;
                          const gamesPlayed = (profile.victories || 0) + (profile.defeats || 0) + (profile.draws || 0);
                          return(
                            <TableRow key={playerId}>
                                <TableCell className="font-medium">{profile?.nickname ? capitalize(profile.nickname) : (user?.name || "Unknown Player")}</TableCell>
                                <TableCell>
                                    <Select
                                        value={currentNumber?.toString() ?? "unassigned"}
                                        onValueChange={(value) => handleLocalNumberChange(playerId, value === "unassigned" ? null : parseInt(value))}
                                    >
                                        <SelectTrigger className="h-8 w-[60px]">
                                            <SelectValue placeholder="-" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">-</SelectItem>
                                            {getAvailableNumbers(currentNumber).map(n => (
                                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>{profile.position}</TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Footprints className="h-5 w-5" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{capitalize(profile.dominantFoot)}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell>
                                   <div className="flex gap-1">
                                      {profile.recentForm?.slice(-5).map((f, i) => (
                                          <Badge key={i} variant={f === 'W' ? 'default' : f === 'L' ? 'destructive' : 'secondary'}
                                           className={cn(f === 'W' && 'bg-green-500 hover:bg-green-600')}>{f}</Badge>
                                      ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-mono">{gamesPlayed}</TableCell>
                                <TableCell className="text-center font-mono">{profile.goals || 0}</TableCell>
                                <TableCell className="text-center font-mono">{profile.assists || 0}</TableCell>
                                <TableCell>
                                    <div className="flex gap-1 items-center">
                                      <span className="font-mono">{profile.yellowCards || 0}</span>
                                      <Square className="h-4 w-4 text-yellow-400 fill-current" />
                                      <span className="font-mono">{profile.redCards || 0}</span>
                                      <Square className="h-4 w-4 text-red-500 fill-current" />
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onPlayerRemoved(playerId)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                          )
                        }) : (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
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

    