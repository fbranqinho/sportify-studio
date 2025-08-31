
"use client";

import * as React from "react";
import type { Payment, Reservation, User, UserRole, PaymentStatus, OwnerProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, CheckCircle, Clock, History, Ban, CreditCard, Send, CircleSlash } from "lucide-react";
import { format } from "date-fns";
import { PlayerPaymentButton } from "./player-payment-button";
import { ManagerRemindButton } from "./manager-remind-button";
import { useMyGames } from "@/hooks/use-my-games";
import { useUser } from "@/hooks/use-user";

interface PaymentsTableProps {
  payments: Payment[];
  showActions: boolean;
  userRole?: UserRole;
  playerUsers: Map<string, User>;
  reservations: Map<string, Reservation>;
  owners: Map<string, OwnerProfile>;
  onActionProcessed: () => void;
}

const getStatusBadge = (status: PaymentStatus) => {
    switch(status) {
      case "Paid": return <Badge variant="default" className="bg-green-600 gap-1.5"><CheckCircle className="h-3 w-3"/>Paid</Badge>;
      case "Pending": return <Badge variant="destructive" className="gap-1.5"><Clock className="h-3 w-3"/>Pending</Badge>;
      case "Cancelled": return <Badge variant="outline" className="gap-1.5"><Ban className="h-3 w-3"/>Cancelled</Badge>;
      case "Refunded": return <Badge variant="secondary" className="bg-blue-500 text-white gap-1.5"><CircleSlash className="h-3 w-3"/>Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
}

export function PaymentsTable({ payments, showActions, userRole, playerUsers, reservations, owners, onActionProcessed }: PaymentsTableProps) {
    const { user } = useUser();
    const myGamesHook = useMyGames(user); // We need this for the handler

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {userRole !== 'PLAYER' && <TableHead>Player</TableHead>}
                    <TableHead>Description</TableHead>
                    {userRole !== 'OWNER' && <TableHead>Owner</TableHead>}
                    <TableHead className="w-[150px]">Game Date</TableHead>
                    <TableHead className="w-[150px]">Payment Date</TableHead>
                    <TableHead className="w-[120px] text-center">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Amount</TableHead>
                    {showActions && <TableHead className="w-[150px] text-right">Action</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {payments.length > 0 ? payments.map((p) => {
                    const reservation = p.reservationRef ? reservations.get(p.reservationRef) : null;
                    const owner = p.ownerRef ? owners.get(p.ownerRef) : null;
                    const actorName = p.playerRef ? playerUsers.get(p.playerRef)?.name : "N/A";
                    const description = p.type === 'booking' 
                        ? `Initial fee for ${p.pitchName}` 
                        : (p.type === 'booking_split' ? `Share for ${p.teamName} at ${p.pitchName}` : `Payment for ${p.teamName}`);
                    
                    const isInitialBookingPayment = p.type === 'booking';

                    return (
                        <TableRow key={p.id}>
                            {userRole !== 'PLAYER' && <TableCell className="font-medium">{isInitialBookingPayment ? 'Your Booking' : actorName}</TableCell>}
                            <TableCell className="font-medium">{description}</TableCell>
                            {userRole !== 'OWNER' && <TableCell>{owner?.companyName || "N/A"}</TableCell>}
                            <TableCell>{reservation ? format(new Date(reservation.date), "dd/MM/yyyy") : '-'}</TableCell>
                            <TableCell>{p.date ? format(new Date(p.date), "dd/MM/yyyy") : '-'}</TableCell>
                            <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                            <TableCell className="text-right font-mono">{p.amount.toFixed(2)}€</TableCell>
                            {showActions && (
                                <TableCell className="text-right">
                                    {p.status === 'Pending' && userRole === 'PLAYER' && (
                                        <PlayerPaymentButton payment={p} reservation={reservation} onPaymentProcessed={onActionProcessed} />
                                    )}
                                    {p.status === 'Pending' && userRole === 'MANAGER' && p.type === 'booking_split' && (
                                        <ManagerRemindButton payment={p} />
                                    )}
                                     {p.status === 'Pending' && userRole === 'MANAGER' && isInitialBookingPayment && reservation && (
                                        <Button size="sm" onClick={() => myGamesHook.handleStartSplitPayment(reservation)}>
                                            <DollarSign className="mr-2 h-4 w-4"/> Initiate Split
                                        </Button>
                                    )}
                                </TableCell>
                            )}
                        </TableRow>
                    )
                }) : (
                    <TableRow>
                        <TableCell colSpan={userRole === 'PLAYER' ? 7 : (showActions ? 8 : 7)} className="h-24 text-center">
                            No payments match your criteria.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}

    