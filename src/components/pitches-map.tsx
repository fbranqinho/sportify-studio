
"use client";

import * as React from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import type { Pitch } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, User } from "lucide-react";

interface PitchesMapProps {
  apiKey: string;
  pitches: Pitch[];
  hoveredPitchId: string | null;
  userLocation: { lat: number; lng: number } | null;
  nearestPitchId: string | null;
}

const containerStyle = {
  width: "100%",
  height: "100%",
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
};

export function PitchesMap({
  apiKey,
  pitches,
  hoveredPitchId,
  userLocation,
  nearestPitchId,
}: PitchesMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const [selectedPitch, setSelectedPitch] = React.useState<Pitch | null>(null);

  const mapRef = React.useRef<google.maps.Map | null>(null);

  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    mapRef.current = map;
    if (pitches.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      pitches.forEach(pitch => {
        if(pitch.coords) bounds.extend(pitch.coords);
      });
      if (userLocation) {
        bounds.extend(userLocation);
      }
      map.fitBounds(bounds);

      // If there's only one pitch, fitting bounds might zoom in too much.
      if (pitches.length === 1 && userLocation) {
         const listener = window.google.maps.event.addListener(map, 'idle', () => { 
            if (map.getZoom()! > 14) map.setZoom(14); 
            window.google.maps.event.removeListener(listener); 
        });
      }
    }
  }, [pitches, userLocation]);


  if (!isLoaded) {
    return <Skeleton className="w-full h-full" />;
  }

  const center = userLocation || { lat: 38.7223, lng: -9.1393 }; // Default to Lisbon

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      options={mapOptions}
      onLoad={onLoad}
    >
      {/* User Location Marker */}
      {userLocation && (
        <Marker
          position={userLocation}
          title="Your Location"
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
        />
      )}

      {/* Pitch Markers */}
      {pitches.map((pitch) => {
        if (!pitch.coords) return null;
        
        const isHovered = pitch.id === hoveredPitchId;

        return (
          <Marker
            key={pitch.id}
            position={pitch.coords}
            title={pitch.name}
            onClick={() => setSelectedPitch(pitch)}
            animation={isHovered ? (window.google.maps.Animation.BOUNCE) : undefined}
          />
        );
      })}

      {/* InfoWindow for Selected Pitch */}
      {selectedPitch && (
        <InfoWindow
          position={selectedPitch.coords}
          onCloseClick={() => setSelectedPitch(null)}
        >
          <div>
            <h3 className="font-bold font-headline">{selectedPitch.name}</h3>
            <p className="text-sm">{selectedPitch.address}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
