
"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ManagerProfile, Team, User } from "@/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInYears } from "date-fns";
import { Calendar, User as UserIcon, Trello, Medal, Shield } from "lucide-react";

interface ManagerProfileCardProps extends React.ComponentProps<typeof Card> {
    user: User;
    profile: ManagerProfile;
    teams: Team[];
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number | undefined | null }) => {
    if (value === undefined || value === null) return null;
    return (
        <div className="flex items-center gap-4 text-sm">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
                <p className="text-muted-foreground">{label}</p>
                <p className="font-semibold">{value}</p>
            </div>
        </div>
    );
};

export function ManagerProfileCard({ user, profile, teams, className, ...props }: ManagerProfileCardProps) {
    const age = user.birthDate ? differenceInYears(new Date(), new Date(user.birthDate)) : "N/A";
    const memberSince = user.createdAt ? formatDistanceToNow(new Date(user.createdAt.seconds * 1000), { addSuffix: true }) : "recently";
    const record = `${profile.victories}-${profile.draws}-${profile.defeats}`;

    return (
        <Card className={cn("flex flex-col", className)} {...props}>
            <CardHeader className="items-center text-center">
                 <Avatar className="h-24 w-24 border-4 border-primary/50 shadow-lg mb-2">
                    <AvatarImage src={"https://placehold.co/128x128.png"} alt={user.name} data-ai-hint="male manager profile"/>
                    <AvatarFallback className="text-3xl">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <CardTitle className="font-headline text-2xl">{user.name}</CardTitle>
                <CardDescription>Manager</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-center space-y-4">
                <DetailRow icon={UserIcon} label="Age" value={age} />
                <DetailRow icon={Trello} label="Preferred Tactic" value={profile.tactics} />
                <DetailRow icon={Shield} label="Teams Managed" value={teams.length} />
                <DetailRow icon={Medal} label="Record (W-D-L)" value={record} />
                <DetailRow icon={Calendar} label="Member Since" value={memberSince} />
            </CardContent>
        </Card>
    )
}
