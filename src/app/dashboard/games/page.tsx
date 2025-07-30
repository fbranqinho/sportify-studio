
"use client";

import * as React from "react";
import { OwnersMap } from "@/components/owners-map";
import type { OwnerProfile } from "@/types";
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
  const [owners, setOwners] = React.useState<OwnerProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hoveredOwnerId, setHoveredOwnerId] = React.useState<string | null>(null);
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [nearestOwnerId, setNearestOwnerId] = React.useState<string | null>(null);
  const { toast } = useToast();
  
  // Fetch owners from Firestore
  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "ownerProfiles"), (snapshot) => {
        const ownersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OwnerProfile));
        setOwners(ownersData);
        // We will set loading to false in the location useEffect
    }, (error) => {
        console.error("Error fetching owners:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch owners data."})
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
          setLoading(false); // End loading after getting location
        },
        () => {
          toast({
            variant: "destructive",
            title: "Location Access Denied",
            description: "Please enable location access to find the nearest owners.",
          });
          setLoading(false); // End loading even if denied
        }
      );
    } else {
        setLoading(false); // End loading if geolocation is not supported
    }
  }, [toast]);
  
  // Find the nearest owner once user location and owners are available
  React.useEffect(() => {
    if (userLocation && owners.length > 0) {
      let closestOwner: OwnerProfile | null = null;
      let minDistance = Infinity;

      owners.forEach(owner => {
        if (owner.latitude && owner.longitude) {
            const distance = getDistance(userLocation.lat, userLocation.lng, owner.latitude, owner.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                closestOwner = owner;
            }
        }
      });
      
      if (closestOwner) {
          setNearestOwnerId(closestOwner.id);
      }
    }
  }, [userLocation, owners]);


  if (loading) {
      return <Skeleton className="w-full h-full rounded-lg border" />;
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border">
        <OwnersMap 
            owners={owners} 
            hoveredOwnerId={hoveredOwnerId} 
            setHoveredOwnerId={setHoveredOwnerId}
            userLocation={userLocation}
            nearestOwnerId={nearestOwnerId}
        />
    </div>
  );
}
