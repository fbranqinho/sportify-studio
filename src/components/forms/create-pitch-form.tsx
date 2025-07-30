
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OwnerProfile, PitchSport } from "@/types";

const sports: PitchSport[] = ["fut5", "fut7", "fut11", "futsal"];

const formSchema = z.object({
  name: z.string().min(2, { message: "Field name must be at least 2 characters." }),
  address: z.string().min(10, { message: "Address is required." }),
  city: z.string().min(2, { message: "City is required." }),
  sport: z.enum(sports),
  capacity: z.coerce.number().min(1, { message: "Capacity must be at least 1." }),
  latitude: z.coerce.number().min(-90).max(90, { message: "Invalid latitude." }),
  longitude: z.coerce.number().min(-180).max(180, { message: "Invalid longitude." }),
});

interface CreatePitchFormProps {
  ownerProfile: OwnerProfile | null;
  onPitchCreated: () => void;
}

export function CreatePitchForm({ ownerProfile, onPitchCreated }: CreatePitchFormProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      sport: "fut7",
      capacity: 14,
      latitude: 0,
      longitude: 0,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!ownerProfile) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No owner profile found. Cannot create pitch.",
      });
      return;
    }

    try {
      await addDoc(collection(db, "pitches"), {
        name: values.name,
        address: values.address,
        city: values.city,
        sport: values.sport,
        capacity: values.capacity,
        coords: {
          lat: values.latitude,
          lng: values.longitude,
        },
        ownerRef: ownerProfile.id,
      });

      toast({
        title: "Field Created!",
        description: `${values.name} has been successfully added.`,
      });

      onPitchCreated();
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Field Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Main Arena" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 123 Football St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            name="sport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sport</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sports.map((s) => (
                      <SelectItem key={s} value={s} className="font-semibold">
                        {s.charAt(0).toUpperCase() + s.slice(1)}
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
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 14" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Latitude</FormLabel>
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
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                    <Input type="number" step="any" placeholder="e.g. -8.6291" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create Field"}
        </Button>
      </form>
    </Form>
  );
}
