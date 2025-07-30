

"use client";

import * as React from "react";
import { addDays, format, startOfDay, isBefore, getYear, getMonth, getDate, getHours } from "date-fns";
import type { Pitch, Reservation, User, Match, Notification } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, arrayUnion, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, CheckCircle, Ban, BookMarked, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateReservationForm } from "./forms/create-reservation-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// Generate hourly time slots from 09:00 to 23:00
const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 9;
    return `${hour.toString().padStart(2, '0')}:00`;
});

interface PitchScheduleProps {
    pitch: Pitch;
    user: User;
}

interface SlotInfo {
  status: 'Available' | 'Pending' | 'Booked' | 'Open';
  match?: Match;
  reservation?: Reservation;
}


export function PitchSchedule({ pitch, user }: PitchScheduleProps) {
    const [selectedDate, setSelectedDate] = React.useState(startOfDay(new Date()));
    const [reservations, setReservations] = React.useState<Reservation[]>([]);
    const [matches, setMatches] = React.useState<Match[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        setLoading(true);

        const qReservations = query(
            collection(db, "reservations"), 
            where("pitchId", "==", pitch.id)
        );
        const qMatches = query(
            collection(db, "matches"),
            where("pitchRef", "==", pitch.id)
        );

        const unsubscribeReservations = onSnapshot(qReservations, (snapshot) => {
            setReservations(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Reservation));
        }, (error) => {
            console.error("Error fetching reservations: ", error);
        });
        
        const unsubscribeMatches = onSnapshot(qMatches, (snapshot) => {
            setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Match));
             setLoading(false); // Consider loading finished after matches are fetched
        }, (error) => {
             console.error("Error fetching matches: ", error);
             setLoading(false);
        });

        return () => {
            unsubscribeReservations();
            unsubscribeMatches();
        };
    }, [pitch.id]);

    const handleDateChange = (days: number) => {
        setSelectedDate(prev => addDays(prev, days));
    };

    const getStatusForSlot = (slot: string): SlotInfo => {
        const [slotHours] = slot.split(':').map(Number);
        
        const isSameTime = (date: Date) => {
            return getYear(date) === getYear(selectedDate) &&
                   getMonth(date) === getMonth(selectedDate) &&
                   getDate(date) === getDate(selectedDate) &&
                   getHours(date) === slotHours;
        };

        // Priority 1: Check for a Match first
        const match = matches.find(m => isSameTime(new Date(m.date)));
        
        if (match) {
            if (match.allowExternalPlayers) {
                const totalPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0) + (match.playerApplications?.length || 0);
                if (totalPlayers < 10) { // Assuming Fut5 capacity
                    return { status: 'Open', match };
                }
            }
            return { status: 'Booked', match };
        }

        // Priority 2: If no match, check for a Reservation
        const reservation = reservations.find(r => isSameTime(new Date(r.date)));

        if (reservation) {
            if (reservation.status === 'Confirmed') return { status: 'Booked', reservation };
            if (reservation.status === 'Pending') return { status: 'Pending', reservation };
        }
        
        return { status: 'Available' };
    };


    const handleApplyToGame = async (match: Match) => {
        if (!user || !user.id) {
            toast({ variant: "destructive", title: "You must be logged in to apply." });
            return;
        }

        const matchRef = doc(db, "matches", match.id);
        
        if(match.playerApplications?.includes(user.id)) {
            toast({ title: "You have already applied to this game." });
            return;
        }
        
        if (match.teamAPlayers?.includes(user.id) || match.teamBPlayers?.includes(user.id)) {
             toast({ title: "You are already confirmed in this game." });
            return;
        }

        try {
            const batch = writeBatch(db);

            // Step 1: Update match with the application
            batch.update(matchRef, {
                playerApplications: arrayUnion(user.id)
            });

            // Step 2: Create a notification for the match manager
            if (match.managerRef) {
                const notification: Omit<Notification, 'id'> = {
                    userId: match.managerRef,
                    message: `${user.name} has applied to play in your game.`,
                    link: `/dashboard/games/${match.id}`,
                    read: false,
                    createdAt: serverTimestamp() as any,
                };
                const notificationsCollection = collection(db, "notifications");
                const newNotificationRef = doc(notificationsCollection);
                batch.set(newNotificationRef, notification);
            }
            
            await batch.commit();

            toast({ title: "Application sent!", description: "The team manager has been notified of your interest." });
        } catch(error) {
            console.error("Error applying to game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not send your application." });
        }
    }

    const handleBookingSuccess = () => {
        setIsDialogOpen(false);
        setSelectedSlot(null);
    }
    
    const today = startOfDay(new Date());
    const isManager = user.role === 'MANAGER';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Book a Slot</CardTitle>
                <CardDescription>Select a day and time to make a reservation or apply to join an open game.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Date Selector */}
                <div className="flex items-center justify-between p-2 border rounded-md">
                    <Button variant="ghost" size="icon" onClick={() => handleDateChange(-1)} disabled={isBefore(selectedDate, addDays(today,1))}>
                        <ChevronLeft />
                    </Button>
                    <div className="text-lg font-bold font-headline">
                        {format(selectedDate, "eeee, dd MMMM yyyy")}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDateChange(1)}>
                        <ChevronRight />
                    </Button>
                </div>

                {/* Time Slots */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {timeSlots.map(slot => <Skeleton key={slot} className="h-12"/>)}
                    </div>
                ) : (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {timeSlots.map(slot => {
                            const slotInfo = getStatusForSlot(slot);
                            const slotDateTime = new Date(selectedDate);
                            const [hours] = slot.split(':').map(Number);
                            slotDateTime.setHours(hours, 0, 0, 0);
                            const isPast = isBefore(slotDateTime, new Date());
                            
                            if (isPast) {
                                return (
                                     <Button
                                        key={slot}
                                        variant="secondary"
                                        disabled
                                        className="h-12 flex-col"
                                    >
                                        <span className="font-bold text-base">{slot}</span>
                                        <div className="text-xs">Unavailable</div>
                                    </Button>
                                )
                            }
                            
                            if (slotInfo.status === 'Open' && slotInfo.match) {
                                const totalPlayers = (slotInfo.match.teamAPlayers?.length || 0) + (slotInfo.match.teamBPlayers?.length || 0) + (slotInfo.match.playerApplications?.length || 0);
                                const missingPlayers = 10 - totalPlayers;
                                return (
                                    <Button
                                        key={slot}
                                        variant="outline"
                                        className="h-12 flex-col"
                                        onClick={() => handleApplyToGame(slotInfo.match!)}
                                    >
                                        <span className="font-bold text-base">{slot}</span>
                                        <div className="text-xs flex items-center gap-1">
                                           <UserPlus className="h-3 w-3" />
                                            {missingPlayers > 0 ? `${missingPlayers} missing` : 'Apply'}
                                        </div>
                                    </Button>
                                );
                            }
                            
                             if (slotInfo.status === 'Available') {
                                return (
                                    isManager ? (
                                        <DialogTrigger asChild key={slot}>
                                            <Button
                                                variant="outline"
                                                className="h-12 flex-col"
                                                onClick={() => setSelectedSlot(slot)}
                                            >
                                                <span className="font-bold text-base">{slot}</span>
                                                <div className="text-xs flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3 text-green-500" /> Available
                                                </div>
                                            </Button>
                                        </DialogTrigger>
                                    ) : (
                                        <Button
                                            key={slot}
                                            variant="outline"
                                            disabled
                                            className="h-12 flex-col"
                                        >
                                            <span className="font-bold text-base">{slot}</span>
                                            <div className="text-xs flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3 text-green-500" /> Available
                                            </div>
                                        </Button>
                                    )
                                )
                            }
                            
                            // For Booked or Pending slots
                            return (
                                 <Button
                                    key={slot}
                                    variant="secondary"
                                    disabled
                                    className="h-12 flex-col"
                                >
                                    <span className="font-bold text-base">{slot}</span>
                                    <div className="text-xs flex items-center gap-1">
                                        {slotInfo.status === 'Pending' && <><Clock className="h-3 w-3 text-amber-500" /> Pending</>}
                                        {slotInfo.status === 'Booked' && <><Ban className="h-3 w-3 text-red-500" /> Booked</>}
                                    </div>
                                </Button>
                            )
                        })}
                    </div>
                     <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                            <DialogTitle className="font-headline flex items-center gap-2">
                                <BookMarked />
                                Confirm your Reservation
                            </DialogTitle>
                            <DialogDescription>
                                You are booking <strong>{pitch.name}</strong> for <strong>{format(selectedDate, "eeee, MMMM dd")}</strong> at <strong>{selectedSlot}</strong>.
                            </DialogDescription>
                        </DialogHeader>
                        {user && selectedSlot && (
                            <CreateReservationForm
                                user={user}
                                pitch={pitch}
                                onReservationSuccess={handleBookingSuccess}
                                selectedDate={selectedDate}
                                selectedTime={selectedSlot}
                            />
                        )}
                    </DialogContent>
                </Dialog>
                )}
            </CardContent>
        </Card>
    )
}
