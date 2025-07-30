
"use client";

import * as React from "react";
import { GamesMap } from "@/components/games-map";
import type { Pitch } from "@/types";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// Haversine formula to calculate distance between two points on Earth
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};


export default function GamesPage() {
  const [pitches, setPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hoveredPitchId, setHoveredPitchId] = React.useState<string | null>(null);
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [nearestPitchId, setNearestPitchId] = React.useState<string | null>(null);
  const { toast } = useToast();
  
  // Fetch pitches from Firestore
  React.useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "pitches"), (snapshot) => {
        const pitchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pitch));
        setPitches(pitchesData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching pitches:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch fields data."})
        setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  // Get user's location
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          toast({
            variant: "destructive",
            title: "Location Access Denied",
            description: "Please enable location access to find the nearest fields.",
          });
        }
      );
    }
  }, [toast]);
  
  // Find the nearest pitch once user location and pitches are available
  React.useEffect(() => {
    if (userLocation && pitches.length > 0) {
      let closestPitch: Pitch | null = null;
      let minDistance = Infinity;

      pitches.forEach(pitch => {
        if (pitch.coords) {
            const distance = getDistance(userLocation.lat, userLocation.lng, pitch.coords.lat, pitch.coords.lng);
            if (distance < minDistance) {
                minDistance = distance;
                closestPitch = pitch;
            }
        }
      });
      
      if (closestPitch) {
          setNearestPitchId(closestPitch.id);
      }
    }
  }, [userLocation, pitches]);


  if (loading) {
      return <Skeleton className="w-full h-full" />;
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border">
        <GamesMap 
            pitches={pitches} 
            hoveredPitchId={hoveredPitchId} 
            setHoveredPitchId={setHoveredPitchId}
            userLocation={userLocation}
            nearestPitchId={nearestPitchId}
        />
    </div>
  );
}
