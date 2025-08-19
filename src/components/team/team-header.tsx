
"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Team } from "@/types";
import { MapPin } from "lucide-react";

export function TeamHeader({ team }: { team: Team }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-3xl">{team.name}</CardTitle>
        <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 pt-2">
            <span>Motto: &quot;{team.motto}&quot;</span>
            <span className="hidden sm:inline">|</span>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{team.city}</span>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
