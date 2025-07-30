
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import type { Pitch } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Shield, CalendarPlus } from "lucide-react";

export default function GamesPage() {
  const [pitches, setPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
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

  const filteredPitches = pitches.filter(pitch =>
    pitch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pitch.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pitch.sport.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Find a Game</h1>
        <p className="text-muted-foreground">
          Search for available games, pitches, or teams near you.
        </p>
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Use the options below to find your next match.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input 
              placeholder="Search by field name, city, or sport..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* More filter components will go here */}
          </CardContent>
        </Card>
        
        <div className="space-y-4">
            <h2 className="text-2xl font-bold font-headline">Results</h2>
             {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-52" />
                    <Skeleton className="h-52" />
                    <Skeleton className="h-52" />
                </div>
            ) : filteredPitches.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPitches.map((pitch) => (
                        <Card key={pitch.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="font-headline">{pitch.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2 pt-1">
                                    <MapPin className="h-4 w-4" /> {pitch.address}
                                </CardDescription>
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
                                <Button className="w-full font-semibold">
                                    <CalendarPlus className="mr-2" /> Book Now
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="flex flex-col items-center justify-center p-12 text-center">
                    <CardHeader>
                        <CardTitle className="font-headline">No Fields Found</CardTitle>
                        <CardDescription>No fields match your search criteria. Try a different search.</CardDescription>
                    </CardHeader>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
