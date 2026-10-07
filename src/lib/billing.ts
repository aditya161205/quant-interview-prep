import "server-only";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const PLAN_ID = process.env.RAZORPAY_PLAN_ID ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

/** Locks apply only once Razorpay is configured, so a deploy without keys never strands users behind a paywall. */
export const billingEnabled = Boolean(problemsEnabled && KEY_ID && KEY_SECRET && PLAN_ID);
export const razorpayKeyId = KEY_ID;

/** A fixed pseudo-random 20% of problems are free: the same set for every user and every deploy. */
export function isFreeProblem(id: number): boolean {
  return Math.imul(id, 2654435761) >>> 0 < 0x33333334;
}

export type Subscription = { subscription_id: string; status: string; current_end: string };

/** The signed-in user and their subscription row, read once per request. */
export const getAccess = cache(async () => {
  const user = await getApiUser();
  if (!billingEnabled) return { user, pro: true, sub: null as Subscription | null };
  if (!user) return { user, pro: false, sub: null };
  const { data } = await getAdminClient()
    .from("subscriptions")
    .select("subscription_id, status, current_end")
    .eq("user_id", user.id)
    .maybeSingle();
  const sub = data as Subscription | null;
  // Paid-through date decides access, so a cancelled plan keeps working until the period it paid for ends.
  return { user, pro: !!sub && new Date(sub.current_end) > new Date(), sub };
});

export async function hasPro(): Promise<boolean> {
  return (await getAccess()).pro;
}

export async function razorpay<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.description ?? `Razorpay HTTP ${r.status}`);
  return data as T;
}

export const createSubscription = (userId: string) =>
  razorpay<{ id: string }>("subscriptions", { plan_id: PLAN_ID, total_count: 120, customer_notify: 1, notes: { user_id: userId } });

type RzpSubscription = { id: string; status: string; current_end: number | null; notes?: { user_id?: string } };
export const fetchSubscription = (id: string) => razorpay<RzpSubscription>(`subscriptions/${encodeURIComponent(id)}`);

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout's signature: HMAC of "payment_id|subscription_id" with the key secret. */
export const checkoutSignatureValid = (paymentId: string, subscriptionId: string, signature: string) =>
  safeEqual(createHmac("sha256", KEY_SECRET).update(`${paymentId}|${subscriptionId}`).digest("hex"), signature);

export const webhookSignatureValid = (raw: string, signature: string) =>
  !!WEBHOOK_SECRET && safeEqual(createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex"), signature);

/** Mirrors a Razorpay subscription into our table, keyed by the user id stored in its notes. */
export async function saveSubscription(s: RzpSubscription, userId = s.notes?.user_id) {
  if (!userId) return;
  // Before Razorpay sets current_end (right after the first charge), grant one month so access starts immediately.
  const end = s.current_end ? new Date(s.current_end * 1000) : new Date(Date.now() + 31 * 86_400_000);
  const { error } = await getAdminClient()
    .from("subscriptions")
    .upsert({ user_id: userId, subscription_id: s.id, status: s.status, current_end: end.toISOString(), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
