
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import type { Pitch } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Shield, CalendarPlus, Star } from "lucide-react";
import { PitchesMap } from "@/components/pitches-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { haversineDistance } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { CreateReservationForm } from "@/components/forms/create-reservation-form";
import { useUser } from "@/hooks/use-user";

// It's important to read the environment variable here
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function GamesPage() {
  const { user } = useUser();
  const [pitches, setPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [nearestPitchId, setNearestPitchId] = React.useState<string | null>(null);
  const [hoveredPitchId, setHoveredPitchId] = React.useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = React.useState<Pitch | null>(null);

  React.useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting user location:", error);
           // Fallback location (e.g., center of Lisbon) if user denies permission
          setUserLocation({ lat: 38.7223, lng: -9.1393 });
        }
      );
    } else {
       // Fallback location if geolocation is not supported
       setUserLocation({ lat: 38.7223, lng: -9.1393 });
    }

    // Fetch pitches
    const q = query(collection(db, "pitches"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pitchesData: Pitch[] = [];
      querySnapshot.forEach((doc) => {
        pitchesData.push({ id: doc.id, ...doc.data() } as Pitch);
      });
      setPitches(pitchesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching pitches:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  React.useEffect(() => {
    if (userLocation && pitches.length > 0) {
      let closestPitchId: string | null = null;
      let minDistance = Infinity;

      pitches.forEach(pitch => {
        if (pitch.coords) {
          const distance = haversineDistance(userLocation, pitch.coords);
          if (distance < minDistance) {
            minDistance = distance;
            closestPitchId = pitch.id;
          }
        }
      });
      setNearestPitchId(closestPitchId);
    }
  }, [userLocation, pitches]);


  const filteredPitches = pitches.filter(pitch =>
    pitch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (pitch.city && pitch.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    pitch.sport.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReservationSuccess = () => {
    setSelectedPitch(null); // Close the dialog
  };
  
  // Explicitly check if the API key is missing.
  if (!googleMapsApiKey) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-destructive">Configuration Error</CardTitle>
                <CardDescription>
                    The Google Maps API key is missing. Please add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to your environment variables.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p>If you have already added the key, please restart the development server for the changes to take effect.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <Dialog open={!!selectedPitch} onOpenChange={(isOpen) => !isOpen && setSelectedPitch(null)}>
        <div className="h-[calc(100vh-10rem)] grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Search and List */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">Find a Game</CardTitle>
                <CardDescription>Use the search below to filter the list and map.</CardDescription>
            </CardHeader>
            <CardContent>
                <Input 
                placeholder="Search by field name, city, or sport..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </CardContent>
            </Card>
            
            <div className="flex flex-col flex-grow min-h-0">
                <h2 className="text-xl font-bold font-headline px-1 pb-2">Results</h2>
                <ScrollArea className="flex-grow">
                    {loading ? (
                        <div className="space-y-4 pr-4">
                            <Skeleton className="h-44" />
                            <Skeleton className="h-44" />
                            <Skeleton className="h-44" />
                        </div>
                    ) : filteredPitches.length > 0 ? (
                        <div className="space-y-4 pr-4">
                            {filteredPitches.map((pitch) => (
                                <Card 
                                    key={pitch.id} 
                                    className="flex flex-col cursor-pointer transition-all border-2 border-transparent hover:border-primary"
                                    onMouseEnter={() => setHoveredPitchId(pitch.id)}
                                    onMouseLeave={() => setHoveredPitchId(null)}
                                >
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="font-headline text-lg">{pitch.name}</CardTitle>
                                                <CardDescription className="flex items-center gap-2 pt-1">
                                                    <MapPin className="h-4 w-4" /> {pitch.address}
                                                </CardDescription>
                                            </div>
                                            {pitch.id === nearestPitchId && (
                                                <div className="flex items-center gap-1 text-xs font-bold text-green-600">
                                                    <Star className="h-4 w-4" /> Nearest
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-primary" />
                                            <span>Sport: <span className="font-semibold text-primary">{pitch.sport.toUpperCase()}</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-primary" />
                                            <span>Capacity: <span className="font-semibold">{pitch.capacity} people</span></span>
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <DialogTrigger asChild>
                                            <Button className="w-full font-semibold" onClick={() => setSelectedPitch(pitch)}>
                                                <CalendarPlus className="mr-2" /> Book Now
                                            </Button>
                                        </DialogTrigger>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="flex flex-col items-center justify-center p-12 text-center h-full">
                            <CardHeader>
                                <CardTitle className="font-headline">No Fields Found</CardTitle>
                                <CardDescription>No fields match your search criteria. Try a different search.</CardDescription>
                            </CardHeader>
                        </Card>
                    )}
                </ScrollArea>
            </div>
        </div>
        
        {/* Right Column: Map */}
        <div className="lg:col-span-2 rounded-lg overflow-hidden border">
            {loading ? (
            <Skeleton className="w-full h-full" />
            ) : (
                <PitchesMap 
                    apiKey={googleMapsApiKey}
                    pitches={filteredPitches} 
                    userLocation={userLocation}
                    nearestPitchId={nearestPitchId}
                    hoveredPitchId={hoveredPitchId}
                />
            )}
        </div>
        </div>

        {/* Booking Dialog */}
        <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle className="font-headline">Book Field: {selectedPitch?.name}</DialogTitle>
                <DialogDescription>
                Select a date and time to request a reservation. The field owner will need to confirm it.
                </DialogDescription>
            </DialogHeader>
            {user && selectedPitch && (
                <CreateReservationForm 
                    user={user} 
                    pitch={selectedPitch} 
                    onReservationSuccess={handleReservationSuccess} 
                />
            )}
        </DialogContent>
    </Dialog>
  );
}
