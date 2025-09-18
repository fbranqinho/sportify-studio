
"use client";

import * as React from "react";
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, getDoc, updateDoc, increment, documentId, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ThumbsUp, ThumbsDown, Send } from "lucide-react";
import type { Match, User, KudosVote, PlayerProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";


const kudosTags = ["Faz tudo", "Anjinho", "Velocista", "Brinca na areia", "Craque", "Agressividade positiva", "Agressividade negativa"];

interface KudosVotingProps {
  match: Match;
  user: User;
}

export function KudosVoting({ match, user }: KudosVotingProps) {
  const [loading, setLoading] = React.useState(true);
  const [participants, setParticipants] = React.useState<User[]>([]);
  const [userVote, setUserVote] = React.useState<KudosVote | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedPlayer, setSelectedPlayer] = React.useState<string | undefined>();
  const [rating, setRating] = React.useState<'up' | 'down' | null>(null);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const { toast } = useToast();

  const didParticipate = (match.teamAPlayers?.includes(user.id) || match.teamBPlayers?.includes(user.id));

  React.useEffect(() => {
    if (!didParticipate || match.status !== "Finished" || !user.premiumPlan) {
      setLoading(false);
      return;
    }

    const fetchVotingData = async () => {
      setLoading(true);
      const allPlayerIds = [...new Set([...(match.teamAPlayers || []), ...(match.teamBPlayers || [])])];
      if (allPlayerIds.length > 0) {
        const usersQuery = query(collection(db, "users"), where("id", "in", allPlayerIds.filter(id => id !== user.id)));
        const usersSnap = await getDocs(usersQuery);
        setParticipants(usersSnap.docs.map(d => d.data() as User));
      }

      // Check if user has already voted by looking in the match document's array
      const existingVote = match.kudosVotes?.find(vote => vote.voterId === user.id);
      if (existingVote) {
        setUserVote(existingVote);
      }
      
      setLoading(false);
    }
    
    fetchVotingData();
  }, [match, user, didParticipate]);
  
  const handleVoteSubmit = async () => {
    if (!selectedPlayer || !rating) {
        toast({ variant: "destructive", title: "Incomplete Vote", description: "Please select a player and a rating." });
        return;
    }
    setIsSubmitting(true);
    try {
        const batch = writeBatch(db);
        const matchRef = doc(db, "matches", match.id);

        const newVote: KudosVote = {
            voterId: user.id,
            votedForId: selectedPlayer,
            rating: rating,
            tags: selectedTags,
        };

        // Atomically add the new vote to the 'kudosVotes' array
        batch.update(matchRef, {
            kudosVotes: arrayUnion(newVote)
        });
        
        const playerProfileQuery = query(collection(db, "playerProfiles"), where("userRef", "==", selectedPlayer));
        const playerProfileSnap = await getDocs(playerProfileQuery);

        if (!playerProfileSnap.empty) {
            const profileRef = playerProfileSnap.docs[0].ref;
            const updateData: { [key: string]: any } = {};
            selectedTags.forEach(tag => {
                updateData[`tags.${tag}`] = increment(1);
            });
            if (Object.keys(updateData).length > 0) {
              batch.update(profileRef, updateData);
            }
        }
        
        await batch.commit();

        setUserVote(newVote);
        toast({ title: "Feedback Submitted!", description: "Thank you for your contribution." });
    } catch (error) {
        console.error("Error submitting kudos vote: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not submit your feedback." });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (!user.premiumPlan || !didParticipate || match.status !== "Finished") return null;

  if (loading) {
      return (
          <Card>
              <CardHeader><CardTitle>Player Feedback</CardTitle></CardHeader>
              <CardContent><Skeleton className="h-40 w-full" /></CardContent>
          </Card>
      );
  }

  if (userVote) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Thank You for Your Feedback!</CardTitle>
                  <CardDescription>You've already submitted your feedback for this match.</CardDescription>
              </CardHeader>
          </Card>
      );
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline">Player Feedback (Premium)</CardTitle>
            <CardDescription>Give kudos to another player and help the community understand their play style.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="player-select">Who are you evaluating?</Label>
                <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                    <SelectTrigger id="player-select"><SelectValue placeholder="Select a player..." /></SelectTrigger>
                    <SelectContent>
                        {participants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-2">
                <Label>Overall Rating</Label>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setRating('up')} className={cn("flex-1 h-16 text-lg", rating === 'up' && 'bg-green-100 border-green-500 text-green-600')}>
                        <ThumbsUp className="mr-2" /> Kudos
                    </Button>
                    <Button variant="outline" onClick={() => setRating('down')} className={cn("flex-1 h-16 text-lg", rating === 'down' && 'bg-red-100 border-red-500 text-red-600')}>
                        <ThumbsDown className="mr-2" /> Could Improve
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Describe this player's style (optional)</Label>
                <ToggleGroup type="multiple" variant="outline" className="flex-wrap justify-start" value={selectedTags} onValueChange={setSelectedTags}>
                    {kudosTags.map(tag => (
                        <ToggleGroupItem key={tag} value={tag} aria-label={`Toggle ${tag}`}>{tag}</ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            <Button className="w-full font-bold" onClick={handleVoteSubmit} disabled={isSubmitting || !selectedPlayer || !rating}>
                <Send className="mr-2 h-4 w-4" /> {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </Button>
        </CardContent>
    </Card>
  );
}
