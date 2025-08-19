
"use client";

import * as React from "react";
import { addDays, format, startOfDay, isBefore, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import type { Pitch, Reservation, User, Match, Team, Promo } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeSlot } from "@/components/pitch/time-slot";

const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 9;
    return `${hour.toString().padStart(2, '0')}:00`;
});

interface PitchScheduleProps {
    pitch: Pitch;
    user: User;
}

export function PitchSchedule({ pitch, user }: PitchScheduleProps) {
    const [currentDate, setCurrentDate] = React.useState(startOfDay(new Date()));
    const [reservations, setReservations] = React.useState<Reservation[]>([]);
    const [matches, setMatches] = React.useState<Match[]>([]);
    const [promos, setPromos] = React.useState<Promo[]>([]);
    const [userTeams, setUserTeams] = React.useState<Team[]>([]);
    const [loading, setLoading] = React.useState(true);

    const week = React.useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentDate]);

    React.useEffect(() => {
        setLoading(true);
        const qReservations = query(collection(db, "reservations"), where("pitchId", "==", pitch.id));
        const qMatches = query(collection(db, "matches"), where("pitchRef", "==", pitch.id));
        const qPromos = query(collection(db, "promos"), where("ownerProfileId", "==", pitch.ownerRef));

        const unsubs: (()=>void)[] = [];
        
        unsubs.push(onSnapshot(qReservations, (snap) => setReservations(snap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Reservation))));
        unsubs.push(onSnapshot(qMatches, (snap) => setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Match))));
        unsubs.push(onSnapshot(qPromos, (snap) => setPromos(snap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Promo))));

        if (user.role === 'MANAGER') {
            const qPlayerTeams = query(collection(db, "teams"), where("managerId", "==", user.id));
            unsubs.push(onSnapshot(qPlayerTeams, (snap) => setUserTeams(snap.docs.map(doc => ({id: doc.id, ...doc.data()}) as Team))));
        }

        Promise.all([getDocs(qReservations), getDocs(qMatches), getDocs(qPromos)])
          .then(() => setLoading(false))
          .catch(() => setLoading(false));

        return () => { unsubs.forEach(unsub => unsub()); };
    }, [pitch.id, pitch.ownerRef, user.id, user.role]);

    const handleDateChange = (weeks: number) => {
        setCurrentDate(prev => addDays(prev, weeks * 7));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Book a Slot</CardTitle>
                 <div className="flex items-center justify-between">
                    <CardDescription>Select a day and time to make a reservation or apply to join an open game.</CardDescription>
                    <div className="flex items-center justify-center p-2 rounded-md gap-4">
                        <Button variant="outline" size="icon" onClick={() => handleDateChange(-1)} disabled={isBefore(week[0], startOfDay(new Date()))}>
                            <ChevronLeft />
                        </Button>
                        <div className="text-lg font-semibold font-headline whitespace-nowrap">
                            {format(week[0], "dd MMM")} - {format(week[6], "dd MMM yyyy")}
                        </div>
                        <Button variant="outline" size="icon" onClick={() => handleDateChange(1)}>
                            <ChevronRight />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({length: 7}).map((_, i) => (
                           <div key={i} className="space-y-2">
                               <Skeleton className="h-10 w-full" />
                               {timeSlots.map(slot => <Skeleton key={slot} className="h-16 w-full"/>)}
                           </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-px bg-border overflow-hidden rounded-lg border">
                        {week.map(day => (
                            <div key={day.toString()} className="flex flex-col bg-background">
                                <div className="text-center font-semibold py-2 border-b">
                                    <p className="text-sm">{format(day, "EEE")}</p>
                                    <p className="text-lg">{format(day, "d")}</p>
                                </div>
                                <div className="flex flex-col gap-px">
                                    {timeSlots.map(time => (
                                        <TimeSlot
                                            key={`${day.toISOString()}-${time}`}
                                            day={day}
                                            time={time}
                                            pitch={pitch}
                                            user={user}
                                            reservations={reservations}
                                            matches={matches}
                                            promos={promos}
                                            userTeams={userTeams}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
