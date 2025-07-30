import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function GamesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Games</CardTitle>
        <CardDescription>View your past and upcoming games with all related details.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is available for Players, Managers, and Owners. Full implementation coming soon.</p>
      </CardContent>
    </Card>
  );
}
