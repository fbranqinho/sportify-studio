
"use client";

import * as React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { ManagerProfile, User, ManagerFootballType, Tactic } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { fut5Tactics, fut7Tactics, futsalTactics } from "@/lib/utils";

const footballTypes = ["fut7", "fut5", "futsal"] as const;

const formSchema = z.object({
    typeOfFootball: z.enum(footballTypes),
    tactics: z.string().min(1, "You must select a tactic."),
});

interface EditManagerProfileFormProps {
    managerProfile: ManagerProfile;
    user: User;
}

export function EditManagerProfileForm({ managerProfile, user }: EditManagerProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      typeOfFootball: managerProfile.typeOfFootball || "fut7",
      tactics: managerProfile.tactics || fut7Tactics[0],
    },
  });

  const selectedFootballType = form.watch("typeOfFootball");

  const availableTactics = React.useMemo(() => {
    switch (selectedFootballType) {
      case "fut5":
        return fut5Tactics;
      case "futsal":
        return futsalTactics;
      case "fut7":
      default:
        return fut7Tactics;
    }
  }, [selectedFootballType]);

  React.useEffect(() => {
    if (!availableTactics.includes(form.getValues("tactics") as Tactic)) {
      form.setValue("tactics", availableTactics[0]);
    }
  }, [selectedFootballType, availableTactics, form]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
        const profileRef = doc(db, "managerProfiles", managerProfile.id);
        await updateDoc(profileRef, {
            typeOfFootball: values.typeOfFootball,
            tactics: values.tactics,
        });

        toast({
            title: "Profile Updated!",
            description: "Your manager profile details have been successfully saved.",
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
            <CardTitle>Edit Your Manager Profile</CardTitle>
            <CardDescription>Update your preferred tactical approach.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="typeOfFootball"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Modalidade Preferida</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select your preferred football type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {footballTypes.map((type) => (
                                <SelectItem key={type} value={type} className="font-semibold">
                                    {type.toUpperCase()}
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
                        name="tactics"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tática Preferida</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select your preferred tactic" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {availableTactics.map((tactic) => (
                                <SelectItem key={tactic} value={tactic} className="font-semibold">
                                    {tactic.replace(/Fut\d{1,2}_|Futsal_/, '')}
                                </SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
