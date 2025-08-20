
"use client";

import * as React from "react";
import { collection, query, where, getDocs, Timestamp, limit, orderBy, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserRole, Match, Team, Pitch, Promo, PlayerProfile, Reservation } from "@/types";
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

// Helper type for enriched match data
interface EnrichedMatch extends Match {
    teamAName?: string;
    teamBName?: string;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [dashboardData, setDashboardData] = React.useState<any>(null);
  const [loadingData, setLoadingData] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
        setLoadingData(true);
        try {
            switch(user.role) {
                case "PLAYER": {
                    const playerProfileQuery = query(collection(db, "playerProfiles"), where("userRef", "==", user.id), limit(1));
                    const playerTeamsQuery = query(collection(db, "teams"), where("playerIds", "array-contains", user.id));
                    
                    const [profileSnap, teamsSnap] = await Promise.all([getDocs(playerProfileQuery), getDocs(playerTeamsQuery)]);
                    
                    const profile = profileSnap.empty ? null : {id: profileSnap.docs[0].id, ...profileSnap.docs[0].data()} as PlayerProfile;
                    const teamIds = teamsSnap.docs.map(doc => doc.id);
                    
                    let upcomingGames = 0;
                    if (teamIds.length > 0) {
                        const gamesAQuery = query(collection(db, "matches"), where("teamARef", "in", teamIds), where("status", "in", ["Scheduled", "Collecting players"]));
                        const gamesBQuery = query(collection(db, "matches"), where("teamBRef", "in", teamIds), where("status", "in", ["Scheduled", "Collecting players"]));
                        const [gamesASnap, gamesBSnap] = await Promise.all([getDocs(gamesAQuery), getDocs(gamesBQuery)]);
                        
                        const now = new Date();
                        const upcomingGamesA = gamesASnap.docs.filter(doc => new Date(doc.data().date) >= now).length;
                        const upcomingGamesB = gamesBSnap.docs.filter(doc => new Date(doc.data().date) >= now).length;
                        upcomingGames = upcomingGamesA + upcomingGamesB;
                    }
                    
                    const paymentsQuery = query(collection(db, "payments"), where("playerRef", "==", user.id), where("status", "==", "Pending"));
                    const paymentsSnap = await getDocs(paymentsQuery);

                    setDashboardData({ user, profile, upcomingGames, pendingPayments: paymentsSnap.size });
                    break;
                }
                case "MANAGER": {
                    const teamsQuery = query(collection(db, "teams"), where("managerId", "==", user.id));
                    const teamsSnap = await getDocs(teamsQuery);
                    const teams = teamsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Team);
                    const teamIds = teams.map(t => t.id);

                    let upcomingMatches: EnrichedMatch[] = [];
                    let teamPlayers: PlayerProfile[] = [];
                    let unavailablePlayers = 0;
                    let pendingPayments = 0;
                    
                    if (teamIds.length > 0) {
                        const matchesAQuery = query(collection(db, "matches"), where("teamARef", "in", teamIds), where("status", "in", ["Scheduled", "Collecting players"]));
                        const matchesBQuery = query(collection(db, "matches"), where("teamBRef", "in", teamIds), where("status", "in", ["Scheduled", "Collecting players"]));
                        const reservationsQuery = query(collection(db, "reservations"), where("managerRef", "==", user.id), where("paymentStatus", "==", "Pending"));
                        
                        const [matchesASnap, matchesBSnap, reservationsSnap] = await Promise.all([
                            getDocs(matchesAQuery),
                            getDocs(matchesBQuery),
                            getDocs(reservationsQuery),
                        ]);

                        pendingPayments = reservationsSnap.size;

                        const allMatchesMap = new Map<string, Match>();
                        matchesASnap.forEach(doc => allMatchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
                        matchesBSnap.forEach(doc => allMatchesMap.set(doc.id, {id: doc.id, ...doc.data()} as Match));
                        
                        const allMatches = Array.from(allMatchesMap.values());
                        const now = new Date();
                        
                        const futureMatches = allMatches.filter(match => new Date(match.date) >= now);

                        const allTeamIds = new Set<string>();
                        futureMatches.forEach(m => {
                            if (m.teamARef) allTeamIds.add(m.teamARef);
                            if (m.teamBRef) allTeamIds.add(m.teamBRef);
                        });

                        const teamsData = new Map<string, Team>();
                        teams.forEach(t => teamsData.set(t.id, t));

                        const missingTeamIds = Array.from(allTeamIds).filter(id => !teamsData.has(id));

                        if (missingTeamIds.length > 0) {
                            const opponentTeamsQuery = query(collection(db, "teams"), where(documentId(), "in", missingTeamIds));
                            const opponentTeamsSnap = await getDocs(opponentTeamsQuery);
                            opponentTeamsSnap.forEach(doc => teamsData.set(doc.id, {id: doc.id, ...doc.data()} as Team));
                        }

                        upcomingMatches = futureMatches
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .slice(0, 3)
                            .map(match => ({
                                ...match,
                                teamAName: match.teamARef ? teamsData.get(match.teamARef)?.name : "Unknown",
                                teamBName: match.teamBRef ? teamsData.get(match.teamBRef)?.name : "TBD",
                            }));


                        const primaryTeam = teams[0];
                        if (primaryTeam && primaryTeam.playerIds.length > 0) {
                            const playersQuery = query(collection(db, "playerProfiles"), where("userRef", "in", primaryTeam.playerIds));
                            const playersSnap = await getDocs(playersQuery);
                            teamPlayers = playersSnap.docs.map(doc => doc.data() as PlayerProfile);
                            unavailablePlayers = teamPlayers.filter(p => p.injured || p.suspended || !p.availableToPlay).length;
                        }
                    }

                    setDashboardData({ teams, upcomingMatches, unavailablePlayers, pendingPayments });
                    break;
                }
                 case "OWNER": {
                    const ownerProfileQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id), limit(1));
                    const profileSnap = await getDocs(ownerProfileQuery);
                    
                    if (profileSnap.empty) {
                        setDashboardData({ pitches: [], bookings: 0, promos: 0 });
                        break;
                    }
                    const ownerProfileId = profileSnap.docs[0].id;
                    
                    const pitchesQuery = query(collection(db, "pitches"), where("ownerRef", "==", ownerProfileId));
                    const reservationsQuery = query(collection(db, "reservations"), where("ownerProfileId", "==", ownerProfileId));
                    const promosQuery = query(collection(db, "promos"), where("validTo", ">=", new Date().toISOString()));

                    const [pitchesSnap, reservationsSnap, promosSnap] = await Promise.all([
                        getDocs(pitchesQuery),
                        getDocs(reservationsSnap),
                        getDocs(promosSnap),
                    ]);

                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);
                    
                    const todaysBookings = reservationsSnap.docs.filter(doc => {
                        const reservation = doc.data() as Reservation;
                        const reservationDate = new Date(reservation.date);
                        return reservationDate >= todayStart && reservationDate <= todayEnd;
                    }).length;


                    setDashboardData({ pitches: pitchesSnap.docs.map(d => ({id: d.id, ...d.data()})), bookings: todaysBookings, promos: promosSnap.size });
                    break;
                }
                default:
                    setDashboardData({}); // No data to fetch for other roles yet
                    break;
            }
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
        <WelcomeHeader role="PLAYER" name="..." />
        <LoadingDashboard />
      </div>
    );
  }

  const renderDashboard = () => {
    switch (user.role) {
      case "PLAYER":
        return <PlayerDashboard data={dashboardData} />;
      case "MANAGER":
        return <ManagerDashboard data={dashboardData} />;
      case "OWNER":
        return <OwnerDashboard data={dashboardData} />;
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
