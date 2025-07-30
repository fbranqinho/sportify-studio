
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function MyGamesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">My Games</CardTitle>
        <CardDescription>View your scheduled and past games.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is under construction. Soon you'll be able to see your game history and upcoming matches here.</p>
      </CardContent>
    </Card>
  );
}
