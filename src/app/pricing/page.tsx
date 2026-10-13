import { Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PRICE } from "@/components/paywall";
import { CancelButton, SubscribeButton } from "@/components/subscribe-button";
import { billingEnabled, getAccess } from "@/lib/billing";

export const metadata = { title: "Pricing — QuantPrep" };
export const dynamic = "force-dynamic";

const ROWS = [
  ["Interview problems", "216 of 1,082", "All 1,082"],
  ["Hints and worked solutions", "On free problems", "Everywhere"],
  ["Quant Trader path", "Step 1", "All 20 steps"],
  ["Quant Researcher path", "Step 1", "All 28 steps"],
  ["Market-making games", "2 of 6", "All 6"],
];

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default async function PricingPage() {
  const { pro, sub } = await getAccess();
  const active = billingEnabled && pro && sub;
  const cancelled = sub?.status === "cancelled";

  return (
    <div>
      <PageHeader title="QuantPrep Pro" code="PRO" description="Every problem, both paths and all six games." />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-x-auto rounded-2xl bg-surface shadow-(--shadow-card)">
        <table className="w-full min-w-[26rem] text-left">
          <thead>
            <tr className="font-x border-b-[3px] border-[#1b2a4a] text-xs font-extrabold uppercase tracking-[0.08em]">
              <th className="p-3 sm:p-5">What you get</th>
              <th className="p-3 text-muted sm:p-5">Free</th>
              <th className="bg-[#1b2a4a] p-3 text-white sm:p-5">Pro</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([what, free, proRow]) => (
              <tr key={what} className="border-b border-border last:border-b-0">
                <td className="p-3 font-semibold sm:p-5">{what}</td>
                <td className="p-3 text-muted sm:p-5">{free}</td>
                <td className="bg-[#1b2a4a]/[0.06] p-3 font-bold sm:p-5">
                  <Check className="mr-2 inline h-4 w-4 text-positive" />
                  {proRow}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <section className="rounded-2xl bg-[#1b2a4a] p-7 text-white shadow-(--shadow-card) lg:sticky lg:top-24">
          <p className="font-xx text-[2.6rem] font-black leading-none">
            {PRICE}
            <span className="ml-1 text-base font-bold opacity-75">/month</span>
          </p>
          <p className="mt-3 text-sm opacity-80">Billed monthly through Razorpay. Cancel any time; Pro lasts until the month you paid for ends.</p>
          <div className="mt-7">
            {!billingEnabled ? (
              <p className="text-sm opacity-85">Subscriptions open soon. Everything is unlocked until then.</p>
            ) : active ? (
              <div className="space-y-4">
                <p className="text-sm">
                  {cancelled ? "Cancelled. Pro stays active until " : "You're on Pro. Renews "}
                  <span className="font-bold">{date(sub.current_end)}</span>.
                </p>
                {!cancelled && <CancelButton />}
              </div>
            ) : (
              <SubscribeButton />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
