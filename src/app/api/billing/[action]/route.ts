import { NextResponse } from "next/server";
import {
  billingEnabled,
  checkoutSignatureValid,
  createSubscription,
  fetchSubscription,
  getAccess,
  razorpay,
  razorpayKeyId,
  saveSubscription,
  webhookSignatureValid,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!billingEnabled) return json({ error: "Payments aren't set up yet." }, 503);

  // Razorpay → us. Authenticated by the webhook signature, not a session.
  if (action === "webhook") {
    const raw = await request.text();
    if (!webhookSignatureValid(raw, request.headers.get("x-razorpay-signature") ?? "")) return json({ error: "bad signature" }, 400);
    const event = JSON.parse(raw);
    const sub = event?.payload?.subscription?.entity;
    if (typeof event?.event === "string" && event.event.startsWith("subscription.") && sub?.id) await saveSubscription(sub);
    return json({ ok: true });
  }

  const { user, sub } = await getAccess();
  if (!user) return json({ error: "Sign in first." }, 401);

  try {
    if (action === "subscribe") {
      const s = await createSubscription(user.id);
      return json({ subscriptionId: s.id, keyId: razorpayKeyId, email: user.email ?? "" });
    }

    if (action === "verify") {
      const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const [paymentId, subscriptionId, signature] = [b.razorpay_payment_id, b.razorpay_subscription_id, b.razorpay_signature].map(String);
      if (!checkoutSignatureValid(paymentId, subscriptionId, signature)) return json({ error: "Payment couldn't be verified." }, 400);
      const s = await fetchSubscription(subscriptionId);
      if (s.notes?.user_id !== user.id) return json({ error: "This subscription belongs to another account." }, 403);
      await saveSubscription(s, user.id);
      return json({ ok: true });
    }

    if (action === "cancel") {
      if (!sub) return json({ error: "No subscription to cancel." }, 404);
      // Cancels at the end of the paid month; access lasts until then.
      const s = await razorpay<Parameters<typeof saveSubscription>[0]>(`subscriptions/${sub.subscription_id}/cancel`, { cancel_at_cycle_end: 1 });
      await saveSubscription(s, user.id);
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Payment provider error." }, 502);
  }
  return json({ error: "not found" }, 404);
}
