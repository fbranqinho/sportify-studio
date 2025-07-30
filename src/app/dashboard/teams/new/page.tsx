
"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { ManagerProfile } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateTeamForm } from "@/components/forms/create-team-form";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewTeamPage() {
  const { user } = useUser();
  const [managerProfile, setManagerProfile] = React.useState<ManagerProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || user.role !== 'MANAGER') {
      setLoading(false);
      return;
    }

    const fetchManagerProfile = async () => {
      try {
        const q = query(collection(db, "managerProfiles"), where("userRef", "==", user.id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const managerDoc = querySnapshot.docs[0];
          setManagerProfile({ id: managerDoc.id, ...managerDoc.data() } as ManagerProfile);
        }
      } catch (error) {
        console.error("Error fetching manager profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchManagerProfile();
  }, [user]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!managerProfile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Could not find a manager profile. Please complete your profile first.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="outline" asChild>
                <Link href="/dashboard/teams">Back to Teams</Link>
            </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/teams">
                <ChevronLeft className="mr-2 h-4 w-4"/>
                Back to Teams
            </Link>
        </Button>
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Create a New Team</CardTitle>
                <CardDescription>Fill in the details below to register your new team.</CardDescription>
            </CardHeader>
            <CardContent>
                <CreateTeamForm managerProfile={managerProfile} />
            </CardContent>
        </Card>
    </div>
  );
}
