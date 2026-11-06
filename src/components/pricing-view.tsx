import { Check } from "lucide-react";
import { PRICE } from "@/components/paywall";
import { CancelButton, SubscribeButton } from "@/components/subscribe-button";
import { Badge } from "@/components/ui/badge";
import { FREE_GAMES, GAMES } from "@/lib/pit";

/** What the ticket offers: billing not live yet, ready to buy, on Pro, or on Pro with the renewal cancelled. */
export type PlanState =
  | { kind: "soon" }
  | { kind: "open" }
  | { kind: "active"; until: string }
  | { kind: "cancelled"; until: string };

const PROBLEMS = 1082;
const FREE_PROBLEMS = 216;
const QT_STEPS = 20;
const QR_STEPS = 28;

const ROWS = [
  { what: "Interview problems", free: `${FREE_PROBLEMS} of ${PROBLEMS.toLocaleString("en-IN")}`, pro: `All ${PROBLEMS.toLocaleString("en-IN")}`, share: FREE_PROBLEMS / PROBLEMS },
  { what: "Hints and worked solutions", free: "Free problems", pro: "All problems", share: FREE_PROBLEMS / PROBLEMS },
  { what: "Quant Trader path", free: "Step 1", pro: `All ${QT_STEPS} steps`, share: 1 / QT_STEPS },
  { what: "Quant Researcher path", free: "Step 1", pro: `All ${QR_STEPS} steps`, share: 1 / QR_STEPS },
  { what: "Market-making games", free: `${FREE_GAMES} of ${GAMES.length}`, pro: `All ${GAMES.length}`, share: FREE_GAMES / GAMES.length },
];

const STATS = [
  { value: PROBLEMS.toLocaleString("en-IN"), label: "problems" },
  { value: String(QT_STEPS + QR_STEPS), label: "path steps" },
  { value: String(GAMES.length), label: "games" },
];

const NOTES = [
  { title: "Billed monthly", body: "Through Razorpay, one month at a time." },
  { title: "Cancel any time", body: "From this page. Pro lasts until the month you paid for ends." },
  { title: "Then back to free", body: `${FREE_PROBLEMS} problems, step 1 of each path and ${FREE_GAMES} games stay open.` },
];

const HEADLINE: Record<PlanState["kind"], { title: string; description: string }> = {
  soon: { title: "QuantPrep Pro", description: "Every problem, both paths and every game." },
  open: { title: "QuantPrep Pro", description: "Every problem, both paths and every game." },
  active: { title: "You're on Pro", description: "Every problem, both paths and every game are open." },
  cancelled: { title: "You're on Pro", description: "Your renewal is off. Everything stays open until your paid month ends." },
};

const STATUS: Record<PlanState["kind"], string> = { soon: "Opening soon", open: "Monthly", active: "Active", cancelled: "Ending" };

function TicketLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[#535c6a]">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

/** The order ticket: always white paper, in both themes, like the trader badges. */
function Ticket({ plan }: { plan: PlanState }) {
  const held = plan.kind === "active" || plan.kind === "cancelled";
  return (
    <section aria-label="Your plan" className="relative w-full overflow-hidden rounded-xl bg-white text-[#0f131a] shadow-(--shadow-card) lg:w-[25rem]">
      <div className="px-6 pb-6 pt-5 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <span className="font-code text-xs font-semibold uppercase tracking-[0.08em] text-[#535c6a]">Order ticket</span>
          <Badge tone="accent">{STATUS[plan.kind]}</Badge>
        </div>
        <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5 leading-none">
          <span className="font-xx text-[2rem] font-black tracking-[-0.01em] sm:text-[2.75rem]">{PRICE}</span>
          <span className="font-x text-base font-bold text-[#535c6a]">/month</span>
        </p>
      </div>

      {/* The tear line, with a punched hole at each edge showing the jacket behind the paper. */}
      <div aria-hidden className="relative border-t-2 border-dashed border-[#cdd2da]">
        <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-jacket" />
        <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-jacket" />
      </div>

      <div className="space-y-5 px-6 pb-6 pt-6 sm:px-7">
        <dl className="space-y-2 text-sm">
          <TicketLine label="Plan" value="QuantPrep Pro" />
          {plan.kind === "active" && <TicketLine label="Renews" value={plan.until} />}
          {plan.kind === "cancelled" && <TicketLine label="Pro until" value={plan.until} />}
          {!held && <TicketLine label="Billing" value="Monthly, via Razorpay" />}
        </dl>
        {plan.kind === "soon" && <p className="text-sm text-[#535c6a]">Subscriptions open soon. Everything is unlocked until then.</p>}
        {plan.kind === "open" && <SubscribeButton price={PRICE} />}
        {plan.kind === "active" && <CancelButton />}
        {plan.kind === "cancelled" && <p className="text-sm text-[#535c6a]">You can subscribe again here once it ends.</p>}
      </div>
    </section>
  );
}

/** The whole bar is Pro; the grey head of it is the part that's free. */
function Share({ share }: { share: number }) {
  return (
    <span aria-hidden className="mt-2.5 flex h-1.5 w-full max-w-56 gap-0.5 overflow-hidden rounded-full">
      <span className="bg-muted/55" style={{ width: `${share * 100}%` }} />
      <span className="flex-1 bg-(--jacket-text)" />
    </span>
  );
}

export function PricingView({ plan }: { plan: PlanState }) {
  const { title, description } = HEADLINE[plan.kind];
  return (
    <div>
      <header className="full-bleed mb-8 bg-jacket text-jacket-ink">
        <div className="mx-auto grid max-w-[96rem] grid-cols-1 items-center gap-8 px-4 py-9 sm:px-6 sm:py-11 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div className="min-w-0">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
              <span className="font-code grid h-16 min-w-[5.5rem] place-items-center rounded-[4px] bg-jacket-ink px-3 text-2xl font-black tracking-[0.04em] text-jacket">PRO</span>
              <h1 className="font-xx min-w-0 text-[2.4rem] font-black leading-[0.95] tracking-[-0.02em] text-balance sm:text-[3.4rem]">{title}</h1>
            </div>
            <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed opacity-85">{description}</p>
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-jacket-ink/20 pt-6">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col-reverse">
                  <dt className="mt-1 text-sm opacity-75">{s.label}</dt>
                  <dd className="font-xx text-[1.75rem] font-black leading-none sm:text-[2.1rem]">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Ticket plan={plan} />
        </div>
      </header>

      <section aria-labelledby="compare" className="min-w-0 overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        <table className="w-full text-left">
          <caption id="compare" className="sr-only">What Free and Pro include</caption>
          <thead>
            <tr className="font-x border-b-[3px] border-(--jacket-text) text-xs max-sm:grid max-sm:grid-cols-2 font-extrabold uppercase tracking-[0.08em]">
              <th scope="col" className="p-3 max-sm:hidden sm:px-6 sm:py-4">What you get</th>
              <th scope="col" className="p-3 text-muted sm:px-6 sm:py-4">
                <span aria-hidden className="mr-2 inline-block h-1.5 w-3 rounded-full bg-muted/55 align-middle" />
                Free
              </th>
              <th scope="col" className="bg-jacket p-3 text-jacket-ink sm:px-6 sm:py-4">Pro</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.what} className="border-b border-border last:border-b-0 max-sm:grid max-sm:grid-cols-2">
                <th scope="row" className="p-3 pb-2 text-left font-semibold max-sm:col-span-2 sm:px-6 sm:py-4">
                  {row.what}
                  <Share share={row.share} />
                </th>
                <td className="whitespace-nowrap p-3 text-sm text-muted sm:px-6 sm:py-4 sm:text-base">{row.free}</td>
                <td className="whitespace-nowrap bg-[color-mix(in_srgb,var(--jacket-text)_8%,transparent)] p-3 text-sm font-bold sm:px-6 sm:py-4 sm:text-base">
                  <Check aria-hidden className="mr-2 inline h-4 w-4 text-positive" />
                  {row.pro}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ul className="mt-8 grid gap-6 sm:grid-cols-3">
        {NOTES.map((n) => (
          <li key={n.title} className="border-t-[3px] border-(--jacket-text) pt-3">
            <h2 className="font-x text-sm font-extrabold uppercase tracking-[0.04em]">{n.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
