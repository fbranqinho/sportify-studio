
"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import type { ManagerProfile } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateTeamForm } from "@/components/forms/create-team-form";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewTeamPage() {
  const { user } = useUser();
  
  if (!user) {
    return <Skeleton className="h-96 w-full" />;
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
                <CreateTeamForm managerId={user.id} />
            </CardContent>
        </Card>
    </div>
  );
}
