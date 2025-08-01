
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Award, DollarSign } from "lucide-react";
import type { Team, Match } from "@/types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";

interface ManagerDashboardProps {
  data: {
    team: Team | null;
    nextMatch: Match | null;
    competitions: number;
  }
}

export function ManagerDashboard({ data }: ManagerDashboardProps) {
  if (!data) return <Skeleton className="h-32 w-full col-span-4"/>;
  
  const { team, nextMatch, competitions } = data;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Main Team Roster</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{team?.playerIds?.length ?? 0}</div>
          <p className="text-xs text-muted-foreground">{team?.name ?? 'No team created'}</p>
          <Button size="sm" className="mt-2" asChild>
            <Link href={team ? `/dashboard/teams/${team.id}`: '/dashboard/teams'}>Manage Team</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Next Match</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {nextMatch ? (
            <>
              <div className="text-2xl font-bold">{formatDistanceToNow(new Date(nextMatch.date), { addSuffix: true })}</div>
              <p className="text-xs text-muted-foreground">vs. The All-Stars at 3:00 PM</p>
              <Button size="sm" className="mt-2" variant="outline" asChild>
                <Link href={`/dashboard/games/${nextMatch.id}`}>Set Lineup</Link>
              </Button>
            </>
          ) : (
             <>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">No upcoming matches scheduled</p>
               <Button size="sm" className="mt-2" variant="outline" asChild>
                <Link href="/dashboard/games">Find a Pitch</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{competitions}</div>
           <p className="text-xs text-muted-foreground">leagues & cups available</p>
           <Button size="sm" className="mt-2" asChild>
            <Link href="/dashboard/competitions">View Standings</Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">3</div>
           <p className="text-xs text-muted-foreground">players with outstanding fees</p>
           <Button size="sm" className="mt-2" variant="secondary">Send Reminders</Button>
        </CardContent>
      </Card>
    </div>
  )
}
