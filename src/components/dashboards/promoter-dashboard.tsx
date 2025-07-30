import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Contact, Users, DollarSign } from "lucide-react";

export function PromoterDashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">My Competitions</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">5</div>
          <p className="text-xs text-muted-foreground">2 ongoing, 3 upcoming</p>
          <Button size="sm" className="mt-2">Manage Competitions</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Network Size</CardTitle>
          <Contact className="h-4 w-4 text-muted-foreground" />
        </Header>
        <CardContent>
          <div className="text-2xl font-bold">1,200+</div>
           <p className="text-xs text-muted-foreground">Players, Managers & Teams</p>
           <Button size="sm" className="mt-2" variant="outline">Explore Network</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Registered Teams</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">48</div>
           <p className="text-xs text-muted-foreground">in current competitions</p>
           <Button size="sm" className="mt-2">View Teams</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Fees Collected</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">$1,800.00</div>
           <p className="text-xs text-muted-foreground">from current competitions</p>
           <Button size="sm" className="mt-2" variant="secondary">View Payments</Button>
        </CardContent>
      </Card>
    </div>
  )
}
