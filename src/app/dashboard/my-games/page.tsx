

"use client";

import * as React from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Gamepad2, History, Search } from "lucide-react";
import { MatchCard } from "@/components/game/match-card";
import { useMyGames } from "@/hooks/use-my-games";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Match as MatchType } from "@/types";


const MatchList = ({ matches, hook }: { matches: any[], hook: ReturnType<typeof useMyGames> }) => (
     <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
      {matches.map(m => <MatchCard key={m.id} match={m} hook={hook} />)}
     </div>
);

const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card className="flex flex-col items-center justify-center p-12 text-center mt-4 border-dashed">
        <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold font-headline">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
);

const LoadingSkeleton = () => (
    <div className="space-y-6">
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
    </div>
    </div>
);


export default function MyGamesPage() {
  const { user } = useUser();
  const myGamesHook = useMyGames(user);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortBy, setSortBy] = React.useState("date-desc");

  const { loading, upcomingMatches, pastMatches, pitches } = myGamesHook;

  const filterAndSortMatches = React.useCallback((matches: MatchType[]) => {
    let filtered = matches.filter(match => {
        if (!searchTerm) return true;
        const pitch = pitches.get(match.pitchRef);
        const lowerCaseSearch = searchTerm.toLowerCase();

        const pitchNameMatch = pitch?.name.toLowerCase().includes(lowerCaseSearch);
        const pitchAddressMatch = pitch?.address.toLowerCase().includes(lowerCaseSearch);
        const sportMatch = pitch?.sport.toLowerCase().includes(lowerCaseSearch);
        
        return pitchNameMatch || sportMatch || pitchAddressMatch;
    });

    const sorted = filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date-asc':
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            case 'sport':
                return (pitches.get(a.pitchRef)?.sport || '').localeCompare(pitches.get(b.pitchRef)?.sport || '');
            case 'location':
                return (pitches.get(a.pitchRef)?.name || '').localeCompare(pitches.get(b.pitchRef)?.name || '');
            case 'date-desc':
            default:
                 return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
    });

    return sorted;

  }, [searchTerm, sortBy, pitches]);

  const processedUpcomingMatches = React.useMemo(() => filterAndSortMatches(upcomingMatches), [upcomingMatches, filterAndSortMatches]);
  const processedPastMatches = React.useMemo(() => filterAndSortMatches(pastMatches), [pastMatches, filterAndSortMatches]);


  if (loading) {
    return (
        <div className="space-y-8">
             <div>
                <h1 className="text-3xl font-bold font-headline">My Games</h1>
                <p className="text-muted-foreground">
                View your upcoming games and invitations.
                </p>
            </div>
            <LoadingSkeleton />
        </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">My Games</h1>
        <p className="text-muted-foreground">
          View your upcoming games and invitations.
        </p>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Filters & Sorting</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="Search by sport, pitch name, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>
             <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                    <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                    <SelectItem value="sport">Sport</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                </SelectContent>
            </Select>
        </CardContent>
      </Card>


      <div className="space-y-4">
        <h2 className="text-2xl font-bold font-headline">Upcoming Games ({processedUpcomingMatches.length})</h2>
        {processedUpcomingMatches.length > 0 ? (
            <MatchList matches={processedUpcomingMatches} hook={myGamesHook} />
        ) : (
            <EmptyState icon={Gamepad2} title="No Upcoming Games" description="No games match your current filters." />
        )}
      </div>

       <div className="border-t pt-8">
        <Accordion type="single" collapsible>
            <AccordionItem value="history">
                <AccordionTrigger>
                    <h2 className="text-2xl font-bold font-headline">Game History ({processedPastMatches.length})</h2>
                </AccordionTrigger>
                <AccordionContent>
                    {processedPastMatches.length > 0 ? (
                        <MatchList matches={processedPastMatches} hook={myGamesHook} />
                    ) : (
                        <EmptyState icon={History} title="No Game History" description="No past games match your current filters." />
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
