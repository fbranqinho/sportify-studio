import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { PitchSport } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to calculate distance between two lat/lng points
export function haversineDistance(
  coords1: { lat: number; lng: number },
  coords2: { lat: number; lng: number }
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (coords2.lat - coords1.lat) * (Math.PI / 180);
  const dLng = (coords2.lng - coords1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.lat * (Math.PI / 180)) *
      Math.cos(coords2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export const getGameDuration = (sport: PitchSport): number => {
    switch (sport) {
        case 'fut11': return 90;
        case 'fut7': return 50;
        case 'fut5': case 'futsal': return 40;
        default: return 90;
    }
};

export const getPlayerCapacity = (sport?: PitchSport): number => {
    if (!sport) return 0;
    switch (sport) {
        case 'fut5':
        case 'futsal':
            return 10;
        case 'fut7':
            return 14;
        case 'fut11':
            return 22;
        default:
            return 0; // Should not happen
    }
};
