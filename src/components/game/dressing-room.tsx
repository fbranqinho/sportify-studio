
"use client";

import * as React from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Match, User } from "@/types";

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
}

const formationPositions = ["GK", "DEF1", "DEF2", "MID1", "MID2", "FWD1", "FWD2"];

export function DressingRoom({ match, players, onUpdate, onClose }: DressingRoomProps) {
  const [teamAFormation, setTeamAFormation] = React.useState<Formation>({});
  const [teamBFormation, setTeamBFormation] = React.useState<Formation>({});
  const { toast } = useToast();

  const handleFormationChange = (team: 'A' | 'B', position: string, playerId: string) => {
    const setFormation = team === 'A' ? setTeamAFormation : setTeamBFormation;
    const otherFormation = team === 'A' ? teamBFormation : teamAFormation;
    
    // Remove player from any other position in either team
    const newFormationA = { ...teamAFormation };
    const newFormationB = { ...teamBFormation };
    Object.keys(newFormationA).forEach(p => { if (newFormationA[p] === playerId) newFormationA[p] = null; });
    Object.keys(newFormationB).forEach(p => { if (newFormationB[p] === playerId) newFormationB[p] = null; });

    // Set player in the new position
    if(team === 'A') {
        newFormationA[position] = playerId === "empty" ? null : playerId;
        setTeamAFormation(newFormationA);
        setTeamBFormation(newFormationB);
    } else {
        newFormationB[position] = playerId === "empty" ? null : playerId;
        setTeamAFormation(newFormationA);
        setTeamBFormation(newFormationB);
    }
  };

  const assignedPlayers = new Set([...Object.values(teamAFormation), ...Object.values(teamBFormation)].filter(Boolean));
  const benchPlayers = players.filter(p => !assignedPlayers.has(p.id));

  const getAvailablePlayers = (currentPosPlayerId: string | null) => {
    return players.filter(p => !assignedPlayers.has(p.id) || p.id === currentPosPlayerId);
  }
  
  const handleSaveChanges = async () => {
    const teamAPlayers = Object.values(teamAFormation).filter((id): id is string => !!id);
    const teamBPlayers = Object.values(teamBFormation).filter((id): id is string => !!id);

    const matchRef = doc(db, "matches", match.id);
    try {
        await updateDoc(matchRef, { teamAPlayers, teamBPlayers });
        toast({ title: "Teams Saved", description: "The practice teams have been updated." });
        onUpdate({ teamAPlayers, teamBPlayers });
        onClose();
    } catch (error) {
        console.error("Error saving teams:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not save team assignments." });
    }
  };

  const FieldPosition = ({ team, position, formation, availablePlayers }: { team: 'A' | 'B', position: string, formation: Formation, availablePlayers: User[]}) => {
    const selectedPlayerId = formation[position] || "empty";
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
  
  const FormationDisplay = ({ team, formation }: { team: 'A' | 'B', formation: Formation }) => {
    const gridPositions: { [key: string]: string } = {
        GK: 'col-start-2 row-start-4', DEF1: 'col-start-3 row-start-2', DEF2: 'col-start-3 row-start-6',
        MID1: 'col-start-4 row-start-3', MID2: 'col-start-4 row-start-5', FWD1: 'col-start-5 row-start-2', FWD2: 'col-start-5 row-start-6'
    };
    return (
        <div className="bg-green-600/20 p-4 rounded-lg border-2 border-dashed border-green-700/30">
            <h3 className="text-lg font-bold text-center mb-4">{team === 'A' ? 'Vests A' : 'Vests B'}</h3>
            <div className="grid grid-cols-5 grid-rows-7 gap-y-2">
                {formationPositions.map(pos => (
                    <div key={pos} className={gridPositions[pos]}>
                        <FieldPosition team={team} position={pos} formation={formation} availablePlayers={getAvailablePlayers(formation[pos])} />
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
        <DialogDescription>Assign players to teams and positions for this practice match.</DialogDescription>
      </DialogHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
        <FormationDisplay team="A" formation={teamAFormation}/>
        <FormationDisplay team="B" formation={teamBFormation}/>
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
