
"use client";

import * as React from "react";
import type { Payment } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote } from "lucide-react";
import { getAllPayments } from "@/lib/actions/admin";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      try {
        const allPayments = await getAllPayments();
        setPayments(allPayments as Payment[]);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching payments",
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [toast]);

  const filteredPayments = payments.filter(p =>
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.playerRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.managerRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ownerRef?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
            <Banknote /> All Payments ({payments.length})
        </h1>
        <p className="text-muted-foreground">View and manage all payments in the database.</p>
       </div>
       <Card>
        <CardHeader>
            <CardTitle>Filter Payments</CardTitle>
            <CardDescription>Search by any ID, type, or status.</CardDescription>
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
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length > 0 ? filteredPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{format(new Date(p.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{p.type}</TableCell>
                  <TableCell>
                    {p.pitchName && `Pitch: ${p.pitchName}`}<br/>
                    {p.teamName && `Team: ${p.teamName}`}
                  </TableCell>
                  <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{p.amount.toFixed(2)}€</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">No payments found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
