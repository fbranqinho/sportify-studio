"use client";

import type { UserRole } from "@/types";
import { PlayerDashboard } from "@/components/dashboards/player-dashboard";
import { ManagerDashboard } from "@/components/dashboards/manager-dashboard";
import { OwnerDashboard } from "@/components/dashboards/owner-dashboard";
import { PromoterDashboard } from "@/components/dashboards/promoter-dashboard";
import { RefereeDashboard } from "@/components/dashboards/referee-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface DashboardPageProps {
  role: UserRole;
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
  const name = "First Player"; // This would come from user data

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
      <WelcomeHeader role={role} name={name} />
      {renderDashboard()}
    </div>
  );
}
