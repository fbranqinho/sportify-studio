
"use client";

import * as React from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import type { Pitch, Match, Team } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gamepad2 } from "lucide-react";
import { PitchesMap } from "@/components/pitches-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPlayerCapacity } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { OpenGameCard } from "@/components/game/open-game-card";

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface EnrichedMatch extends Match {
    pitch?: Pitch;
    team?: Team;
}

export function PlayerGamesView() {
  const { user } = useUser();
  const [openMatches, setOpenMatches] = React.useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [hoveredMatchId, setHoveredMatchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => setUserLocation({ lat: 38.7223, lng: -9.1393 }) // Lisbon fallback
      );
    } else {
      setUserLocation({ lat: 38.7223, lng: -9.1393 });
    }

    const fetchOpenGames = async () => {
        setLoading(true);
        try {
            const q = query(
              collection(db, "matches"),
              where("status", "==", "Collecting players"),
              where("allowExternalPlayers", "==", true)
            );
            
            const querySnapshot = await getDocs(q);
            const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
            
            const pitchIds = [...new Set(matchesData.map(m => m.pitchRef))];
            const teamIds = [...new Set(matchesData.map(m => m.teamARef).filter(Boolean))];

            const pitchesMap = new Map<string, Pitch>();
            if (pitchIds.length > 0) {
                const pitchesQuery = query(collection(db, "pitches"), where(documentId(), "in", pitchIds));
                const pitchesSnap = await getDocs(pitchesQuery);
                pitchesSnap.forEach(doc => pitchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Pitch));
            }

            const teamsMap = new Map<string, Team>();
            if (teamIds.length > 0) {
                const teamsQuery = query(collection(db, "teams"), where(documentId(), "in", teamIds));
                const teamsSnap = await getDocs(teamsQuery);
                teamsSnap.forEach(doc => teamsMap.set(doc.id, { id: doc.id, ...doc.data() } as Team));
            }

            const enrichedMatches = matchesData.map(match => ({
                ...match,
                pitch: pitchesMap.get(match.pitchRef),
                team: match.teamARef ? teamsMap.get(match.teamARef) : undefined
            })).filter(m => {
                if (!m.pitch) return false;
                const capacity = getPlayerCapacity(m.pitch.sport);
                const currentPlayers = (m.teamAPlayers?.length || 0) + (m.teamBPlayers?.length || 0);
                return currentPlayers < capacity;
            });
            
            setOpenMatches(enrichedMatches);

        } catch(error) {
             console.error("Error fetching open matches:", error);
        } finally {
             setLoading(false);
        }
    };
    
    fetchOpenGames();
    
  }, []);

  const filteredMatches = openMatches.filter(match => {
    const term = searchTerm.toLowerCase();
    return (
        match.pitch?.name.toLowerCase().includes(term) ||
        match.pitch?.city.toLowerCase().includes(term) ||
        match.pitch?.sport.toLowerCase().includes(term) ||
        match.team?.name.toLowerCase().includes(term)
    )
  });
  
  const mapPitches = React.useMemo(() => {
    return filteredMatches.map(m => m.pitch).filter((p): p is Pitch => !!p);
  }, [filteredMatches]);

  if (!googleMapsApiKey) {
    return (
        <Card><CardHeader><CardTitle className="text-destructive">Configuration Error</CardTitle><CardDescription>The Google Maps API key is missing.</CardDescription></CardHeader></Card>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 flex flex-col gap-6">
        <div className="flex flex-col flex-grow min-h-0">
          <h2 className="text-xl font-bold font-headline px-1 pb-2">Open Games ({filteredMatches.length})</h2>
          <ScrollArea className="flex-grow">
            {loading ? (
              <div className="space-y-4 pr-4">
                <Skeleton className="h-56" /><Skeleton className="h-56" />
              </div>
            ) : filteredMatches.length > 0 ? (
              <div className="space-y-4 pr-4">
                {filteredMatches.map((match) => (
                  <OpenGameCard 
                      key={match.id} 
                      match={match} 
                      user={user}
                      onMouseEnter={() => setHoveredMatchId(match.id)}
                      onMouseLeave={() => setHoveredMatchId(null)}
                  />
                ))}
              </div>
            ) : (
              <Card className="flex flex-col items-center justify-center p-12 text-center h-full">
                <CardHeader>
                  <Gamepad2 className="mx-auto h-12 w-12 text-muted-foreground" />
                  <CardTitle className="font-headline mt-4">No Open Games Found</CardTitle>
                  <CardDescription>There are no games looking for players right now. Check back later!</CardDescription>
                </CardHeader>
              </Card>
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
            pitches={mapPitches} 
            userLocation={userLocation}
            hoveredPitchId={hoveredMatchId ? (openMatches.find(m => m.id === hoveredMatchId)?.pitch?.id || null) : null}
            nearestPitchId={null}
          />
        )}
      </div>
    </div>
  );
}
