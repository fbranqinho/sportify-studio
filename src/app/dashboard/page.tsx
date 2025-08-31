
"use client";

import * as React from "react";
import { collection, query, where, getDocs, Timestamp, limit, orderBy, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserRole, Match, Team, Pitch, Promo, PlayerProfile, Reservation, ManagerProfile, OwnerProfile } from "@/types";
import { PlayerDashboard } from "@/components/dashboards/player-dashboard";
import { ManagerDashboard } from "@/components/dashboards/manager-dashboard";
import { OwnerDashboard } from "@/components/dashboards/owner-dashboard";
import { PromoterDashboard } from "@/components/dashboards/promoter-dashboard";
import { RefereeDashboard } from "@/components/dashboards/referee-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useUser } from "@/hooks/use-user";
import { Skeleton } from "@/components/ui/skeleton";


interface WelcomeHeaderProps {
  role: UserRole;
  name: string;
}

const WelcomeHeader = ({ role, name }: WelcomeHeaderProps) => (
  <div>
    <h1 className="text-3xl font-bold font-headline">
      Welcome, {name}!
    </h1>
    <p className="text-muted-foreground">
      Here's your {role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()} dashboard overview.
    </p>
  </div>
);

const AdminDashboard = () => (
    <Card>
        <CardHeader>
            <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
            <p>Full implementation coming soon.</p>
        </CardContent>
    </Card>
);

const LoadingDashboard = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
    </div>
);

export default function DashboardPage() {
  const { user } = useUser();
  const [profileData, setProfileData] = React.useState<any>(null);
  const [loadingData, setLoadingData] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
        setLoadingData(true);
        try {
            let profile: any = null;
            let profileCollectionName = '';
            
            switch(user.role) {
                case "PLAYER": profileCollectionName = "playerProfiles"; break;
                case "MANAGER": profileCollectionName = "managerProfiles"; break;
                case "OWNER": profileCollectionName = "ownerProfiles"; break;
            }

            if (profileCollectionName) {
                const profileQuery = query(collection(db, profileCollectionName), where("userRef", "==", user.id), limit(1));
                const profileSnap = await getDocs(profileQuery);
                if (!profileSnap.empty) {
                    profile = {id: profileSnap.docs[0].id, ...profileSnap.docs[0].data()};
                }
            }
            
            setProfileData({ user, profile });

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoadingData(false);
        }
    };
    fetchData();
  }, [user]);

  if (loadingData || !user) {
    return (
       <div className="space-y-6">
        <WelcomeHeader role={"PLAYER"} name={"..."} />
        <LoadingDashboard />
      </div>
    );
  }

  const renderDashboard = () => {
    switch (user.role) {
      case "PLAYER":
        return <PlayerDashboard data={profileData} />;
      case "MANAGER":
        return <ManagerDashboard data={profileData} />;
      case "OWNER":
        return <OwnerDashboard data={profileData} />;
      case "PROMOTER":
        return <PromoterDashboard />;
      case "REFEREE":
        return <RefereeDashboard />;
      case "ADMIN":
        return <AdminDashboard />;
      default:
        // Fallback or loading state
        return <div>Loading dashboard...</div>;
    }
  };

  return (
    <div className="space-y-6">
      <WelcomeHeader role={user.role} name={user.name} />
      {renderDashboard()}
    </div>
  );
}
