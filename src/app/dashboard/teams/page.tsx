
"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore";
import type { Team, ManagerProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users, MapPin, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsPage() {
  const { user } = useUser();
  const [managerProfile, setManagerProfile] = React.useState<ManagerProfile | null>(null);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || user.role !== 'MANAGER') return;

    const fetchManagerProfile = async () => {
      try {
        const q = query(collection(db, "managerProfiles"), where("userRef", "==", user.id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const managerDoc = querySnapshot.docs[0];
          setManagerProfile({ id: managerDoc.id, ...managerDoc.data() } as ManagerProfile);
        } else {
            setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching manager profile:", error);
        setLoading(false);
      }
    };

    fetchManagerProfile();
  }, [user]);

  React.useEffect(() => {
    if (!managerProfile) return;

    setLoading(true);
    const q = query(collection(db, "teams"), where("managerRef", "==", managerProfile.id));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const teamsData: Team[] = [];
      querySnapshot.forEach((doc) => {
        teamsData.push({ id: doc.id, ...doc.data() } as Team);
      });
      setTeams(teamsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teams:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [managerProfile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">My Teams</h1>
          <p className="text-muted-foreground">View, create, and manage your teams.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/teams/new">
            <PlusCircle className="mr-2" />
            Create New Team
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : teams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline">{team.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                  <MapPin className="h-4 w-4" /> {team.city}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>
                    <span className="font-semibold">{team.players.length}</span> players
                  </span>
                </div>
                 <p className="text-muted-foreground italic">&quot;{team.motto}&quot;</p>
              </CardContent>
              <CardFooter>
                 <Button variant="outline" className="w-full justify-between">
                    Manage Team <ChevronRight className="h-4 w-4" />
                 </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <CardHeader>
            <CardTitle className="font-headline">No Teams Found</CardTitle>
            <CardDescription>You haven't created any teams yet. Get started now!</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href="/dashboard/teams/new">
                    <PlusCircle className="mr-2" />
                    Create Your First Team
                </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
