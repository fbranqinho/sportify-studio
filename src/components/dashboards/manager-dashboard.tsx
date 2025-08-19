
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, AlertTriangle, DollarSign, ArrowRight } from "lucide-react";
import type { Team, Match } from "@/types";
import { format } from "date-fns";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";

// Helper type for enriched match data, also add team names
interface EnrichedMatch extends Match {
    teamAName?: string;
    teamBName?: string;
}

interface ManagerDashboardProps {
  data: {
    teams: Team[];
    upcomingMatches: EnrichedMatch[];
    unavailablePlayers: number;
    pendingPayments: number;
  }
}

export function ManagerDashboard({ data }: ManagerDashboardProps) {
  if (!data) return <Skeleton className="h-32 w-full col-span-4"/>;
  
  const { teams, upcomingMatches, unavailablePlayers, pendingPayments } = data;
  const primaryTeam = teams?.[0];

  const getMatchTitle = (match: EnrichedMatch) => {
    if (match.teamAName && match.teamBName && match.teamBName !== 'TBD') {
        return `${match.teamAName} vs ${match.teamBName}`;
    }
    return `${match.teamAName} (Open for challenges)`;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
      <Card className="xl:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Games</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {upcomingMatches.length > 0 ? (
                <div className="space-y-4">
                    {upcomingMatches.map(match => (
                        <div key={match.id} className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{getMatchTitle(match)}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(match.date), "EEE, MMM d 'at' HH:mm")}</p>
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/dashboard/games/${match.id}`}>
                                    Manage <ArrowRight className="ml-2 h-4 w-4"/>
                                </Link>
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No upcoming matches scheduled.</p>
                    <Button size="sm" className="mt-2" variant="outline" asChild>
                        <Link href="/dashboard/games">Find a Pitch & Book</Link>
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
       <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Team Status</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{unavailablePlayers}</div>
           <p className="text-xs text-muted-foreground">players injured or unavailable</p>
           <Button size="sm" className="mt-2" asChild>
            <Link href={primaryTeam ? `/dashboard/teams/${primaryTeam.id}`: '/dashboard/teams'}>Manage Roster</Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">{pendingPayments}</div>
           <p className="text-xs text-muted-foreground">{pendingPayments === 1 ? 'payment to confirm' : 'payments to confirm'}</p>
           <Button size="sm" className="mt-2" variant="secondary" asChild>
             <Link href="/dashboard/my-games">View Games</Link>
            </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
