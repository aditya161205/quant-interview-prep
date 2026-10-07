import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const PRICE = "₹1,499";

/** Shown in place of anything that needs a subscription. */
export function Paywall({ what = "This" }: { what?: string }) {
  return (
    <Card className="mx-auto my-10 max-w-md p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
        <Lock className="h-5 w-5" />
      </span>
      <h2 className="mt-5 text-xl font-bold tracking-[-0.02em]">{what} is part of Pro</h2>
      <p className="mt-2 text-sm text-muted">All problems, both paths and every game for {PRICE}/month.</p>
      <Link href="/pricing" className="mt-6 inline-block">
        <Button>Get Pro</Button>
      </Link>
    </Card>
  );
}
