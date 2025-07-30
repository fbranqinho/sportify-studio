import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Award, DollarSign } from "lucide-react";

export function ManagerDashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Team Roster</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">15 / 18</div>
          <p className="text-xs text-muted-foreground">players registered</p>
          <Button size="sm" className="mt-2">Manage Team</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Next Match</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Saturday</div>
           <p className="text-xs text-muted-foreground">vs. The All-Stars at 3:00 PM</p>
           <Button size="sm" className="mt-2" variant="outline">Set Lineup</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1</div>
           <p className="text-xs text-muted-foreground">City League - 3rd Place</p>
           <Button size="sm" className="mt-2">View Standings</Button>
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
