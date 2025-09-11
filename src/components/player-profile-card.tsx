
"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayerProfile, User } from "@/types";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, differenceInYears } from "date-fns";
import { Calendar, User as UserIcon, Shield, MapPin, Scale, Footprints, Trophy, Hash } from "lucide-react";
import { Badge } from "./ui/badge";

interface PlayerProfileCardProps extends React.ComponentProps<typeof Card> {
    user: User;
    profile: PlayerProfile;
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number | undefined | null | React.ReactNode }) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4 text-sm">
            <Icon className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="flex-1">
                <p className="text-muted-foreground">{label}</p>
                <div className="font-semibold">{value}</div>
            </div>
        </div>
    );
};


export function PlayerProfileCard({ user, profile, className, ...props }: PlayerProfileCardProps) {
    const age = user.birthDate ? differenceInYears(new Date(), user.birthDate.toDate()) : "N/A";
    const memberSince = profile.createdAt ? formatDistanceToNow(profile.createdAt.toDate(), { addSuffix: true }) : "recently";
    const displayName = profile.nickname.charAt(0).toUpperCase() + profile.nickname.slice(1);
    
    const sortedTags = React.useMemo(() => {
        if (!profile.tags) return [];
        return Object.entries(profile.tags).sort(([, a], [, b]) => b - a).slice(0, 5);
    }, [profile.tags]);

    return (
        <Card className={cn("flex flex-col", className)} {...props}>
            <CardHeader className="items-center text-center">
                 <Avatar className="h-24 w-24 border-4 border-primary/50 shadow-lg mb-2">
                    <AvatarImage src={profile.photoUrl || "https://placehold.co/128x128.png"} alt={user.name} data-ai-hint="male profile"/>
                    <AvatarFallback className="text-3xl">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <CardTitle className="font-headline text-2xl">{displayName}</CardTitle>
                <CardDescription>@{profile.nickname}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-center space-y-4">
                <DetailRow icon={UserIcon} label="Age" value={age} />
                <DetailRow icon={MapPin} label="City" value={profile.city} />
                <DetailRow icon={Shield} label="Position" value={profile.position} />
                <DetailRow icon={Trophy} label="Experience" value={profile.experience} />
                <DetailRow icon={Scale} label="Height" value={profile.height ? `${profile.height} cm` : null} />
                <DetailRow icon={Scale} label="Weight" value={profile.weight ? `${profile.weight} kg` : null} />
                <DetailRow icon={Footprints} label="Dominant Foot" value={profile.dominantFoot ? profile.dominantFoot.charAt(0).toUpperCase() + profile.dominantFoot.slice(1) : null} />
                <DetailRow 
                    icon={Hash} 
                    label="Player Tags" 
                    value={
                        sortedTags.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {sortedTags.map(([tag, count]) => <Badge key={tag} variant="secondary">{tag} ({count})</Badge>)}
                            </div>
                        ) : "No tags yet"
                    } 
                />
                <DetailRow icon={Calendar} label="Member Since" value={memberSince} />
            </CardContent>
        </Card>
    )
}
