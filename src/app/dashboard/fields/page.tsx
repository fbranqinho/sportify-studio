import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function FieldsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">My Fields</CardTitle>
        <CardDescription>View and edit details of your available fields for rent.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is available for Owners. Full implementation coming soon.</p>
      </CardContent>
    </Card>
  );
}
