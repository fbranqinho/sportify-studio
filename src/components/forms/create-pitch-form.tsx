
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
  sport: z.enum(sports),
  capacity: z.coerce.number().min(1, { message: "Capacity must be at least 1." }),
  basePrice: z.coerce.number().min(0, { message: "Base price must be a positive number." }),
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
      sport: "fut7",
      capacity: 150,
      basePrice: 50,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!ownerProfile || !ownerProfile.companyAddress) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No owner profile with an address found. Cannot create pitch.",
      });
      return;
    }

    // A simple heuristic to extract city from the address string.
    const addressParts = ownerProfile.companyAddress.split(',').map(part => part.trim());
    const city = addressParts.length > 1 ? addressParts[addressParts.length - 1] : "Unknown City";


    try {
      await addDoc(collection(db, "pitches"), {
        name: values.name,
        address: ownerProfile.companyAddress, // Use owner's address
        city: city,
        sport: values.sport,
        capacity: values.capacity,
        basePrice: values.basePrice,
        // Using owner's coordinates as the default for the pitch
        coords: {
          lat: ownerProfile.latitude,
          lng: ownerProfile.longitude,
        },
        ownerRef: ownerProfile.id,
      });

      toast({
        title: "Field Created!",
        description: `${values.name} has been successfully added.`,
      });

      form.reset();
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <FormLabel>Spectator Capacity</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 150" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
         <FormField
            control={form.control}
            name="basePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Price per Hour (€)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating..." : "Create Field"}
        </Button>
      </form>
    </Form>
  );
}
