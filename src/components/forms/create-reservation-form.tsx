
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pitch, User, Team } from "@/types";

const formSchema = z.object({
  teamRef: z.string().min(1, { message: "You must select a team." }), // Team selection is now mandatory for managers
});

interface CreateReservationFormProps {
  user: User;
  pitch: Pitch;
  onReservationSuccess: () => void;
  selectedDate: Date;
  selectedTime: string;
}

export function CreateReservationForm({ user, pitch, onReservationSuccess, selectedDate, selectedTime }: CreateReservationFormProps) {
  const { toast } = useToast();
  const [managerTeams, setManagerTeams] = React.useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = React.useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      teamRef: "",
    },
  });

  React.useEffect(() => {
    // This form is now only for managers
    const fetchManagerTeams = async () => {
      setLoadingTeams(true);
      const teamsQuery = query(collection(db, "teams"), where("managerId", "==", user.id));
      const teamsSnapshot = await getDocs(teamsQuery);
      const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setManagerTeams(teams);
      setLoadingTeams(false);
    };
    fetchManagerTeams();
  }, [user]);

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
        const [hour, minute] = selectedTime.split(':').map(Number);
        const bookingDate = new Date(selectedDate);
        bookingDate.setHours(hour, minute);

      const reservationData: any = {
        date: bookingDate.toISOString(),
        status: "Pending",
        pitchId: pitch.id,
        pitchName: pitch.name,
        ownerProfileId: pitch.ownerRef,
        paymentRefs: [],
        totalAmount: 0,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        createdAt: serverTimestamp(),
        managerRef: user.id, // Explicitly set managerRef
        teamRef: values.teamRef,
      };

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
        {loadingTeams ? <p className="text-sm text-muted-foreground">Loading your teams...</p> : 
        managerTeams.length > 0 ? (
          <FormField
            control={form.control}
            name="teamRef"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Team</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select one of your teams for the booking" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {managerTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
            <div className="text-sm text-muted-foreground p-4 bg-muted rounded-md border text-center">
                <p className="font-semibold">You must have a team to book a pitch.</p>
                <p className="text-xs mt-1">Please create a team in the "My Teams" section first.</p>
            </div>
        )
        }
        
        <p className="text-xs text-muted-foreground">Note: For now, all bookings are for a default 1-hour slot. The owner will confirm the request.</p>

        <Button 
            type="submit" 
            className="w-full font-semibold" 
            disabled={form.formState.isSubmitting || loadingTeams || managerTeams.length === 0}>
          {form.formState.isSubmitting ? "Requesting..." : "Confirm & Request Reservation"}
        </Button>
      </form>
    </Form>
  );
}
