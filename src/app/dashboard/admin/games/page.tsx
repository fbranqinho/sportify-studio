
"use client";

import * as React from "react";
import type { Match } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Gamepad2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteMatchById, getAllMatches } from "@/lib/actions/admin";

export default function AdminGamesPage() {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();

  const fetchMatches = React.useCallback(async () => {
    setLoading(true);
    try {
      const allMatches = await getAllMatches();
      setMatches(allMatches as Match[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching games",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleDelete = async (matchId: string) => {
    try {
      const result = await deleteMatchById(matchId);
      if (result.success) {
        toast({ title: "Game Deleted", description: result.message });
        fetchMatches(); // Refresh the list
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: `An unexpected error occurred: ${error.message}` });
    }
  };

  const filteredMatches = matches.filter(m =>
    m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.pitchRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.teamARef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.teamBRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.status.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => (b.date?.toDate().getTime() || 0) - (a.date?.toDate().getTime() || 0));

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
            <Gamepad2 /> All Games ({matches.length})
        </h1>
        <p className="text-muted-foreground">View and manage all games in the database.</p>
       </div>
       <Card>
        <CardHeader>
            <CardTitle>Filter Games</CardTitle>
            <CardDescription>Search by ID, team refs, pitch refs, or status.</CardDescription>
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
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team A vs Team B</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.length > 0 ? filteredMatches.map(match => (
                <TableRow key={match.id}>
                  <TableCell>{match.date ? format(match.date.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                  <TableCell><Badge variant={match.status === 'Finished' ? 'default' : 'secondary'}>{match.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{match.teamARef} vs {match.teamBRef || 'N/A'}</TableCell>
                  <TableCell className="font-mono">{match.scoreA} - {match.scoreB}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete game <strong>{match.id}</strong> and all associated data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(match.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">No games found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
