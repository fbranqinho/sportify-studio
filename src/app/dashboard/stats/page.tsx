
"use client";

import * as React from "react";
import { PlayerStatsChart } from "@/components/player-stats-chart";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { PlayerProfile } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsPageProps {
  userId?: string;
}

export default function StatsPage({ userId }: StatsPageProps) {
  const [playerProfile, setPlayerProfile] = React.useState<PlayerProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPlayerProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const q = query(collection(db, "playerProfiles"), where("userRef", "==", userId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data() as PlayerProfile;
          setPlayerProfile(docData);
        } else {
          console.log("No such player profile for userId:", userId);
          setPlayerProfile(null);
        }
      } catch (error) {
        console.error("Error fetching player profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerProfile();
  }, [userId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Player Statistics</h1>
        <p className="text-muted-foreground">
          An overview of your performance and attributes.
        </p>
      </div>
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <Skeleton className="lg:col-span-3 h-[500px]" />
            <Skeleton className="lg:col-span-2 h-[500px]" />
        </div>
      ) : playerProfile ? (
        <PlayerStatsChart playerProfile={playerProfile} />
      ) : (
        <p>No player data found.</p>
      )}
    </div>
  );
}
