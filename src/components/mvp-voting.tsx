
"use client";

import * as React from "react";
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, getDoc, updateDoc, increment, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, CheckCircle, Trophy } from "lucide-react";
import type { Match, User, MvpVote } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface MvpVotingProps {
  match: Match;
  user: User;
  onMvpUpdated: () => void;
}

function VotingEndedCard({ match, user, isSubmitting, handleFinalizeVotes }: { match: Match, user: User, isSubmitting: boolean, handleFinalizeVotes: () => void }) {
    const [provisionalMvp, setProvisionalMvp] = React.useState<User | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const calculateWinner = async () => {
            const votesQuery = query(collection(db, "matches", match.id, "mvpVotes"));
            const votesSnap = await getDocs(votesQuery);

            if (votesSnap.empty) {
                setLoading(false);
                return;
            }

            const voteCounts: { [playerId: string]: number } = {};
            votesSnap.forEach(doc => {
                const vote = doc.data();
                voteCounts[vote.votedForId] = (voteCounts[vote.votedForId] || 0) + 1;
            });
            
            if (Object.keys(voteCounts).length > 0) {
                 const mvpId = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
                 const userDoc = await getDoc(doc(db, "users", mvpId));
                 if (userDoc.exists()) {
                     setProvisionalMvp(userDoc.data() as User);
                 }
            }
            setLoading(false);
        };
        calculateWinner();
    }, [match.id]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="text-amber-500" /> MVP Voting has ended</CardTitle>
                <CardDescription>The voting period for this match has closed. The manager can now finalize the results.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-1/2" /> :
                    provisionalMvp ? (
                        <p className="font-semibold">Provisional Winner: <span className="text-primary">{provisionalMvp.name}</span></p>
                    ) : (
                        <p className="text-muted-foreground">No votes were cast in this match.</p>
                    )
                }
                {user.role === 'MANAGER' && (
                    <Button onClick={handleFinalizeVotes} disabled={isSubmitting || !provisionalMvp} className="mt-4">
                        {isSubmitting ? "Finalizing..." : "Finalize MVP & Award"}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

export function MvpVoting({ match, user, onMvpUpdated }: MvpVotingProps) {
  const [loading, setLoading] = React.useState(true);
  const [participants, setParticipants] = React.useState<User[]>([]);
  const [userVote, setUserVote] = React.useState<MvpVote | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedPlayer, setSelectedPlayer] = React.useState<string | undefined>(undefined);
  const { toast } = useToast();
  
  const didParticipate = (match.teamAPlayers?.includes(user.id) || match.teamBPlayers?.includes(user.id));
  
  const isVotingOpen = React.useMemo(() => {
    if (!match.finishTime) return false;
    const finishDate = new Date(match.finishTime.seconds * 1000);
    const cutoffDate = new Date(finishDate.getTime() + 24 * 60 * 60 * 1000);
    return new Date() < cutoffDate;
  }, [match.finishTime]);

  React.useEffect(() => {
    if (!didParticipate || match.status !== "Finished") {
        setLoading(false);
        return;
    }

    const fetchVotingData = async () => {
        setLoading(true);
        // Fetch participants
        const allPlayerIds = [...new Set([...(match.teamAPlayers || []), ...(match.teamBPlayers || [])])];
        if (allPlayerIds.length > 0) {
            const usersQuery = query(collection(db, "users"), where(documentId(), "in", allPlayerIds));
            const usersSnap = await getDocs(usersQuery);
            setParticipants(usersSnap.docs.map(d => d.data() as User));
        }

        // Check if user has already voted
        const votesQuery = query(collection(db, "matches", match.id, "mvpVotes"), where("voterId", "==", user.id));
        const votesSnap = await getDocs(votesQuery);
        if (!votesSnap.empty) {
            setUserVote(votesSnap.docs[0].data() as MvpVote);
        }
        setLoading(false);
    }
    
    fetchVotingData();
  }, [match, user, didParticipate]);
  
  const handleVoteSubmit = async () => {
    if (!selectedPlayer) {
        toast({ variant: "destructive", title: "No player selected", description: "Please select a player to vote for." });
        return;
    }
    setIsSubmitting(true);
    try {
        const batch = writeBatch(db);

        // Add vote to subcollection
        const voteRef = doc(collection(db, "matches", match.id, "mvpVotes"));
        batch.set(voteRef, {
            voterId: user.id,
            votedForId: selectedPlayer,
            timestamp: serverTimestamp(),
        });
        
        await batch.commit();

        setUserVote({ id: voteRef.id, voterId: user.id, votedForId: selectedPlayer, timestamp: new Date() });
        toast({ title: "Vote Submitted!", description: "Your MVP vote has been counted."});
    } catch (error) {
        console.error("Error submitting vote: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not submit your vote." });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handleFinalizeVotes = async () => {
      setIsSubmitting(true);
      try {
        const votesQuery = query(collection(db, "matches", match.id, "mvpVotes"));
        const votesSnap = await getDocs(votesQuery);

        if (votesSnap.empty) {
            toast({ title: "No votes yet", description: "Cannot determine MVP without any votes." });
            setIsSubmitting(false);
            return;
        }

        const voteCounts: { [playerId: string]: number } = {};
        votesSnap.forEach(doc => {
            const vote = doc.data();
            voteCounts[vote.votedForId] = (voteCounts[vote.votedForId] || 0) + 1;
        });

        const mvpId = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);

        const matchRef = doc(db, "matches", match.id);
        const playerProfileQuery = query(collection(db, "playerProfiles"), where("userRef", "==", mvpId));
        const playerProfileSnap = await getDocs(playerProfileQuery);

        if (playerProfileSnap.empty) throw new Error("MVP profile not found");
        
        const playerProfileRef = playerProfileSnap.docs[0].ref;

        const batch = writeBatch(db);
        batch.update(matchRef, { mvpPlayerId: mvpId });
        batch.update(playerProfileRef, { mvps: increment(1) });
        
        await batch.commit();
        onMvpUpdated();
        toast({ title: "MVP Finalized!", description: "The Man of the Match has been determined." });

      } catch (error) {
          console.error("Error finalizing votes: ", error);
          toast({ variant: "destructive", title: "Error", description: "Could not finalize MVP voting." });
      } finally {
          setIsSubmitting(false);
      }
  }
  
  // Render conditions
  if (!didParticipate || match.status !== "Finished") return null;
  
  if (loading) {
      return (
          <Card>
              <CardHeader><CardTitle>Vote for the MVP</CardTitle></CardHeader>
              <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
      );
  }

  if (userVote) {
      return (
          <Card className="bg-green-500/10 border-green-500/20">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-600" /> Vote Submitted</CardTitle>
                  <CardDescription>Thank you for participating. The MVP will be revealed after the voting period ends.</CardDescription>
              </CardHeader>
          </Card>
      )
  }
  
  if (!isVotingOpen && !match.mvpPlayerId) {
    return <VotingEndedCard match={match} user={user} isSubmitting={isSubmitting} handleFinalizeVotes={handleFinalizeVotes} />
  }

  if (match.mvpPlayerId) {
      return null; // Don't show anything if MVP is already decided. The MVP card will be shown instead.
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Star className="text-primary"/>Vote for the MVP</CardTitle>
            <CardDescription>The voting is open for 24 hours after the match. You cannot vote for yourself.</CardDescription>
        </CardHeader>
        <CardContent>
            <RadioGroup value={selectedPlayer} onValueChange={setSelectedPlayer} className="space-y-2">
                {participants.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={p.id} id={p.id} disabled={p.id === user.id}/>
                        <Label htmlFor={p.id}>{p.name}</Label>
                    </div>
                ))}
            </RadioGroup>
            <Button className="mt-6 w-full" onClick={handleVoteSubmit} disabled={isSubmitting || !selectedPlayer}>
                {isSubmitting ? "Submitting..." : "Submit My Vote"}
            </Button>
        </CardContent>
    </Card>
  )
}
