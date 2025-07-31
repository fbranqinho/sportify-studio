
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, arrayUnion, arrayRemove, writeBatch, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Notification, Pitch, OwnerProfile, User } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Search, UserPlus, X, Trash2, Building, MapPin, Shield, Users, CheckCircle, XCircle, Inbox } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge";


// Component to handle inviting an opponent
function InviteOpponent({ match, onOpponentInvited }: { match: Match, onOpponentInvited: (teamId: string) => void }) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [searchResults, setSearchResults] = React.useState<Team[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);
    const { toast } = useToast();
    const { user } = useUser();

    const handleSearch = async (queryText: string) => {
        setSearchQuery(queryText);
        const searchTerm = queryText.trim().toLowerCase();
        if (!searchTerm) {
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
            let teams = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Team))
                .filter(team => team.id !== match.teamARef); 
                
            setSearchResults(teams);
        } catch (error) {
             console.error("Error searching teams: ", error);
             toast({ variant: "destructive", title: "Search Error", description: "Failed to search for teams. A required index might be building." });
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
            // Update the match with the invitation details
            await updateDoc(matchRef, {
                invitedTeamId: opponentTeam.id,
                status: "PendingOpponent"
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
                <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Search by team name..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
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
                                {searchResults.map(team => (
                                    <TableRow key={team.id}>
                                        <TableCell>
                                            <div className="font-medium">{team.name}</div>
                                            <div className="text-xs text-muted-foreground">{team.city}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <Button size="sm" onClick={() => handleInvite(team)}>
                                                <UserPlus className="mr-2 h-4 w-4"/>
                                                Invite
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                 ) : searchQuery && !isSearching ? (
                    <div className="mt-2 text-sm text-muted-foreground text-center py-4">No teams found.</div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function ManageGame({ match, onMatchUpdate }: { match: Match, onMatchUpdate: (data: Partial<Match>) => void}) {
    const { toast } = useToast();
    const router = useRouter();

    const handleToggleExternalPlayers = async (checked: boolean) => {
        const matchRef = doc(db, "matches", match.id);
        try {
            await updateDoc(matchRef, { allowExternalPlayers: checked });
            onMatchUpdate({ allowExternalPlayers: checked });
            toast({ title: "Settings updated", description: `Players can ${checked ? 'now' : 'no longer'} apply to this game.`});
        } catch (error) {
            console.error("Error updating match settings:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not update match settings." });
        }
    }
    
    const handleDeleteGame = async () => {
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", match.id);
        batch.delete(matchRef);

        // If there's an associated reservation, delete it as well.
        if (match.reservationRef) {
            const reservationRef = doc(db, "reservations", match.reservationRef);
            batch.delete(reservationRef);
        }

        try {
            await batch.commit();
            toast({ title: "Game Deleted", description: "The game and its reservation have been removed."});
            router.push('/dashboard/my-games');
        } catch (error) {
            console.error("Error deleting game and reservation:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete the game." });
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Game Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="allow-external" className="text-base font-semibold">
                            Accept External Players
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Allow players who are not in a team to apply to fill empty slots in this game.
                        </p>
                    </div>
                    <Switch
                        id="allow-external"
                        checked={!!match.allowExternalPlayers}
                        onCheckedChange={handleToggleExternalPlayers}
                    />
                </div>
                 <div className="flex items-center justify-between space-x-2 rounded-lg border border-destructive/50 p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="allow-external" className="text-base font-semibold text-destructive">
                            Delete Game
                        </Label>
                        <p className="text-sm text-muted-foreground">
                           This will permanently delete the game and its associated field reservation. This action cannot be undone.
                        </p>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the game
                                and its associated reservation from the schedule.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteGame}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    )
}

function PlayerApplications({ match, onUpdate }: { match: Match; onUpdate: () => void }) {
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

        // Operation 1: Remove from applications list
        batch.update(matchRef, { playerApplications: arrayRemove(applicantId) });
        
        let notificationMessage = `Your application for the game on ${format(new Date(match.date), "MMM d")} was not accepted.`;
        let notificationLink = '/dashboard/my-games';
        
        if (accepted) {
            // Operation 2: Add to confirmed players list (assuming Team A)
            batch.update(matchRef, { teamAPlayers: arrayUnion(applicantId) });
            notificationMessage = `You're in! Your application for the game on ${format(new Date(match.date), "MMM d")} was accepted.`;
        }

        // Operation 3: Send notification to the player
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
            toast({ title: `Application ${accepted ? 'Accepted' : 'Declined'}`, description: `The player has been notified.` });
            onUpdate(); // Re-fetch all data to update UI
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

interface ConfirmedPlayer {
    id: string;
    name: string;
    teamName: string;
}

function ConfirmedPlayers({ match, teamA, teamB }: { match: Match; teamA: Team | null; teamB: Team | null }) {
    const [players, setPlayers] = React.useState<ConfirmedPlayer[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchPlayers = async () => {
            const allPlayerIds = [...(match.teamAPlayers || []), ...(match.teamBPlayers || [])];
            if (allPlayerIds.length === 0) {
                setPlayers([]);
                setLoading(false);
                return;
            }
            setLoading(true);

            const usersQuery = query(collection(db, "users"), where(documentId(), "in", allPlayerIds));
            const usersSnapshot = await getDocs(usersQuery);
            const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data() as User]));
            
            const confirmedPlayers: ConfirmedPlayer[] = allPlayerIds.map(id => {
                const user = usersMap.get(id);
                let teamName = "External Player";
                if (match.teamAPlayers?.includes(id)) {
                    teamName = teamA?.name || "Team A";
                } else if (match.teamBPlayers?.includes(id)) {
                    teamName = teamB?.name || "Team B";
                }
                return {
                    id: id,
                    name: user?.name || "Unknown Player",
                    teamName: teamName,
                };
            });
            setPlayers(confirmedPlayers);
            setLoading(false);
        };

        fetchPlayers();
    }, [match, teamA, teamB]);
    
    if ((match.teamAPlayers?.length || 0) === 0 && (match.teamBPlayers?.length || 0) === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Confirmed Players</CardTitle>
                <CardDescription>Players who have confirmed their attendance for this game.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-20 w-full" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Player</TableHead>
                                <TableHead>Team</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {players.map(player => (
                                <TableRow key={player.id}>
                                    <TableCell className="font-medium">{player.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{player.teamName}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}



export default function GameDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useUser();
    const gameId = params.gameId as string;
    const [match, setMatch] = React.useState<Match | null>(null);
    const [teamA, setTeamA] = React.useState<Team | null>(null);
    const [teamB, setTeamB] = React.useState<Team | null>(null);
    const [pitch, setPitch] = React.useState<Pitch | null>(null);
    const [owner, setOwner] = React.useState<OwnerProfile | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchGameDetails = React.useCallback(async () => {
        // setLoading(true); // Don't set loading on re-fetch to avoid flicker
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

            // Fetch related data in parallel
            const promises = [];

            // Team A
            if (matchData.teamARef) {
                promises.push(getDoc(doc(db, "teams", matchData.teamARef)).then(d => d.exists() ? setTeamA({id: d.id, ...d.data()} as Team) : null));
            }

            // Team B (or Invited Team)
            const teamBId = matchData.teamBRef || matchData.invitedTeamId;
            if (teamBId) {
                promises.push(getDoc(doc(db, "teams", teamBId)).then(d => d.exists() ? setTeamB({id: d.id, ...d.data()} as Team) : null));
            }
            
            // Pitch and Owner
            if (matchData.pitchRef) {
                const pitchRef = doc(db, "pitches", matchData.pitchRef);
                const pitchPromise = getDoc(pitchRef).then(async (pitchDoc) => {
                    if (pitchDoc.exists()) {
                        const pitchData = { id: pitchDoc.id, ...pitchDoc.data() } as Pitch;
                        setPitch(pitchData);
                        if (pitchData.ownerRef) {
                            // Assuming ownerRef points to the user ID of the owner
                            const ownerQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", pitchData.ownerRef));
                            const ownerSnapshot = await getDocs(ownerQuery);
                            if (!ownerSnapshot.empty) {
                                const ownerDoc = ownerSnapshot.docs[0];
                                setOwner({ id: ownerDoc.id, ...ownerDoc.data() } as OwnerProfile);
                            }
                        }
                    }
                });
                promises.push(pitchPromise);
            }

            await Promise.all(promises);

        } catch (error) {
            console.error("Error fetching game details: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load game details." });
        } finally {
            setLoading(false);
        }
    }, [gameId, router, toast]);

    React.useEffect(() => {
        if (gameId) {
            fetchGameDetails();
        }
    }, [gameId, fetchGameDetails]);

    const handleMatchUpdate = (data: Partial<Match>) => {
        setMatch(prev => prev ? {...prev, ...data} : null);
    }

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
        if (teamA && !teamB && !match.invitedTeamId && (match.status === 'PendingOpponent' || match.status === 'Scheduled')) return `${teamA.name} (Practice)`;
        if (teamA && teamB) return `${teamA.name} vs ${teamB.name}`;
        if (teamA && match.invitedTeamId && !teamB) {
             const invitedTeam = teamB; // This is a bit of a hack, teamB state holds the invited team
             return `${teamA.name} vs ${invitedTeam?.name || 'Invited Team'} (Pending)`;
        }
        return 'Match Details';
    };

    const confirmedPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
    const missingPlayers = (pitch?.capacity || 0) - confirmedPlayers;


    const getMatchStatus = () => {
        if (match.status === 'PendingOpponent') {
            if (match.invitedTeamId) return 'Awaiting Opponent Confirmation';
            return `Waiting players... ${missingPlayers > 0 ? `${missingPlayers} missing` : 'Full'}`;
        }
        return match.status;
    };
    
    const isManager = user?.id === teamA?.managerId;


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

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Match Details</CardTitle>
                        <CardDescription>{format(new Date(match.date), "EEEE, MMMM d, yyyy 'at' HH:mm")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="text-sm space-y-2">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground"/>
                                <span>Status: <span className="font-semibold">{getMatchStatus()}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground"/>
                                <span>Confirmed Players: <span className="font-semibold">{confirmedPlayers}</span></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {pitch && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Venue Information</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3">
                             <div className="flex items-start gap-3">
                                <Shield className="h-4 w-4 text-muted-foreground mt-0.5"/>
                                <div>
                                    <p className="font-semibold">{pitch.name}</p>
                                    <p className="text-xs text-muted-foreground">Pitch</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5"/>
                                 <div>
                                    <p className="font-semibold">{pitch.address}</p>
                                    <p className="text-xs text-muted-foreground">Address</p>
                                </div>
                            </div>
                              {owner && <div className="flex items-start gap-3">
                                <Building className="h-4 w-4 text-muted-foreground mt-0.5"/>
                                 <div>
                                    <p className="font-semibold">{owner.companyName}</p>
                                    <p className="text-xs text-muted-foreground">Managed by</p>
                                </div>
                            </div>}
                        </CardContent>
                    </Card>
                )}
            </div>
            
            {isManager && <PlayerApplications match={match} onUpdate={fetchGameDetails} />}
            {isManager && <ConfirmedPlayers match={match} teamA={teamA} teamB={teamB} />}

            {isManager && <ManageGame match={match} onMatchUpdate={handleMatchUpdate} />}

            {/* Invite Opponent section, shown only if there's no opponent and no invitation sent */}
            {isManager && match.teamARef && !match.teamBRef && !match.invitedTeamId && (
                <InviteOpponent match={match} onOpponentInvited={() => fetchGameDetails()} />
            )}
        </div>
    );
}

    