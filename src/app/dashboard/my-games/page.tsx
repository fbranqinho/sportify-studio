
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function MyGamesPage() {
  return (
    <div className="space-y-8">
      {/* Game Invitations Section */}
       <div>
        <h1 className="text-3xl font-bold font-headline">Game Invitations</h1>
        <p className="text-muted-foreground">Accept or decline invitations to play in individual games.</p>
        <Card className="mt-4 flex flex-col items-center justify-center p-12 text-center">
            <CardHeader>
                <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="font-headline mt-4">No Game Invitations</CardTitle>
                <CardDescription>This feature is coming soon!</CardDescription>
            </CardHeader>
        </Card>
       </div>
      
       {/* Scheduled Games Section */}
      <div className="border-t pt-8">
         <h1 className="text-3xl font-bold font-headline">My Schedule</h1>
         <p className="text-muted-foreground">View your scheduled and past games.</p>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="font-headline">Game History</CardTitle>
            <CardDescription>Your upcoming and past games will be shown here.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>This feature is under construction. Soon you'll be able to see your game history and upcoming matches here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
