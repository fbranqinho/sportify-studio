
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

const formSchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters." }),
  companyNif: z.string().regex(/^[0-9]{9}$/, { message: "NIF must have 9 digits." }),
  companyAddress: z.string().min(10, { message: "Company address is required." }),
  description: z.string().optional(),
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
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
        // Step 1: Create owner profile document in Firestore
        await addDoc(collection(db, "ownerProfiles"), {
            ...values,
            userRef: userId,
            pitches: [],
            // Defaulting lat/lng, should be updated when creating a pitch
            latitude: 0, 
            longitude: 0,
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
            <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save and Continue"}
            </Button>
        </form>
    </Form>
  )
}
