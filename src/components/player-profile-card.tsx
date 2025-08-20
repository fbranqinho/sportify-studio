
"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayerProfile, User } from "@/types";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, differenceInYears } from "date-fns";
import { Calendar, User as UserIcon, Shield } from "lucide-react";

interface PlayerProfileCardProps extends React.ComponentProps<typeof Card> {
    user: User;
    profile: PlayerProfile;
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
    <div className="flex items-center gap-4 text-sm">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
            <p className="text-muted-foreground">{label}</p>
            <p className="font-semibold">{value}</p>
        </div>
    </div>
);


export function PlayerProfileCard({ user, profile, className, ...props }: PlayerProfileCardProps) {
    const age = user.birthDate ? differenceInYears(new Date(), new Date(user.birthDate)) : "N/A";
    const memberSince = profile.createdAt ? formatDistanceToNow(new Date(profile.createdAt.seconds * 1000), { addSuffix: true }) : "recently";

    return (
        <Card className={cn("flex flex-col", className)} {...props}>
            <CardHeader className="items-center text-center">
                 <Avatar className="h-24 w-24 border-4 border-primary/50 shadow-lg mb-2">
                    <AvatarImage src={profile.photoUrl || "https://placehold.co/128x128.png"} alt={user.name} data-ai-hint="male profile"/>
                    <AvatarFallback className="text-3xl">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <CardTitle className="font-headline text-2xl">{user.name}</CardTitle>
                <CardDescription>&quot;{profile.nickname}&quot;</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-center space-y-6">
                <DetailRow icon={UserIcon} label="Age" value={age} />
                <DetailRow icon={Shield} label="Position" value={profile.position} />
                <DetailRow icon={Calendar} label="Member Since" value={memberSince} />
            </CardContent>
        </Card>
    )
}
