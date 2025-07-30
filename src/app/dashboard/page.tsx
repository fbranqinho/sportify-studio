
"use client";

import type { User, UserRole } from "@/types";
import { PlayerDashboard } from "@/components/dashboards/player-dashboard";
import { ManagerDashboard } from "@/components/dashboards/manager-dashboard";
import { OwnerDashboard } from "@/components/dashboards/owner-dashboard";
import { PromoterDashboard } from "@/components/dashboards/promoter-dashboard";
import { RefereeDashboard } from "@/components/dashboards/referee-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import React from "react";
import { getAuth } from "firebase/auth";
import { app, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface DashboardPageProps {
  role?: UserRole;
  userId?: string;
}

const WelcomeHeader = ({ role, name }: { role: UserRole, name: string }) => (
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


export default function DashboardPage({ role }: DashboardPageProps) {
  const [user, setUser] = React.useState<User | null>(null);
  const auth = getAuth(app);

  React.useEffect(() => {
    const fetchUser = async () => {
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                setUser({ id: userDoc.id, ...userDoc.data() } as User);
            }
        }
    }
    fetchUser();
  }, [auth]);

  if (!role || !user) {
    return <div>Loading...</div>;
  }

  const renderDashboard = () => {
    switch (role) {
      case "PLAYER":
        return <PlayerDashboard />;
      case "MANAGER":
        return <ManagerDashboard />;
      case "OWNER":
        return <OwnerDashboard />;
      case "PROMOTER":
        return <PromoterDashboard />;
      case "REFEREE":
        return <RefereeDashboard />;
      case "ADMIN":
        return <AdminDashboard />;
      default:
        return <PlayerDashboard />;
    }
  };

  return (
    <div className="space-y-6">
      <WelcomeHeader role={role} name={user.name} />
      {renderDashboard()}
    </div>
  );
}
