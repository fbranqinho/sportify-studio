

"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, addDoc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Reservation, Team, Notification, MatchInvitation } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, User, Clock, CheckCircle, XCircle, History, CheckCheck, Ban, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


export default function SchedulePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [ownerProfileId, setOwnerProfileId] = React.useState<string | null>(null);

  // Effect to get Owner Profile ID if user is an OWNER
  React.useEffect(() => {
    if (user?.role === 'OWNER' && user.id) {
      const profilesQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
      getDocs(profilesQuery).then(profileSnapshot => {
        if (!profileSnapshot.empty) {
          const ownerId = profileSnapshot.docs[0].id;
          setOwnerProfileId(ownerId);
        } else {
           setLoading(false); // No profile, so no reservations to load
        }
      }).catch(error => {
          console.error("Error fetching owner profile: ", error);
          setLoading(false);
      });
    } else { // For other roles, no need to fetch owner profile
        setLoading(false);
    }
  }, [user]);

  // Effect to fetch reservations based on user role
  React.useEffect(() => {
    if (!user || user.role !== 'OWNER' || !ownerProfileId) {
        setLoading(false);
        return;
    }
    
    setLoading(true);

    let unsubscribe = () => {};
    let reservationsQuery = query(collection(db, "reservations"), where("ownerProfileId", "==", ownerProfileId));
    
    unsubscribe = onSnapshot(reservationsQuery, (querySnapshot) => {
      const reservationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
      setReservations(reservationsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reservations: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch reservations." });
      setLoading(false);
    });
    
    return () => unsubscribe();

  }, [user, ownerProfileId, toast]);
  

  const handleUpdateStatus = async (reservation: Reservation, status: "Confirmed" | "Canceled") => {
    const reservationRef = doc(db, "reservations", reservation.id);
    
    if (status === "Canceled") {
      try {
        await updateDoc(reservationRef, { status: "Canceled" });
        toast({
          title: "Reservation Canceled",
          description: `The reservation has been canceled.`,
        });
      } catch (error) {
        console.error("Error canceling reservation: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not cancel reservation." });
      }
      return;
    }

    // Handle Confirmed status
    if (status === "Confirmed") {
      try {
        // --- Manager Booking ---
        if (reservation.teamRef) {
            const teamDocRef = doc(db, "teams", reservation.teamRef);
            const teamDoc = await getDoc(teamDocRef);

            if (!teamDoc.exists()) {
                toast({ variant: "destructive", title: "Error", description: "Team associated with reservation not found." });
                return;
            }
            const teamData = teamDoc.data() as Team;
            const playerIds = teamData.playerIds || [];
            
            const batch = writeBatch(db);

            const matchDocRef = doc(collection(db, "matches"));
            const matchData = {
                date: reservation.date,
                pitchRef: reservation.pitchId,
                reservationRef: reservation.id, // Link reservation to match
                status: "PendingOpponent", 
                teamARef: reservation.teamRef,
                teamBRef: null,
                teamAPlayers: [], // Initially empty, players must accept invitation
                teamBPlayers: [],
                playerApplications: [],
                allowExternalPlayers: true,
                scoreA: 0,
                scoreB: 0,
                refereeId: null,
                attendance: 0,
                managerRef: teamData.managerId || reservation.managerRef || null,
            };
            batch.set(matchDocRef, matchData);
            
            batch.update(reservationRef, { status: "Confirmed" });
            
            const notificationsCollection = collection(db, 'notifications');
            const matchInvitationsCollection = collection(db, 'matchInvitations');
            
            // Notification for the Manager
            const managerNotificationRef = doc(notificationsCollection);
            const managerNotification: Omit<Notification, 'id'> = {
                userId: teamData.managerId,
                message: `Your booking for ${reservation.pitchName} was confirmed. A practice match has been created.`,
                link: `/dashboard/games/${matchDocRef.id}`,
                read: false,
                createdAt: serverTimestamp() as any,
            };
            batch.set(managerNotificationRef, managerNotification);

            // Create invitations for each Player on the team
            playerIds.forEach(playerId => {
                const playerInvitationRef = doc(matchInvitationsCollection);
                const playerInvitation: Omit<MatchInvitation, 'id'> = {
                    matchId: matchDocRef.id,
                    teamId: teamData.id,
                    playerId: playerId,
                    managerId: teamData.managerId,
                    status: "pending",
                    invitedAt: serverTimestamp() as any,
                };
                batch.set(playerInvitationRef, playerInvitation);
                
                 // Also create a simple notification to alert them of the invitation
                const playerNotificationRef = doc(notificationsCollection);
                const playerNotification: Omit<Notification, 'id'> = {
                    userId: playerId,
                    message: `You've been invited to a new game for your team, ${teamData.name}!`,
                    link: '/dashboard/my-games',
                    read: false,
                    createdAt: serverTimestamp() as any,
                };
                batch.set(playerNotificationRef, playerNotification);
            });


            await batch.commit(); 
            
            toast({
            title: "Reservation Confirmed!",
            description: `A practice match has been scheduled and players have been invited.`,
            });
        
        // --- Player Booking (Pick-up Game) ---
        } else if (reservation.playerRef) {
             const matchDoc = await addDoc(collection(db, "matches"), {
                date: reservation.date,
                pitchRef: reservation.pitchId,
                reservationRef: reservation.id, // Link reservation to match
                status: "PendingOpponent", // This status means it's open for players
                teamARef: null, // No teams in a pick-up game initially
                teamBRef: null,
                teamAPlayers: [reservation.playerRef], // The creator is the first player
                teamBPlayers: [],
                playerApplications: [],
                allowExternalPlayers: true,
                scoreA: 0,
                scoreB: 0,
                refereeId: null,
                attendance: 0,
                managerRef: null, // No manager for pick-up games
            });

            const batch = writeBatch(db);
            batch.update(reservationRef, { status: "Confirmed" });
            const notificationsCollection = collection(db, 'notifications');
            const newNotificationRef = doc(notificationsCollection);
            const notification: Omit<Notification, 'id'> = {
                userId: reservation.playerRef,
                message: `Your booking for ${reservation.pitchName} was confirmed. Your pick-up game is ready!`,
                link: `/dashboard/games/${matchDoc.id}`,
                read: false,
                createdAt: serverTimestamp() as any,
            };
            batch.set(newNotificationRef, notification);
            
            await batch.commit();

             toast({
                title: "Reservation Confirmed!",
                description: `A new pick-up game has been created and is open for players.`,
            });
        }
      } catch (error) {
        console.error("Error confirming reservation and creating match: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not confirm reservation." });
      }
    }
  };

  const now = new Date();
  const pendingReservations = reservations.filter(r => r.status === "Pending");
  const upcomingReservations = reservations.filter(r => (r.status === "Confirmed" || r.status === "Scheduled") && new Date(r.date) >= now);
  const pastReservations = reservations.filter(r => new Date(r.date) < now || r.status === "Canceled");
  
  const getStatusIcon = (status: Reservation["status"]) => {
    switch(status) {
        case "Scheduled":
            return <CalendarCheck className="h-4 w-4 text-blue-600" />;
        case "Confirmed":
            return <CheckCheck className="h-4 w-4 text-green-600" />;
        case "Canceled":
            return <Ban className="h-4 w-4 text-red-600" />;
        case "Pending":
             return <Clock className="h-4 w-4 text-amber-600" />;
        default:
            return <Clock className="h-4 w-4 text-primary" />;
    }
  }

  const ReservationCard = ({ reservation }: { reservation: Reservation }) => (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">{reservation.pitchName}</CardTitle>
        <CardDescription className="flex items-center gap-2 pt-1">
          <Calendar className="h-4 w-4" /> {format(new Date(reservation.date), "PPP 'at' HH:mm")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span>Booked by: <span className="font-semibold">{reservation.actorName} ({reservation.actorRole})</span></span>
        </div>
        <div className="flex items-center gap-2">
            {getStatusIcon(reservation.status)}
            <span>Status: <span className="font-semibold">{reservation.status}</span></span>
        </div>
      </CardContent>
      {user?.role === 'OWNER' && reservation.status === 'Pending' && (
        <CardFooter className="gap-2">
          <Button size="sm" onClick={() => handleUpdateStatus(reservation, 'Confirmed')}>
             <CheckCircle className="mr-2 h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(reservation, 'Canceled')}>
             <XCircle className="mr-2 h-4 w-4" /> Reject
          </Button>
        </CardFooter>
      )}
    </Card>
  )

  const ReservationList = ({ reservations }: { reservations: Reservation[] }) => (
     <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
      {reservations.map(res => <ReservationCard key={res.id} reservation={res} />)}
     </div>
  )

  const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card className="flex flex-col items-center justify-center p-12 text-center mt-4 border-dashed">
        <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold font-headline">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  )

  const LoadingSkeleton = () => (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
        </div>
         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
        </div>
      </div>
  )

  if (loading) {
    return (
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold font-headline">My Schedule</h1>
                <p className="text-muted-foreground">
                View and manage your upcoming and past reservations.
                </p>
            </div>
            <LoadingSkeleton />
        </div>
    )
  }
  
  if (user?.role !== 'OWNER') {
    return (
       <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">My Schedule</h1>
                <p className="text-muted-foreground">
                This page is for pitch owners to manage their reservations.
                </p>
            </div>
             <EmptyState icon={Ban} title="Access Denied" description="You must be an Owner to view this page." />
        </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Schedule</h1>
        <p className="text-muted-foreground">
          View and manage your upcoming and past reservations.
        </p>
      </div>

      {/* Pending Requests Section */}
      {user?.role === 'OWNER' &&
        <div className="space-y-4">
            <h2 className="text-2xl font-bold font-headline text-primary">Pending Requests ({pendingReservations.length})</h2>
            {pendingReservations.length > 0 ? (
                <ReservationList reservations={pendingReservations} />
            ) : (
                <EmptyState icon={Clock} title="No Pending Reservations" description="You don't have any new booking requests right now." />
            )}
        </div>
      }

      <div className="border-t pt-8 space-y-4">
        <h2 className="text-2xl font-bold font-headline">Upcoming Schedule ({upcomingReservations.length})</h2>
         {upcomingReservations.length > 0 ? (
            <ReservationList reservations={upcomingReservations} />
        ) : (
            <EmptyState icon={Calendar} title="No Upcoming Bookings" description="There are no confirmed or scheduled bookings for the future." />
        )}
      </div>

       <div className="border-t pt-8">
        <Accordion type="single" collapsible>
            <AccordionItem value="history">
                <AccordionTrigger>
                    <h2 className="text-2xl font-bold font-headline">Reservation History ({pastReservations.length})</h2>
                </AccordionTrigger>
                <AccordionContent>
                    {pastReservations.length > 0 ? (
                        <ReservationList reservations={pastReservations} />
                    ) : (
                        <EmptyState icon={History} title="No Reservation History" description="Your past bookings will appear here." />
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </div>

    </div>
  );
}
