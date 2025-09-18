'use server';

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    const { priceId } = await req.json();

    const authHeader = req.headers.get('authorization');
    const authToken = authHeader?.replace(/^Bearer\s+/i, '') ?? null;

    if (!authToken) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const decodedToken = await adminAuth.verifyIdToken(authToken);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email || undefined;

        if (!priceId) {
            return new NextResponse('Price ID is required', { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${appUrl}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/dashboard/settings`,
            customer_email: userEmail,
            metadata: { userId },
        });

        return NextResponse.json({ sessionId: checkoutSession.id });
    } catch (error: any) {
        if (
            error?.code === 'auth/argument-error' ||
            error?.code === 'auth/id-token-expired' ||
            error?.code === 'auth/invalid-id-token'
        ) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        console.error('Error creating checkout session:', error);
        return new NextResponse('Internal error', { status: 500 });
    }
}