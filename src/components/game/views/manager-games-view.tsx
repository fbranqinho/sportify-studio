
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, getDocs } from "firebase/firestore";
import type { Pitch } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Shield, Users, DollarSign } from "lucide-react";
import { PitchesMap } from "@/components/pitches-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { haversineDistance } from "@/lib/utils";
import Link from "next/link";
import { Input } from "@/components/ui/input";

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function ManagerGamesView() {
  const [allPitches, setAllPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [hoveredPitchId, setHoveredPitchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => setUserLocation({ lat: 38.7223, lng: -9.1393 }) // Lisbon fallback
      );
    } else {
      setUserLocation({ lat: 38.7223, lng: -9.1393 });
    }

    const fetchPitches = async () => {
        try {
            const q = query(collection(db, "pitches"));
            const querySnapshot = await getDocs(q);
            const pitchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pitch));
            setAllPitches(pitchesData);
        } catch (error) {
            console.error("Error fetching pitches:", error);
        } finally {
            setLoading(false);
        }
    };
    
    fetchPitches();

  }, []);

  const filteredPitches = allPitches
    .map(pitch => ({
      ...pitch,
      distance: userLocation && pitch.coords ? haversineDistance(userLocation, pitch.coords) : null,
    }))
    .filter(pitch => {
        const term = searchTerm.toLowerCase();
        return (
            pitch.name.toLowerCase().includes(term) ||
            pitch.address.toLowerCase().includes(term) ||
            pitch.city.toLowerCase().includes(term) ||
            pitch.sport.toLowerCase().includes(term)
        );
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  const nearestPitchId = filteredPitches[0]?.id || null;

  if (!googleMapsApiKey) {
    return (
        <Card><CardHeader><CardTitle className="text-destructive">Configuration Error</CardTitle><CardDescription>The Google Maps API key is missing.</CardDescription></CardHeader></Card>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Find a Pitch</CardTitle>
            <CardDescription>Search for a pitch to book for your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input 
              placeholder="Search by name, city, or sport..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardContent>
        </Card>
        
        <div className="flex flex-col flex-grow min-h-0">
          <h2 className="text-xl font-bold font-headline px-1 pb-2">Available Pitches ({filteredPitches.length})</h2>
          <ScrollArea className="flex-grow">
            {loading ? (
              <div className="space-y-4 pr-4">
                <Skeleton className="h-40" /><Skeleton className="h-40" />
              </div>
            ) : filteredPitches.length > 0 ? (
              <div className="space-y-4 pr-4">
                {filteredPitches.map((pitch) => (
                  <Card key={pitch.id} onMouseEnter={() => setHoveredPitchId(pitch.id)} onMouseLeave={() => setHoveredPitchId(null)}>
                    <CardHeader>
                        <CardTitle className="font-headline text-lg">{pitch.name}</CardTitle>
                         <CardDescription className="flex items-center gap-2 pt-1">
                            <MapPin className="h-4 w-4" /> {pitch.address}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <span>{pitch.sport.toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span>Capacity: {pitch.capacity}</span>
                        </div>
                         <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            <span>From {pitch.basePrice}€/hour</span>
                        </div>
                         {pitch.distance && 
                            <p className="text-xs text-muted-foreground pt-1">{pitch.distance.toFixed(1)} km away</p>
                         }
                    </CardContent>
                    <CardFooter>
                         <Button asChild className="w-full">
                            <Link href={`/dashboard/pitches/${pitch.id}`}>
                                View Schedule & Book
                            </Link>
                        </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <p>No pitches found.</p>
            )}
          </ScrollArea>
        </div>
      </div>
    
      <div className="lg:col-span-2 rounded-lg overflow-hidden border">
        {loading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <PitchesMap 
            apiKey={googleMapsApiKey}
            pitches={filteredPitches} 
            userLocation={userLocation}
            hoveredPitchId={hoveredPitchId}
            nearestPitchId={nearestPitchId}
          />
        )}
      </div>
    </div>
  );
}
