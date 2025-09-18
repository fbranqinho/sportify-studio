
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
import { PlusCircle, Tag, Calendar, Clock, Percent, Shield, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { EditPromoForm } from "@/components/forms/edit-promo-form";
import { useToast } from "@/hooks/use-toast";

const dayOfWeekAsString = (dayIndex: number) => {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayIndex];
}

export default function PromosPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfile | null>(null);
  const [promos, setPromos] = React.useState<Promo[]>([]);
  const [ownerPitches, setOwnerPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [editingPromo, setEditingPromo] = React.useState<Promo | null>(null);

  const fetchPromos = React.useCallback(async (profileId: string) => {
    setLoading(true);
    try {
        const q = query(collection(db, "promos"), where("ownerProfileId", "==", profileId));
        const querySnapshot = await getDocs(q);
        const promosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promo));
        promosData.sort((a, b) => (b.createdAt?.toDate().getTime() || 0) - (a.createdAt?.toDate().getTime() || 0));
        setPromos(promosData);
    } catch (error) {
        console.error("Error fetching promos:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load promotions." });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!user || user.role !== 'OWNER') {
        setLoading(false);
        return;
    }

    const fetchOwnerProfileAndPitches = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const ownerDoc = querySnapshot.docs[0];
          const profile = { id: ownerDoc.id, ...ownerDoc.data() } as OwnerProfile;
          setOwnerProfile(profile);

          const pitchesQuery = query(collection(db, "pitches"), where("ownerRef", "==", profile.id));
          const pitchesSnapshot = await getDocs(pitchesQuery);
          const pitchesData = pitchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pitch));
          setOwnerPitches(pitchesData);
          
          await fetchPromos(profile.id);

        } else {
             setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching owner profile and pitches:", error);
        setLoading(false);
      }
    };

    fetchOwnerProfileAndPitches();
  }, [user, fetchPromos]);
  
  const handlePromoCreated = () => {
    setIsCreateDialogOpen(false);
    if (ownerProfile) fetchPromos(ownerProfile.id);
  };
  
  const handlePromoUpdated = () => {
    setEditingPromo(null);
    if (ownerProfile) fetchPromos(ownerProfile.id);
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
                  <span>{format(promo.validFrom.toDate(), "MMM d, yyyy")} to {format(promo.validTo.toDate(), "MMM d, yyyy")}</span>
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
              <CardFooter className="gap-2">
                 <Button variant="outline" size="sm" className="w-full" onClick={() => setEditingPromo(promo)}>
                    <Edit className="mr-2 h-4 w-4"/> Edit Details
                  </Button>
                  <Button variant="destructive" size="sm" disabled>
                    <Trash2 className="mr-2 h-4 w-4"/>
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

      {/* Edit Promo Dialog */}
       <Dialog open={!!editingPromo} onOpenChange={(isOpen) => !isOpen && setEditingPromo(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Edit Promotion</DialogTitle>
            <DialogDescription>
              Update the details for your promotion below.
            </DialogDescription>
          </DialogHeader>
          {editingPromo && (
            <EditPromoForm
              promo={editingPromo}
              ownerPitches={ownerPitches}
              onPromoUpdated={handlePromoUpdated}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
