
"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Database, Trash2, Users, Calendar, Gamepad2, Banknote, LineChart, Euro } from "lucide-react";
import { deleteAllMatches, getMonthlyStats } from "@/lib/actions/admin";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export default function AdminPage() {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [stats, setStats] = React.useState<any>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear().toString());

  const fetchStats = React.useCallback(async (month: number, year: number) => {
    setLoadingStats(true);
    try {
        const result = await getMonthlyStats(month, year);
        setStats(result);
    } catch(error: any) {
        toast({
            variant: "destructive",
            title: "Error fetching stats",
            description: error.message
        });
        setStats(null);
    } finally {
        setLoadingStats(false);
    }
  }, [toast]);
  
  React.useEffect(() => {
    fetchStats(parseInt(selectedMonth), parseInt(selectedYear));
  }, [selectedMonth, selectedYear, fetchStats]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAllMatches();
      toast({
        title: "Operation Successful",
        description: `${result.deletedCount} games have been deleted.`,
      });
    } catch (error: any) {
      console.error("Error deleting games:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Could not delete games: ${error.message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const months = Array.from({length: 12}, (_, i) => ({ value: (i + 1).toString(), label: new Date(0, i).toLocaleString('default', { month: 'long' }) }));
  const years = Array.from({length: 5}, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Advanced controls and site metrics. Use with caution.
        </p>
      </div>

       <Card>
            <CardHeader>
                <CardTitle>Platform Metrics</CardTitle>
                <CardDescription>View key metrics for the selected month and year.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 {loadingStats ? (
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                     </div>
                 ) : stats ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} description={`${stats.newUsers} new this month`} />
                        <StatCard title="Premium Users" value={stats.premiumUsers} icon={Users} />
                        <StatCard title="Total Games" value={stats.totalGames} icon={Gamepad2} />
                        <StatCard title="Total Reservations" value={stats.totalReservations} icon={Calendar} description={`${stats.cancelledReservations} cancelled`} />
                        <StatCard title="Total Payments" value={stats.totalPayments} icon={Banknote} />
                        <StatCard title="Payment Volume" value={`${stats.totalPaymentVolume.toFixed(2)}€`} icon={Euro} />
                    </div>
                 ) : (
                    <p>Could not load stats.</p>
                 )}
            </CardContent>
        </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="font-headline text-destructive flex items-center gap-2">
            <Database />
            Destructive Actions
          </CardTitle>
          <CardDescription>
            These actions directly modify the Firestore database and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h3 className="font-semibold">Delete All Games</h3>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all matches from the database. This
                action cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete All Games"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all game records. This action is
                    irreversible and will affect all users.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Yes, delete all games
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
