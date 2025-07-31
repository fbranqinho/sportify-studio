
"use client";

import * as React from "react";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import type { Promo, OwnerProfile, Pitch } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreatePromoForm } from "@/components/forms/create-promo-form";
import { PlusCircle, Tag, Calendar, Clock, Percent, Shield, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const dayOfWeekAsString = (dayIndex: number) => {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayIndex];
}

export default function PromosPage() {
  const { user } = useUser();
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfile | null>(null);
  const [promos, setPromos] = React.useState<Promo[]>([]);
  const [ownerPitches, setOwnerPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;

    const fetchOwnerProfileAndPitches = async () => {
      try {
        const q = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const ownerDoc = querySnapshot.docs[0];
          const profile = { id: ownerDoc.id, ...ownerDoc.data() } as OwnerProfile;
          setOwnerProfile(profile);

          if (profile.pitches && profile.pitches.length > 0) {
            const pitchesQuery = query(collection(db, "pitches"), where("ownerRef", "==", profile.id));
            const pitchesSnapshot = await getDocs(pitchesQuery);
            const pitchesData = pitchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pitch));
            setOwnerPitches(pitchesData);
          }

        }
      } catch (error) {
        console.error("Error fetching owner profile and pitches:", error);
      }
    };

    fetchOwnerProfileAndPitches();
  }, [user]);

  React.useEffect(() => {
    if (!ownerProfile) return;

    setLoading(true);
    const q = query(collection(db, "promos"), where("ownerProfileId", "==", ownerProfile.id));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const promosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promo));
      promosData.sort((a, b) => (b.createdAt as any) - (a.createdAt as any));
      setPromos(promosData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching promos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerProfile]);
  
  const handlePromoCreated = () => {
    setIsCreateDialogOpen(false);
  };

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold font-headline">My Promotions</h1>
            <p className="text-muted-foreground">Launch promotions for your fields during vacant hours to increase profitability.</p>
         </div>
         <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!ownerProfile}>
                <PlusCircle className="mr-2" />
                Create Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle className="font-headline">Create a New Promotion</DialogTitle>
                <DialogDescription>
                  Fill in the details below to create a new promotion for your pitches.
                </DialogDescription>
              </DialogHeader>
              <CreatePromoForm 
                ownerProfile={ownerProfile} 
                ownerPitches={ownerPitches}
                onPromoCreated={handlePromoCreated} 
              />
            </DialogContent>
          </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
        </div>
      ) : promos.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {promos.map((promo) => (
            <Card key={promo.id}>
              <CardHeader>
                <CardTitle className="font-headline flex items-center justify-between">
                  <span>{promo.name}</span>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Percent className="h-4 w-4" />
                    {promo.discountPercent}% OFF
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1 text-xs">
                  <Calendar className="h-4 w-4" /> 
                  <span>{format(new Date(promo.validFrom), "MMM d, yyyy")} to {format(new Date(promo.validTo), "MMM d, yyyy")}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                 <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>Hours: <span className="font-semibold text-primary">{promo.applicableHours.join(', ')}h</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                     <span>Days: <span className="font-semibold text-primary">{promo.applicableDays.map(dayOfWeekAsString).join(', ')}</span></span>
                 </div>
                 <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p>Applicable Pitches:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {promo.pitchIds.length === 0 ? (
                            <Badge variant="outline">All Pitches</Badge>
                        ) : (
                          promo.pitchIds.map(id => {
                            const pitch = ownerPitches.find(p => p.id === id);
                            return <Badge key={id} variant="outline">{pitch?.name || 'Unknown Pitch'}</Badge>
                          })
                        )}
                      </div>
                    </div>
                 </div>
              </CardContent>
              <CardFooter>
                 <Button variant="outline" size="sm" className="w-full" disabled>
                    <Trash2 className="mr-2 h-4 w-4"/> Delete (Coming Soon)
                  </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <CardHeader>
                <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="font-headline mt-4">No Promotions Found</CardTitle>
                <CardDescription>You haven't created any promotions yet. Get started now!</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!ownerProfile}>
                    <PlusCircle className="mr-2" />
                    Create Your First Promotion
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
