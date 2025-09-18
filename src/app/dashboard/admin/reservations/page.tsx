
"use client";

import * as React from "react";
import type { Reservation } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { List } from "lucide-react";
import { getAllReservations } from "@/lib/actions/admin";

export default function AdminReservationsPage() {
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchReservations = async () => {
      setLoading(true);
      try {
        const allReservations = await getAllReservations();
        setReservations(allReservations as Reservation[]);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching reservations",
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchReservations();
  }, [toast]);

  const filteredReservations = reservations.filter(r =>
    r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.pitchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.actorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.status?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => (b.date ? new Date(b.date as any).getTime() : 0) - (a.date ? new Date(a.date as any).getTime() : 0));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
            <List /> All Reservations ({reservations.length})
        </h1>
        <p className="text-muted-foreground">View and manage all reservations in the database.</p>
       </div>
       <Card>
        <CardHeader>
            <CardTitle>Filter Reservations</CardTitle>
            <CardDescription>Search by ID, pitch name, actor name, or status.</CardDescription>
        </CardHeader>
        <CardContent>
            <Input 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </CardContent>
       </Card>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Pitch Name</TableHead>
                <TableHead>Booked By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReservations.length > 0 ? filteredReservations.map(res => (
                <TableRow key={res.id}>
                  <TableCell>{res.date ? format(new Date(res.date as any), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                  <TableCell>{res.pitchName}</TableCell>
                  <TableCell className="font-medium">{res.actorName} ({res.actorRole})</TableCell>
                  <TableCell><Badge variant="outline">{res.status}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{res.paymentStatus}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{res.totalAmount.toFixed(2)}€</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">No reservations found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
