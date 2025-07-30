import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function PaymentsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Payments</CardTitle>
        <CardDescription>Manage all your payments, past and pending.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This feature is available for all roles. Full implementation coming soon.</p>
      </CardContent>
    </Card>
  );
}
