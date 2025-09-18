
"use client";

import * as React from "react";
import type { MatchEvent, MatchEventType } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Goal, CirclePlus, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function EventTimeline({ events, teamAName, teamBName, duration }: { events: MatchEvent[], teamAName?: string, teamBName?: string, duration: number }) {
    if (!events || events.length === 0) {
        return (
            <div className="text-center text-sm text-muted-foreground py-4">
                No events recorded yet.
            </div>
        );
    }

    const sortedEvents = [...events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
    const halfTime = duration / 2;

    const getEventIcon = (type: MatchEventType) => {
        switch (type) {
            case 'Goal': return <Goal className="h-4 w-4" />;
            case 'Assist': return <CirclePlus className="h-4 w-4" />;
            case 'YellowCard': return <Square className="h-4 w-4 text-yellow-500 fill-current" />;
            case 'RedCard': return <Square className="h-4 w-4 text-red-600 fill-current" />;
            default: return null;
        }
    };

    const getEventColor = (type: MatchEventType) => {
        switch (type) {
            case 'Goal': return 'bg-green-500';
            case 'Assist': return 'bg-blue-500';
            case 'YellowCard': return 'bg-yellow-500';
            case 'RedCard': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };
    
    const getTeamName = (teamId: string) => {
        if (teamId === 'A') return teamAName || 'Vests A';
        if (teamId === 'B') return teamBName || 'Vests B';
        return 'Unknown Team';
    }

    return (
         <TooltipProvider>
            <div className="w-full py-8 px-4">
                <div className="relative h-1 bg-muted rounded-full">
                {/* Timeline Axis Labels */}
                <div className="absolute -top-5 w-full flex justify-between text-xs text-muted-foreground">
                    <span>0'</span>
                    <span>{halfTime}'</span>
                    <span>{duration}'</span>
                </div>
                <div className="absolute top-1/2 h-4 w-px bg-muted-foreground" style={{ left: '50%' }} />

                {/* Events */}
                {sortedEvents.map(event => (
                    <Tooltip key={event.id}>
                    <TooltipTrigger asChild>
                        <div
                        className={cn("absolute -top-1/2 w-4 h-4 rounded-full border-2 border-background cursor-pointer hover:scale-125 transition-transform", getEventColor(event.type))}
                        style={{ left: `calc(${(event.minute ?? 0) / duration * 100}% - 8px)` }}
                        />
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="flex items-center gap-2 p-1">
                            {getEventIcon(event.type)}
                            <div className="font-bold">{event.minute}'</div>
                            <div>
                                <p className="font-semibold capitalize">{event.type} - {event.playerName}</p>
                                <p className="text-xs text-muted-foreground">{getTeamName(event.teamId)}</p>
                            </div>
                        </div>
                    </TooltipContent>
                    </Tooltip>
                ))}
                </div>
            </div>
        </TooltipProvider>
    );
}
