

"use client";

import * as React from "react";
import type { Pitch, Reservation, User, Match, Team, Notification, Promo } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getPlayerCapacity } from "@/lib/utils";
import { useSlotStatus, type SlotInfo } from "@/hooks/use-slot-status";
import { CreateReservationForm } from "@/components/forms/create-reservation-form";
import Link from "next/link";
import { format } from "date-fns";
import { addDoc, collection, doc, writeBatch, serverTimestamp, arrayUnion, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookMarked, UserPlus, ShieldPlus, Eye, Info, Ban, Send, Tag, Clock } from "lucide-react";

interface TimeSlotProps {
  day: Date;
  time: string;
  pitch: Pitch;
  user: User;
  reservations: Reservation[];
  matches: Match[];
  promos: Promo[];
  userTeams: Team[];
}

// --- Specific Slot Components ---

const AvailableSlot = ({ day, time, pitch, user, slotInfo }: { day: Date; time: string; pitch: Pitch; user: User; slotInfo: SlotInfo }) => {
  const [isBookingDialogOpen, setIsBookingDialogOpen] = React.useState(false);

  const handleBookingSuccess = () => {
    setIsBookingDialogOpen(false);
  };

  return (
    <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant={slotInfo.promotion ? "default" : "outline"}
          className="h-16 flex-col w-full rounded-none border-0"
        >
          {slotInfo.promotion && (
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="line-through text-destructive">{(pitch.basePrice || 0).toFixed(2)}€</span>
              <Badge variant="secondary" className="gap-1"><Tag className="h-3 w-3"/>{slotInfo.promotion.discountPercent}%</Badge>
            </div>
          )}
          <span className="font-bold text-lg">{slotInfo.price.toFixed(2)}€</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2"> <BookMarked /> Confirm your Reservation </DialogTitle>
          <DialogDescription> You are booking <strong>{pitch.name}</strong> for <strong>{format(day, "eeee, MMMM dd")}</strong> at <strong>{time}</strong>. </DialogDescription>
        </DialogHeader>
        <CreateReservationForm
            user={user} pitch={pitch}
            onReservationSuccess={handleBookingSuccess}
            selectedDate={day} selectedTime={time}
            promotion={slotInfo.promotion || null}
        />
      </DialogContent>
    </Dialog>
  );
};

const ApplySlot = ({ match, user }: { match: Match; user: User; }) => {
  const { toast } = useToast();
  const [hasApplied, setHasApplied] = React.useState(match.playerApplications?.includes(user.id) || false);

  const handleApplyToGame = async () => {
    if (hasApplied) return toast({ title: "You have already applied." });
    setHasApplied(true);

    const batch = writeBatch(db);
    batch.update(doc(db, "matches", match.id), { playerApplications: arrayUnion(user.id) });

    if (match.managerRef) {
      const notificationRef = doc(collection(db, "users", match.managerRef, "notifications"));
      const notification: Omit<Notification, 'id'> = { message: `${user.name} applied to your game.`, link: `/dashboard/games/${match.id}`, read: false, createdAt: serverTimestamp() as any };
      batch.set(notificationRef, notification);
    }
    
    await batch.commit();
    toast({ title: "Application sent!" });
  };
  
  return (
    <Button
        variant={hasApplied ? "secondary" : "outline"}
        className="h-16 flex-col w-full rounded-none border-0 text-green-600 hover:text-green-700 hover:bg-green-50"
        onClick={handleApplyToGame}
        disabled={hasApplied}
    >
        {hasApplied ? <Send className="h-4 w-4 mb-1" /> : <UserPlus className="h-4 w-4 mb-1" />}
        <span className="font-bold">{hasApplied ? 'Sent' : 'Apply'}</span>
    </Button>
  );
};

