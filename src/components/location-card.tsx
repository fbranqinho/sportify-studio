import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Location } from "@/types";
import { Heart, MapPin, DollarSign, Puzzle, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LocationCardProps {
  location: Location;
}

export function LocationCard({ location }: LocationCardProps) {
  const sports = location.sportsOffered.split(',').map(s => s.trim());

  return (
    <Card className="overflow-hidden flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0">
        <div className="relative aspect-video">
          <Image
            src={location.image || "https://placehold.co/600x400.png"}
            alt={location.locationName}
            data-ai-hint={location.imageHint || "sports field"}
            fill
            className="object-cover"
          />
          <Badge variant="destructive" className="absolute top-3 right-3 text-sm">
            {location.pricing}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="font-headline text-xl mb-2">{location.locationName}</CardTitle>
        <p className="text-muted-foreground text-sm flex items-start gap-2 mb-3">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{location.address}</span>
        </p>
        <p className="text-sm mb-3">{location.description}</p>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Sports:</span>
          <div className="flex flex-wrap gap-1.5">
            {sports.map(sport => (
              <Badge key={sport} variant="secondary" className="font-medium">{sport}</Badge>
            ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
             <span className="font-semibold text-sm text-muted-foreground">Suitability</span>
             <span className="font-bold text-sm text-primary">{Math.round(location.suitabilityScore * 100)}%</span>
          </div>
          <Progress value={location.suitabilityScore * 100} className="h-2" />
        </div>
      </CardContent>
      <CardFooter className="p-4 bg-muted/50 flex justify-between">
        <Button variant="outline" className="font-semibold">View Details</Button>
        <Button variant="ghost" size="icon" className="text-accent hover:text-accent hover:bg-accent/10">
          <Heart />
          <span className="sr-only">Favorite</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
