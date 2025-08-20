

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ShieldCheck, DollarSign, Goal, Award, ArrowRight } from "lucide-react";
import type { PlayerProfile, User } from "@/types";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import { PlayerProfileCard } from "../player-profile-card";

interface PlayerDashboardProps {
  data: {
    user: User;
    profile: PlayerProfile | null;
    upcomingGames: number;
    pendingPayments: number;
  }
}

export function PlayerDashboard({ data }: PlayerDashboardProps) {
  if (!data) return <Skeleton className="h-32 w-full col-span-4"/>;

  const { user, profile, upcomingGames, pendingPayments } = data;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {profile && user && (
          <PlayerProfileCard user={user} profile={profile} className="lg:col-span-1" />
      )}

      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="md:col-span-2">
              <CardHeader>
                  <CardTitle className="font-headline">Next Game</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center p-6">
                  <p className="text-6xl font-bold font-headline text-primary">{upcomingGames}</p>
                  <p className="text-muted-foreground mt-2">upcoming games on your schedule</p>
                  <Button size="lg" className="mt-6 font-bold" asChild>
                      <Link href="/dashboard/my-games">
                          View Games <ArrowRight className="ml-2"/>
                      </Link>
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
                  <p className="text-xs text-muted-foreground">{pendingPayments === 1 ? 'payment required' : 'payments required'}</p>
                  <Button size="sm" variant={pendingPayments > 0 ? "destructive" : "secondary"} className="mt-2" asChild>
                      <Link href="/dashboard/payments">
                          {pendingPayments > 0 ? 'Pay Now' : 'View History'}
                      </Link>
                  </Button>
              </CardContent>
          </Card>

          <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Recent Form</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="flex items-center gap-1">
                      {(profile?.recentForm && profile.recentForm.length > 0) ? (
                          profile.recentForm.slice(-5).map((form, i) => (
                              <Badge key={i} className={
                                  form === 'W' ? 'bg-green-500 hover:bg-green-500 text-white' :
                                  form === 'L' ? 'bg-red-500 hover:bg-red-500 text-white' :
                                  'bg-gray-400 hover:bg-gray-400 text-white'
                              }>{form}</Badge>
                          ))
                      ) : (
                          <p className="text-xs text-muted-foreground">No games played yet</p>
                      )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Last 5 matches</p>
              </CardContent>
          </Card>
      </div>
    </div>
  )
}
