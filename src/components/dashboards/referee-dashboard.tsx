import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ShieldCheck, Map } from "lucide-react";

export function RefereeDashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Game</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Sunday at 5:00 PM</div>
          <p className="text-xs text-muted-foreground">City Arena - Field 2</p>
          <p className="text-sm mt-1">Lions FC vs. Tigers United</p>
          <Button size="sm" className="mt-2">View Game Details</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Matches Officiated</CardTitle>
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">78</div>
           <p className="text-xs text-muted-foreground">Total this season</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Find Games</CardTitle>
          <Map className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm">Looking for more games to officiate?</p>
           <Button size="sm" className="mt-2" variant="secondary">Browse Available Games</Button>
        </CardContent>
      </Card>
    </div>
  )
}
