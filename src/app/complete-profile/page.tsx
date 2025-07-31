
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import type { User } from "@/types";
import { PlayerProfileForm } from "@/components/forms/player-profile-form";
import { OwnerProfileForm } from "@/components/forms/owner-profile-form";
import { ManagerProfileForm } from "@/components/forms/manager-profile-form";
import { Icons } from "@/components/icons";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CompleteProfilePage() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = { id: userDoc.id, ...userDoc.data() } as User;
          setUser(userData);
          if (userData.profileCompleted) {
            router.push("/dashboard");
          }
        } else {
          router.push("/login");
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, auth]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const renderProfileForm = () => {
    switch (user.role) {
      case "PLAYER":
        return <PlayerProfileForm userId={user.id} />;
      case "OWNER":
        return <OwnerProfileForm userId={user.id} />;
      case "MANAGER":
        return <ManagerProfileForm userId={user.id} userName={user.name} />;
      // Add other roles as needed
      default:
        return <p>No profile form available for your role yet.</p>;
    }
  };

  return (
     <div className="flex items-center justify-center min-h-screen bg-background">
       <div className="absolute top-4 left-4">
          <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold text-primary">
            <Icons.logo className="h-20 w-20" />
            <span>Sportify</span>
          </Link>
        </div>
      <Card className="mx-auto max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Complete Your Profile</CardTitle>
          <CardDescription>
            Just a few more details to get you started as a {user.role.toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {renderProfileForm()}
        </CardContent>
      </Card>
    </div>
  );
}
