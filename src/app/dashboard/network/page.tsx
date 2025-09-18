import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function NetworkPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Network</CardTitle>
        <CardDescription>Consult teams, managers, and players in the Sportify network.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is available for Promoters. Full implementation coming soon.</p>
      </CardContent>
    </Card>
  );
}
