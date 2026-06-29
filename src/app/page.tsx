import Link from "next/link";
import { BrainCircuit, LineChart, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCard } from "@/components/icon-card";

export default function DashboardPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="pb-4 pt-10 sm:pt-16">
        <Badge tone="accent" className="mb-6">
          Quant Interview Practice
        </Badge>
        <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl">
          Crack the
          <br />
          <span className="text-accent">trading desk</span> interview
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted sm:text-lg">
          Drill mental math, probability and expected value — then prove it under
          pressure across four interactive market-making games.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
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
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Modules
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <IconCard
            href="/practice"
            icon={BrainCircuit}
            color="violet"
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
            kicker="4 interactive games"
            description="Quote markets, hunt mispricings, and trade against AI agents — scored on the math that matters."
            watermark="MM"
          />
        </div>
      </section>
    </div>
  );
}
