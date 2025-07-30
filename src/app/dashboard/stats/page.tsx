
"use client";

import * as React from "react";
import { PlayerStatsChart } from "@/components/player-stats-chart";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { PlayerProfile } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";

export default function StatsPage() {
  const { user } = useUser();
  const userId = user?.id;
  const [playerProfile, setPlayerProfile] = React.useState<PlayerProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPlayerProfile = async () => {
      setLoading(true);

      if (typeof userId !== 'string' || !userId) {
        console.log("StatsPage: No valid userId yet.");
        setLoading(false);
        return;
      }
      
      try {
        const q = query(collection(db, "playerProfiles"), where("userRef", "==", userId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data() as PlayerProfile;
          setPlayerProfile({id: querySnapshot.docs[0].id, ...docData});
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

    fetchPlayerProfile();
  }, [userId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Statistics</h1>
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
