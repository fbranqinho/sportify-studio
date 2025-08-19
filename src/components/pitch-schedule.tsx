
"use client";

import * as React from "react";
import { addDays, format, startOfDay, isBefore, getYear, getMonth, getDate, getHours, getDay, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import type { Pitch, Reservation, User, Match, Notification, Team, PitchSport, Promo } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, arrayUnion, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, CheckCircle, Ban, BookMarked, UserPlus, Send, Tag, Info, ShieldPlus, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateReservationForm } from "./forms/create-reservation-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { getPlayerCapacity } from "@/lib/utils";
import Link from "next/link";


const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 9;
    return `${hour.toString().padStart(2, '0')}:00`;
});

interface PitchScheduleProps {
    pitch: Pitch;
    user: User;
}

interface SlotInfo {
  status: 'Available' | 'Pending' | 'Booked' | 'OpenForPlayers' | 'OpenForTeam' | 'Past' | 'Live';
  match?: Match;
  reservation?: Reservation;
  promotion?: Promo;
  price: number;
}


export function PitchSchedule({ pitch, user }: PitchScheduleProps) {
    const [currentDate, setCurrentDate] = React.useState(startOfDay(new Date()));
    const [reservations, setReservations] = React.useState<Reservation[]>([]);
    const [matches, setMatches] = React.useState<Match[]>([]);
    const [promos, setPromos] = React.useState<Promo[]>([]);
    const [userTeams, setUserTeams] = React.useState<Team[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedSlot, setSelectedSlot] = React.useState<{ date: Date, time: string} | null>(null);
    const [selectedPromo, setSelectedPromo] = React.useState<Promo | null>(null);
    const [isBookingDialogOpen, setIsBookingDialogOpen] = React.useState(false);
    const [isChallengeDialogOpen, setIsChallengeDialogOpen] = React.useState(false);
    const [challengeTarget, setChallengeTarget] = React.useState<Match | null>(null);
    const [challengingTeamId, setChallengingTeamId] = React.useState<string | undefined>(undefined);
    const [appliedMatchIds, setAppliedMatchIds] = React.useState<string[]>([]);
    const { toast } = useToast();

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

    const getStatusForSlot = (day: Date, time: string): SlotInfo => {
        const [slotHours] = time.split(':').map(Number);
        const slotDateTime = new Date(day);
        slotDateTime.setHours(slotHours, 0, 0, 0);

        if (isBefore(slotDateTime, new Date())) return { status: 'Past', price: pitch.basePrice || 0 };

        const isSameTime = (d: Date) => getYear(d) === getYear(day) && getMonth(d) === getMonth(day) && getDate(d) === getDate(day) && getHours(d) === slotHours;
        
        const reservation = reservations.find(r => isSameTime(new Date(r.date)));
        
        if (reservation && (reservation.status === 'Confirmed' || reservation.status === 'Scheduled')) {
            const match = matches.find(m => m.reservationRef === reservation.id);
            const isMyGame = reservation.actorId === user.id;

            if (match?.status === 'InProgress') {
                 return { status: 'Live', match, reservation, price: 0 };
            }
            
            // This is the source of truth for "is the slot full?"
            if (match && !match.teamBRef && match.allowChallenges && user.role === 'MANAGER' && match.managerRef !== user.id) {
                return { status: 'OpenForTeam', match, reservation, price: 0 };
            }

            const totalPlayers = (match?.teamAPlayers?.length || 0) + (match?.teamBPlayers?.length || 0);
            const capacity = getPlayerCapacity(pitch.sport);
            if (match && match.allowExternalPlayers && totalPlayers < capacity) {
                 return { status: 'OpenForPlayers', match, reservation, price: 0 };
            }

            if (isMyGame && user.role !== "OWNER") { // Owners shouldn't see their own bookings as "Booked" by them
                return { status: 'Booked', match, reservation, price: reservation.totalAmount };
            }

            return { status: 'Booked', reservation, price: reservation.totalAmount };
        }
        
        const dayOfWeek = getDay(day);
        const applicablePromo = promos
            .filter(p => new Date(day) >= startOfDay(new Date(p.validFrom)) && new Date(day) <= startOfDay(new Date(p.validTo)) && p.applicableDays.includes(dayOfWeek) && p.applicableHours.includes(slotHours) && (p.pitchIds.length === 0 || p.pitchIds.includes(pitch.id)))
            .sort((a, b) => b.discountPercent - a.discountPercent)[0];

        const basePrice = pitch.basePrice || 0;
        const finalPrice = applicablePromo ? basePrice * (1 - applicablePromo.discountPercent / 100) : basePrice;

        return { status: 'Available', promotion: applicablePromo, price: finalPrice };
    };

    const handleApplyToGame = async (match: Match) => {
        if (!user.id) return toast({ variant: "destructive", title: "You must be logged in." });
        if(appliedMatchIds.includes(match.id) || match.playerApplications?.includes(user.id)) return toast({ title: "You have already applied." });

        const batch = writeBatch(db);
        batch.update(doc(db, "matches", match.id), { playerApplications: arrayUnion(user.id) });

        if (match.managerRef) {
            const notification: Omit<Notification, 'id'> = { userId: match.managerRef, message: `${user.name} applied to your game.`, link: `/dashboard/games/${match.id}`, read: false, createdAt: serverTimestamp() as any };
            batch.set(doc(collection(db, "notifications")), notification);
        }
        
        await batch.commit();
        setAppliedMatchIds(prev => [...prev, match.id]);
        toast({ title: "Application sent!" });
    };

    const handleBookingSuccess = () => {
        setIsBookingDialogOpen(false);
        setSelectedSlot(null);
        setSelectedPromo(null);
    }
    
    const handleChallengeClick = (match: Match) => {
        if (userTeams.length === 0) {
            toast({ variant: "destructive", title: "No Team Found", description: "You must manage at least one team to challenge another." });
            return;
        }
        setChallengeTarget(match);
        setIsChallengeDialogOpen(true);
    }
    
    const handleSendChallenge = async () => {
        if (!challengeTarget || !challengingTeamId || !challengeTarget.managerRef) {
             toast({ variant: "destructive", title: "Error", description: "Missing required information to send challenge."});
             return;
        }
        
        const challengingTeam = userTeams.find(t => t.id === challengingTeamId);
        if (!challengingTeam) return;

        try {
            const notification: Omit<Notification, 'id'> = {
                userId: challengeTarget.managerRef,
                message: `The team '${challengingTeam.name}' has challenged you to a match!`,
                link: `/dashboard/games/${challengeTarget.id}`, // Corrected link
                read: false,
                createdAt: serverTimestamp() as any,
                type: 'Challenge',
                payload: {
                    matchId: challengeTarget.id,
                    challengerTeamId: challengingTeam.id,
                    challengerTeamName: challengingTeam.name,
                    challengerManagerId: user.id,
                }
            };
            
            await addDoc(collection(db, 'notifications'), notification);
            
            toast({ title: "Challenge Sent!", description: `Your challenge has been sent to the manager of the opponent team.` });
            setIsChallengeDialogOpen(false);
            setChallengeTarget(null);
            setChallengingTeamId(undefined);

        } catch (error) {
            console.error("Error sending challenge: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not send the challenge." });
        }
    }

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
                <>
                    <div className="grid grid-cols-7 gap-px bg-border overflow-hidden rounded-lg border">
                        {week.map(day => (
                            <div key={day.toString()} className="flex flex-col bg-background">
                                <div className="text-center font-semibold py-2 border-b">
                                    <p className="text-sm">{format(day, "EEE")}</p>
                                    <p className="text-lg">{format(day, "d")}</p>
                                </div>
                                <div className="flex flex-col gap-px">
                                    {timeSlots.map(time => {
                                        const slotInfo = getStatusForSlot(day, time);
                                        const hasApplied = slotInfo.match && (appliedMatchIds.includes(slotInfo.match.id) || slotInfo.match.playerApplications?.includes(user.id));
                                        
                                        let content;
                                        switch (slotInfo.status) {
                                            case 'Available':
                                                content = (
                                                    <Dialog open={isBookingDialogOpen && selectedSlot?.date.getTime() === day.getTime() && selectedSlot?.time === time} onOpenChange={(open) => { if (!open) setSelectedSlot(null); setIsBookingDialogOpen(open); }}>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant={slotInfo.promotion ? "default" : "outline"}
                                                                className="h-16 flex-col w-full rounded-none border-0"
                                                                onClick={() => {
                                                                    setSelectedSlot({ date: day, time });
                                                                    setSelectedPromo(slotInfo.promotion || null);
                                                                    setIsBookingDialogOpen(true);
                                                                }}
                                                            >
                                                                {slotInfo.promotion && (
                                                                    <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                                                                        <span className="line-through">{(pitch.basePrice || 0).toFixed(2)}€</span>
                                                                        <Badge variant="destructive" className="gap-1"><Tag className="h-3 w-3"/>{slotInfo.promotion.discountPercent}%</Badge>
                                                                    </div>
                                                                )}
                                                                <span className="font-bold text-lg">{slotInfo.price.toFixed(2)}€</span>
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="sm:max-w-[480px]">
                                                            <DialogHeader>
                                                                <DialogTitle className="font-headline flex items-center gap-2"> <BookMarked /> Confirm your Reservation </DialogTitle>
                                                                {selectedSlot && <DialogDescription> You are booking <strong>{pitch.name}</strong> for <strong>{format(selectedSlot.date, "eeee, MMMM dd")}</strong> at <strong>{selectedSlot.time}</strong>. </DialogDescription>}
                                                            </DialogHeader>
                                                            {user && selectedSlot && (
                                                                <CreateReservationForm
                                                                    user={user} pitch={pitch}
                                                                    onReservationSuccess={handleBookingSuccess}
                                                                    selectedDate={selectedSlot.date} selectedTime={selectedSlot.time}
                                                                    promotion={selectedPromo}
                                                                />
                                                            )}
                                                        </DialogContent>
                                                    </Dialog>
                                                );
                                                break;
                                            case 'OpenForPlayers':
                                                content = (
                                                    <Button
                                                        variant={hasApplied ? "secondary" : "outline"}
                                                        className="h-16 flex-col w-full rounded-none border-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleApplyToGame(slotInfo.match!)}
                                                        disabled={hasApplied}
                                                    >
                                                        {hasApplied ? <Send className="h-4 w-4 mb-1" /> : <UserPlus className="h-4 w-4 mb-1" />}
                                                        <span className="font-bold">{hasApplied ? 'Sent' : 'Apply'}</span>
                                                        <span className="text-xs">{(getPlayerCapacity(pitch.sport) - ((slotInfo.match?.teamAPlayers?.length || 0) + (slotInfo.match?.teamBPlayers?.length || 0)))} slots left</span>
                                                    </Button>
                                                );
                                                break;
                                            case 'OpenForTeam':
                                                 content = (
                                                    <Button
                                                        variant="outline"
                                                        className="h-16 flex-col w-full rounded-none border-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => handleChallengeClick(slotInfo.match!)}
                                                    >
                                                        <ShieldPlus className="h-4 w-4 mb-1"/>
                                                        <span className="font-bold">Challenge</span>
                                                        <span className="text-xs">vs Team</span>
                                                    </Button>
                                                );
                                                break;
                                            case 'Live':
                                                content = (
                                                    <Button asChild variant="destructive" className="h-16 flex-col w-full rounded-none border-0 animate-pulse">
                                                        <Link href={`/live-game/${slotInfo.match?.id}`}>
                                                            <Eye className="h-4 w-4 mb-1" />
                                                            <span className="font-bold">View Live</span>
                                                        </Link>
                                                    </Button>
                                                );
                                                break;
                                            case 'Booked':
                                            case 'Past':
                                                content = (
                                                    <Button variant="secondary" disabled className="h-16 flex-col w-full rounded-none border-0">
                                                        <span className="font-semibold">{time}</span>
                                                        <div className="text-xs flex items-center gap-1">
                                                            {slotInfo.status === 'Booked' && <Ban className="h-3 w-3" />}
                                                            {slotInfo.status === 'Past' && <Info className="h-3 w-3" />}
                                                            <span>{slotInfo.status}</span>
                                                        </div>
                                                    </Button>
                                                );
                                                break;
                                            default:
                                                content = <Skeleton className="h-16"/>;
                                                break;
                                        }
                                        
                                        return <div key={time} className="w-full">{content}</div>;
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Dialog open={isChallengeDialogOpen} onOpenChange={setIsChallengeDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="font-headline">Challenge Team</DialogTitle>
                                <DialogDescription>Select which of your teams will challenge the opponent.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                <Label htmlFor="team-select">Your Team</Label>
                                <Select onValueChange={setChallengingTeamId} value={challengingTeamId}>
                                    <SelectTrigger id="team-select">
                                        <SelectValue placeholder="Select a team..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {userTeams.map(team => (
                                            <SelectItem key={team.id} value={team.id}>
                                                {team.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsChallengeDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleSendChallenge} disabled={!challengingTeamId}>
                                    <Send className="mr-2 h-4 w-4" /> Send Challenge
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
                )}
            </CardContent>
        </Card>
    )
}

    
    