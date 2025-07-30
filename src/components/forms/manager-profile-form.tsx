
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

// No fields needed for the initial form, so the schema is empty.
const formSchema = z.object({});

interface ManagerProfileFormProps {
    userId: string;
    userName: string;
}

export function ManagerProfileForm({ userId, userName }: ManagerProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit() {
    try {
        // Step 1: Create manager profile document in Firestore with default values
        await addDoc(collection(db, "managerProfiles"), {
            userRef: userId,
            name: userName,
            teams: [],
            tactics: "4-4-2", // Default value
            victories: 0,
            defeats: 0,
            draws: 0,
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
    }
  }

  return (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
           <p className="text-sm text-muted-foreground">
              Welcome, Manager! All your stats will be tracked as you manage teams and play games. For now, just click below to get started.
           </p>
            <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Complete and Continue"}
            </Button>
        </form>
    </Form>
  )
}
