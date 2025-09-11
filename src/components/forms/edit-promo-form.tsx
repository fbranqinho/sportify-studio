
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pitch, Promo } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const daysOfWeek = [
  { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" },
  { id: 4, label: "Thu" }, { id: 5, label: "Fri" }, { id: 6, label: "Sat" },
  { id: 0, label: "Sun" },
];

const formSchema = z.object({
  name: z.string().min(3, "Promotion name is too short.").max(50, "Promotion name is too long."),
  discountPercent: z.number().min(1, "Discount must be at least 1%.").max(100, "Discount cannot exceed 100%."),
  dates: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date({ required_error: "End date is required." }),
  }),
  applicableHours: z.array(z.number()).min(1, "You must select at least one hour."),
  applicableDays: z.array(z.number()).min(1, "You must select at least one day of the week."),
  pitchIds: z.array(z.string()).optional(),
});

interface EditPromoFormProps {
  promo: Promo;
  ownerPitches: Pitch[];
  onPromoUpdated: () => void;
}

export function EditPromoForm({ promo, ownerPitches, onPromoUpdated }: EditPromoFormProps) {
  const { toast } = useToast();
  const [selectedPitches, setSelectedPitches] = React.useState<Pitch[]>(
    () => ownerPitches.filter(p => promo.pitchIds.includes(p.id))
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: promo.name,
      discountPercent: promo.discountPercent,
      dates: {
        from: promo.validFrom.toDate(),
        to: promo.validTo.toDate(),
      },
      applicableHours: promo.applicableHours,
      applicableDays: promo.applicableDays,
      pitchIds: promo.pitchIds,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const promoRef = doc(db, "promos", promo.id);
      await updateDoc(promoRef, {
        name: values.name,
        discountPercent: values.discountPercent,
        validFrom: Timestamp.fromDate(values.dates.from),
        validTo: Timestamp.fromDate(values.dates.to),
        applicableHours: values.applicableHours.sort((a,b) => a - b),
        applicableDays: values.applicableDays.sort((a,b) => a - b),
        pitchIds: selectedPitches.map(p => p.id),
      });

      toast({ title: "Promotion Updated!", description: "Your promotion has been successfully saved." });
      onPromoUpdated();

    } catch (error: any) {
      toast({ variant: "destructive", title: "Something went wrong", description: error.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Promotion Name</FormLabel>
                <FormControl><Input placeholder="e.g. Morning Madness" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dates"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Promotion Dates</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value?.from ? (
                          field.value.to ? (
                            <>
                              {format(field.value.from, "LLL dd, y")} -{" "}
                              {format(field.value.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(field.value.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={field.value?.from}
                      selected={{ from: field.value?.from, to: field.value?.to }}
                      onSelect={field.onChange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
            control={form.control}
            name="discountPercent"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Discount Percentage - {field.value}%</FormLabel>
                    <FormControl>
                        <Slider
                            min={1} max={100} step={1}
                            defaultValue={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                        />
                    </FormControl>
                </FormItem>
            )}
        />
        
        <FormField
          control={form.control}
          name="applicableDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Applicable Days</FormLabel>
              <FormControl>
                <ToggleGroup type="multiple" variant="outline" value={field.value.map(String)} onValueChange={(value) => field.onChange(value.map(Number))}>
                  {daysOfWeek.map(day => (
                    <ToggleGroupItem key={day.id} value={day.id.toString()} aria-label={`Toggle ${day.label}`}>{day.label}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="applicableHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Applicable Hours (Start of slot)</FormLabel>
              <FormControl>
                <ToggleGroup type="multiple" variant="outline" className="flex-wrap justify-start" value={field.value.map(String)} onValueChange={(value) => field.onChange(value.map(Number))}>
                  {Array.from({ length: 15 }, (_, i) => i + 9).map(hour => (
                    <ToggleGroupItem key={hour} value={hour.toString()} aria-label={`Toggle ${hour}:00`}>{hour}:00</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Controller
            control={form.control}
            name="pitchIds"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Applicable Pitches</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant="outline" role="combobox" className="w-full justify-between">
                            {selectedPitches.length > 0 ? `${selectedPitches.length} pitch(es) selected` : "Select pitches..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search pitches..." />
                                <CommandList>
                                <CommandEmpty>No pitches found.</CommandEmpty>
                                <CommandGroup>
                                    {ownerPitches.map((pitch) => (
                                    <CommandItem
                                        value={pitch.name}
                                        key={pitch.id}
                                        onSelect={() => {
                                            const isSelected = selectedPitches.some(p => p.id === pitch.id);
                                            const newSelection = isSelected ? selectedPitches.filter(p => p.id !== pitch.id) : [...selectedPitches, pitch];
                                            setSelectedPitches(newSelection);
                                            field.onChange(newSelection.map(p => p.id));
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", selectedPitches.some(p => p.id === pitch.id) ? "opacity-100" : "opacity-0")} />
                                        {pitch.name}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <FormDescription>If no pitches are selected, the promotion will apply to all of your pitches.</FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        
        <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}
