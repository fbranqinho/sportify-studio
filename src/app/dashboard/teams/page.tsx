import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function TeamsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Teams</CardTitle>
        <CardDescription>View teams you belong to, manage your own teams, or consult teams in the network.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is available for Players, Managers, and Promoters. Full implementation coming soon.</p>
      </CardContent>
    </Card>
  );
}
