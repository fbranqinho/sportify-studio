

"use client";

import * as React from "react";
import { useUser } from "@/hooks/use-user";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePayments } from "@/hooks/use-payments";
import { PaymentsTable } from "@/components/payments/payments-table";

const LoadingSkeleton = () => (
      <div className="space-y-4">
         <Skeleton className="h-10 w-1/4" />
         <Skeleton className="h-48 w-full" />
      </div>
);
  
export default function PaymentsPage() {
  const { user } = useUser();
  const { allPayments, reservations, playerUsers, loading, fetchData } = usePayments(user);
  const [searchTerm, setSearchTerm] = React.useState("");
  
  const filteredPayments = React.useMemo(() => {
    return allPayments.filter(p => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        const teamMatch = p.teamName?.toLowerCase().includes(lowerCaseSearch);
        const pitchMatch = p.pitchName?.toLowerCase().includes(lowerCaseSearch);
        let playerMatch = false;
        if (user?.role !== 'PLAYER' && p.playerRef) {
            playerMatch = playerUsers.get(p.playerRef)?.name.toLowerCase().includes(lowerCaseSearch) || false;
        }

        return teamMatch || pitchMatch || playerMatch;
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [allPayments, searchTerm, user?.role, playerUsers]);

  const pendingPayments = filteredPayments.filter(p => p.status === 'Pending');
  const historyPayments = filteredPayments.filter(p => p.status !== 'Pending');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Payments</h1>
        <p className="text-muted-foreground">
          View your payment history and pending game fees.
        </p>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="Search by team, pitch or player name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>
        </CardContent>
      </Card>

       <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline text-primary">Pending Payments ({pendingPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : (
          <PaymentsTable 
              payments={pendingPayments} 
              showActions={true} 
              userRole={user?.role}
              playerUsers={playerUsers}
              reservations={reservations}
              onActionProcessed={fetchData}
          />
        )}
      </div>

      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Payment History ({historyPayments.length})</h2>
        {loading ? <LoadingSkeleton /> : (
          <PaymentsTable 
            payments={historyPayments} 
            showActions={false}
            userRole={user?.role}
            playerUsers={playerUsers}
            reservations={reservations}
            onActionProcessed={fetchData}
          />
        )}
      </div>
    </div>
  );
}
