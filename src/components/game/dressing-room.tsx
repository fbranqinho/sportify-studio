
"use client";

import * as React from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Match, Team, User } from "@/types";

type TeamAssignment = {
  [playerId: string]: 'A' | 'B' | 'Bench';
};

type Formation = {
  [position: string]: string | null; // playerId or null
};

interface DressingRoomProps {
  match: Match;
  players: User[];
  onUpdate: (data: Partial<Match>) => void;
  onClose: () => void;
  teamA: Team | null;
  teamB: Team | null;
  currentUserIsManagerFor: 'A' | 'B' | 'both' | 'none';
}

const formationPositions = ["GK", "DEF1", "DEF2", "MID1", "MID2", "FWD1", "FWD2"];

export function DressingRoom({ match, players, onUpdate, onClose, teamA, teamB, currentUserIsManagerFor }: DressingRoomProps) {
  const [teamAFormation, setTeamAFormation] = React.useState<Formation>({});
  const [teamBFormation, setTeamBFormation] = React.useState<Formation>({});
  const { toast } = useToast();
  const autoFilled = React.useRef(false);

  const isPracticeMatch = !teamA || !teamB;
  const canManageTeamA = currentUserIsManagerFor === 'both' || currentUserIsManagerFor === 'A';
  const canManageTeamB = currentUserIsManagerFor === 'both' || currentUserIsManagerFor === 'B';


  React.useEffect(() => {
    // Auto-fill logic for practice matches only
    if (isPracticeMatch && players.length > 0 && !autoFilled.current) {
        const shuffled = [...players].sort(() => 0.5 - Math.random());
        const newFormationA: Formation = {};
        const newFormationB: Formation = {};

        const playersForA = shuffled.splice(0, Math.min(shuffled.length, formationPositions.length));
        const playersForB = shuffled.splice(0, Math.min(shuffled.length, formationPositions.length));
        
        formationPositions.forEach((pos, index) => {
            newFormationA[pos] = playersForA[index]?.id || null;
            newFormationB[pos] = playersForB[index]?.id || null;
        });

        setTeamAFormation(newFormationA);
        setTeamBFormation(newFormationB);
        autoFilled.current = true;
    }
  }, [players, isPracticeMatch]);

  const handleFormationChange = (team: 'A' | 'B', position: string, playerId: string) => {
    // Determine which formation state to update based on the team
    const currentFormation = team === 'A' ? teamAFormation : teamBFormation;
    const setFormation = team === 'A' ? setTeamAFormation : setTeamBFormation;
    const otherFormation = team === 'A' ? teamBFormation : teamAFormation;
    
    // Create a new copy of the formation to modify
    const newFormation = { ...currentFormation };

    // If the selected player is already in another position in the same team, clear that old position
    for (const pos in newFormation) {
        if (newFormation[pos] === playerId) {
            newFormation[pos] = null;
        }
    }
    
    // Also remove from the other team if it's a practice match
    if(isPracticeMatch) {
       const newOtherFormation = {...otherFormation};
        for (const pos in newOtherFormation) {
            if (newOtherFormation[pos] === playerId) {
                newOtherFormation[pos] = null;
            }
        }
        if(team === 'A') setTeamBFormation(newOtherFormation);
        else setTeamAFormation(newOtherFormation);
    }

    // Set the player in the new position, or clear it if "empty" was selected
    newFormation[position] = playerId === "empty" ? null : playerId;

    // Update the state
    setFormation(newFormation);
  };

  const assignedPlayersA = new Set(Object.values(teamAFormation).filter(Boolean));
  const assignedPlayersB = new Set(Object.values(teamBFormation).filter(Boolean));
  const assignedPlayers = new Set([...Array.from(assignedPlayersA), ...Array.from(assignedPlayersB)]);

  const getAvailablePlayersForTeam = (teamId: 'A' | 'B', currentPosPlayerId: string | null): User[] => {
      const teamPlayers = players.filter(p => {
          if (isPracticeMatch) return true; // Any player can be in any team for practice
          return teamId === 'A' ? match.teamAPlayers?.includes(p.id) : match.teamBPlayers?.includes(p.id);
      });

      return teamPlayers.filter(p => !assignedPlayers.has(p.id) || p.id === currentPosPlayerId);
  }

  const benchPlayers = players.filter(p => !assignedPlayers.has(p.id));

  const handleSaveChanges = async () => {
    const teamAPlayers = Object.values(teamAFormation).filter((id): id is string => !!id);
    const teamBPlayers = Object.values(teamBFormation).filter((id): id is string => !!id);

    // In a real match, we only update the manager's own team
    const updateData: Partial<Match> = {};
    if (canManageTeamA) updateData.teamAPlayers = teamAPlayers;
    if (canManageTeamB) updateData.teamBPlayers = teamBPlayers;

    const matchRef = doc(db, "matches", match.id);
    try {
        await updateDoc(matchRef, updateData);
        toast({ title: "Teams Saved", description: "The team formations have been updated." });
        onUpdate(updateData);
        onClose();
    } catch (error) {
        console.error("Error saving teams:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not save team assignments." });
    }
  };

  const FieldPosition = ({ team, position, formation, availablePlayers, disabled }: { team: 'A' | 'B', position: string, formation: Formation, availablePlayers: User[], disabled: boolean }) => {
    const selectedPlayerId = formation[position] || "empty";
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);

    if (disabled) {
        return (
             <div className="flex flex-col items-center">
                <Label htmlFor={`${team}-${position}`} className="text-xs font-bold text-muted-foreground">{position}</Label>
                <div className="w-[120px] h-8 mt-1 flex items-center justify-center bg-muted/50 rounded-md text-sm text-muted-foreground px-2 truncate">
                    {selectedPlayer?.name || '-'}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center">
            <Label htmlFor={`${team}-${position}`} className="text-xs font-bold">{position}</Label>
            <Select value={selectedPlayerId} onValueChange={(value) => handleFormationChange(team, position, value)}>
                <SelectTrigger id={`${team}-${position}`} className="w-[120px] h-8 mt-1">
                    <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="empty">- Empty -</SelectItem>
                    {availablePlayers.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
  };
  
  const FormationDisplay = ({ team, formation, teamData, canManage }: { team: 'A' | 'B', formation: Formation, teamData: Team | null, canManage: boolean }) => {
    const gridPositions: { [key: string]: string } = {
        GK: 'col-start-2 row-start-4', DEF1: 'col-start-3 row-start-2', DEF2: 'col-start-3 row-start-6',
        MID1: 'col-start-4 row-start-3', MID2: 'col-start-4 row-start-5', FWD1: 'col-start-5 row-start-2', FWD2: 'col-start-5 row-start-6'
    };
    
    const teamName = teamData?.name || (team === 'A' ? 'Vests A' : 'Vests B');
    const availablePlayers = getAvailablePlayersForTeam(team, null);

    return (
        <div className="bg-green-600/20 p-4 rounded-lg border-2 border-dashed border-green-700/30">
            <h3 className="text-lg font-bold text-center mb-4">{teamName}</h3>
            <div className="grid grid-cols-5 grid-rows-7 gap-y-2">
                {formationPositions.map(pos => (
                    <div key={pos} className={gridPositions[pos]}>
                        <FieldPosition 
                            team={team} 
                            position={pos} 
                            formation={formation} 
                            availablePlayers={getAvailablePlayersForTeam(team, formation[pos])} 
                            disabled={!canManage}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
  }

  return (
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle className="font-headline">Dressing Room</DialogTitle>
        <DialogDescription>Assign players to teams and positions for this match.</DialogDescription>
      </DialogHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
        <FormationDisplay team="A" formation={teamAFormation} teamData={teamA} canManage={canManageTeamA}/>
        <FormationDisplay team="B" formation={teamBFormation} teamData={teamB} canManage={canManageTeamB}/>
      </div>
      
      <div>
        <h4 className="font-bold mb-2">Bench ({benchPlayers.length})</h4>
        <div className="p-4 bg-muted rounded-md min-h-[60px] flex flex-wrap gap-2">
            {benchPlayers.length > 0 ? benchPlayers.map(p => (
                <div key={p.id} className="bg-background px-3 py-1 rounded-md text-sm font-medium">{p.name}</div>
            )) : <p className="text-sm text-muted-foreground">No players on the bench.</p>}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSaveChanges}>Save Teams</Button>
      </DialogFooter>
    </DialogContent>
  );
}
