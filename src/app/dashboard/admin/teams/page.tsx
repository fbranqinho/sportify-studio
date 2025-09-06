
"use client";

import * as React from "react";
import type { Team } from "@/types";
import { getAllTeams } from "@/ai/flows/admin-flow";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheckIcon } from "lucide-react";

export default function AdminTeamsPage() {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const allTeams = await getAllTeams();
        setTeams(allTeams);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching teams",
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [toast]);

  const filteredTeams = teams.filter(t =>
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.managerId?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => (a.name || "").localeCompare(b.name || ""));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
            <ShieldCheckIcon /> All Teams ({teams.length})
        </h1>
        <p className="text-muted-foreground">View and manage all teams in the database.</p>
       </div>
       <Card>
        <CardHeader>
            <CardTitle>Filter Teams</CardTitle>
            <CardDescription>Search by ID, name, city, or manager ID.</CardDescription>
        </CardHeader>
        <CardContent>
            <Input 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </CardContent>
       </Card>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Manager ID</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>Record (W-D-L)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeams.length > 0 ? filteredTeams.map(team => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.city}</TableCell>
                  <TableCell className="font-mono text-xs">{team.managerId}</TableCell>
                  <TableCell className="text-center">{team.playerIds?.length || 0}</TableCell>
                  <TableCell className="font-mono">{team.wins}-{team.draws}-{team.losses}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">No teams found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
