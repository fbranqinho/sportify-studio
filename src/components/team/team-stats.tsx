
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Goal, Square } from "lucide-react";
import type { Team } from "@/types";

export function TeamStats({ team }: { team: Team }) {
   return (
    <div className="grid gap-4 md:grid-cols-3">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Form</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-1">
                    {(team.recentForm && team.recentForm.length > 0) ? (
                        team.recentForm.slice(0, 5).map((form, i) => (
                            <Badge
                            key={i}
                            className={
                                form === "W"
                                ? "bg-green-500 hover:bg-green-500 text-white"
                                : form === "L"
                                ? "bg-red-500 hover:bg-red-500 text-white"
                                : "bg-gray-400 hover:bg-gray-400 text-white"
                            }
                            >
                            {form}
                            </Badge>
                        ))
                    ) : (
                        <span className="text-xs text-muted-foreground">No games played</span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Last 5 matches</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Team Goals</CardTitle>
            <Goal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{team.wins * 3 + team.draws}</div>
            <p className="text-xs text-muted-foreground">Goals Scored this season</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Discipline</CardTitle>
            <Square className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-xl font-bold">{team.yellowCards} <span className="text-sm font-normal">Yellows</span></div>
            <div className="text-xl font-bold">{team.redCards} <span className="text-sm font-normal">Reds</span></div>
            </CardContent>
        </Card>
    </div>
  )
}
