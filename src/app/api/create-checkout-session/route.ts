
'use server';
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase-admin";

export async function POST(req: Request) {
    const headersList = headers();
    const { priceId } = await req.json();

    const authToken = headersList.get('Authorization')?.split('Bearer ')[1] || null;

    if (!authToken) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    
    try {
        const decodedToken = await getAuth(adminApp).verifyIdToken(authToken);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        if (!priceId) {
             return new NextResponse("Price ID is required", { status: 400 });
        }
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${appUrl}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/dashboard/settings`,
            customer_email: userEmail,
            metadata: {
                userId: userId,
            }
        });

        return NextResponse.json({ sessionId: checkoutSession.id });

    } catch (error: any) {
        console.error("Error creating checkout session:", error);
        return new NextResponse(error.message, { status: 500 });
    }
}
