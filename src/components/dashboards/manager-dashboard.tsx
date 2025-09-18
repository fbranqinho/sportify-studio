
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, AlertTriangle, DollarSign, ArrowRight, Gamepad2, ShieldCheck, Square, Award } from "lucide-react";
import type { Team, Match, ManagerProfile, User } from "@/types";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import { ManagerProfileCard } from "../manager-profile-card";
import { Badge } from "../ui/badge";

interface ManagerDashboardProps {
  data: {
    user: User;
    profile: ManagerProfile | null;
  }
}

export function ManagerDashboard({ data }: ManagerDashboardProps) {
  if (!data) return <Skeleton className="h-32 w-full col-span-4"/>;
  
  const { user, profile } = data;
  const primaryTeam = profile?.teams?.[0] as any; // Simplified

  return (
     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {profile && user && (
          <ManagerProfileCard user={user} profile={profile} teams={profile.teams as any[]} className="lg:col-span-1" />
      )}

      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="md:col-span-2">
              <CardHeader>
                  <CardTitle className="font-headline">Next Game</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center p-6">
                  <p className="text-2xl text-muted-foreground mt-2">Find a pitch, book a game and manage your teams.</p>
                  <Button size="lg" className="mt-6 font-bold" asChild>
                      <Link href="/dashboard/games">
                          Find a Pitch <ArrowRight className="ml-2"/>
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
                  <p className="text-xs text-muted-foreground">Check for pending payments</p>
                  <Button size="sm" variant={"secondary"} className="mt-2" asChild>
                      <Link href="/dashboard/payments">
                          View Payments
                      </Link>
                  </Button>
              </CardContent>
          </Card>

           <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Team Status</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                 <p className="text-xs text-muted-foreground">Manage your player roster</p>
                 <Button size="sm" className="mt-2" asChild>
                    <Link href={primaryTeam ? `/dashboard/teams/${primaryTeam.id}` : '/dashboard/teams'}>
                        Manage Roster
                    </Link>
                 </Button>
              </CardContent>
          </Card>

           <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">My Teams</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                 <div className="text-2xl font-bold">{profile?.teams?.length || 0}</div>
                 <p className="text-xs text-muted-foreground">teams managed</p>
              </CardContent>
          </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Competitions</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                 <p className="text-xs text-muted-foreground">View and create competitions</p>
                  <Button size="sm" variant="secondary" className="mt-2" asChild>
                    <Link href="/dashboard/competitions">
                        Manage
                    </Link>
                 </Button>
              </CardContent>
          </Card>

      </div>
    </div>
  )
}
