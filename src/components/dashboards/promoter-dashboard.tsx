import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Contact, Users, DollarSign, ArrowRight } from "lucide-react";
import Link from "next/link";

export function PromoterDashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">My Competitions</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">5</div>
          <p className="text-xs text-muted-foreground">2 ongoing, 3 upcoming</p>
          <Button size="sm" className="mt-4 font-semibold" asChild>
            <Link href="/dashboard/competitions">
                Manage <ArrowRight className="ml-2"/>
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Network Size</CardTitle>
          <Contact className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">1,200+</div>
           <p className="text-xs text-muted-foreground">Players, Managers & Teams</p>
           <Button size="sm" className="mt-4 font-semibold" variant="outline" asChild>
                <Link href="/dashboard/network">Explore Network</Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Registered Teams</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">48</div>
           <p className="text-xs text-muted-foreground">in current competitions</p>
            <Button size="sm" className="mt-4 font-semibold" variant="outline" asChild>
                <Link href="/dashboard/competitions">View Teams</Link>
            </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-3xl font-bold">$1,800</div>
           <p className="text-xs text-muted-foreground">collected this season</p>
           <Button size="sm" className="mt-4 font-semibold" variant="secondary" asChild>
            <Link href="/dashboard/payments">View Payments</Link>
           </Button>
        </CardContent>
      </Card>
    </div>
  )
}
