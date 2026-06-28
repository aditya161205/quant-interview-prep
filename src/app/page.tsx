import Link from "next/link";
import { BrainCircuit, LineChart, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const modules = [
  {
    href: "/practice",
    title: "Practice Problems",
    description:
      "Probability, expected value, and brainteasers pulled from real quant interviews. Toggle solutions when you're ready.",
    icon: BrainCircuit,
    cta: "Start practicing",
    stat: "5 sample problems",
  },
  {
    href: "/market-making",
    title: "Market Making Game",
    description:
      "Set a bid/ask on the sum of a hidden hand. We score your spread against the true expected value and book your PnL.",
    icon: LineChart,
    cta: "Make a market",
    stat: "Live EV scoring",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="obsidian-glow rounded-2xl border border-border bg-surface p-8 sm:p-10">
        <Badge tone="accent" className="mb-4">
          MVP · Quant Interview Practice
        </Badge>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Sharpen the skills that get you{" "}
          <span className="text-accent">past the trading desk interview.</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Drill mental math, probability and expected value — then prove it
          under pressure in an interactive market-making game.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/practice">
            <Button size="lg">
              Practice problems <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/market-making">
            <Button size="lg" variant="outline">
              Play the game
            </Button>
          </Link>
        </div>
      </section>

      {/* Modules */}
      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">
          Modules
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="group">
              <Card className="h-full transition-colors group-hover:border-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-accent/15 text-accent">
                      <m.icon className="h-6 w-6" />
                    </span>
                    <Badge tone="outline">{m.stat}</Badge>
                  </div>
                  <CardTitle className="mt-3">{m.title}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
                    {m.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
