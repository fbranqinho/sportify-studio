import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, ShieldCheck, DollarSign } from "lucide-react";

export function PlayerDashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Games</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">2</div>
          <p className="text-xs text-muted-foreground">vs. Team Rocket on Sunday</p>
          <Button size="sm" className="mt-2">View Games</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Discipline</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">1 <span className="text-sm font-normal">Yellow Card</span></div>
           <p className="text-xs text-muted-foreground">0 Red Cards</p>
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
             <Badge className="bg-green-500 hover:bg-green-500 text-white">W</Badge>
             <Badge className="bg-green-500 hover:bg-green-500 text-white">W</Badge>
             <Badge className="bg-red-500 hover:bg-red-500 text-white">L</Badge>
             <Badge className="bg-gray-400 hover:bg-gray-400 text-white">D</Badge>
             <Badge className="bg-green-500 hover:bg-green-500 text-white">W</Badge>
          </div>
           <p className="text-xs text-muted-foreground mt-2">Last 5 matches</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Overdue Payments</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold text-red-600">$15.00</div>
           <p className="text-xs text-muted-foreground">Team fee for May</p>
           <Button size="sm" variant="destructive" className="mt-2">Pay Now</Button>
        </CardContent>
      </Card>
    </div>
  )
}
