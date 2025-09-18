
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

const formSchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyNif: z.string().regex(/^[0-9]{9}$/, { message: "NIF must have 9 digits." }),
  companyAddress: z.string().min(10, { message: "Company address is required." }),
  description: z.string().optional(),
  latitude: z.coerce.number().min(-90, "Invalid latitude.").max(90, { message: "Invalid latitude." }),
  longitude: z.coerce.number().min(-180, "Invalid longitude.").max(180, { message: "Invalid longitude." }),
});

interface OwnerProfileFormProps {
    userId: string;
}

export function OwnerProfileForm({ userId }: OwnerProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      companyNif: "",
      companyAddress: "",
      description: "",
      latitude: 0,
      longitude: 0,
    },
  });
  
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          form.setValue("latitude", parseFloat(latitude.toFixed(6)));
          form.setValue("longitude", parseFloat(longitude.toFixed(6)));
          toast({
            title: "Location Found!",
            description: "Coordinates have been filled in for you.",
          });
        },
        (error) => {
          console.error("Error getting location: ", error);
          toast({
            variant: "destructive",
            title: "Could not get location",
            description: "Please enable location permissions in your browser or enter coordinates manually.",
          });
        }
      );
    } else {
      toast({
        variant: "destructive",
        title: "Geolocation not supported",
        description: "Your browser does not support geolocation.",
      });
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
        // Step 1: Create owner profile document in Firestore
        await addDoc(collection(db, "ownerProfiles"), {
            ...values,
            userRef: userId,
            pitches: [],
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
        router.refresh(); // Force a refresh to re-evaluate the layout logic

    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Something went wrong",
            description: error.message,
        });
    }
  }

  return (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. Fields Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="companyNif"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Company NIF</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. 500100200" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="companyAddress"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Company Address</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Rua da Empresa, 123, Porto" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="Tell us a little bit about your company and the fields you manage."
                            className="resize-none"
                            {...field}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <FormLabel>Company Coordinates</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={handleGetLocation}>
                        <MapPin className="mr-2 h-4 w-4" />
                        Get Current Location
                    </Button>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="latitude"
                        render={({ field }) => (
                        <FormItem>
                            <FormControl>
                            <Input type="number" step="any" placeholder="e.g. 41.1579" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="longitude"
                        render={({ field }) => (
                        <FormItem>
                            <FormControl>
                            <Input type="number" step="any" placeholder="e.g. -8.6291" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save and Continue"}
            </Button>
        </form>
    </Form>
  )
}
