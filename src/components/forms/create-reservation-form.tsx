
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
import { Calendar as CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pitch, User } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const formSchema = z.object({
  date: z.date({
    required_error: "A date for the booking is required.",
  }),
});

interface CreateReservationFormProps {
  user: User;
  pitch: Pitch;
  onReservationSuccess: () => void;
}

export function CreateReservationForm({ user, pitch, onReservationSuccess }: CreateReservationFormProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !pitch) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User or pitch data is missing.",
      });
      return;
    }

    try {
      const reservationData: any = {
        date: values.date.toISOString(),
        status: "Pending",
        pitchId: pitch.id,
        pitchName: pitch.name,
        ownerProfileId: pitch.ownerRef, // This is the ID of the owner's profile document
        paymentRefs: [],
        totalAmount: 0, // Assuming no cost for now
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        createdAt: serverTimestamp(),
      };
      
      // Add role-specific reference
      const roleField = `${user.role.toLowerCase()}Ref`;
      reservationData[roleField] = user.id;

      await addDoc(collection(db, "reservations"), reservationData);

      toast({
        title: "Reservation Requested!",
        description: `Your request to book ${pitch.name} has been sent to the owner.`,
      });

      form.reset();
      onReservationSuccess();

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
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Booking Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <p className="text-xs text-muted-foreground">Note: For now, all bookings are for a default 1-hour slot. Time selection will be available soon.</p>

        <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Requesting..." : "Request Reservation"}
        </Button>
      </form>
    </Form>
  );
}
