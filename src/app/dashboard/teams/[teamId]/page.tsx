

"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useTeamDetails } from "@/hooks/use-team-details";
import { ManagerTeamView } from "@/components/team/manager-team-view";
import { PlayerTeamView } from "@/components/team/player-team-view";
import { TeamHeader } from "@/components/team/team-header";
import { Skeleton } from "@/components/ui/skeleton";


export default function TeamDetailsPage() {
  const { user } = useUser();
  const {
      team, players, loading,
      handleRemovePlayer, handleUpdateNumber, handleInvitePlayer
  } = useTeamDetails();

  if (loading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-28 w-full" />
            <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  if (!team || !user) {
    return <div>Team not found.</div>;
  }

  const isManager = user.id === team.managerId;

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline">{isManager ? "Manage Team" : team.name}</h1>
            <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/teams">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Teams
                </Link>
            </Button>
        </div>

      <TeamHeader team={team} />

      {isManager ? (
        <ManagerTeamView 
            team={team} 
            players={players} 
            onPlayerRemoved={handleRemovePlayer} 
            onNumberUpdated={handleUpdateNumber}
            onPlayerInvited={handleInvitePlayer}
        />
      ) : (
        <PlayerTeamView team={team} players={players} />
      )}
    </div>
  );
}
