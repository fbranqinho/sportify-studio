
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
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { PlayerPosition, DominantFoot, PlayerExperience, PlayerProfile, User } from "@/types";
import { Switch } from "../ui/switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";

const positions: PlayerPosition[] = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const dominantFoots: DominantFoot[] = ["left", "right", "both"];
const experiences: PlayerExperience[] = ["Amateur", "Ex-Federated", "Federated"];

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  city: z.string().min(2, { message: "City is required." }),
  photo: z.any().optional(),
  position: z.enum(positions),
  dominantFoot: z.enum(dominantFoots),
  experience: z.enum(experiences),
  height: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
  availableToPlay: z.boolean().default(true),
  availableToJoinTeams: z.boolean().default(true),
});

interface EditPlayerProfileFormProps {
    playerProfile: PlayerProfile;
    user: User;
}

export function EditPlayerProfileForm({ playerProfile, user }: EditPlayerProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const storage = getStorage();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.name || "",
      city: playerProfile.city || "",
      position: playerProfile.position || "Midfielder",
      dominantFoot: playerProfile.dominantFoot || "right",
      experience: playerProfile.experience || "Amateur",
      height: playerProfile.height || undefined,
      weight: playerProfile.weight || undefined,
      availableToPlay: playerProfile.availableToPlay,
      availableToJoinTeams: playerProfile.availableToJoinTeams,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
        const batch = writeBatch(db);
        const profileRef = doc(db, "playerProfiles", playerProfile.id);
        const userRef = doc(db, "users", user.id);

        let photoUrl = playerProfile.photoUrl;

        if (values.photo && values.photo.length > 0) {
            const file = values.photo[0] as File;
            const storageRef = ref(storage, `profile-pictures/${playerProfile.userRef}/${file.name}`);
            await uploadBytes(storageRef, file);
            photoUrl = await getDownloadURL(storageRef);
        }

        // Update player profile
        batch.update(profileRef, {
            nickname: values.name.toLowerCase(), // Keep nickname for any legacy needs
            city: values.city,
            photoUrl: photoUrl || null,
            position: values.position,
            dominantFoot: values.dominantFoot,
            experience: values.experience,
            height: values.height || null,
            weight: values.weight || null,
            availableToPlay: values.availableToPlay,
            availableToJoinTeams: values.availableToJoinTeams,
        });

        // Update user document
        batch.update(userRef, {
            name: values.name,
            name_lowercase: values.name.toLowerCase(),
        });
        
        await batch.commit();

        toast({
            title: "Profile Updated!",
            description: "Your profile details have been successfully saved.",
        });
        
        router.refresh();

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Something went wrong",
            description: error.message,
        });
    }
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Edit Your Player Profile</CardTitle>
            <CardDescription>Keep your details up to date so managers can find you.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-24 w-24 border-2 border-muted">
                            <AvatarImage src={playerProfile.photoUrl || "https://placehold.co/128x128.png"} alt={user.name} data-ai-hint="male profile"/>
                            <AvatarFallback>{user.name?.[0] || 'P'}</AvatarFallback>
                        </Avatar>
                        <FormField
                            control={form.control}
                            name="photo"
                            render={() => (
                                <FormItem className="flex-1">
                                    <FormLabel>Profile Photo</FormLabel>
                                    <FormControl>
                                        <Input type="file" {...form.register("photo")} />
                                    </FormControl>
                                    <FormDescription>Upload a new photo to update your profile.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Cristiano Ronaldo" {...field} />
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
                                <FormLabel>Position</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {positions.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
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
                                <FormLabel>Dominant Foot</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {dominantFoots.map((f) => (<SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="experience"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Experience</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select your experience level" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {experiences.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="height"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Height (cm)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g. 180" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="weight"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Weight (kg)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g. 75" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t">
                        <FormField
                            control={form.control}
                            name="availableToPlay"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Available to Play</FormLabel>
                                        <FormDescription>Enable if you are available to be invited to individual games.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="availableToJoinTeams"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Available to Join Teams</FormLabel>
                                        <FormDescription>Enable if you are looking for a new team to join.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
