"use client";

import * as React from "react";
import { PlayerStatsChart } from "@/components/player-stats-chart";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { PlayerProfile } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";

export default function StatsPage() {
    const { user } = useUser();
    const userId = user?.id;
    const [playerProfile, setPlayerProfile] = React.useState<PlayerProfile | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchPlayerProfile = async () => {
            setLoading(true);

            if (typeof userId !== "string" || !userId) {
                console.log("StatsPage: No valid userId yet.");
                setLoading(false);
                return;
            }

            try {
                const q = query(collection(db, "playerProfiles"), where("userRef", "==", userId));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const snap = querySnapshot.docs[0];
                    const data = snap.data() as Omit<PlayerProfile, "id">;
                    setPlayerProfile({ ...data, id: snap.id });
                } else {
                    console.log(`StatsPage: No player profile found for userId: ${userId}`);
                    setPlayerProfile(null);
                }
            } catch (error) {
                console.error("StatsPage: Error fetching player profile:", error);
                setPlayerProfile(null);
            } finally {
                setLoading(false);
            }
        };

        if (user?.premiumPlan) {
            fetchPlayerProfile();
        } else {
            setLoading(false);
        }
    }, [userId, user?.premiumPlan]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                    <Skeleton className="lg:col-span-3 h-[500px]" />
                    <Skeleton className="lg:col-span-2 h-[500px]" />
                </div>
            </div>
        );
    }

    if (!user?.premiumPlan) {
        return (
            <Card className="text-center">
                <CardHeader>
                    <Lock className="mx-auto h-12 w-12 text-primary" />
                    <CardTitle className="mt-4 font-headline text-2xl">Upgrade to Pro</CardTitle>
                    <CardDescription>Esta funcionalidade está disponível apenas para membros premium.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4 text-muted-foreground">
                        Desbloqueie estatísticas detalhadas, análise de desempenho e mais para elevar seu jogo.
                    </p>
                    <Button size="lg" asChild>
                        <Link href="/dashboard/settings">Upgrade Your Plan</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">My Statistics</h1>
                <p className="text-muted-foreground">An overview of your performance and attributes.</p>
            </div>
            {playerProfile ? <PlayerStatsChart playerProfile={playerProfile} /> : <p>No player data found.</p>}
        </div>
    );
}