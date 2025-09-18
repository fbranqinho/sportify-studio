'use client';

import * as React from "react";
import { useUser } from "@/hooks/use-user";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { PlayerProfile, ManagerProfile, OwnerProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EditPlayerProfileForm } from "@/components/forms/edit-player-profile-form";
import { EditManagerProfileForm } from "@/components/forms/edit-manager-profile-form";
import { EditOwnerProfileForm } from "@/components/forms/edit-owner-profile-form";
import { PricingCard } from "@/components/pricing-card";

export default function SettingsPage() {
    const { user } = useUser();
    const [profileData, setProfileData] = React.useState<PlayerProfile | ManagerProfile | OwnerProfile | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            setLoading(true);
            try {
                let profileCollection = "";
                switch (user.role) {
                    case "PLAYER": profileCollection = "playerProfiles"; break;
                    case "MANAGER": profileCollection = "managerProfiles"; break;
                    case "OWNER": profileCollection = "ownerProfiles"; break;
                    default:
                        setLoading(false);
                        return;
                }

                const q = query(collection(db, profileCollection), where("userRef", "==", user.id));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    const docData = docSnap.data();

                    switch (user.role) {
                        case "PLAYER": {
                            const { id: _ignore, ...rest } = docData as PlayerProfile;
                            setProfileData({ ...(rest as Omit<PlayerProfile, "id">), id: docSnap.id });
                            break;
                        }
                        case "MANAGER": {
                            const { id: _ignore, ...rest } = docData as ManagerProfile;
                            setProfileData({ ...(rest as Omit<ManagerProfile, "id">), id: docSnap.id });
                            break;
                        }
                        case "OWNER": {
                            const { id: _ignore, ...rest } = docData as OwnerProfile;
                            setProfileData({ ...(rest as Omit<OwnerProfile, "id">), id: docSnap.id });
                            break;
                        }
                    }
                } else {
                    console.log(`SettingsPage: No profile found for userId: ${user.id} in ${profileCollection}`);
                    setProfileData(null);
                }
            } catch (error) {
                console.error("SettingsPage: Error fetching profile:", error);
                setProfileData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const renderSettingsForms = () => {
        if (loading || !user) {
            return <Skeleton className="h-48 w-full" />;
        }

        if (!profileData) {
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Your profile data could not be loaded. Please try again later.</p>
                    </CardContent>
                </Card>
            );
        }

        switch (user.role) {
            case "PLAYER":
                return <EditPlayerProfileForm playerProfile={profileData as PlayerProfile} user={user} />;
            case "MANAGER":
                return <EditManagerProfileForm managerProfile={profileData as ManagerProfile} user={user} />;
            case "OWNER":
                return <EditOwnerProfileForm ownerProfile={profileData as OwnerProfile} user={user} />;
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
                    Manage your account, profile, and subscription settings.
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    {renderSettingsForms()}
                </div>
                <div className="lg:col-span-1">
                    <PricingCard user={user} />
                </div>
            </div>
        </div>
    );
}