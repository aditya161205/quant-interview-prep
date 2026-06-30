"use client";

import * as React from "react";
import {
  Play, RotateCcw, ArrowRight, Settings2, Flag, Dices, Coins, Spade,
  ChevronDown, Check, X, Trophy, Sigma, Timer,
} from "lucide-react";
import {
  useBettingStore,
  DEFAULT_BETTING_CONFIG,
  BETTING_OPTIONS,
  STARTING_BANKROLL,
  type BettingConfig,
  type BoardProp,
  type ResolvedLine,
  type RoundResult,
} from "@/store/betting-store";
import {
  type Category,
  type RoundOutcome,
} from "@/lib/betting-game";
import { cn, formatSigned } from "@/lib/utils";
import { useRecordGame } from "@/store/practice-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CAT_ICON: Record<Category, typeof Dices> = { Dice: Dices, Cards: Spade, Coins: Coins };

export function BettingGame() {
  const phase = useBettingStore((s) => s.phase);
  if (phase === "intro") return <Intro />;
  if (phase === "gameover") return <GameOver />;
  return <BoardScreen />;
}

/* ----------------------------------- intro --------------------------- */

function Intro() {
  const start = useBettingStore((s) => s.start);
  const saved = useBettingStore((s) => s.config);
  const [config, setConfig] = React.useState<BettingConfig>(saved ?? DEFAULT_BETTING_CONFIG);
  const set = <K extends keyof BettingConfig>(k: K, v: BettingConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  return (
    <Card className="obsidian-glow mx-auto max-w-2xl">
      <CardContent className="space-y-7 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500 text-white shadow-lg">
            <Dices className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-black uppercase tracking-tight">Probability Betting Game</h2>
          <p className="max-w-md text-muted">
            Each round the house quotes fractional odds on dice, card and coin
            events — but the odds are skewed off the true probability. Compute the
            real odds, take the bets where you have an edge, and grow your bankroll
            of {STARTING_BANKROLL}.
          </p>
        </div>

        <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4 text-accent" /> Game settings
          </div>
          <Segmented label="Rounds" options={BETTING_OPTIONS.rounds} value={config.rounds} onChange={(v) => set("rounds", v)} />
          <Segmented label="Events per category" options={BETTING_OPTIONS.eventsPerCategory} value={config.eventsPerCategory} onChange={(v) => set("eventsPerCategory", v)} />
          <Segmented label="Minutes per round" options={BETTING_OPTIONS.roundMinutes} value={config.roundMinutes} onChange={(v) => set("roundMinutes", v)} suffix="m" />
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Skip results animation</span>
            <input
              type="checkbox"
              checked={config.skipAnimation}
              onChange={(e) => set("skipAnimation", e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
              className="h-4 w-4"
            />
          </label>
        </div>

        <KellyCard />

        <div className="flex justify-center">
          <Button size="lg" onClick={() => start(config)}>
            <Play className="h-4 w-4" /> Start game
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Segmented<T extends number>({
  label, options, value, onChange, suffix = "",
}: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; suffix?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "h-9 min-w-11 rounded-lg border px-3 font-mono text-sm transition-colors",
              value === opt ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {opt}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

function MinutesCountdown({ minutes, onExpire }: { minutes: number; onExpire: () => void }) {
  const seconds = minutes * 60;
  const [left, setLeft] = React.useState(seconds);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - (Date.now() - start) / 1000);
      setLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onExpire();
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, onExpire]);

  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  const danger = left <= 30;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-sm font-semibold", danger ? "text-negative" : "text-foreground")}>
      <Timer className="h-4 w-4" />
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

function KellyCard() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-surface-2/40">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-4 text-left text-sm font-medium">
        <Sigma className="h-4 w-4 text-accent" /> Kelly Criterion — optimal bet sizing
        <ChevronDown className={cn("ml-auto h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-pop space-y-2 border-t border-border p-4 text-sm text-muted">
          <p>Bet the fraction of your bankroll that maximises long-run growth:</p>
          <div className="rounded-lg bg-surface px-3 py-2 text-center font-mono text-foreground">
            f* = (b·p − q) / b
          </div>
          <ul className="space-y-1">
            <li><span className="font-mono text-foreground">b</span> — decimal net odds (the “b” in b:1)</li>
            <li><span className="font-mono text-foreground">p</span> — true probability of winning</li>
            <li><span className="font-mono text-foreground">q</span> — 1 − p</li>
          </ul>
          <p>If f* ≤ 0 the bet has no edge — skip it.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- board ---------------------------- */

function BoardScreen() {
  const { phase, round, config, bankroll, committed, endGame, resolve } = useBettingStore();
  const available = bankroll - committed();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-base font-semibold">
              Round {round}
              <span className="ml-1.5 text-sm font-normal text-muted">of {config.rounds}</span>
            </span>
            <span className="text-sm text-muted">
              Bankroll <span className="font-mono font-semibold text-foreground">{bankroll}</span>
            </span>
            {phase === "betting" && (
              <span className="text-sm text-muted">
                Available <span className="font-mono font-semibold text-accent">{available}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {phase === "betting" && (
              <MinutesCountdown key={round} minutes={config.roundMinutes} onExpire={resolve} />
            )}
            <Button variant="ghost" size="sm" onClick={endGame}>
              <Flag className="h-4 w-4" /> End game
            </Button>
          </div>
        </CardContent>
      </Card>

      <div key={round} className="animate-round">
        {phase === "betting" ? <BettingBoard /> : <ResultView />}
      </div>
    </div>
  );
}

function BettingBoard() {
  const { board, putOdds, callOdds, resolve } = useBettingStore();
  const cats: Category[] = ["Dice", "Cards", "Coins"];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {cats.map((cat) => {
          const Icon = CAT_ICON[cat];
          const props = board.filter((b) => b.prop.category === cat);
          return (
            <Card key={cat} className="animate-pop">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-accent" /> {cat}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {props.map((bp) => <PropRow key={bp.prop.id} bp={bp} />)}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="animate-pop">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Special bets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <SpecialRow kind="put" label="Put" sub="Wins if your other bets net a loss" b={putOdds.b} />
          <SpecialRow kind="call" label="Call" sub="Wins if your other bets net a profit" b={callOdds.b} />
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={resolve}>
        Resolve round <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StakeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      className="h-9 w-20 rounded-lg border border-border bg-surface-2 px-2 text-center font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function PropRow({ bp }: { bp: BoardProp }) {
  const { bets, placeBet, removeBet } = useBettingStore();
  const taken = bets[bp.prop.id];
  const [stake, setStake] = React.useState("10");

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm leading-snug">{bp.prop.label}</span>
        <span className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wider text-muted">Odds</span>
          <span className="font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">{bp.odds.b.toFixed(2)}:1</span>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {taken ? (
          <div className="flex flex-1 items-center justify-between rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent">
            <span className="font-mono">Taken · {taken.stake}</span>
            <button onClick={() => removeBet(bp.prop.id)} aria-label="Remove bet" className="hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <StakeInput value={stake} onChange={setStake} />
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                const ok = placeBet({ id: bp.prop.id, category: bp.prop.category, label: bp.prop.label, b: bp.odds.b, stake: Number(stake) });
                if (ok) setStake("10");
              }}
            >
              Take
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function SpecialRow({ kind, label, sub, b }: { kind: "put" | "call"; label: string; sub: string; b: number }) {
  const { specials, placeSpecial, removeSpecial } = useBettingStore();
  const taken = specials[kind];
  const [stake, setStake] = React.useState("10");

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <span>
          <span className="text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted">{sub}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wider text-muted">Odds</span>
          <span className="font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">{b.toFixed(2)}:1</span>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {taken ? (
          <div className="flex flex-1 items-center justify-between rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent">
            <span className="font-mono">Taken · {taken.stake}</span>
            <button onClick={() => removeSpecial(kind)} aria-label="Remove bet" className="hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <StakeInput value={stake} onChange={setStake} />
            <Button size="sm" className="flex-1" onClick={() => placeSpecial(kind, Number(stake), b)}>
              Take
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- result --------------------------- */

const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function OutcomeStrip({ outcome, compact = false }: { outcome: RoundOutcome; compact?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <OutcomeTile title="Dice" compact={compact}>
        {outcome.dice.map((d, i) => (
          <span key={i} className={cn("leading-none text-foreground", compact ? "text-4xl" : "text-6xl")}>{DIE_FACES[d]}</span>
        ))}
      </OutcomeTile>
      <OutcomeTile title="Cards" compact={compact}>
        {outcome.cards.map((c, i) => {
          const red = c.suit === "♥" || c.suit === "♦";
          return (
            <span
              key={i}
              className={cn(
                "inline-flex flex-col items-center justify-center rounded-lg border border-zinc-300 bg-white font-bold leading-none shadow-sm",
                compact ? "h-11 w-8 text-sm" : "h-16 w-12 text-xl",
              )}
              style={{ color: red ? "#d4163c" : "#17171d" }}
            >
              <span>{c.rank}</span>
              <span className={compact ? "text-xs" : "text-base"}>{c.suit}</span>
            </span>
          );
        })}
      </OutcomeTile>
      <OutcomeTile title="Coins" compact={compact}>
        {outcome.coins.map((c, i) => (
          <span
            key={i}
            className={cn(
              "grid place-items-center rounded-full border font-mono font-bold",
              compact ? "h-9 w-9 text-xs" : "h-14 w-14 text-base",
              c === "H" ? "border-accent/50 bg-accent/15 text-accent" : "border-border bg-surface-2 text-muted",
            )}
          >
            {c}
          </span>
        ))}
      </OutcomeTile>
    </div>
  );
}

function OutcomeTile({ title, children, compact = false }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface-2/40 text-center", compact ? "p-2.5" : "p-4")}>
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">{title}</div>
      <div className={cn("flex items-center justify-center", compact ? "gap-2" : "gap-3")}>{children}</div>
    </div>
  );
}

function ResultView() {
  const { result, next, round, config } = useBettingStore();
  if (!result) return null;
  const won = result.roundPnl >= 0;
  const isLast = round >= config.rounds;

  return (
    <div className="animate-pop space-y-4">
      <OutcomeStrip outcome={result.outcome} />

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Your bets</CardTitle>
            <span className={cn("font-mono text-base font-semibold", won ? "text-positive" : "text-negative")}>
              Round {formatSigned(result.roundPnl)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.lines.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted">You placed no bets this round.</p>
          ) : (
            result.lines.map((l) => <ResultLine key={l.id} line={l} />)
          )}
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={next}>
        {isLast ? "See final results" : "Next round"} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ResultLine({ line }: { line: ResolvedLine }) {
  const trueProb = line.trueProb;
  const implied = 1 / (line.b + 1);
  const hadEdge = trueProb !== null && implied < trueProb;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm">
      <span className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-full",
        line.voided ? "bg-surface-2 text-muted" : line.won ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative",
      )}>
        {line.voided ? "–" : line.won ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{line.label}</span>
        <span className="text-xs text-muted">
          stake {line.stake} @ {line.b.toFixed(2)}:1
          {trueProb !== null && (
            <>
              {" · "}true {(trueProb * 100).toFixed(0)}% vs implied {(implied * 100).toFixed(0)}%
              {" · "}
              <span className={hadEdge ? "text-positive" : "text-negative"}>{hadEdge ? "+EV" : "−EV"}</span>
            </>
          )}
        </span>
      </span>
      <span className={cn("shrink-0 font-mono font-semibold", line.pnl > 0 && "text-positive", line.pnl < 0 && "text-negative", line.pnl === 0 && "text-muted")}>
        {formatSigned(line.pnl)}
      </span>
    </div>
  );
}

/* --------------------------------- game over ------------------------- */

function GameOver() {
  const { bankroll, peak, history, reset } = useBettingStore();
  useRecordGame();
  const net = bankroll - STARTING_BANKROLL;
  const totalBets = history.reduce((s, r) => s + r.lines.length, 0);
  const wins = history.reduce((s, r) => s + r.lines.filter((l) => !l.voided && l.won).length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="obsidian-glow">
        <CardContent className="space-y-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg">
              <Trophy className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tight">Final bankroll</h2>
            <div className="font-mono text-4xl font-bold">{bankroll}</div>
            <div className={cn("font-mono text-sm font-semibold", net > 0 ? "text-positive" : net < 0 ? "text-negative" : "text-muted")}>
              {formatSigned(net)} net · peak {peak}
            </div>
          </div>

          <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
            <Stat label="Bets placed" value={String(totalBets)} />
            <Stat label="Bets won" value={`${wins}/${totalBets}`} />
            <Stat label="Rounds" value={String(history.length)} />
          </div>

          <div className="flex justify-center">
            <Button size="lg" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Play again
            </Button>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Round-by-round breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.map((r, i) => <RoundBreakdown key={i} index={i} result={r} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-center">
      <div className="font-mono text-lg font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function RoundBreakdown({ index, result }: { index: number; result: RoundResult }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2/30">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm">
        <span className="font-mono text-muted">Round {index + 1}</span>
        <span className="text-xs text-muted">{result.lines.length} bet{result.lines.length === 1 ? "" : "s"}</span>
        <span className={cn("ml-auto font-mono font-semibold", result.roundPnl > 0 && "text-positive", result.roundPnl < 0 && "text-negative", result.roundPnl === 0 && "text-muted")}>
          {formatSigned(result.roundPnl)}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-pop space-y-3 border-t border-border p-3">
          <OutcomeStrip outcome={result.outcome} compact />
          {result.lines.length === 0 ? (
            <p className="text-center text-xs text-muted">No bets placed.</p>
          ) : (
            <div className="space-y-2">
              {result.lines.map((l) => <ResultLine key={l.id} line={l} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
