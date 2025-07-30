
"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Pitch } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { User, Star } from "lucide-react";

interface PitchesMapProps {
  pitches: Pitch[];
  hoveredPitchId: string | null;
  setHoveredPitchId: (id: string | null) => void;
  userLocation: { lat: number; lng: number } | null;
  nearestPitchId: string | null;
}

// In a real app, you'd get these bounds from the map viewport
// This is a simplified normalization for a static map image of Lisbon
const normalizeCoords = (coords: { lat: number; lng: number }, bounds: any) => {
  const x = (coords.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
  const y = (bounds.maxLat - coords.lat) / (bounds.maxLat - bounds.minLat);
  return { x: x * 100, y: y * 100 };
};


export function PitchesMap({ pitches, hoveredPitchId, setHoveredPitchId, userLocation, nearestPitchId }: PitchesMapProps) {
    
  // Define the geographical bounds for Lisbon to position the markers
  // These values might need tweaking for better marker distribution
  const lisbonBounds = {
    minLat: 38.70, maxLat: 38.78,
    minLng: -9.20, maxLng: -9.10,
  };

  return (
    <div className="w-full h-full bg-muted/50 relative overflow-hidden">
      <Image 
        src="https://placehold.co/1200x1200.png"
        layout="fill"
        objectFit="cover"
        alt="Map of the area"
        className="opacity-20"
        data-ai-hint="city map"
      />
      
      <TooltipProvider>
        {/* Render User Location */}
        {userLocation && (() => {
          const {x, y} = normalizeCoords(userLocation, lisbonBounds);
          return (
             <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        style={{ left: `${x}%`, top: `${y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                    >
                        <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                            <User className="h-3 w-3 text-white" />
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="font-semibold">Your Location</p>
                </TooltipContent>
            </Tooltip>
          )
        })()}

        {/* Render Pitches */}
        {pitches.map((pitch) => {
            if (!pitch.coords || typeof pitch.coords.lat !== 'number' || typeof pitch.coords.lng !== 'number') return null;
            
            const {x, y} = normalizeCoords(pitch.coords, lisbonBounds);
            const isNearest = pitch.id === nearestPitchId;
            const isHovered = pitch.id === hoveredPitchId;

            return (
                 <Tooltip key={pitch.id}>
                    <TooltipTrigger asChild>
                        <button
                            onMouseEnter={() => setHoveredPitchId(pitch.id)}
                            onMouseLeave={() => setHoveredPitchId(null)}
                            style={{ left: `${x}%`, top: `${y}%` }}
                            className={cn(
                                "absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all duration-300",
                                "hover:scale-150 hover:z-10",
                                isHovered && "scale-150 z-10 ring-2 ring-accent",
                                isNearest ? "bg-green-500" : "bg-primary",
                            )}
                        >
                          {isNearest && <Star className="h-2.5 w-2.5 text-white" />}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="font-semibold">{pitch.name}</p>
                        <p className="text-sm text-muted-foreground">{pitch.address}</p>
                         {isNearest && <p className="text-xs text-green-600 font-bold mt-1">Nearest to you!</p>}
                    </TooltipContent>
                </Tooltip>
            )
        })}
       </TooltipProvider>
    </div>
  );
}
