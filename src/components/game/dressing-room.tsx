
"use client";

import * as React from "react";
import { doc, updateDoc, collection, query, where, documentId, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Match, Team, User, Formation, Tactic, PlayerProfile, Pitch } from "@/types";
import { cn, fut5Tactics, fut7Tactics, futsalTactics } from "@/lib/utils";
import { Sparkles, Users } from "lucide-react";

// --- TACTICS & POSITIONS ---
const formationPositionsByTactic: { [key in Tactic]: string[] } = {
    // Fut7
    "Fut7_3-2-1": ["GK", "CB1", "CB2", "CB3", "CM1", "CM2", "ST"],
    "Fut7_2-3-1": ["GK", "CB1", "CB2", "LM", "CM", "RM", "ST"],
    "Fut7_3-1-2": ["GK", "CB1", "CB2", "CB3", "CDM", "ST1", "ST2"],
    "Fut7_2-2-2": ["GK", "LB", "RB", "CM1", "CM2", "ST1", "ST2"],
    // Fut5
    "Fut5_2-1-1": ["GK", "DEF1", "DEF2", "MID", "FWD"],
    "Fut5_1-2-1": ["GK", "DEF", "LW", "RW", "PIV"],
    // Futsal
    "Futsal_1-2-1": ["GK", "DEF", "LW", "RW", "PIV"], // Diamond
    "Futsal_2-2":   ["GK", "DEF1", "DEF2", "FWD1", "FWD2"], // Square
    "Futsal_4-0":   ["GK", "P1", "P2", "P3", "P4"], // All-rounders
};

const positionStyles: { [key: string]: string } = {
  // Team A
  "A-GK": "top-[5%] left-1/2 -translate-x-1/2",
  "A-CB1": "top-[20%] left-1/4 -translate-x-1/2", "A-CB2": "top-[20%] left-1/2 -translate-x-1/2", "A-CB3": "top-[20%] left-3/4 -translate-x-1/2",
  "A-LB": "top-[20%] left-[15%]", "A-RB": "top-[20%] right-[15%]",
  "A-CM1": "top-[38%] left-1/4 -translate-x-1/2", "A-CM2": "top-[38%] left-3/4 -translate-x-1/2",
  "A-LM": "top-[35%] left-[15%]", "A-CM": "top-[35%] left-1/2 -translate-x-1/2", "A-RM": "top-[35%] right-[15%]",
  "A-CDM": "top-[30%] left-1/2 -translate-x-1/2",
  "A-ST": "top-[38%] left-1/2 -translate-x-1/2", "A-ST1": "top-[38%] left-1/4 -translate-x-1/2", "A-ST2": "top-[38%] left-3/4 -translate-x-1/2",
  "A-DEF": "top-[25%] left-1/2 -translate-x-1/2", "A-DEF1": "top-[25%] left-[25%]", "A-DEF2": "top-[25%] right-[25%]",
  "A-LW": "top-[35%] left-[20%]", "A-RW": "top-[35%] right-[20%]",
  "A-MID": "top-[35%] left-1/2 -translate-x-1/2",
  "A-FWD": "top-[45%] left-1/2 -translate-x-1/2", "A-FWD1": "top-[40%] left-[25%]", "A-FWD2": "top-[40%] right-[25%]",
  "A-PIV": "top-[45%] left-1/2 -translate-x-1/2",
  "A-P1": "top-[25%] left-[15%]", "A-P2": "top-[25%] right-[15%]", "A-P3": "top-[40%] left-[15%]", "A-P4": "top-[40%] right-[15%]",

  // Team B
  "B-GK": "bottom-[5%] left-1/2 -translate-x-1/2",
  "B-CB1": "bottom-[20%] left-1/4 -translate-x-1/2", "B-CB2": "bottom-[20%] left-1/2 -translate-x-1/2", "B-CB3": "bottom-[20%] left-3/4 -translate-x-1/2",
  "B-LB": "bottom-[20%] left-[15%]", "B-RB": "bottom-[20%] right-[15%]",
  "B-CM1": "bottom-[38%] left-1/4 -translate-x-1/2", "B-CM2": "bottom-[38%] left-3/4 -translate-x-1/2",
  "B-LM": "bottom-[35%] left-[15%]", "B-CM": "bottom-[35%] left-1/2 -translate-x-1/2", "B-RM": "bottom-[35%] right-[15%]",
  "B-CDM": "bottom-[30%] left-1/2 -translate-x-1/2",
  "B-ST": "bottom-[38%] left-1/2 -translate-x-1/2", "B-ST1": "bottom-[38%] left-1/4 -translate-x-1/2", "B-ST2": "bottom-[38%] left-3/4 -translate-x-1/2",
  "B-DEF": "bottom-[25%] left-1/2 -translate-x-1/2", "B-DEF1": "bottom-[25%] left-[25%]", "B-DEF2": "bottom-[25%] right-[25%]",
  "B-LW": "bottom-[35%] left-[20%]", "B-RW": "bottom-[35%] right-[20%]",
  "B-MID": "bottom-[35%] left-1/2 -translate-x-1/2",
  "B-FWD": "bottom-[45%] left-1/2 -translate-x-1/2", "B-FWD1": "bottom-[40%] left-[25%]", "B-FWD2": "bottom-[40%] right-[25%]",
  "B-PIV": "bottom-[45%] left-1/2 -translate-x-1/2",
  "B-P1": "bottom-[25%] left-[15%]", "B-P2": "bottom-[25%] right-[15%]", "B-P3": "bottom-[40%] left-[15%]", "B-P4": "bottom-[40%] right-[15%]",
};


