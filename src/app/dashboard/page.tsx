import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { LocationCard } from "@/components/location-card";
import type { Location } from "@/types";
import { Search } from "lucide-react";

const mockLocations: Location[] = [
  {
    locationId: "1",
    locationName: "City Arena",
    description: "State-of-the-art indoor football facility with 5G turf.",
    sportsOffered: "Football, Futsal",
    address: "123 Main Street, Downtown",
    availableTimes: "09:00-23:00",
    pricing: "$50/hr",
    suitabilityScore: 0.9,
    imageHint: "indoor soccer"
  },
  {
    locationId: "2",
    locationName: "Greenfield Park",
    description: "Spacious outdoor fields perfect for 11-a-side matches.",
    sportsOffered: "Football, Rugby",
    address: "456 Park Avenue, Suburbia",
    availableTimes: "08:00-20:00",
    pricing: "$40/hr",
    suitabilityScore: 0.75,
    imageHint: "outdoor football"
  },
  {
    locationId: "3",
    locationName: "Riverside Sports Complex",
    description: "Versatile complex with multiple courts and fields.",
    sportsOffered: "Football, Basketball, Tennis",
    address: "789 River Road, West End",
    availableTimes: "07:00-22:00",
    pricing: "$60/hr",
    suitabilityScore: 0.82,
    imageHint: "sports complex"
  },
];


export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Find a Game</h1>
          <p className="text-muted-foreground">Search for available fields near you.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
            <Image
              src="https://placehold.co/1200x400.png"
              alt="Map of nearby fields"
              data-ai-hint="map satellite"
              layout="fill"
              objectFit="cover"
            />
             <div className="absolute inset-0 bg-black/20"></div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <Input type="text" placeholder="Search by location..." className="h-10"/>
        </div>
        <div className="md:col-span-1">
          <Select>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Filter by sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="football">Football</SelectItem>
              <SelectItem value="basketball">Basketball</SelectItem>
              <SelectItem value="futsal">Futsal</SelectItem>
              <SelectItem value="tennis">Tennis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="h-10 md:col-span-1 font-semibold">
          <Search className="mr-2 h-4 w-4"/>
          Search
        </Button>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Nearby Fields</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockLocations.map((location) => (
            <LocationCard key={location.locationId} location={location} />
          ))}
        </div>
      </div>
    </div>
  );
}
