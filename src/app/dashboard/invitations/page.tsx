
"use client";

// This page is no longer in use and can be deleted.
// Team invitations are handled in /dashboard/teams
// Match invitations are handled in /dashboard/my-games

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DeprecatedInvitationsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This page is no longer in use.</CardTitle>
        <CardDescription>
            Please check &quot;My Teams&quot; for team invitations or &quot;My Games&quot; for match invitations.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
