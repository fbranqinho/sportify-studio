import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function PromosPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Promotions</CardTitle>
        <CardDescription>Launch promotions for your fields during vacant hours to increase profitability.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is available for Owners. Full implementation coming soon.</p>
      </CardContent>
    </Card>
  );
}
