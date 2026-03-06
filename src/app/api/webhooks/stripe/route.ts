import { headers } from "next/headers";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !apiKey) {
    return new Response("Stripe not configured (STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY)", { status: 500 });
  }

  const stripe = new Stripe(apiKey);

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  void event;

  return new Response("ok", { status: 200 });
}

