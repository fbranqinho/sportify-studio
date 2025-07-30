
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, Search } from "lucide-react";
import { GamesMap } from "@/components/games-map";
import type { Pitch } from "@/types";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

export default function GamesPage() {
  const [pitches, setPitches] = React.useState<Pitch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hoveredPitchId, setHoveredPitchId] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [sportFilter, setSportFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  
  React.useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "pitches"), (snapshot) => {
        const pitchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pitch));
        setPitches(pitchesData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching pitches:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleFavorite = (pitchId: string) => {
    setFavorites((prev) =>
      prev.includes(pitchId)
        ? prev.filter((id) => id !== pitchId)
        : [...prev, pitchId]
    );
  };
  
  const filteredPitches = pitches
    .filter(p => sportFilter === 'all' || p.sport === sportFilter)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.address.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      {/* Left Column: Filters and List */}
      <div className="lg:col-span-1 flex flex-col gap-4 h-full">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Find a Game</CardTitle>
            <CardDescription>Filter by sport and location to find the perfect match.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search by name or address..." 
                className="pl-10" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={sportFilter} onValueChange={setSportFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="fut5">Futebol 5</SelectItem>
                <SelectItem value="fut7">Futebol 7</SelectItem>
                <SelectItem value="fut11">Futebol 11</SelectItem>
                <SelectItem value="futsal">Futsal</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-4 p-4 rounded-lg border">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))
          ) : filteredPitches.map((pitch) => (
             <Card 
                key={pitch.id} 
                className="hover:shadow-md transition-shadow"
                onMouseEnter={() => setHoveredPitchId(pitch.id)}
                onMouseLeave={() => setHoveredPitchId(null)}
              >
              <CardHeader>
                <CardTitle className="text-lg font-headline flex justify-between items-start">
                  {pitch.name}
                   <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => toggleFavorite(pitch.id)}>
                    <Heart className={cn("h-5 w-5", favorites.includes(pitch.id) ? "text-red-500 fill-current" : "text-muted-foreground")} />
                  </Button>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                  <MapPin className="h-4 w-4" /> {pitch.address}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-semibold bg-primary/10 text-primary rounded-full px-3 py-1 inline-block">
                  {pitch.sport.toUpperCase()}
                </div>
              </CardContent>
              <CardFooter>
                 <Button className="w-full font-semibold">View Details & Book</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Column: Map */}
      <div className="lg:col-span-2 h-full rounded-lg overflow-hidden border">
         <GamesMap pitches={filteredPitches} hoveredPitchId={hoveredPitchId} setHoveredPitchId={setHoveredPitchId} />
      </div>
    </div>
  );
}
