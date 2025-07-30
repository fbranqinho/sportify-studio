
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function GamesPage() {
  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold font-headline">Find a Game</h1>
        <p className="text-muted-foreground">
          Search for available games, pitches, or teams near you.
        </p>
      </div>
       <div className="grid gap-6">
         <Card>
            <CardHeader>
                <CardTitle>Search & Filter</CardTitle>
                <CardDescription>Use the options below to find your next match.</CardDescription>
            </CardHeader>
            <CardContent>
                <Input placeholder="Search by team name, city, or sport..." />
                {/* More filter components will go here */}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Full search and listing implementation coming soon.</p>
            </CardContent>
        </Card>
       </div>
    </div>
  );
}
