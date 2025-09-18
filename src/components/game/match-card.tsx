
"use client";

import * as React from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { useMyGames } from "@/hooks/use-my-games";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Calendar, Users, Shield, MapPin, Building, CreditCard, Check, X, DollarSign, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { getPlayerCapacity } from "@/lib/utils";

export const MatchCard = ({ match, hook }: { match: Match, hook: ReturnType<typeof useMyGames> }) => {
    const { 
        user, teams, pitches, owners, reservations, invitations, teamMatchInvitations,
        handlePlayerInvitationResponse, handleTeamInvitationResponse, handleStartSplitPayment
    } = hook;

    const teamA = match.teamARef ? teams.get(match.teamARef) : null;
    const teamB = match.teamBRef ? teams.get(match.teamBRef) : (match.invitedTeamId ? teams.get(match.invitedTeamId) : null);
    const pitch = match.pitchRef ? pitches.get(match.pitchRef) : null;
    const owner = pitch?.ownerRef ? owners.get(pitch.ownerRef) : null;
    const reservation = match.reservationRef ? reservations.get(match.reservationRef) : null;

    const isFinished = match.status === "Finished";
    const isLive = match.status === "InProgress";
    const isPlayer = user?.role === 'PLAYER';
    const isManager = user?.role === 'MANAGER' && user.id === match.managerRef;

    const playerInvitation = isPlayer ? invitations.get(match.id) : null;
    const managerInvitation = (user?.role === 'MANAGER' && teamMatchInvitations.has(match.id)) ? teamMatchInvitations.get(match.id) : null;

    const confirmedPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
    
    const playerCapacity = getPlayerCapacity(pitch?.sport);
    const missingPlayers = playerCapacity > 0 ? playerCapacity - confirmedPlayers : 0;
    
    const getMatchTitle = () => {
      const teamAName = teamA?.name || 'Team A';
      if (teamA && !teamB && !match.invitedTeamId) return `${teamAName} (Practice)`;
      if (teamA && teamB) return `${teamAName} vs ${teamB.name}`;
      if (teamA && match.invitedTeamId) {
          const invitedTeamData = teams.get(match.invitedTeamId);
          return `${teamAName} vs ${invitedTeamData?.name || '(Invited Team)'}`;
      }
      return 'Match Details';
    }
    
    const showStartPaymentButton = isManager && reservation?.status === 'Confirmed' && reservation?.paymentStatus === 'Pending' && confirmedPlayers > 0;
    
    let buttonContent;
    if (playerInvitation) {
        buttonContent = (
            <div className="w-full flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-center">You're invited to this game.</p>
                <div className="flex gap-2 w-full">
                    <Button size="sm" className="flex-1" onClick={() => handlePlayerInvitationResponse(playerInvitation, true)}>
                       <Check className="mr-2 h-4 w-4" /> Accept
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handlePlayerInvitationResponse(playerInvitation, false)}>
                       <X className="mr-2 h-4 w-4" /> Decline
                    </Button>
                </div>
            </div>
        );
    } else if (managerInvitation) {
        buttonContent = (
             <div className="w-full flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-center">Your team is invited to this match.</p>
                <div className="flex gap-2 w-full">
                    <Button size="sm" className="flex-1" onClick={() => handleTeamInvitationResponse(managerInvitation, true)}>
                       <Check className="mr-2 h-4 w-4" /> Accept
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleTeamInvitationResponse(managerInvitation, false)}>
                       <X className="mr-2 h-4 w-4" /> Decline
                    </Button>
                </div>
            </div>
        );
    } else {
        buttonContent = (
             <div className="flex flex-col w-full gap-2">
                 {showStartPaymentButton && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button className="w-full">
                                <DollarSign className="mr-2 h-4 w-4"/> Initiate Payment
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Initiate Split Payment?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will create a pending payment for each of the <strong>{confirmedPlayers}</strong> confirmed players. They will be notified. Are you sure?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleStartSplitPayment(reservation!)}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/games/${match.id}`} className="flex justify-between items-center w-full">
                        <span>{isFinished ? "View Report" : isLive ? "View Live" : "Manage Game"}</span>
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
             </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex justify-between items-center">
                    <span>{getMatchTitle()}</span>
                    {isFinished && (
                        <span className="text-2xl font-bold">{match.scoreA} - {match.scoreB}</span>
                    )}
                    {isLive && (
                        <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
                    )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <Calendar className="h-4 w-4" /> {match.date ? format(match.date.toDate(), "PPP 'at' HH:mm") : 'No date'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                 <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span><span className="font-semibold">{pitch?.name || "Loading..."}</span> ({pitch?.sport.toUpperCase()})</span>
                 </div>
                 {owner && (
                    <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-primary" />
                        <span>Managed by: <span className="font-semibold">{owner.companyName}</span></span>
                    </div>
                 )}
                 <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Status: <span className="font-semibold">{match.status}</span></span>
                 </div>
                 {playerCapacity > 0 && (
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>Players: <span className="font-semibold">{confirmedPlayers} / {playerCapacity}</span> ({missingPlayers > 0 ? `${missingPlayers} missing` : 'Full'})</span>
                    </div>
                 )}
                 {reservation?.paymentStatus && (
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Payment Status: <span className="font-semibold">{reservation.paymentStatus}</span></span>
                    </div>
                 )}
            </CardContent>
             <CardFooter className="flex-col items-start gap-4">
                {buttonContent}
            </CardFooter>
        </Card>
    )
  }
