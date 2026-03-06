import { headers } from "next/headers";
import Stripe from "stripe";
import { GrantSource, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function getStripeConfig() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return {
    webhookSecret,
    secretKey,
    configured: Boolean(webhookSecret && secretKey)
  };
}

function missingStripeConfigResponse() {
  return new Response(
    "Stripe webhook is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.",
    { status: 500 }
  );
}

function asStripeId(value: string | { id?: string } | null): string | null {
  return typeof value === "string" ? value : null;
}

function fromUnixSeconds(value: number | null): Date | null {
  if (!value) return null;
  return new Date(value * 1000);
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  if (!periodEnds.length) return null;
  return fromUnixSeconds(Math.max(...periodEnds));
}

function parseDelimitedKeys(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
}

function getMetadataValue(
  metadata: Stripe.Metadata | null | undefined,
  keys: string[]
): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

async function resolveUserIdForSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const metadataUserId = getMetadataValue(subscription.metadata, ["userId", "user_id"]);
  if (metadataUserId) return metadataUserId;

  const bySubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { userId: true }
  });
  if (bySubscription?.userId) return bySubscription.userId;

  const customerId = asStripeId(subscription.customer);
  if (!customerId) return null;

  const byCustomer = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
    orderBy: { updatedAt: "desc" }
  });
  return byCustomer?.userId ?? null;
}

async function upsertSubscriptionFromStripeObject(
  subscription: Stripe.Subscription
): Promise<string> {
  const userId = await resolveUserIdForSubscription(subscription);
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true }
  });

  const stripeCustomerId = asStripeId(subscription.customer);
  const stripePriceId = subscription.items.data[0]?.price?.id ?? null;
  const data = {
    status: subscription.status,
    stripeCustomerId,
    stripePriceId,
    currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  };

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: userId ? { ...data, userId } : data
    });
    return existing.id;
  }

  if (!userId) {
    throw new Error(
      `Cannot create subscription ${subscription.id}: missing userId in metadata and no existing mapping`
    );
  }

  const created = await prisma.subscription.create({
    data: {
      userId,
      provider: "stripe",
      status: subscription.status,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    },
    select: { id: true }
  });
  return created.id;
}

async function grantEntitlements(
  userId: string,
  source: GrantSource,
  keys: string[],
  expiresAt: Date | null
) {
  if (!keys.length) return;

  const entitlements = await prisma.entitlement.findMany({
    where: { key: { in: keys } },
    select: { id: true }
  });

  for (const entitlement of entitlements) {
    await prisma.userEntitlement.upsert({
      where: {
        userId_entitlementId: {
          userId,
          entitlementId: entitlement.id
        }
      },
      create: {
        userId,
        entitlementId: entitlement.id,
        source,
        expiresAt
      },
      update: {
        source,
        expiresAt
      }
    });
  }
}

async function handleSubscriptionEvent(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const userId = await resolveUserIdForSubscription(subscription);
  const subscriptionId = await upsertSubscriptionFromStripeObject(subscription);
  void subscriptionId;

  if (!userId) return;

  const entitlementKeys = parseDelimitedKeys(
    getMetadataValue(subscription.metadata, ["entitlementKeys", "entitlements"]) ?? undefined
  );

  if (!entitlementKeys.length) return;

  const isActive = subscription.status === "active" || subscription.status === "trialing";
  await grantEntitlements(
    userId,
    GrantSource.SUBSCRIPTION,
    entitlementKeys,
    isActive ? getSubscriptionPeriodEnd(subscription) : new Date()
  );
}

async function handleCheckoutCompleted(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId =
    getMetadataValue(session.metadata, ["userId", "user_id"]) ??
    session.client_reference_id ??
    null;

  if (session.mode === "subscription") {
    const subscriptionId = asStripeId(session.subscription);
    if (!subscriptionId) return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertSubscriptionFromStripeObject(subscription);
    return;
  }

  if (!userId) {
    throw new Error(`Cannot persist checkout session ${session.id}: missing userId`);
  }

  const purchase = await prisma.purchase.upsert({
    where: { stripeCheckoutSessionId: session.id },
    create: {
      userId,
      provider: "stripe",
      status:
        session.payment_status === "paid" ? PurchaseStatus.PAID : PurchaseStatus.PENDING,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    },
    update: {
      status:
        session.payment_status === "paid" ? PurchaseStatus.PAID : PurchaseStatus.PENDING,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    },
    select: { id: true }
  });

  const entitlementKeys = parseDelimitedKeys(
    getMetadataValue(session.metadata, ["entitlementKeys", "entitlements"]) ?? undefined
  );
  if (!entitlementKeys.length) return;

  const entitlements = await prisma.entitlement.findMany({
    where: { key: { in: entitlementKeys } },
    select: { id: true }
  });

  for (const entitlement of entitlements) {
    await prisma.purchaseItem.upsert({
      where: {
        purchaseId_entitlementId: {
          purchaseId: purchase.id,
          entitlementId: entitlement.id
        }
      },
      create: {
        purchaseId: purchase.id,
        entitlementId: entitlement.id
      },
      update: {}
    });
  }

  if (session.payment_status === "paid") {
    await grantEntitlements(userId, GrantSource.PURCHASE, entitlementKeys, null);
  }
}

async function handleStripeEvent(event: Stripe.Event, stripe: Stripe) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event, stripe);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionEvent(event);
      return;
    default:
      return;
  }
}

export async function POST(req: Request) {
  const stripeConfig = getStripeConfig();
  if (!stripeConfig.configured) {
    return missingStripeConfigResponse();
  }

  const stripe = new Stripe(stripeConfig.secretKey!);

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, stripeConfig.webhookSecret!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  try {
    await handleStripeEvent(event, stripe);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook handler error";
    return new Response(`Webhook handler failed: ${message}`, { status: 500 });
  }

  return new Response("received", { status: 200 });
}
