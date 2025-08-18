
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Match, Team, Notification, Pitch, OwnerProfile, User, MatchEvent, Reservation } from "@/types";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";

// Import individual components
import { GameFlowManager } from "@/components/game/game-flow-manager";
import { PlayerRoster } from "@/components/game/player-roster";
import { PlayerApplications } from "@/components/game/player-applications";
import { ChallengeInvitations } from "@/components/game/challenge-invitations";
import { ManageGame } from "@/components/game/manage-game";
import { MatchReport } from "@/components/game/match-report";
import { MatchDetailsCard } from "@/components/game/match-details-card";


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
    const [reservation, setReservation] = React.useState<Reservation | null>(null);
    const [invitationCounts, setInvitationCounts] = React.useState<{ pending: number, declined: number }>({ pending: 0, declined: 0 });
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchGameDetails = React.useCallback(async () => {
        try {
            setLoading(true);
            const matchRef = doc(db, "matches", gameId);
            const matchSnap = await getDoc(matchRef);

            if (!matchSnap.exists()) {
                toast({ variant: "destructive", title: "Error", description: "Match not found." });
                router.push("/dashboard/my-games");
                return;
            }

            const matchData = { id: matchSnap.id, ...matchSnap.data() } as Match;
            setMatch(matchData);

            const promises = [];

            if (matchData.teamARef) {
                promises.push(getDoc(doc(db, "teams", matchData.teamARef)).then(d => d.exists() ? setTeamA({id: d.id, ...d.data()} as Team) : null));
            }

            const teamBId = matchData.teamBRef || matchData.invitedTeamId;
            if (teamBId) {
                promises.push(getDoc(doc(db, "teams", teamBId)).then(d => d.exists() ? setTeamB({id: d.id, ...d.data()} as Team) : null));
            }
            
            if (matchData.pitchRef) {
                const pitchRef = doc(db, "pitches", matchData.pitchRef);
                const pitchPromise = getDoc(pitchRef).then(async (pitchDoc) => {
                    if (pitchDoc.exists()) {
                        const pitchData = { id: pitchDoc.id, ...pitchDoc.data() } as Pitch;
                        setPitch(pitchData);
                        if (pitchData.ownerRef) {
                             const ownerDocRef = doc(db, "ownerProfiles", pitchData.ownerRef);
                             const ownerDoc = await getDoc(ownerDocRef);
                             if (ownerDoc.exists()) {
                                 setOwner({ id: ownerDoc.id, ...ownerDoc.data() } as OwnerProfile);
                             }
                        }
                    }
                });
                promises.push(pitchPromise);
            }

            if (matchData.reservationRef) {
                const reservationPromise = getDoc(doc(db, "reservations", matchData.reservationRef)).then(resSnap => {
                     if (resSnap.exists()) {
                        setReservation({id: resSnap.id, ...resSnap.data()} as Reservation);
                    }
                });
                promises.push(reservationPromise);
            }

            const invQuery = query(collection(db, "matchInvitations"), where("matchId", "==", gameId));
            const invPromise = getDocs(invQuery).then(snapshot => {
                let pending = 0;
                let declined = 0;
                snapshot.forEach(doc => {
                    const status = doc.data().status;
                    if (status === 'pending') pending++;
                    if (status === 'declined') declined++;
                });
                setInvitationCounts({ pending, declined });
            });
            promises.push(invPromise);


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
        if (data.teamAPlayers || data.teamBPlayers || data.events || data.status === 'Finished') {
            fetchGameDetails(); // Re-fetch to get correct player states
        }
    }
    
    const handleEventAdded = (event: MatchEvent) => {
        setMatch(prev => {
            if (!prev) return null;
            const newEvents = [...(prev.events || []), event];
            return { ...prev, events: newEvents };
        });
    }

    if (loading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
        </div>
    }

    if (!match || !user) {
        return <div>Match not found or user not logged in.</div>;
    }
    
    const isManagerA = user?.id === teamA?.managerId;
    const isManagerB = user?.id === teamB?.managerId;
    const isManager = isManagerA || isManagerB;
    const isFinished = match.status === 'Finished';

    const getMatchTitle = () => {
        const teamAName = teamA?.name || 'Team A';
        if (isFinished) return `${teamA?.name || 'Team A'} ${match.scoreA} - ${match.scoreB} ${teamB?.name || 'Team B'}`;
        if (teamA && !teamB && !match.invitedTeamId && (match.status === 'Collecting players' || match.status === 'Scheduled')) return `${teamA.name} (Practice)`;
        if (teamA && teamB) return `${teamA.name} vs ${teamB.name}`;
        if (teamA && match.invitedTeamId && !teamB) {
             const invitedTeam = teamB; 
             return `${teamA.name} vs ${invitedTeam?.name || 'Invited Team'} (Pending)`;
        }
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
            
            <MatchDetailsCard
                match={match}
                pitch={pitch}
                owner={owner}
                invitationCounts={invitationCounts}
            />
            
            {isFinished ? (
                 pitch && <MatchReport match={match} teamA={teamA} teamB={teamB} pitch={pitch} user={user} onMvpUpdate={fetchGameDetails} />
            ) : (
                <div className="space-y-6">
                    {isManagerA && <GameFlowManager match={match} onMatchUpdate={handleMatchUpdate} teamA={teamA} teamB={teamB} pitch={pitch} reservation={reservation} />}
                    <PlayerRoster 
                        match={match} 
                        isManager={isManager} 
                        onUpdate={handleMatchUpdate} 
                        onEventAdded={handleEventAdded} 
                        reservation={reservation}
                        teamA={teamA}
                        teamB={teamB}
                    />
                    {isManagerA && <PlayerApplications match={match} onUpdate={fetchGameDetails} />}
                    {isManagerA && <ChallengeInvitations match={match} onUpdate={fetchGameDetails} />}
                    {isManagerA && match.status !== "InProgress" && match.status !== "Finished" && <ManageGame match={match} onMatchUpdate={handleMatchUpdate} reservation={reservation} />}
                </div>
            )}
        </div>
    );
}
