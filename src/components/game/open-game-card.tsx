

"use client";

import * as React from "react";
import type { Match, Pitch, Team, User, Notification } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Shield, Calendar, UserPlus, Send } from "lucide-react";
import { format } from "date-fns";
import { getPlayerCapacity } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, arrayUnion, writeBatch, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface EnrichedMatch extends Match {
    pitch?: Pitch;
    team?: Team;
}

interface OpenGameCardProps {
    match: EnrichedMatch;
    user: User | null;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

export function OpenGameCard({ match, user, onMouseEnter, onMouseLeave }: OpenGameCardProps) {
    const { toast } = useToast();
    const { pitch, team } = match;
    const [isApplying, setIsApplying] = React.useState(false);
    const [hasApplied, setHasApplied] = React.useState(user ? match.playerApplications?.includes(user.id) || false : false);

    const capacity = pitch ? getPlayerCapacity(pitch.sport) : 0;
    const confirmedPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
    const spotsLeft = capacity - confirmedPlayers;
    
    const handleApply = async () => {
        if (!user || !match.managerRef) {
            toast({ variant: "destructive", title: "Error", description: "You must be logged in to apply, or the match is missing a manager." });
            return;
        }
        setIsApplying(true);
        try {
            const batch = writeBatch(db);
            const matchRef = doc(db, "matches", match.id);
            const notificationRef = doc(collection(db, "users", match.managerRef, "notifications"));

            // Add player to applications list
            batch.update(matchRef, { playerApplications: arrayUnion(user.id) });
            
            // Notify manager
            const notification: Omit<Notification, 'id'> = {
                message: `${user.name} has applied to join your game.`,
                link: `/dashboard/games/${match.id}`,
                read: false,
                createdAt: serverTimestamp() as any,
            };
            batch.set(notificationRef, notification);

            await batch.commit();

            setHasApplied(true);
            toast({ title: "Application Sent!", description: "The team manager has been notified." });

        } catch (error) {
            console.error("Error applying to game:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not send your application." });
        } finally {
            setIsApplying(false);
        }
    };


    return (
        <Card onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-lg">{pitch?.name}</CardTitle>
                    <Badge variant={spotsLeft > 2 ? "default" : "secondary"} className={spotsLeft > 2 ? "bg-green-600" : ""}>
                        {spotsLeft} spot{spotsLeft !== 1 && 's'} left
                    </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <MapPin className="h-4 w-4" /> {pitch?.address}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span><span className="font-semibold">{match.date ? format(match.date.toDate(), "EEE, MMM d 'at' HH:mm") : 'No Date'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Hosted by: <span className="font-semibold">{team?.name || 'A Team'}</span> ({pitch?.sport})</span>
                </div>
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Players: <span className="font-semibold">{confirmedPlayers} / {capacity}</span> confirmed</span>
                </div>
            </CardContent>
            <CardFooter>
                 {user?.role === "PLAYER" && (
                    <Button 
                        className="w-full font-semibold"
                        onClick={handleApply}
                        disabled={isApplying || hasApplied}
                    >
                        {hasApplied 
                            ? <><Send className="mr-2"/> Application Sent</>
                            : <><UserPlus className="mr-2" /> Apply to Join</>
                        }
                    </Button>
                 )}
                 {user?.role !== "PLAYER" && (
                     <Button className="w-full font-semibold" disabled>
                        Only players can apply
                     </Button>
                 )}
            </CardFooter>
        </Card>
    )
}
