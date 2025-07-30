import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function CompetitionsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Competitions</CardTitle>
        <CardDescription>View leagues and cups, create new competitions, and invite teams.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is available for Managers and Promoters. Full implementation coming soon.</p>
      </CardContent>
    </Card>
  );
}
