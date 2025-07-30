"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { getRecommendationsAction } from "./actions";
import type { Location } from "@/types";
import { LocationCard } from "@/components/location-card";
import { Loader2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  currentLocation: z.string().min(2, {
    message: "Location must be at least 2 characters.",
  }),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  pastGamePreferences: z.string().optional(),
});

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentLocation: "",
      skillLevel: "intermediate",
      pastGamePreferences: "Football",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setRecommendations([]);
    try {
      const result = await getRecommendationsAction({
        ...values,
        userId: "demo-user", // In a real app, this would come from session
      });
      if (result && result.recommendations) {
        setRecommendations(result.recommendations);
      } else {
         toast({
          variant: "destructive",
          title: "No Recommendations Found",
          description: "The AI couldn't find any recommendations based on your input. Try different criteria.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description:
          "There was a problem with our AI service. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-primary" /> AI Recommendations
        </h1>
        <p className="text-muted-foreground">
          Let our AI find the perfect fields for you based on your preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Find Your Match</CardTitle>
          <CardDescription>
            Fill out the form below to get personalized recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="currentLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Current Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Lisbon, Portugal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="skillLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill Level</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your skill level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">
                            Intermediate
                          </SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-2">
                 <FormField
                    control={form.control}
                    name="pastGamePreferences"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Game Preferences (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Football, 5-a-side, Futsal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="font-semibold">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Recommendations...
                  </>
                ) : (
                  <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Recommendations
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {isLoading && (
        <div>
          <h2 className="text-2xl font-bold font-headline mb-4">Finding best matches...</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
               <Card key={i} className="overflow-hidden flex flex-col h-full">
                 <Skeleton className="h-48 w-full" />
                 <CardContent className="p-4 flex-grow space-y-3">
                   <Skeleton className="h-6 w-3/4" />
                   <Skeleton className="h-4 w-full" />
                   <Skeleton className="h-4 w-1/2" />
                 </CardContent>
                 <CardFooter className="p-4 bg-muted/50 flex justify-between">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                 </CardFooter>
               </Card>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
         <div>
          <h2 className="text-2xl font-bold font-headline mb-4">Here are your top recommendations:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((location) => (
              <LocationCard key={location.locationId} location={location} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
