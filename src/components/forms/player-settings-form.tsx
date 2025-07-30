
"use client";

import * as React from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PlayerProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PlayerSettingsFormProps {
    playerProfile: PlayerProfile;
}

export function PlayerSettingsForm({ playerProfile }: PlayerSettingsFormProps) {
    const { toast } = useToast();
    const [availableToPlay, setAvailableToPlay] = React.useState(playerProfile.availableToPlay);
    const [availableToJoin, setAvailableToJoin] = React.useState(playerProfile.availableToJoinTeams);

    const handleToggle = async (field: 'availableToPlay' | 'availableToJoinTeams', value: boolean) => {
        const profileRef = doc(db, "playerProfiles", playerProfile.id);
        
        // Update local state immediately for a responsive UI
        if (field === 'availableToPlay') {
            setAvailableToPlay(value);
        } else {
            setAvailableToJoin(value);
        }

        try {
            await updateDoc(profileRef, { [field]: value });
            toast({
                title: "Settings Updated",
                description: "Your availability status has been saved.",
            });
        } catch (error) {
            console.error("Error updating player settings:", error);
            // Revert local state if the update fails
            if (field === 'availableToPlay') {
                setAvailableToPlay(!value);
            } else {
                setAvailableToJoin(!value);
            }
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: "Could not save your changes. Please try again.",
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Player Availability</CardTitle>
                <CardDescription>
                    Control when you appear in searches for new games and teams.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="available-to-play" className="text-base font-semibold">
                            Available to Play
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Enable this if you are currently available to be invited for individual games.
                        </p>
                    </div>
                    <Switch
                        id="available-to-play"
                        checked={availableToPlay}
                        onCheckedChange={(value) => handleToggle('availableToPlay', value)}
                    />
                </div>
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                     <div className="space-y-0.5">
                        <Label htmlFor="available-to-join" className="text-base font-semibold">
                            Available to Join Teams
                        </Label>
                        <p className="text-sm text-muted-foreground">
                           Enable this if you are looking for a new team to join. Managers can find and invite you.
                        </p>
                    </div>
                    <Switch
                        id="available-to-join"
                        checked={availableToJoin}
                        onCheckedChange={(value) => handleToggle('availableToJoinTeams', value)}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