// --- COMPONENT ---

interface DressingRoomProps {
  match: Match;
  onUpdate: (data: Partial<Match>) => void;
  onClose: () => void;
  teamA: Team | null;
  teamB: Team | null;
  pitch: Pitch | null;
  currentUserIsManagerFor: 'A' | 'B' | 'none';
}

const Bench = ({ title, players }: { title: string, players: (User & { profile: PlayerProfile })[] }) => (
    <div>
        <h4 className="font-bold mb-2 flex items-center gap-2"><Users className="h-4 w-4"/>{title} ({players.length})</h4>
        <div className="p-4 bg-muted rounded-md min-h-[60px] flex flex-wrap gap-2">
            {players.length > 0 ? players.map(p => (
                <div key={p.id} className="bg-background px-3 py-1 rounded-md text-sm font-medium">{p.name}</div>
            )) : <p className="text-sm text-muted-foreground">No players on the bench.</p>}
        </div>
    </div>
);


export function DressingRoom({ match, onUpdate, onClose, teamA, teamB, pitch, currentUserIsManagerFor }: DressingRoomProps) {
  const [players, setPlayers] = React.useState<(User & { profile: PlayerProfile })[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const { toast } = useToast();

  const getTacticsForSport = (sport: Pitch['sport'] | undefined) => {
    switch (sport) {
        case 'fut5': return fut5Tactics;
        case 'futsal': return futsalTactics;
        case 'fut7':
        default: return fut7Tactics;
    }
  };

  const availableTactics = getTacticsForSport(pitch?.sport);
  const defaultTactic = availableTactics[0];

  const [tacticA, setTacticA] = React.useState<Tactic>(match.teamADetails?.tactic || defaultTactic);
  const [formationA, setFormationA] = React.useState<Formation>(match.teamADetails?.formation || {});
  const [captainA, setCaptainA] = React.useState<string | undefined>(match.teamADetails?.captainId);
  const [penaltyTakerA, setPenaltyTakerA] = React.useState<string | undefined>(match.teamADetails?.penaltyTakerId);
  const [cornerTakerA, setCornerTakerA] = React.useState<string | undefined>(match.teamADetails?.cornerTakerId);
  const [freeKickTakerA, setFreeKickTakerA] = React.useState<string | undefined>(match.teamADetails?.freeKickTakerId);

  const [tacticB, setTacticB] = React.useState<Tactic>(match.teamBDetails?.tactic || defaultTactic);
  const [formationB, setFormationB] = React.useState<Formation>(match.teamBDetails?.formation || {});
  const [captainB, setCaptainB] = React.useState<string | undefined>(match.teamBDetails?.captainId);
  const [penaltyTakerB, setPenaltyTakerB] = React.useState<string | undefined>(match.teamBDetails?.penaltyTakerId);
  const [cornerTakerB, setCornerTakerB] = React.useState<string | undefined>(match.teamBDetails?.cornerTakerId);
  const [freeKickTakerB, setFreeKickTakerB] = React.useState<string | undefined>(match.teamBDetails?.freeKickTakerId);

  
  const isPracticeMatch = !!match.teamARef && !match.teamBRef;
  const hasOpponent = !!match.teamBRef;
  const canManageTeamA = currentUserIsManagerFor === 'A';
  const canManageTeamB = currentUserIsManagerFor === 'B';
  const canManagePractice = isPracticeMatch && currentUserIsManagerFor === 'A';

  const assignPlayersToFormation = (
    currentFormation: Formation,
    playersToAssign: (User & { profile: PlayerProfile })[],
    tactic: Tactic,
    takenIds: Set<string>
  ) => {
    const newFormation = { ...currentFormation };
    const positions = formationPositionsByTactic[tactic];
    const localTakenIds = new Set(takenIds);

    positions.forEach(pos => {
      let playerToAssign: (User & { profile: PlayerProfile }) | undefined;
      // Prefer players for their actual position
      if (pos === "GK") playerToAssign = playersToAssign.find(p => p.profile.position === "Goalkeeper" && !localTakenIds.has(p.id));
      else if (pos.includes("DEF") || pos.includes("CB") || pos.includes("LB") || pos.includes("RB")) playerToAssign = playersToAssign.find(p => p.profile.position === "Defender" && !localTakenIds.has(p.id));
      else if (pos.includes("CM") || pos.includes("LM") || pos.includes("RM") || pos.includes("CDM") || pos.includes("MID")) playerToAssign = playersToAssign.find(p => p.profile.position === "Midfielder" && !localTakenIds.has(p.id));
      else if (pos.includes("ST") || pos.includes("FWD") || pos.includes("PIV") || pos.includes("LW") || pos.includes("RW")) playerToAssign = playersToAssign.find(p => p.profile.position === "Forward" && !localTakenIds.has(p.id));
      
      // Fallback to any available player
      if (!playerToAssign) playerToAssign = playersToAssign.find(p => !localTakenIds.has(p.id));

      if (playerToAssign) {
        newFormation[pos] = playerToAssign.id;
        localTakenIds.add(playerToAssign.id);
      } else {
        newFormation[pos] = null;
      }
    });
    return newFormation;
  };

  const handleAutoFill = () => {
    if (players.length === 0) return;
    
    if (canManagePractice) {
        const shuffled = [...players].sort(() => 0.5 - Math.random());
        const midPoint = Math.ceil(shuffled.length / 2);
        const playersForA = shuffled.slice(0, midPoint);
        const playersForB = shuffled.slice(midPoint);

        const filledFormationA = assignPlayersToFormation({}, playersForA, tacticA, new Set());
        const filledFormationB = assignPlayersToFormation({}, playersForB, tacticB, new Set(Object.values(filledFormationA)));

        setFormationA(filledFormationA);
        setFormationB(filledFormationB);
        toast({ title: "Teams Auto-Filled!", description: "Players have been randomly assigned to both teams." });
    } 
    else if (hasOpponent) {
        if (canManageTeamA) {
            const playersForA = players.filter(p => match.teamAPlayers?.includes(p.id));
            const filledFormationA = assignPlayersToFormation(formationA, playersForA, tacticA, new Set(Object.values(formationB)));
            setFormationA(filledFormationA);
            toast({ title: "Team Auto-Filled!", description: "Your team's positions have been filled." });
        } else if (canManageTeamB) {
            const playersForB = players.filter(p => match.teamBPlayers?.includes(p.id));
            const filledFormationB = assignPlayersToFormation(formationB, playersForB, tacticB, new Set(Object.values(formationA)));
            setFormationB(filledFormationB);
            toast({ title: "Team Auto-Filled!", description: "Your team's positions have been filled." });
        }
    }
  };

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
  
  const getAvailablePlayersForTeam = (teamId: 'A' | 'B', currentPosPlayerId: string | null): (User & {profile: PlayerProfile})[] => {
      let teamPlayers;
      if (isPracticeMatch) {
          teamPlayers = players;
      } else {
          teamPlayers = players.filter(p => (teamId === 'A' ? match.teamAPlayers?.includes(p.id) : match.teamBPlayers?.includes(p.id)));
      }

      const assignedInOtherTeam = teamId === 'A' ? assignedPlayersB : assignedPlayersA;
      return teamPlayers.filter(p => {
          const isAssigned = (teamId === 'A' ? assignedPlayersA : assignedPlayersB).has(p.id);
          const isAssignedOther = isPracticeMatch ? false : assignedInOtherTeam.has(p.id);
          return (!isAssigned && !isAssignedOther) || p.id === currentPosPlayerId;
      });
  }

  const getBenchA = () => {
    const teamAPlayerIds = new Set(match.teamAPlayers || []);
    return players.filter(p => teamAPlayerIds.has(p.id) && !assignedPlayersA.has(p.id));
  };
  
  const getBenchB = () => {
    const teamBPlayerIds = new Set(match.teamBPlayers || []);
    return players.filter(p => teamBPlayerIds.has(p.id) && !assignedPlayersB.has(p.id));
  };

  const handleSaveChanges = async () => {
    const updateData: Partial<Match> = {};
    const canUpdateA = canManageTeamA || canManagePractice;
    const canUpdateB = canManageTeamB || canManagePractice;
    
    if (canUpdateA) {
      updateData.teamADetails = {
        tactic: tacticA,
        formation: formationA,
        captainId: captainA || null,
        penaltyTakerId: penaltyTakerA || null,
        cornerTakerId: cornerTakerA || null,
        freeKickTakerId: freeKickTakerA || null
      };
      if (isPracticeMatch) updateData.teamAPlayers = Object.values(formationA).filter((id): id is string => !!id);
    }
    if (canUpdateB) {
      updateData.teamBDetails = { 
          tactic: tacticB, 
          formation: formationB,
          captainId: captainB || null,
          penaltyTakerId: penaltyTakerB || null,
          cornerTakerId: cornerTakerB || null,
          freeKickTakerId: freeKickTakerB || null
      };
      if (isPracticeMatch) updateData.teamBPlayers = Object.values(formationB).filter((id): id is string => !!id);
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

  const FieldPosition = ({ team, position, formation, disabled }: { team: 'A' | 'B', position: string, formation: Formation, disabled: boolean }) => {
    const selectedPlayerId = formation[position] || "empty";
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);
    const availablePlayers = getAvailablePlayersForTeam(team, selectedPlayerId);

    const baseStyle = "absolute z-10 w-32 flex flex-col items-center gap-1";
    const positionStyle = positionStyles[`${team}-${position}`];

    if (disabled) {
        return (
             <div className={cn(baseStyle, positionStyle)}>
                <Label htmlFor={`${team}-${position}`} className="text-xs font-bold text-muted-foreground">{position}</Label>
                <div className="w-full h-8 mt-1 flex items-center justify-center bg-muted/50 rounded-md text-sm text-muted-foreground px-2 truncate">
                    {selectedPlayer?.name || '-'}
                </div>
            </div>
        )
    }

    return (
        <div className={cn(baseStyle, positionStyle)}>
            <Label htmlFor={`${team}-${position}`} className="text-xs font-bold text-white shadow-black [text-shadow:1px_1px_2px_var(--tw-shadow-color)]">{position}</Label>
            <Select value={selectedPlayerId} onValueChange={(value) => handleFormationChange(team, position, value)}>
                <SelectTrigger id={`${team}-${position}`} className="w-full h-8">
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
  
  const teamAPlayersOnField = players.filter(p => assignedPlayersA.has(p.id));
  const teamBPlayersOnField = players.filter(p => assignedPlayersB.has(p.id));

  return (
    <DialogContent className="max-w-4xl">
        <DialogHeader>
            <DialogTitle className="font-headline">Dressing Room</DialogTitle>
            <DialogDescription>Assign players to teams and positions for this match.</DialogDescription>
        </DialogHeader>
      
        <div className="max-h-[70vh] overflow-y-auto pr-4">
            {loading ? <p>Loading players...</p> : (
                <div className="space-y-6">
                    {/* The Field */}
                    <div className="bg-green-600/20 p-4 rounded-lg border-2 border-dashed border-green-700/30 min-h-[500px] relative">
                        {/* Field Markings */}
                        <div className="absolute top-1/2 left-0 w-full h-px bg-white/30"></div>
                        <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white/30 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute top-0 left-1/2 w-48 h-24 border-2 border-white/30 rounded-b-xl -translate-x-1/2 border-t-0"></div>
                        <div className="absolute bottom-0 left-1/2 w-48 h-24 border-2 border-white/30 rounded-t-xl -translate-x-1/2 border-b-0"></div>
                        
                        {/* Team A Formation */}
                        {formationPositionsByTactic[tacticA].map(pos => (
                            <FieldPosition key={`A-${pos}`} team="A" position={pos} formation={formationA} disabled={!(canManageTeamA || canManagePractice)} />
                        ))}

                        {/* Team B Formation */}
                        {formationPositionsByTactic[tacticB].map(pos => (
                            <FieldPosition key={`B-${pos}`} team="B" position={pos} formation={formationB} disabled={!(canManageTeamB || canManagePractice)} />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Team A Controls */}
                         <div className="space-y-4">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-lg font-bold text-center">{teamA?.name || 'Vests A'}</h3>
                                <Select value={tacticA} onValueChange={(v) => setTacticA(v as Tactic)} disabled={!(canManageTeamA || canManagePractice)}>
                                    <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{availableTactics.map(t => <SelectItem key={t} value={t}>{t.replace(/Fut\d{1,2}_|Futsal_/, '')}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             {(canManageTeamA || canManagePractice) && (
                              <div>
                                  <h4 className="font-bold mb-2 text-sm px-4">Tactical Roles</h4>
                                  <div className="p-4 bg-muted rounded-md grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label className="text-xs">Captain</Label><Select value={captainA} onValueChange={setCaptainA}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label className="text-xs">Penalties</Label><Select value={penaltyTakerA} onValueChange={setPenaltyTakerA}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label className="text-xs">Corners</Label><Select value={cornerTakerA} onValueChange={setCornerTakerA}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label className="text-xs">Free Kicks</Label><Select value={freeKickTakerA} onValueChange={setFreeKickTakerA}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamAPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                  </div>
                              </div>
                             )}
                         </div>
                         {/* Team B Controls */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-lg font-bold text-center">{teamB?.name || 'Vests B'}</h3>
                                <Select value={tacticB} onValueChange={(v) => setTacticB(v as Tactic)} disabled={!(canManageTeamB || canManagePractice)}>
                                    <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{availableTactics.map(t => <SelectItem key={t} value={t}>{t.replace(/Fut\d{1,2}_|Futsal_/, '')}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             {(canManageTeamB || canManagePractice) && (
                              <div>
                                  <h4 className="font-bold mb-2 text-sm px-4">Tactical Roles</h4>
                                  <div className="p-4 bg-muted rounded-md grid grid-cols-2 gap-4">
                                     <div className="space-y-1"><Label className="text-xs">Captain</Label><Select value={captainB} onValueChange={setCaptainB}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamBPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label className="text-xs">Penalties</Label><Select value={penaltyTakerB} onValueChange={setPenaltyTakerB}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamBPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label className="text-xs">Corners</Label><Select value={cornerTakerB} onValueChange={setCornerTakerB}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamBPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label className="text-xs">Free Kicks</Label><Select value={freeKickTakerB} onValueChange={setFreeKickTakerB}><SelectTrigger className="h-8"><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{teamBPlayersOnField.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                  </div>
                              </div>
                             )}
                        </div>
                    </div>
                    {/* Benches */}
                    <div className="space-y-4">
                        {(canManageTeamA || canManagePractice) && <Bench title={`${teamA?.name || 'Vests A'} Bench`} players={getBenchA()} />}
                        {(canManageTeamB || canManagePractice) && <Bench title={`${teamB?.name || 'Vests B'} Bench`} players={getBenchB()} />}
                    </div>
                </div>
            )}
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {(canManagePractice || (hasOpponent && (canManageTeamA || canManageTeamB))) && (
                <Button variant="secondary" onClick={handleAutoFill}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Auto-fill
                </Button>
            )}
            <Button onClick={handleSaveChanges} disabled={loading}>Save Teams</Button>
        </DialogFooter>
    </DialogContent>
  );
}
