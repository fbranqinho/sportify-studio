
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
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  name: z.string().min(3, { message: "Team name must be at least 3 characters." }),
  city: z.string().min(2, { message: "City is required." }),
  motto: z.string().optional(),
});

interface CreateTeamFormProps {
  managerId: string;
}

export function CreateTeamForm({ managerId }: CreateTeamFormProps) {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      city: "",
      motto: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!managerId) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Manager ID is missing. Cannot create team.",
        });
        return;
    }
    
    try {
      await addDoc(collection(db, "teams"), {
        ...values,
        managerId: managerId,
        players: [],
        playerIds: [],
        foundationYear: new Date().getFullYear(),
        wins: 0,
        draws: 0,
        losses: 0,
        yellowCards: 0,
        redCards: 0,
        suspensions: 0,
        latePayments: 0,
        debts: 0,
        competitions: [],
      });

      toast({
        title: "Team Created!",
        description: `${values.name} has been successfully registered.`,
      });

      router.push("/dashboard/teams");
      
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. The All-Stars" {...field} />
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
        </div>
        <FormField
            control={form.control}
            name="motto"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Team Motto (Optional)</FormLabel>
                <FormControl>
                    <Input placeholder="e.g. 'Play with heart'" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating Team..." : "Create Team"}
        </Button>
      </form>
    </Form>
  );
}
