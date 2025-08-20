
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { PlayerPosition, DominantFoot } from "@/types";

const positions: PlayerPosition[] = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const dominantFoots: DominantFoot[] = ["left", "right", "both"];

const formSchema = z.object({
  nickname: z.string().min(2, { message: "Nickname must be at least 2 characters." }),
  city: z.string().min(2, { message: "City is required." }),
  position: z.enum(positions),
  dominantFoot: z.enum(dominantFoots),
  photoUrl: z.string().url({ message: "Please enter a valid URL." }).optional(),
});

interface PlayerProfileFormProps {
    userId: string;
}

export function PlayerProfileForm({ userId }: PlayerProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: "",
      city: "",
      position: "Midfielder",
      dominantFoot: "right",
      photoUrl: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsUploading(true);
    
    try {
        // Step 1: Create player profile document in Firestore
        await addDoc(collection(db, "playerProfiles"), {
            nickname: values.nickname.toLowerCase(),
            city: values.city,
            position: values.position,
            dominantFoot: values.dominantFoot,
            photoUrl: values.photoUrl,
            userRef: userId,
            createdAt: serverTimestamp() as Timestamp,
            recentForm: [],
            finishing: 50, shotPower: 50, longShots: 50, heading: 50, curve: 50,
            marking: 50, standingTackle: 50, slidingTackle: 50, crossing: 50,
            shortPassing: 50, longPassing: 50, acceleration: 50, stamina: 50,
            strength: 50, balance: 50, agility: 50, jumping: 50, vision: 50,
            aggression: 50, reactions: 50, interceptions: 50, composure: 50,
            ballControl: 50, firstTouch: 50, dribbling: 50, defending: 50,
            attacking: 50, pace: 50, overall: 50, yellowCards: 0, redCards: 0,
            injuries: 0, goals: 0, assists: 0, victories: 0, defeats: 0,
            draws: 0, mvps: 0, teamOfWeek: 0, playerOfYear: 0, injured: false,
            suspended: false, availableToPlay: true, availableToJoinTeams: true,
        });

        // Step 2: Update user document
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
            profileCompleted: true,
        });

        toast({
            title: "Profile Completed!",
            description: "Welcome to Sportify. Redirecting you to your dashboard.",
        });

        router.push("/dashboard");
        router.refresh();

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Something went wrong",
            description: error.message,
        });
    } finally {
      setIsUploading(false);
    }
  }

  return (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nickname</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. The Rocket" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. Lisbon" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>I play as a...</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select your position" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {positions.map((p) => (
                            <SelectItem key={p} value={p} className="font-semibold">
                                {p}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="dominantFoot"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>My dominant foot is...</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select your dominant foot" />
                            </Trigger>
                        </FormControl>
                        <SelectContent>
                            {dominantFoots.map((f) => (
                            <SelectItem key={f} value={f} className="font-semibold">
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <div className="md:col-span-2">
                    <FormField
                        control={form.control}
                        name="photoUrl"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Photo URL</FormLabel>
                                <FormControl>
                                    <Input placeholder="https://example.com/photo.jpg" {...field} />
                                </FormControl>
                                <FormDescription>
                                    Paste a link to your profile picture.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
            </div>
            <Button type="submit" className="w-full font-semibold" disabled={isUploading}>
                {isUploading ? "Saving..." : "Save and Continue"}
            </Button>
        </form>
    </Form>
  );
}
