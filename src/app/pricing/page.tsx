import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PRICE } from "@/components/paywall";
import { CancelButton, SubscribeButton } from "@/components/subscribe-button";
import { billingEnabled, getAccess } from "@/lib/billing";

export const metadata = { title: "Pricing — QuantPrep" };
export const dynamic = "force-dynamic";

const FEATURES = [
  "All 1,082 interview problems with hints and solutions",
  "Quant Trader and Quant Researcher paths, with every lesson, question and coding task",
  "All six market-making games",
];

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default async function PricingPage() {
  const { pro, sub } = await getAccess();
  const active = billingEnabled && pro && sub;
  const cancelled = sub?.status === "cancelled";

  return (
    <div className="space-y-8">
      <PageHeader kicker="Pricing" title="QuantPrep Pro" />
      <Card className="max-w-md p-8">
        <p className="text-4xl font-bold tracking-[-0.03em]">
          {PRICE}
          <span className="text-base font-medium text-muted">/month</span>
        </p>
        <ul className="mt-6 space-y-3 text-sm">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          {!billingEnabled ? (
            <p className="text-sm text-muted">Subscriptions open soon. Everything is unlocked until then.</p>
          ) : active ? (
            <div className="space-y-4">
              <p className="text-sm">
                {cancelled ? "Cancelled. Pro stays active until " : "You're on Pro. Renews "}
                <span className="font-semibold">{date(sub.current_end)}</span>.
              </p>
              {!cancelled && <CancelButton />}
            </div>
          ) : (
            <SubscribeButton />
          )}
        </div>
      </Card>
    </div>
  );
}
