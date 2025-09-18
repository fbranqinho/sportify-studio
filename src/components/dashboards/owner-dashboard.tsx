
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Calendar, Ticket, DollarSign, ArrowRight } from "lucide-react";
import type { Pitch, OwnerProfile } from "@/types";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";


interface OwnerDashboardProps {
  data: {
    profile: OwnerProfile | null;
  }
}

export function OwnerDashboard({ data }: OwnerDashboardProps) {
  if (!data) return <Skeleton className="h-32 w-full col-span-4"/>;

  const { profile } = data;
  
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">My Pitches</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{profile?.pitches?.length || 0}</div>
          <p className="text-xs text-muted-foreground">total pitches registered</p>
          <Button size="sm" className="mt-4 font-semibold" asChild>
            <Link href="/dashboard/pitches">
                Manage <ArrowRight className="ml-2"/>
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">My Schedule</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <p className="text-xs text-muted-foreground">View your bookings and requests</p>
           <Button size="sm" className="mt-4 font-semibold" variant="outline" asChild>
            <Link href="/dashboard/schedule">View Schedule</Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
          <Ticket className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <p className="text-xs text-muted-foreground">Create and manage promotions</p>
           <Button size="sm" className="mt-4 font-semibold" asChild>
            <Link href="/dashboard/promos">Manage Promos</Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Payments</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <p className="text-xs text-muted-foreground">View payment history</p>
           <Button size="sm" className="mt-4 font-semibold" variant="secondary" asChild>
                <Link href="/dashboard/payments">View Payments</Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  )
}
