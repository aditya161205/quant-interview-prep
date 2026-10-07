"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type RazorpayResponse = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };
type RazorpayCheckout = new (options: Record<string, unknown>) => { open: () => void };

const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<RazorpayCheckout> {
  const w = window as unknown as { Razorpay?: RazorpayCheckout };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CHECKOUT_JS;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Checkout didn't load.")));
    s.onerror = () => reject(new Error("Checkout didn't load. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

async function post<T>(action: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/billing/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `Request failed (HTTP ${r.status})`);
  return data as T;
}

export function SubscribeButton() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const [Razorpay, s] = await Promise.all([
        loadCheckout(),
        post<{ subscriptionId: string; keyId: string; email: string }>("subscribe"),
      ]);
      new Razorpay({
        key: s.keyId,
        subscription_id: s.subscriptionId,
        name: "QuantPrep Pro",
        description: "Monthly subscription",
        prefill: { email: s.email },
        theme: { color: "#7c5cff" },
        handler: async (resp: RazorpayResponse) => {
          try {
            await post("verify", resp);
            window.location.reload();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full" onClick={start} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Subscribe
      </Button>
      {error && <p className="text-sm text-negative">{error}</p>}
    </div>
  );
}

export function CancelButton() {
  const [state, setState] = React.useState("idle"); // "idle", "busy" or an error message
  const cancel = async () => {
    if (!confirm("Cancel Pro? You keep access until the end of the month you've paid for.")) return;
    setState("busy");
    try {
      await post("cancel");
      window.location.reload();
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={cancel} disabled={state === "busy"}>
        Cancel subscription
      </Button>
      {state !== "idle" && state !== "busy" && <p className="text-sm text-negative">{state}</p>}
    </div>
  );
}
