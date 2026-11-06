import { PricingView, type PlanState } from "@/components/pricing-view";
import { billingEnabled, getAccess } from "@/lib/billing";

export const metadata = { title: "Pricing — QuantPrep" };
export const dynamic = "force-dynamic";

// Razorpay dates are instants; show the day as our Indian subscribers see it, not the server's UTC day.
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function PricingPage() {
  const { pro, sub } = await getAccess();

  let plan: PlanState = { kind: "open" };
  if (!billingEnabled) plan = { kind: "soon" };
  else if (pro && sub) plan = { kind: sub.status === "cancelled" ? "cancelled" : "active", until: date(sub.current_end) };

  return <PricingView plan={plan} />;
}
