
"use client";

import * as React from "react";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import type { PlayerProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EditPlayerProfileForm } from "@/components/forms/edit-player-profile-form";

export default function SettingsPage() {
    const { user } = useUser();
    const [playerProfile, setPlayerProfile] = React.useState<PlayerProfile | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user || user.role !== 'PLAYER') {
            setLoading(false);
            return;
        }

        const fetchPlayerProfile = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, "playerProfiles"), where("userRef", "==", user.id));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docData = querySnapshot.docs[0].data() as PlayerProfile;
                    setPlayerProfile({ id: querySnapshot.docs[0].id, ...docData });
                } else {
                    console.log(`SettingsPage: No player profile found for userId: ${user.id}`);
                    setPlayerProfile(null);
                }
            } catch (error) {
                console.error("SettingsPage: Error fetching player profile:", error);
                setPlayerProfile(null);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayerProfile();
    }, [user]);

    const renderSettings = () => {
        if (loading || !user) {
            return <Skeleton className="h-48 w-full" />;
        }

        switch (user?.role) {
            case 'PLAYER':
                return playerProfile ? (
                    <EditPlayerProfileForm playerProfile={playerProfile} user={user} />
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Player Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>No player profile found to configure.</p>
                        </CardContent>
                    </Card>
                );
            // Add cases for other roles like MANAGER, OWNER, etc. in the future
            default:
                return (
                     <Card>
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>There are no specific settings for your role yet.</p>
                        </CardContent>
                    </Card>
                );
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account and profile settings.
                </p>
            </div>
            {renderSettings()}
        </div>
    );
}
