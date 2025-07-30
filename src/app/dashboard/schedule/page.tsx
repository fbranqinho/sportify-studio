
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from "firebase/firestore";
import { useUser } from "@/hooks/use-user";
import type { Reservation, Pitch, OwnerProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, User, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function SchedulePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
  
    setLoading(true);
    let reservationsQuery;
  
    if (user.role === 'OWNER') {
      // New logic: Query based on ownerProfile ID
      const profilesQuery = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
      getDocs(profilesQuery).then(profileSnapshot => {
        if (!profileSnapshot.empty) {
          const ownerProfileId = profileSnapshot.docs[0].id;
          reservationsQuery = query(collection(db, "reservations"), where("ownerProfileId", "==", ownerProfileId));
  
          const unsubscribe = onSnapshot(reservationsQuery, (querySnapshot) => {
            const reservationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
            setReservations(reservationsData);
            setLoading(false);
          }, (error) => {
            console.error("Error fetching reservations: ", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch reservations." });
            setLoading(false);
          });
          return () => unsubscribe();
        } else {
          setLoading(false);
        }
      });
    } else {
      // For other roles, query based on user ID directly
      const roleField = `${user.role.toLowerCase()}Ref`;
      reservationsQuery = query(collection(db, "reservations"), where(roleField, "==", user.id));
      
      const unsubscribe = onSnapshot(reservationsQuery, (querySnapshot) => {
        const reservationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
        setReservations(reservationsData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching reservations: ", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch reservations." });
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, toast]);
  

  const handleUpdateStatus = async (reservationId: string, status: "Confirmed" | "Cancelled") => {
    const reservationRef = doc(db, "reservations", reservationId);
    try {
      await updateDoc(reservationRef, { status });
      toast({
        title: "Reservation Updated",
        description: `The reservation has been ${status.toLowerCase()}.`,
      });
    } catch (error) {
      console.error("Error updating reservation status: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not update reservation." });
    }
  };

  const pendingReservations = reservations.filter(r => r.status === "Pending");
  const pastReservations = reservations.filter(r => r.status !== "Pending");
  
  const ReservationCard = ({ reservation }: { reservation: Reservation }) => (
    <Card>
      <CardHeader>
        <CardTitle>{reservation.pitchName}</CardTitle>
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
            <Clock className="h-4 w-4 text-primary" />
            <span>Status: <span className="font-semibold">{reservation.status}</span></span>
        </div>
      </CardContent>
      {user?.role === 'OWNER' && reservation.status === 'Pending' && (
        <CardFooter className="gap-2">
          <Button size="sm" onClick={() => handleUpdateStatus(reservation.id, 'Confirmed')}>
             <CheckCircle className="mr-2 h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(reservation.id, 'Cancelled')}>
             <XCircle className="mr-2 h-4 w-4" /> Reject
          </Button>
        </CardFooter>
      )}
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Schedule</h1>
        <p className="text-muted-foreground">
          View and manage your upcoming and past reservations.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingReservations.length})</TabsTrigger>
          <TabsTrigger value="history">History ({pastReservations.length})</TabsTrigger>
        </TabsList>
        
        {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </div>
        ) : (
          <>
            <TabsContent value="pending">
              {pendingReservations.length > 0 ? (
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                  {pendingReservations.map(res => <ReservationCard key={res.id} reservation={res} />)}
                 </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No pending reservations found.</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="history">
              {pastReservations.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                   {pastReservations.map(res => <ReservationCard key={res.id} reservation={res} />)}
                </div>
              ) : (
                <div className="text-center py-12">
                   <p className="text-muted-foreground">No reservation history found.</p>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