const ChallengeSlot = ({ match, user, userTeams }: { match: Match; user: User; userTeams: Team[] }) => {
  const { toast } = useToast();
  const [isChallengeDialogOpen, setIsChallengeDialogOpen] = React.useState(false);
  const [challengingTeamId, setChallengingTeamId] = React.useState<string | undefined>(undefined);

  const handleChallengeClick = () => {
    if (userTeams.length === 0) {
      toast({ variant: "destructive", title: "No Team Found", description: "You must manage at least one team to challenge another." });
      return;
    }
    setIsChallengeDialogOpen(true);
  };
  
  const handleSendChallenge = async () => {
    if (!match || !challengingTeamId || !match.managerRef) {
         toast({ variant: "destructive", title: "Error", description: "Missing required information to send challenge."});
         return;
    }
    const challengingTeam = userTeams.find(t => t.id === challengingTeamId);
    if (!challengingTeam) return;
    
    const notificationRef = doc(collection(db, "users", match.managerRef, "notifications"));
    const notification: Omit<Notification, 'id'> = {
        message: `The team '${challengingTeam.name}' has challenged you to a match!`,
        link: `/dashboard/games/${match.id}`,
        read: false,
        createdAt: serverTimestamp() as any,
        type: 'Challenge',
        payload: {
            matchId: match.id,
            challengerTeamId: challengingTeam.id,
            challengerTeamName: challengingTeam.name,
            challengerManagerId: user.id,
        }
    };
    await addDoc(collection(db, "users", match.managerRef, "notifications"), notification);
    toast({ title: "Challenge Sent!" });
    setIsChallengeDialogOpen(false);
  };
  
  return (
    <>
      <Button
          variant="outline"
          className="h-16 flex-col w-full rounded-none border-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={handleChallengeClick}
      >
          <ShieldPlus className="h-4 w-4 mb-1"/>
          <span className="font-bold">Challenge</span>
      </Button>
      <Dialog open={isChallengeDialogOpen} onOpenChange={setIsChallengeDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle className="font-headline">Challenge Team</DialogTitle>
                  <DialogDescription>Select which of your teams will challenge the opponent.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <Label htmlFor="team-select">Your Team</Label>
                  <Select onValueChange={setChallengingTeamId} value={challengingTeamId}>
                      <SelectTrigger id="team-select"><SelectValue placeholder="Select a team..." /></SelectTrigger>
                      <SelectContent>
                          {userTeams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsChallengeDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSendChallenge} disabled={!challengingTeamId}><Send className="mr-2 h-4 w-4" /> Send Challenge</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
};

const LiveSlot = ({ match }: { match: Match }) => (
  <Button asChild variant="destructive" className="h-16 flex-col w-full rounded-none border-0 animate-pulse">
      <Link href={`/live-game/${match?.id}`}>
          <Eye className="h-4 w-4 mb-1" />
          <span className="font-bold">View Live</span>
      </Link>
  </Button>
);

const BookedSlot = ({ time, status }: { time: string; status: 'Booked' | 'Past' | 'Pending' }) => {
    return (
        <Button variant="secondary" disabled className="h-16 flex-col w-full rounded-none border-0">
            <span className="font-semibold">{time}</span>
            <div className="text-xs flex items-center gap-1">
                {status === 'Booked' && <Ban className="h-3 w-3" />}
                {status === 'Past' && <Info className="h-3 w-3" />}
                {status === 'Pending' && <Clock className="h-3 w-3" />}
                <span>{status}</span>
            </div>
        </Button>
    );
}


// --- Main Component ---

export const TimeSlot = ({ day, time, ...props }: TimeSlotProps) => {
  const slotInfo = useSlotStatus({ day, time, ...props });

  switch (slotInfo.status) {
    case 'Available':
      return <AvailableSlot day={day} time={time} pitch={props.pitch} user={props.user} slotInfo={slotInfo} />;
    case 'OpenForPlayers':
      return <ApplySlot match={slotInfo.match!} user={props.user} />;
    case 'OpenForTeam':
      return <ChallengeSlot match={slotInfo.match!} user={props.user} userTeams={props.userTeams} />;
    case 'Live':
      return <LiveSlot match={slotInfo.match!} />;
    case 'Booked':
    case 'Past':
    case 'Pending':
      return <BookedSlot time={time} status={slotInfo.status} />;
    default:
      return <BookedSlot time={time} status="Booked" />;
  }
};
