
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Notification } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Search, UserPlus } from "lucide-react";
import { format } from "date-fns";

// Component to handle inviting an opponent
function InviteOpponent({ match, onOpponentInvited }: { match: Match, onOpponentInvited: (teamId: string) => void }) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [searchResults, setSearchResults] = React.useState<Team[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);
    const { toast } = useToast();
    const { user } = useUser();

    const handleSearch = async () => {
        const searchTerm = searchQuery.trim().toLowerCase();
        if (searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const teamsQuery = query(
                collection(db, "teams"),
                where("name_lowercase", ">=", searchTerm),
                where("name_lowercase", "<=", searchTerm + '\uf8ff')
            );
            const querySnapshot = await getDocs(teamsQuery);
            const teams = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Team))
                .filter(team => team.id !== match.teamARef); // Exclude the current team
            setSearchResults(teams);
        } catch (error) {
            console.error("Error searching teams: ", error);
            toast({ variant: "destructive", title: "Search Error", description: "Failed to search for teams." });
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleInvite = async (opponentTeam: Team) => {
        if (!user || !match.teamARef) return;

        const matchRef = doc(db, "matches", match.id);
        const homeTeamDoc = await getDoc(doc(db, "teams", match.teamARef));
        if (!homeTeamDoc.exists()) {
             toast({ variant: "destructive", title: "Error", description: "Your team could not be found." });
             return;
        }
        const homeTeamName = homeTeamDoc.data().name;

        try {
            // Update the match with the opponent
            await updateDoc(matchRef, {
                teamBRef: opponentTeam.id,
                status: "Scheduled" // Or another status to indicate invitation sent
            });

            // Create a notification for the opponent's manager
             if (opponentTeam.managerId) {
                const notification: Omit<Notification, 'id'> = {
                    userId: opponentTeam.managerId,
                    message: `${homeTeamName} has invited your team, ${opponentTeam.name}, to a match!`,
                    link: `/dashboard/my-games`, // Link to their games page
                    read: false,
                    createdAt: serverTimestamp() as any,
                };
                await addDoc(collection(db, "notifications"), notification);
            }
            
            toast({ title: "Invitation Sent!", description: `An invitation has been sent to ${opponentTeam.name}.` });
            onOpponentInvited(opponentTeam.id);
        } catch (error) {
            console.error("Error inviting opponent: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to send invitation." });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Find an Opponent</CardTitle>
                <CardDescription>Search for a team to invite to this match.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input 
                        placeholder="Search by team name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isSearching}>
                        <Search className="mr-2 h-4 w-4" />
                        {isSearching ? "Searching..." : "Search"}
                    </Button>
                </div>
                <div className="space-y-2">
                    {searchResults.length > 0 ? (
                        searchResults.map(team => (
                            <div key={team.id} className="flex justify-between items-center p-2 border rounded-md">
                                <span>{team.name} ({team.city})</span>
                                <Button size="sm" onClick={() => handleInvite(team)}>
                                    <UserPlus className="mr-2 h-4 w-4"/>
                                    Invite
                                </Button>
                            </div>
                        ))
                    ) : (
                        !isSearching && searchQuery && <p className="text-sm text-muted-foreground text-center">No teams found.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}


export default function GameDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const gameId = params.gameId as string;
    const [match, setMatch] = React.useState<Match | null>(null);
    const [teamA, setTeamA] = React.useState<Team | null>(null);
    const [teamB, setTeamB] = React.useState<Team | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchGameDetails = React.useCallback(async () => {
        setLoading(true);
        try {
            const matchRef = doc(db, "matches", gameId);
            const matchSnap = await getDoc(matchRef);

            if (!matchSnap.exists()) {
                toast({ variant: "destructive", title: "Error", description: "Match not found." });
                router.push("/dashboard/my-games");
                return;
            }

            const matchData = { id: matchSnap.id, ...matchSnap.data() } as Match;
            setMatch(matchData);

            if (matchData.teamARef) {
                const teamADoc = await getDoc(doc(db, "teams", matchData.teamARef));
                if (teamADoc.exists()) setTeamA({ id: teamADoc.id, ...teamADoc.data() } as Team);
            }
            if (matchData.teamBRef) {
                const teamBDoc = await getDoc(doc(db, "teams", matchData.teamBRef));
                if (teamBDoc.exists()) setTeamB({ id: teamBDoc.id, ...teamBDoc.data() } as Team);
            }
        } catch (error) {
            console.error("Error fetching game details: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load game details." });
        } finally {
            setLoading(false);
        }
    }, [gameId, router, toast]);

    React.useEffect(() => {
        fetchGameDetails();
    }, [fetchGameDetails]);

    if (loading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
        </div>
    }

    if (!match || !teamA) {
        return <div>Match not found or team data is missing.</div>;
    }

    const getMatchTitle = () => {
        if (teamA && !teamB) return `${teamA.name} (treino)`;
        if (teamA && teamB) return `${teamA.name} vs ${teamB.name}`;
        return 'Match Details';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold font-headline">{getMatchTitle()}</h1>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/my-games">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to My Games
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Match Details</CardTitle>
                    <CardDescription>{format(new Date(match.date), "EEEE, MMMM d, yyyy 'at' HH:mm")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Status: {match.status}</p>
                    <p>Pitch: Placeholder Pitch Name</p>
                </CardContent>
            </Card>

            {/* Invite Opponent section, shown only for training matches */}
            {match.teamARef && !match.teamBRef && (
                <InviteOpponent match={match} onOpponentInvited={() => fetchGameDetails()} />
            )}
        </div>
    );
}
