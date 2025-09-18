import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ShieldCheck, Map, ArrowRight } from "lucide-react";
import Link from "next/link";

export function RefereeDashboard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Game</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">Sunday at 5:00 PM</div>
          <p className="text-xs text-muted-foreground">City Arena - Field 2</p>
          <p className="text-sm mt-2">Lions FC vs. Tigers United</p>
          <Button size="sm" className="mt-4 font-semibold" asChild>
            <Link href="/dashboard/my-games">
                View Details <ArrowRight className="ml-2"/>
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Matches Officiated</CardTitle>
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">78</div>
           <p className="text-xs text-muted-foreground">Total this season</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Find Games</CardTitle>
          <Map className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Looking for more games to officiate?</p>
           <Button size="sm" className="mt-4 font-semibold" variant="secondary" asChild>
            <Link href="/dashboard/games">
                Browse Available Games
            </Link>
           </Button>
        </CardContent>
      </Card>
    </div>
  )
}
