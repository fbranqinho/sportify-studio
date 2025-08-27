
"use client";

import * as React from "react";
import type { User } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Gem } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from '@stripe/stripe-js';

interface PricingCardProps {
    user: User | null;
}

const premiumFeatures = [
    "Advanced Statistics Analysis",
    "AI-powered recommendations",
    "Priority in game applications",
    "Customizable profile with badges"
];

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PricingCard({ user }: PricingCardProps) {
    const { firebaseUser } = useUser();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleUpgrade = async () => {
        setIsProcessing(true);
        try {
            if (!firebaseUser) {
                throw new Error("User not authenticated.");
            }
            const token = await firebaseUser.getIdToken();

            const res = await fetch("/api/create-checkout-session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ priceId: process.env.STRIPE_PRO_PRICE_ID }),
            });

            if (!res.ok) {
                throw new Error(`Failed to create checkout session: ${res.statusText}`);
            }

            const { sessionId } = await res.json();
            const stripe = await stripePromise;
            if (!stripe) {
                throw new Error("Stripe.js has not loaded yet.");
            }
            
            const { error } = await stripe.redirectToCheckout({ sessionId });
            if (error) {
                throw error;
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Something went wrong.",
            });
        } finally {
            setIsProcessing(false);
        }
    }

    if (!user) {
        return null;
    }

    return (
        <Card className="flex flex-col h-full">
            <CardHeader>
                <CardTitle className="font-headline">Subscription Plan</CardTitle>
                <CardDescription>Manage your current plan and see upgrade options.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-6">
                <div>
                    <h3 className="font-semibold mb-2">Current Plan</h3>
                     <Badge variant={user.premiumPlan ? "default" : "outline"} className={cn(user.premiumPlan && "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg gap-1 border-amber-500")}>
                        {user.premiumPlan ? (
                            <>
                                <Gem className="h-4 w-4"/> Pro Player
                            </>
                        ) : "Free Plan"}
                    </Badge>
                </div>
                {!user.premiumPlan && (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                        <div className="text-center">
                            <h4 className="font-bold text-lg text-primary">Go Pro Player!</h4>
                            <p className="text-2xl font-bold">€5<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                        </div>
                        <ul className="space-y-2 text-sm">
                            {premiumFeatures.map(feature => (
                                <li key={feature} className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-500" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 {!user.premiumPlan && (
                    <Button onClick={handleUpgrade} className="w-full font-bold" disabled={isProcessing}>
                        {isProcessing ? "Processing..." : "Upgrade to Premium"}
                    </Button>
                )}
                 {user.premiumPlan && (
                     <p className="text-sm text-muted-foreground text-center w-full">You have the best plan available. Thank you for your support!</p>
                 )}
            </CardFooter>
        </Card>
    )
}
