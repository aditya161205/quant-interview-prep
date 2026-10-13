import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const PRICE = "₹1,499";

/** Shown in place of anything that needs a subscription: a navy Pro plate, the offer and one action. */
export function Paywall({ what = "This" }: { what?: string }) {
  return (
    <section className="mx-auto my-12 grid max-w-3xl overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card) sm:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="grid place-items-center bg-[#1b2a4a] p-8">
        <span className="font-xx rounded-[4px] bg-white px-4 py-3 text-3xl font-black tracking-[0.04em] text-[#1b2a4a]">PRO</span>
      </div>
      <div className="p-8">
        <h2 className="font-x text-2xl font-black">{what} is part of Pro</h2>
        <p className="mt-2 text-muted">All 1,082 problems, both paths and all six games for {PRICE} a month.</p>
        <Link
          href="/pricing"
          className="font-x mt-6 inline-flex h-11 items-center gap-2 rounded-[6px] bg-[#1b2a4a] px-6 font-bold text-white transition hover:brightness-125"
        >
          Get Pro <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
