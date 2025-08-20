
"use client";

import * as React from "react";
import { useUser } from "@/hooks/use-user";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerGamesView } from "@/components/game/views/player-games-view";
import { ManagerGamesView } from "@/components/game/views/manager-games-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GamesPage() {
    const { user, loading } = useUser();

    if (loading || !user) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-1 h-[80vh]" />
                    <Skeleton className="lg:col-span-2 h-[80vh]" />
                </div>
            </div>
        );
    }
    
    switch (user.role) {
        case "PLAYER":
        case "REFEREE":
            return <PlayerGamesView />;
        case "MANAGER":
            return <ManagerGamesView />;
        default:
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>This page is not available for your role.</p>
                    </CardContent>
                </Card>
            );
    }
}
