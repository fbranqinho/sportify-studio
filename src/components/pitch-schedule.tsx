
"use client";

import * as React from "react";
import { addDays, format, startOfDay, isBefore } from "date-fns";
import type { Pitch, Reservation, User } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, CheckCircle, Ban, BookMarked } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateReservationForm } from "./forms/create-reservation-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";

// Generate hourly time slots from 09:00 to 23:00
const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 9;
    return `${hour.toString().padStart(2, '0')}:00`;
});

interface PitchScheduleProps {
    pitch: Pitch;
    user: User;
}

export function PitchSchedule({ pitch, user }: PitchScheduleProps) {
    const [selectedDate, setSelectedDate] = React.useState(startOfDay(new Date()));
    const [reservations, setReservations] = React.useState<Reservation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    React.useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, "reservations"), 
            where("pitchId", "==", pitch.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const resData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Reservation);
            setReservations(resData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching reservations: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [pitch.id]);

    const handleDateChange = (days: number) => {
        setSelectedDate(prev => addDays(prev, days));
    };

    const getStatusForSlot = (slot: string) => {
        const slotDateTime = new Date(selectedDate);
        const [hours, minutes] = slot.split(':').map(Number);
        slotDateTime.setHours(hours, minutes, 0, 0);

        const foundReservation = reservations.find(r => {
            const reservationDate = new Date(r.date);
            return reservationDate.getTime() === slotDateTime.getTime() && (r.status === 'Confirmed' || r.status === 'Pending');
        });

        return foundReservation ? foundReservation.status : 'Available';
    };

    const handleBookingSuccess = () => {
        setIsDialogOpen(false);
        setSelectedSlot(null);
    }
    
    const today = startOfDay(new Date());

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Book a Slot</CardTitle>
                <CardDescription>Select a day and time to make a reservation.</CardDescription>
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
                            const status = getStatusForSlot(slot);
                            const slotDateTime = new Date(selectedDate);
                            const [hours] = slot.split(':').map(Number);
                            slotDateTime.setHours(hours, 0, 0, 0);
                            const isPast = isBefore(slotDateTime, new Date());

                            const isDisabled = status !== 'Available' || isPast;

                            return (
                                <DialogTrigger asChild key={slot}>
                                    <Button
                                        variant={status === 'Available' ? "outline" : "secondary"}
                                        disabled={isDisabled}
                                        className="h-12 flex-col"
                                        onClick={() => setSelectedSlot(slot)}
                                    >
                                        <span className="font-bold text-base">{slot}</span>
                                        <div className="text-xs flex items-center gap-1">
                                            {status === 'Available' && !isPast && <><CheckCircle className="h-3 w-3 text-green-500" /> Available</>}
                                            {status === 'Pending' && <><Clock className="h-3 w-3 text-amber-500" /> Pending</>}
                                            {status === 'Confirmed' && <><Ban className="h-3 w-3 text-red-500" /> Booked</>}
                                            {isPast && status === 'Available' && 'Unavailable'}
                                        </div>
                                    </Button>
                                </DialogTrigger>
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
