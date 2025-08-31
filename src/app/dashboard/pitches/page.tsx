
"use client";

import * as React from "react";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Pitch, OwnerProfile } from "@/types";
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
import { CreatePitchForm } from "@/components/forms/create-pitch-form";
import { EditPitchForm } from "@/components/forms/edit-pitch-form";
import { PlusCircle, MapPin, Users, Shield, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function PitchesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfile | null>(null);
  const [pitches, setPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [editingPitch, setEditingPitch] = React.useState<Pitch | null>(null);

  const fetchPitches = React.useCallback(async (profileId: string) => {
    try {
        const q = query(collection(db, "pitches"), where("ownerRef", "==", profileId));
        const querySnapshot = await getDocs(q);
        const pitchesData: Pitch[] = [];
        querySnapshot.forEach((doc) => {
            pitchesData.push({ id: doc.id, ...doc.data() } as Pitch);
        });
        setPitches(pitchesData);
    } catch (error) {
        console.error("Error fetching pitches:", error);
        toast({ variant: "destructive", title: "Error fetching pitches", description: "Could not load your pitches."});
    } finally {
        setLoading(false);
    }
  }, [toast]);


  React.useEffect(() => {
    if (!user || user.role !== 'OWNER') {
        setLoading(false);
        return;
    }

    const fetchOwnerProfile = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const ownerDoc = querySnapshot.docs[0];
          const profile = { id: ownerDoc.id, ...ownerDoc.data() } as OwnerProfile;
          setOwnerProfile(profile);
          // Fetch pitches after getting the profile
          await fetchPitches(profile.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching owner profile:", error);
        setLoading(false);
      }
    };

    fetchOwnerProfile();
  }, [user, fetchPitches]);
  
  const handlePitchCreated = () => {
    setIsCreateDialogOpen(false);
    if(ownerProfile) fetchPitches(ownerProfile.id);
  };

  const handlePitchUpdated = () => {
    setEditingPitch(null);
    if(ownerProfile) fetchPitches(ownerProfile.id);
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold font-headline">My Pitches</h1>
            <p className="text-muted-foreground">View, create, and manage your available pitches.</p>
         </div>
         <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!ownerProfile}>
                <PlusCircle className="mr-2" />
                Add New Pitch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="font-headline">Add a New Pitch</DialogTitle>
                <DialogDescription>
                  Fill in the details below to list a new pitch. The address will be inherited from your owner profile.
                </DialogDescription>
              </DialogHeader>
              <CreatePitchForm ownerProfile={ownerProfile} onPitchCreated={handlePitchCreated} />
            </DialogContent>
          </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
        </div>
      ) : pitches.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pitches.map((pitch) => (
            <Card key={pitch.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline">{pitch.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                  <MapPin className="h-4 w-4" /> {pitch.address}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-grow">
                 <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Sport: <span className="font-semibold text-primary">{pitch.sport.toUpperCase()}</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Capacity: <span className="font-semibold">{pitch.capacity} people</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span>Base Price: <span className="font-semibold">{pitch.basePrice}€ / hour</span></span>
                 </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 items-stretch">
                 <Button variant="default" className="w-full" asChild>
                    <Link href={`/dashboard/pitches/${pitch.id}`}>
                        View Schedule & Book
                    </Link>
                 </Button>
                 <Button variant="outline" className="w-full" onClick={() => setEditingPitch(pitch)}>Edit Details</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
            <CardHeader>
                <CardTitle className="font-headline">No Pitches Found</CardTitle>
                <CardDescription>You haven't added any pitches yet. Get started by adding your first one!</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!ownerProfile}>
                    <PlusCircle className="mr-2" />
                    Add Your First Pitch
                </Button>
            </CardContent>
        </Card>
      )}

      {/* Edit Pitch Dialog */}
      <Dialog open={!!editingPitch} onOpenChange={(isOpen) => !isOpen && setEditingPitch(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Edit Pitch Details</DialogTitle>
            <DialogDescription>
              Update the information for your pitch below.
            </DialogDescription>
          </DialogHeader>
          {editingPitch && (
            <EditPitchForm pitch={editingPitch} onPitchUpdated={handlePitchUpdated} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
