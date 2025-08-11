
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, ShieldCheck, DollarSign } from "lucide-react";
import type { PlayerProfile } from "@/types";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";

interface PlayerDashboardProps {
  data: {
    profile: PlayerProfile | null;
    upcomingGames: number;
    pendingPayments: number;
  }
}

export function PlayerDashboard({ data }: PlayerDashboardProps) {
  if (!data) return <Skeleton className="h-32 w-full col-span-4"/>;

  const { profile, upcomingGames, pendingPayments } = data;
  
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Games</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{upcomingGames}</div>
          <p className="text-xs text-muted-foreground">games on your schedule</p>
          <Button size="sm" className="mt-2" asChild>
            <Link href="/dashboard/my-games">View Games</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Discipline</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">{profile?.yellowCards ?? 0} <span className="text-sm font-normal">Yellows</span></div>
           <p className="text-xs text-muted-foreground">{profile?.redCards ?? 0} Red Cards</p>
           <p className="text-xs text-muted-foreground mt-2 text-green-600 font-semibold">Clean record this month</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Recent Form</CardTitle>
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
             {(profile?.recentForm?.length > 0 ? profile.recentForm : ['N','A','N','A','N']).slice(0,5).map((form, i) => (
               <Badge key={i} className={
                form === 'W' ? 'bg-green-500 hover:bg-green-500' :
                form === 'L' ? 'bg-red-500 hover:bg-red-500' :
                'bg-gray-400 hover:bg-gray-400'
               }>{form}</Badge>
             ))}
          </div>
           <p className="text-xs text-muted-foreground mt-2">Last 5 matches</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">{pendingPayments}</div>
           <p className="text-xs text-muted-foreground">{pendingPayments === 1 ? 'payment required' : 'payments required'}</p>
           <Button size="sm" variant={pendingPayments > 0 ? "destructive" : "secondary"} className="mt-2" asChild>
            <Link href="/dashboard/payments">
              {pendingPayments > 0 ? 'Pay Now' : 'View History'}
            </Link>
           </Button>
        </CardContent>
      </Card>
    </div>
  )
}
