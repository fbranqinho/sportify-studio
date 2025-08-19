
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, documentId, arrayRemove, arrayUnion, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Team, PlayerProfile, User, EnrichedPlayerSearchResult, Notification } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "./use-user";

interface EnrichedTeamPlayer {
    playerId: string;
    number: number | null;
    profile?: PlayerProfile;
    user?: User;
}

export function useTeamDetails() {
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
          const usersQuery = query(collection(db, "users"), where(documentId(), "in", teamData.playerIds));

          const [playerProfilesSnapshot, usersSnapshot] = await Promise.all([
            getDocs(playerProfilesQuery),
            getDocs(usersQuery)
          ]);
          
          const playerProfilesMap = new Map<string, PlayerProfile>();
          playerProfilesSnapshot.forEach(doc => {
              const profile = {id: doc.id, ...doc.data()} as PlayerProfile;
              playerProfilesMap.set(profile.userRef, profile);
          });

          const usersMap = new Map<string, User>();
          usersSnapshot.forEach(doc => {
            usersMap.set(doc.id, { id: doc.id, ...doc.data() } as User);
          });
          
          const enrichedPlayers = teamData.playerIds.map(userId => {
              const profile = playerProfilesMap.get(userId);
              const userInfo = usersMap.get(userId);
              const teamPlayerInfo = teamData.players.find(p => p.playerId === userId);
              return {
                  playerId: userId,
                  number: teamPlayerInfo?.number ?? null,
                  profile: profile,
                  user: userInfo,
              };
          }).filter((p): p is EnrichedTeamPlayer => !!p.user && !!p.profile)
            .sort((a,b) => (a.number ?? 999) - (b.number ?? 999));
          
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

    if (!updatedPlayers.some(p => p.playerId === playerId)) {
        updatedPlayers.push({ playerId, number: newNumber });
    }

    try {
      const teamDocRef = doc(db, "teams", teamId);
      await updateDoc(teamDocRef, { players: updatedPlayers });
      
      setPlayers(current => {
          const newPlayers = current.map(p => p.playerId === playerId ? { ...p, number: newNumber } : p);
          return newPlayers.sort((a,b) => (a.number ?? 999) - (b.number ?? 999));
      });
      setTeam(prev => prev ? { ...prev, players: updatedPlayers } : null);

      toast({ title: "Success", description: "Player number updated." });
    } catch (error) {
      console.error("Error updating player number:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update player number." });
      fetchTeamData();
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

        const batch = writeBatch(db);

        const newInvitationRef = doc(collection(db, "teamInvitations"));
        batch.set(newInvitationRef, {
            teamId: teamId,
            teamName: team.name,
            playerId: invitedUserId,
            playerName: playerToInvite.user.name,
            managerId: user.id,
            status: "pending",
            invitedAt: serverTimestamp(),
        });

        const newNotificationRef = doc(collection(db, "notifications"));
        batch.set(newNotificationRef, {
            userId: invitedUserId,
            message: `You've been invited to join the team: ${team.name}.`,
            link: '/dashboard/teams',
            read: false,
            createdAt: serverTimestamp() as any,
        });
        
        await batch.commit();
        toast({ title: "Invitation Sent!", description: `An invitation has been sent to ${playerToInvite.user.name}.` });
    } catch (error) {
         console.error("Error inviting player:", error);
         toast({ variant: "destructive", title: "Error", description: "Failed to send invitation." });
    }
  };
  
  return {
      team,
      players,
      loading,
      handleUpdateNumber,
      handleRemovePlayer,
      handleInvitePlayer
  }

}
