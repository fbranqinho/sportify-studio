
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Calendar, Ticket, DollarSign } from "lucide-react";
import type { Pitch } from "@/types";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";


interface OwnerDashboardProps {
  data: {
    pitches: Pitch[];
    bookings: number;
    promos: number;
  }
}

export function OwnerDashboard({ data }: OwnerDashboardProps) {
  if (!data) return <Skeleton className="h-32 w-full col-span-4"/>;

  const { pitches, bookings, promos } = data;
  const availableToday = pitches.length; // Simplified for now
  
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">My Pitches</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pitches.length}</div>
          <p className="text-xs text-muted-foreground">{availableToday} available today</p>
          <Button size="sm" className="mt-2" asChild>
            <Link href="/dashboard/pitches">Manage Pitches</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{bookings}</div>
           <p className="text-xs text-muted-foreground">reservations for today</p>
           <Button size="sm" className="mt-2" variant="outline" asChild>
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
          <div className="text-2xl font-bold">{promos}</div>
           <p className="text-xs text-muted-foreground">active promotions running</p>
           <Button size="sm" className="mt-2" asChild>
            <Link href="/dashboard/promos">Manage Promos</Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">$450.00</div>
           <p className="text-xs text-muted-foreground">+15% from yesterday</p>
           <Button size="sm" className="mt-2" variant="secondary">View Payments</Button>
        </CardContent>
      </Card>
    </div>
  )
}
