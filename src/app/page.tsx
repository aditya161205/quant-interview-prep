import Link from "next/link";
import { BrainCircuit, LineChart, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCard } from "@/components/icon-card";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      {/* The one place big display type earns its size — everywhere else
          headings are sentence case, so this reads as the brand moment
          rather than one more shouting element. */}
      <section className="pb-2 pt-2 sm:pt-6">
        <Badge tone="accent" className="mb-5">
          Quant Interview Practice
        </Badge>
        <h1 className="max-w-4xl text-[2.75rem] font-black uppercase leading-[0.95] tracking-[-0.02em] sm:text-6xl">
          Crack the
          <br />
          <span className="text-accent">trading desk</span> interview
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          Drill mental math, probability and expected value — then prove it under
          pressure across six interactive market-making games.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/practice">
            <Button size="lg">
              Practice problems <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/market-making">
            <Button size="lg" variant="outline">
              Play the games
            </Button>
          </Link>
        </div>
      </section>

      {/* Modules */}
      <section>
        <h2 className="mb-4 text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
          Modules
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <IconCard
            href="/practice"
            icon={BrainCircuit}
            color="mint"
            title="Practice Problems"
            kicker="Probability · EV · Brainteasers"
            description="Real quant interview questions with worked solutions, search, filters, and progress tracking."
            watermark="PR"
          />
          <IconCard
            href="/market-making"
            icon={LineChart}
            color="emerald"
            title="Market Making Games"
            kicker="6 interactive games"
            description="Quote markets, hunt mispricings, and trade against AI agents — scored on the math that matters."
            watermark="MM"
          />
        </div>
      </section>
    </div>
  );
}
