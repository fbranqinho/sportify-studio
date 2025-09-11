
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Match, Pitch, OwnerProfile } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Users, CheckCircle, Play, Trophy, Shield, MapPin, Building } from "lucide-react";

interface MatchDetailsCardProps {
    match: Match;
    pitch: Pitch | null;
    owner: OwnerProfile | null;
}

export function MatchDetailsCard({ match, pitch, owner }: MatchDetailsCardProps) {
    
    const confirmedPlayersCount = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
    const isFinished = match.status === 'Finished';

    const getStatusInfo = () => {
        switch (match.status) {
            case 'Collecting players':
                return { text: 'Collecting Players', icon: Users, color: 'text-amber-600' };
            case 'Scheduled':
                 return { text: 'Scheduled', icon: CheckCircle, color: 'text-blue-600' };
            case 'InProgress':
                 return { text: 'In Progress', icon: Play, color: 'text-green-600 animate-pulse' };
            case 'Finished':
                 return { text: 'Finished', icon: Trophy, color: 'text-primary' };
            default:
                return { text: match.status, icon: Shield, color: 'text-muted-foreground' };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>{isFinished ? 'Match Summary' : 'Match Details'}</CardTitle>
                    <CardDescription>{match.date ? format(match.date.toDate(), "EEEE, MMMM d, yyyy 'at' HH:mm") : 'Date not set'}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <statusInfo.icon className={cn("h-4 w-4", statusInfo.color)}/>
                            <span>Status: <span className="font-semibold">{statusInfo.text}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground"/>
                            <span>Confirmed: <span className="font-semibold">{confirmedPlayersCount}</span></span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {pitch && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Venue Information</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                         <div className="flex items-start gap-3">
                            <Shield className="h-4 w-4 text-muted-foreground mt-0.5"/>
                            <div>
                                <p className="font-semibold">{pitch.name}</p>
                                <p className="text-xs text-muted-foreground">Pitch</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5"/>
                             <div>
                                <p className="font-semibold">{pitch.address}</p>
                                <p className="text-xs text-muted-foreground">Address</p>
                            </div>
                        </div>
                          {owner && <div className="flex items-start gap-3">
                            <Building className="h-4 w-4 text-muted-foreground mt-0.5"/>
                             <div>
                                <p className="font-semibold">{owner.companyName}</p>
                                <p className="text-xs text-muted-foreground">Managed by</p>
                            </div>
                        </div>}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

    
