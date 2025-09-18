
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pitch } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, MapPin, Shield, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitchSchedule } from "@/components/pitch-schedule";
import { useUser } from "@/hooks/use-user";

export default function PitchPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useUser();
    const pitchId = params.pitchId as string;
    
    const [pitch, setPitch] = React.useState<Pitch | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!pitchId) return;

        const fetchPitchDetails = async () => {
            setLoading(true);
            try {
                const pitchDocRef = doc(db, "pitches", pitchId);
                const pitchDoc = await getDoc(pitchDocRef);

                if (pitchDoc.exists()) {
                    setPitch({ id: pitchDoc.id, ...pitchDoc.data() } as Pitch);
                } else {
                    console.error("Pitch not found");
                    router.push("/dashboard/games"); // Redirect if pitch doesn't exist
                }
            } catch (error) {
                console.error("Error fetching pitch details: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPitchDetails();
    }, [pitchId, router]);


    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    if (!pitch || !user) {
        return (
             <div className="space-y-4 text-center">
                <p>Pitch data could not be loaded or you are not logged in.</p>
                <Button asChild variant="outline">
                    <Link href="/dashboard/games">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Find Pitch
                    </Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                     <Button variant="outline" size="sm" asChild className="mb-4">
                        <Link href="/dashboard/games">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back to All Pitches
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold font-headline">{pitch.name}</h1>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Pitch Details</CardTitle>
                    <CardDescription className="flex items-center gap-2 pt-1">
                        <MapPin className="h-4 w-4" /> {pitch.address}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                        <Shield className="h-5 w-5 text-primary" />
                        <div>
                            <span className="text-muted-foreground">Sport</span>
                            <p className="font-semibold text-primary">{pitch.sport.toUpperCase()}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                        <Users className="h-5 w-5 text-primary" />
                         <div>
                            <span className="text-muted-foreground">Capacity</span>
                            <p className="font-semibold">{pitch.capacity} people</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <PitchSchedule pitch={pitch} user={user} />

        </div>
    )

}
