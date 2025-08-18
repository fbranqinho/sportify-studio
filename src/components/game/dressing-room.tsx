
"use client";

import * as React from "react";
import { doc, updateDoc, collection, query, where, documentId, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Match, Team, User, Formation, Tactic, PlayerProfile } from "@/types";

const tactics: Tactic[] = ["3-2-1", "2-3-1", "3-1-2", "2-2-2"];

const formationPositionsByTactic: { [key in Tactic]: string[] } = {
    "3-2-1": ["GK", "CB1", "CB2", "CB3", "CM1", "CM2", "ST"],
    "2-3-1": ["GK", "CB1", "CB2", "LM", "CM", "RM", "ST"],
    "3-1-2": ["GK", "CB1", "CB2", "CB3", "CDM", "ST1", "ST2"],
    "2-2-2": ["GK", "LB", "RB", "CM1", "CM2", "ST1", "ST2"],
};

interface DressingRoomProps {
  match: Match;
  onUpdate: (data: Partial<Match>) => void;
  onClose: () => void;
  teamA: Team | null;
  teamB: Team | null;
  currentUserIsManagerFor: 'A' | 'B' | 'both' | 'none';
}

export function DressingRoom({ match, onUpdate, onClose, teamA, teamB, currentUserIsManagerFor }: DressingRoomProps) {
  const [players, setPlayers] = React.useState<(User & { profile: PlayerProfile })[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [tacticA, setTacticA] = React.useState<Tactic>(match.teamADetails?.tactic || '3-2-1');
  const [formationA, setFormationA] = React.useState<Formation>(match.teamADetails?.formation || {});
  const [captainA, setCaptainA] = React.useState<string | undefined>(match.teamADetails?.captainId);
  const [penaltyTakerA, setPenaltyTakerA] = React.useState<string | undefined>(match.teamADetails?.penaltyTakerId);
  const [cornerTakerA, setCornerTakerA] = React.useState<string | undefined>(match.teamADetails?.cornerTakerId);
  const [freeKickTakerA, setFreeKickTakerA] = React.useState<string | undefined>(match.teamADetails?.freeKickTakerId);

  const [tacticB, setTacticB] = React.useState<Tactic>(match.teamBDetails?.tactic || '3-2-1');
  const [formationB, setFormationB] = React.useState<Formation>(match.teamBDetails?.formation || {});

  const { toast } = useToast();
  const autoFilled = React.useRef(false);
  
  const isPracticeMatch = !!match.teamARef && !match.teamBRef && !match.invitedTeamId;
  const canManageTeamA = currentUserIsManagerFor === 'both' || currentUserIsManagerFor === 'A';
  const canManageTeamB = currentUserIsManagerFor === 'both' || currentUserIsManagerFor === 'B';

  React.useEffect(() => {
    const fetchPlayers = async () => {
        setLoading(true);
        const playerIds = [...new Set([...(match.teamAPlayers || []), ...(match.teamBPlayers || [])])];
        if (playerIds.length === 0) {
            setPlayers([]);
            setLoading(false);
            return;
        }

        const usersQuery = query(collection(db, "users"), where(documentId(), "in", playerIds));
        const profilesQuery = query(collection(db, "playerProfiles"), where("userRef", "in", playerIds));

        const [usersSnap, profilesSnap] = await Promise.all([getDocs(usersQuery), getDocs(profilesQuery)]);

        const usersMap = new Map(usersSnap.docs.map(doc => [doc.id, doc.data() as User]));
        const profilesMap = new Map(profilesSnap.docs.map(doc => [doc.data().userRef, doc.data() as PlayerProfile]));

        const combinedData = playerIds.map(id => {
            const user = usersMap.get(id);
            const profile = profilesMap.get(id);
            return user && profile ? { ...user, profile } : null;
        }).filter((p): p is User & { profile: PlayerProfile } => p !== null);
        
        setPlayers(combinedData);
        setLoading(false);
    };
    fetchPlayers();
  }, [match.teamAPlayers, match.teamBPlayers]);

  React.useEffect(() => {
    // Intelligent Auto-fill logic for practice matches only
    if (isPracticeMatch && players.length > 0 && !autoFilled.current) {
        const shuffled = [...players].sort(() => 0.5 - Math.random());
        const newFormationA: Formation = {};
        const newFormationB: Formation = {};
        
        const playersForA = shuffled.slice(0, Math.ceil(shuffled.length / 2));
        const playersForB = shuffled.slice(Math.ceil(shuffled.length / 2));

        const positions = formationPositionsByTactic[tacticA];
        
        const assignPlayers = (formation: Formation, availablePlayers: (User & {profile: PlayerProfile})[]) => {
            let assigned = new Set<string>();
            positions.forEach(pos => {
                let playerToAssign: (User & { profile: PlayerProfile }) | undefined;
                if (pos === "GK") playerToAssign = availablePlayers.find(p => p.profile.position === "Goalkeeper" && !assigned.has(p.id));
                else if (pos.includes("B")) playerToAssign = availablePlayers.find(p => p.profile.position === "Defender" && !assigned.has(p.id));
                else if (pos.includes("M")) playerToAssign = availablePlayers.find(p => p.profile.position === "Midfielder" && !assigned.has(p.id));
                else if (pos.includes("ST") || pos.includes("W")) playerToAssign = availablePlayers.find(p => p.profile.position === "Forward" && !assigned.has(p.id));
                
                if (!playerToAssign) playerToAssign = availablePlayers.find(p => !assigned.has(p.id));

                if (playerToAssign) {
                    formation[pos] = playerToAssign.id;
                    assigned.add(playerToAssign.id);
                }
            });
        };
        
        assignPlayers(newFormationA, playersForA);
        assignPlayers(newFormationB, playersForB);

        setFormationA(newFormationA);
        setFormationB(newFormationB);
        autoFilled.current = true;
    }
  }, [players, isPracticeMatch, tacticA]);

  const handleFormationChange = (team: 'A' | 'B', position: string, playerId: string) => {
    const currentFormation = team === 'A' ? formationA : formationB;
    const setFormation = team === 'A' ? setFormationA : setFormationB;
    const otherFormation = team === 'A' ? formationB : formationA;

    const newFormation = { ...currentFormation };
    for (const pos in newFormation) {
      if (newFormation[pos] === playerId) newFormation[pos] = null;
    }
    if (isPracticeMatch) {
      const newOtherFormation = { ...otherFormation };
      for (const pos in newOtherFormation) {
        if (newOtherFormation[pos] === playerId) newOtherFormation[pos] = null;
      }
      if (team === 'A') setFormationB(newOtherFormation);
      else setFormationA(newOtherFormation);
    }
    newFormation[position] = playerId === "empty" ? null : playerId;
    setFormation(newFormation);
  };

  const assignedPlayersA = new Set(Object.values(formationA).filter(Boolean));
  const assignedPlayersB = new Set(Object.values(formationB).filter(Boolean));
  const assignedPlayers = new Set([...Array.from(assignedPlayersA), ...Array.from(assignedPlayersB)]);

  const getAvailablePlayersForTeam = (teamId: 'A' | 'B', currentPosPlayerId: string | null): (User & {profile: PlayerProfile})[] => {
      const teamPlayers = players.filter(p => {
          if (isPracticeMatch) return true;
          return teamId === 'A' ? match.teamAPlayers?.includes(p.id) : match.teamBPlayers?.includes(p.id);
      });
      return teamPlayers.filter(p => !assignedPlayers.has(p.id) || p.id === currentPosPlayerId);
  }

  const benchPlayers = players.filter(p => !assignedPlayers.has(p.id));

  const handleSaveChanges = async () => {
    const updateData: Partial<Match> = {};
    if (canManageTeamA) {
      updateData.teamADetails = {
        tactic: tacticA,
        formation: formationA,
        captainId: captainA,
        penaltyTakerId: penaltyTakerA,
        cornerTakerId: cornerTakerA,
        freeKickTakerId: freeKickTakerA
      };
      updateData.teamAPlayers = Object.values(formationA).filter((id): id is string => !!id);
    }
    if (canManageTeamB) {
      updateData.teamBDetails = { tactic: tacticB, formation: formationB };
      updateData.teamBPlayers = Object.values(formationB).filter((id): id is string => !!id);
    }

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

  const FieldPosition = ({ team, position, formation, availablePlayers, disabled }: { team: 'A' | 'B', position: string, formation: Formation, availablePlayers: (User & {profile: PlayerProfile})[], disabled: boolean }) => {
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
  
  const FormationDisplay = ({ team, tactic, setTactic, formation, teamData, canManage }: { team: 'A' | 'B', tactic: Tactic, setTactic: (t: Tactic) => void, formation: Formation, teamData: Team | null, canManage: boolean }) => {
    const teamName = teamData?.name || (team === 'A' ? 'Vests A' : 'Vests B');
    const positions = formationPositionsByTactic[tactic];

    return (
      <div className="bg-green-600/20 p-4 rounded-lg border-2 border-dashed border-green-700/30 space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-center">{teamName}</h3>
            <Select value={tactic} onValueChange={(v) => setTactic(v as Tactic)} disabled={!canManage}>
                <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {tactics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-2">
            {positions.map(pos => (
                <FieldPosition 
                    key={pos}
                    team={team} 
                    position={pos} 
                    formation={formation} 
                    availablePlayers={getAvailablePlayersForTeam(team, formation[pos])} 
                    disabled={!canManage}
                />
            ))}
        </div>
      </div>
    );
  };
  
  const teamAPlayersOnField = players.filter(p => assignedPlayersA.has(p.id));

  return (
    <DialogContent className="max-w-6xl">
      <DialogHeader>
        <DialogTitle className="font-headline">Dressing Room</DialogTitle>
        <DialogDescription>Assign players to teams and positions for this match.</DialogDescription>
      </DialogHeader>
      
      {loading ? <p>Loading players...</p> : (
        <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 py-4">
                <FormationDisplay team="A" tactic={tacticA} setTactic={setTacticA} formation={formationA} teamData={teamA} canManage={canManageTeamA}/>
                <FormationDisplay team="B" tactic={tacticB} setTactic={setTacticB} formation={formationB} teamData={teamB} canManage={canManageTeamB}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-bold mb-2">Bench ({benchPlayers.length})</h4>
                    <div className="p-4 bg-muted rounded-md min-h-[60px] flex flex-wrap gap-2">
                        {benchPlayers.length > 0 ? benchPlayers.map(p => (
                            <div key={p.id} className="bg-background px-3 py-1 rounded-md text-sm font-medium">{p.name}</div>
                        )) : <p className="text-sm text-muted-foreground">No players on the bench.</p>}
                    </div>
                </div>

                {canManageTeamA && (
                <div>
                    <h4 className="font-bold mb-2">Tactical Roles</h4>
                    <div className="p-4 bg-muted rounded-md grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label>Captain</Label>
                        <Select value={captainA} onValueChange={setCaptainA}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Penalties</Label>
                        <Select value={penaltyTakerA} onValueChange={setPenaltyTakerA}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Corners</Label>
                        <Select value={cornerTakerA} onValueChange={setCornerTakerA}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Free Kicks</Label>
                        <Select value={freeKickTakerA} onValueChange={setFreeKickTakerA}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    </div>
                </div>
                )}
            </div>
        </>
      )}


      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSaveChanges} disabled={loading}>Save Teams</Button>
      </DialogFooter>
    </DialogContent>
  );
}
