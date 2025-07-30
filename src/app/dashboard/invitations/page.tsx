
"use client";

// This page is no longer in use and can be deleted.
// The logic has been moved to /dashboard/teams/page.tsx for players.

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DeprecatedInvitationsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This page is no longer in use.</CardTitle>
        <CardDescription>
            Team invitations are now handled directly within the &quot;My Teams&quot; section.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
