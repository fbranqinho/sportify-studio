
"use client";

import type { Team } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeamStats } from "./team-stats";

interface EnrichedTeamPlayer {
    playerId: string;
    number: number | null;
    profile?: { nickname?: string; position?: string; };
    user?: { name?: string; };
}

export function PlayerTeamView({ team, players }: { team: Team, players: EnrichedTeamPlayer[] }) {
  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  
  return (
    <div className="space-y-6">
       <TeamStats team={team} />
       <Card>
          <CardHeader>
             <CardTitle className="font-headline">Team Roster</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
                <TableHeader>
                   <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="w-[100px] text-center">Number</TableHead>
                      <TableHead className="text-right">Position</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {players.map(({ playerId, number, profile, user: playerUser }) => (
                      <TableRow key={playerId}>
                         <TableCell className="font-medium">{profile?.nickname ? capitalize(profile.nickname) : (playerUser?.name || "Unknown")}</TableCell>
                         <TableCell className="text-center font-mono">{number ?? "-"}</TableCell>
                         <TableCell className="text-right">{profile?.position ?? "N/A"}</TableCell>
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
          </CardContent>
       </Card>
    </div>
  )
}
