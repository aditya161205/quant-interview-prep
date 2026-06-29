"use client";

import * as React from "react";
import {
  Play,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  SkipForward,
  Crown,
  Trophy,
  Timer,
  EyeOff,
  Eye,
  Settings2,
  Lock,
  AlertTriangle,
  ArrowLeftRight,
  Flag,
} from "lucide-react";
import {
  useGameStore,
  YOU_INDEX,
  REVEAL_SECONDS,
  WRONG_PNL_PENALTY,
  type Player,
  type RoundRecord,
  type CardSnapshot,
} from "@/store/game-store";
import {
  MIN_SPREAD,
  MAX_SPREAD,
  DEFAULT_CONFIG,
  CONFIG_OPTIONS,
  canAfford,
  type GameConfig,
  type BotTrade,
} from "@/lib/market-game";
import { cn, formatSigned } from "@/lib/utils";
import { useRecordGame } from "@/store/practice-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayingCard } from "@/components/playing-card";

export function MarketGame() {
  const phase = useGameStore((s) => s.phase);

  if (phase === "intro") return <Intro />;
  if (phase === "gameover") return <GameOver />;
  return <Table />;
}

/* ----------------------------------- intro --------------------------- */

function Intro() {
  const start = useGameStore((s) => s.start);
  const savedConfig = useGameStore((s) => s.config);
  const [config, setConfig] = React.useState<GameConfig>(savedConfig ?? DEFAULT_CONFIG);

  const set = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <Card className="obsidian-glow mx-auto max-w-2xl">
      <CardContent className="space-y-7 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg">
            <Crown className="h-7 w-7" />
          </span>
          <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Card Trading Game</h2>
          <p className="max-w-md text-muted">
            The market-maker role rotates each round — quote a tight market when
            it&apos;s your turn, and hunt for edge against the bots when it
            isn&apos;t. Cards flash for {REVEAL_SECONDS}s, then you compute the
            settlement and PnL yourself. Everyone starts at 500.
          </p>
        </div>

        <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4 text-accent" /> Game settings
          </div>
          <Segmented label="Cards per round" options={CONFIG_OPTIONS.numCards} value={config.numCards} onChange={(v) => set("numCards", v)} />
          <Segmented label="Number of rounds" options={CONFIG_OPTIONS.totalRounds} value={config.totalRounds} onChange={(v) => set("totalRounds", v)} />
          <Segmented label="Market-making timer" options={CONFIG_OPTIONS.makeSeconds} value={config.makeSeconds} onChange={(v) => set("makeSeconds", v)} suffix="s" />
          <Segmented label="Trading timer" options={CONFIG_OPTIONS.tradeSeconds} value={config.tradeSeconds} onChange={(v) => set("tradeSeconds", v)} suffix="s" />
        </div>

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
  label,
  options,
  value,
  onChange,
  suffix = "",
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "h-9 min-w-11 rounded-xl border px-3 font-mono text-sm transition-colors",
              value === opt
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {opt}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- countdown --------------------------- */

function Countdown({
  seconds,
  onExpire,
  label = "Time to act",
}: {
  seconds: number;
  onExpire: () => void;
  label?: string;
}) {
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
    }, 100);
    return () => clearInterval(id);
  }, [seconds, onExpire]);

  const pct = Math.max(0, (left / seconds) * 100);
  const danger = left <= seconds * 0.35;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <Timer className="h-3.5 w-3.5" /> {label}
        </span>
        <span className={cn("font-mono font-semibold", danger ? "text-negative" : "text-foreground")}>
          {Math.ceil(left)}s
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", danger ? "bg-negative" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ----------------------------------- table --------------------------- */

function Table() {
  const { players, round, mmIndex, hand, quote, phase, dealId, config, result } = useGameStore();
  const youAreMaker = mmIndex === YOU_INDEX;
  const makerName = players[mmIndex].isYou ? "Your" : `${players[mmIndex].name}'s`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {players.map((p, i) => (
          <PlayerCard key={p.id} player={p} isMaker={i === mmIndex} quote={i === mmIndex ? quote : null} />
        ))}
      </div>

      <Card key={round} className="obsidian-glow animate-round">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Round {round}
              <span className="ml-2 text-sm font-normal text-muted">of {config.totalRounds}</span>
            </CardTitle>
            <Badge tone={youAreMaker ? "accent" : "outline"}>
              {youAreMaker ? "You are the market maker" : `${players[mmIndex].name} is making`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cards */}
          <div
            key={dealId}
            className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-surface-2/40 py-4"
          >
            {hand?.cards.map((c, i) => (
              <PlayingCard key={`${dealId}-${i}`} card={c} delayMs={i * 100} />
            ))}
          </div>

          {/* Quote + your trade — one clearly visible section below the cards */}
          {quote && <QuoteBar quote={quote} makerName={makerName} result={result} />}

          {phase === "make" && <MakeMarket />}
          {phase === "trade" && <TradePhase />}
          {phase === "reveal" && <RevealPanel />}
          {phase === "settle" && <SettlePanel />}
          {phase === "result" && <ResultPanel />}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <EndGameButton />
        <ResetButton />
      </div>
    </div>
  );
}

function QuoteBar({
  quote,
  makerName,
  result,
}: {
  quote: { bid: number; ask: number };
  makerName: string;
  result: ReturnType<typeof useGameStore.getState>["result"];
}) {
  const showTrade = !!result && result.role === "trader" && !!result.action;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          {makerName} market
        </span>
        <div className="flex items-center gap-2 font-mono text-lg">
          <span className="rounded-md bg-positive/10 px-3 py-1 font-semibold text-positive">bid {quote.bid}</span>
          <span className="text-muted">@</span>
          <span className="rounded-md bg-negative/10 px-3 py-1 font-semibold text-negative">ask {quote.ask}</span>
        </div>
      </div>

      {showTrade && (
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border pt-2.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Your trade</span>
          {result.action === "skip" ? (
            <span className="inline-flex items-center gap-1.5 text-base font-semibold text-muted">
              <SkipForward className="h-4 w-4" /> Skipped — no trade
            </span>
          ) : (
            // Neutral yellow on purpose — colour/arrows would hint profit vs loss.
            <span className="inline-flex items-center gap-1.5 text-base font-semibold text-amber-600 dark:text-amber-400">
              <ArrowLeftRight className="h-4 w-4" />
              {result.action === "buy" ? "Bought" : "Sold"} {result.qty} @{" "}
              {result.action === "buy" ? quote.ask : quote.bid}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  isMaker,
  quote,
}: {
  player: Player;
  isMaker: boolean;
  quote: { bid: number; ask: number } | null;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        player.isYou
          ? "border-accent/70 bg-accent/[0.07] ring-1 ring-accent/30"
          : isMaker
            ? "border-accent/40 bg-surface"
            : "border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-[15px] font-semibold", player.isYou && "text-accent")}>
          {player.name}
        </span>
        <Badge tone={player.isYou ? "accent" : "default"}>{player.isYou ? "You" : "Bot"}</Badge>
      </div>

      {isMaker ? (
        <div className="mt-2">
          <span className="inline-flex h-5 items-center rounded-full bg-accent/15 px-2 text-[11px] font-medium text-accent animate-pulse-badge">
            <Crown className="mr-1 h-3 w-3" /> Maker
          </span>
          {quote ? (
            <div className="mt-2 flex gap-2 font-mono text-sm">
              <span className="rounded-md bg-positive/10 px-2 py-0.5 text-positive">bid {quote.bid}</span>
              <span className="rounded-md bg-negative/10 px-2 py-0.5 text-negative">ask {quote.ask}</span>
            </div>
          ) : (
            <div className="mt-2 text-[13px] text-muted">quoting…</div>
          )}
        </div>
      ) : (
        <div className="mt-2 h-5 text-[13px] text-muted">Trader</div>
      )}

      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2">
        <span className="text-xs text-muted">Score</span>
        <span className="font-mono text-lg font-semibold">{player.score}</span>
      </div>
    </div>
  );
}

/* ------------------------------- make market ------------------------- */

function MakeMarket() {
  const submitMarket = useGameStore((s) => s.submitMarket);
  const timeoutRound = useGameStore((s) => s.timeoutRound);
  const makeSeconds = useGameStore((s) => s.config.makeSeconds);
  const [bid, setBid] = React.useState("");
  const [ask, setAsk] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const b = Number(bid);
    const a = Number(ask);
    if (bid === "" || ask === "" || Number.isNaN(b) || Number.isNaN(a)) {
      setError("Enter a number for both bid and ask.");
      return;
    }
    const spread = a - b;
    if (spread < MIN_SPREAD) return setError(`Spread too tight — minimum is ${MIN_SPREAD}.`);
    if (spread > MAX_SPREAD) return setError(`Spread too wide — maximum is ${MAX_SPREAD}.`);
    setError(null);
    submitMarket(b, a);
  };

  return (
    <form onSubmit={submit} className="animate-pop space-y-4">
      <Countdown seconds={makeSeconds} onExpire={timeoutRound} />
      <div className="rounded-xl border border-border bg-surface-2/50 px-4 py-3 text-sm text-foreground">
        You&apos;re the market maker. Quote a bid &amp; ask on the total sum — the
        bots will trade against you and your PnL is settled automatically.
      </div>
      <div className="flex justify-center">
        <Badge tone="outline">Min spread {MIN_SPREAD} · Max spread {MAX_SPREAD}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PriceInput label="Your bid" value={bid} onChange={setBid} placeholder="e.g. 20" />
        <PriceInput label="Your ask" value={ask} onChange={setAsk} placeholder="e.g. 24" />
      </div>
      {error && <p className="text-center text-sm text-negative">{error}</p>}
      <Button type="submit" size="lg" className="w-full">
        Submit market <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

/* --------------------------------- trade ----------------------------- */

const MAX_SIZE = 20;

function TradePhase() {
  const { trade, quote, timeoutRound } = useGameStore();
  const tradeSeconds = useGameStore((s) => s.config.tradeSeconds);
  const numCards = useGameStore((s) => s.config.numCards);
  const balance = useGameStore((s) => s.players[YOU_INDEX].score);
  const [qty, setQty] = React.useState(5);

  if (!quote) return null;

  const canBuy = canAfford("buy", quote, qty, numCards, balance);
  const canSell = canAfford("sell", quote, qty, numCards, balance);

  return (
    <div className="animate-pop space-y-4">
      <Countdown seconds={tradeSeconds} onExpire={timeoutRound} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2/50 px-4 py-3 text-sm text-foreground">
        <span>Lift the offer if it&apos;s cheap, hit the bid if it&apos;s rich, or skip.</span>
        <span className="font-mono text-muted">balance {balance}</span>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Order size</span>
          <span className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-sm">Size: {qty}</span>
        </div>
        <input
          type="range"
          min={1}
          max={MAX_SIZE}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{ accentColor: "var(--accent)" }}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Button variant="outline" disabled={!canBuy} className="h-auto flex-col gap-0 py-2.5 border-positive/40 text-positive hover:bg-positive/10" onClick={() => trade("buy", qty)}>
          <span className="flex items-center gap-1.5 font-semibold">Buy <TrendingUp className="h-4 w-4" /></span>
          <span className="text-[11px] font-normal text-muted">at {quote.ask}</span>
        </Button>
        <Button variant="outline" disabled={!canSell} className="h-auto flex-col gap-0 py-2.5 border-negative/40 text-negative hover:bg-negative/10" onClick={() => trade("sell", qty)}>
          <span className="flex items-center gap-1.5 font-semibold">Sell <TrendingDown className="h-4 w-4" /></span>
          <span className="text-[11px] font-normal text-muted">at {quote.bid}</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-0 py-2.5" onClick={() => trade("skip", qty)}>
          <span className="flex items-center gap-1.5 font-semibold">Skip <SkipForward className="h-4 w-4" /></span>
          <span className="text-[11px] font-normal text-muted">no trade</span>
        </Button>
      </div>

      {(!canBuy || !canSell) && (
        <p className="text-center text-xs text-muted">
          Greyed-out actions would risk more than your balance of {balance} at size {qty}.
        </p>
      )}
    </div>
  );
}

/* --------------------------- reveal (memorise) ----------------------- */

function RevealPanel() {
  const { finishReveal, result } = useGameStore();
  if (!result) return null;

  return (
    <div className="animate-pop space-y-4">
      <Countdown seconds={REVEAL_SECONDS} onExpire={finishReveal} label="Memorise — hiding in" />
      <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        <Eye className="h-4 w-4 shrink-0 text-accent" />
        <span>
          Cards are face-up — <strong className="text-foreground">memorise them</strong>.
          You&apos;ll work out the settlement &amp; PnL from memory next.
        </span>
      </div>
      <Button variant="outline" className="w-full" onClick={finishReveal}>
        <EyeOff className="h-4 w-4" /> Hide now &amp; continue
      </Button>
    </div>
  );
}

/* ------------------------------- settle ------------------------------ */

function SettlePanel() {
  const { submitSettlement, result } = useGameStore();
  const [settlement, setSettlement] = React.useState("");
  const [pnl, setPnl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  if (!result) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = Number(settlement);
    const p = Number(pnl);
    if (settlement === "" || pnl === "" || Number.isNaN(s) || Number.isNaN(p)) {
      setError("Enter both the settlement price and your P/L.");
      return;
    }
    setError(null);
    submitSettlement(s, p);
  };

  return (
    <form onSubmit={submit} className="animate-pop space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-4 py-3 text-sm">
        <EyeOff className="h-4 w-4 shrink-0 text-muted" />
        <span>
          Cards hidden. From memory: what was the{" "}
          <strong className="text-foreground">settlement</strong> (sum of all
          cards) and your <strong className="text-foreground">P/L</strong>? A
          wrong PnL costs {WRONG_PNL_PENALTY} points.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PriceInput label="Settlement price" value={settlement} onChange={setSettlement} placeholder="sum of cards" />
        <PriceInput label="Your P/L" value={pnl} onChange={setPnl} placeholder="compute it" />
      </div>
      {error && <p className="text-center text-sm text-negative">{error}</p>}
      <Button type="submit" size="lg" className="w-full">
        <Lock className="h-4 w-4" /> Lock in
      </Button>
    </form>
  );
}

/* -------------------------------- result ----------------------------- */

function ResultPanel() {
  const { result, next, config, round } = useGameStore();
  if (!result) return null;

  const final = result.finalPnl ?? 0;
  const won = final >= 0;
  const isLast = round >= config.totalRounds;

  return (
    <div className="animate-pop space-y-4">
      <div className={cn("rounded-xl border p-4", won ? "border-positive/30 bg-positive/5" : "border-negative/30 bg-negative/5")}>
        <div className="flex items-center gap-2">
          {won ? <TrendingUp className="h-5 w-5 text-positive" /> : <TrendingDown className="h-5 w-5 text-negative" />}
          <span className="font-semibold">Round PnL {formatSigned(final)}</span>
          {result.timedOut && <Badge tone="outline" className="ml-auto">Skipped — timed out</Badge>}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <Stat label="Settlement" value={String(result.trueSum)} />
          {result.role === "maker" ? (
            <Stat label="Auto PnL (bot flow)" value={formatSigned(result.actualPnl)} />
          ) : (
            !result.timedOut && <Stat label="Trade PnL" value={formatSigned(result.actualPnl)} />
          )}
          {result.role === "trader" && !result.timedOut && (
            <Stat
              label="Your settlement guess"
              value={String(result.guessedSettlement ?? "—")}
              ok={result.guessedSettlement === result.trueSum}
            />
          )}
        </dl>

        {result.role === "trader" && !result.timedOut && (
          <div className="mt-3 text-sm">
            {result.penalized ? (
              <p className="flex items-center gap-2 text-negative">
                <AlertTriangle className="h-4 w-4" />
                Your PnL guess {formatSigned(result.guessedPnl ?? 0)} was wrong (actual{" "}
                {formatSigned(result.actualPnl)}) — {WRONG_PNL_PENALTY}-point penalty applied.
              </p>
            ) : (
              <p className="text-positive">Correct PnL — no penalty. Nicely counted.</p>
            )}
          </div>
        )}

        {result.role === "maker" && !result.timedOut && (
          <BotTrades trades={result.botTrades ?? []} />
        )}
      </div>

      <Button size="lg" className="w-full" onClick={next}>
        {isLast ? "See final standings" : "Next round"} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BotTrades({ trades }: { trades: BotTrade[] }) {
  const players = useGameStore((s) => s.players);
  if (trades.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider text-muted">
        How the bots traded your market
      </div>
      {trades.map((t) => {
        const name = players[t.player]?.name ?? `Player ${t.player + 1}`;
        if (t.action === "skip") {
          return (
            <div key={t.player} className="flex items-center justify-between text-sm">
              <span className="text-muted">{name} passed — no edge</span>
              <span className="font-mono text-muted">$0.00</span>
            </div>
          );
        }
        const verb = t.action === "buy" ? "lifted your offer" : "hit your bid";
        return (
          <div key={t.player} className="flex items-center justify-between text-sm">
            <span>
              <span className="font-medium">{name}</span>{" "}
              <span className="text-muted">
                {verb} — {t.action === "buy" ? "bought" : "sold"} {t.qty} @ {t.price}
              </span>
            </span>
            <span className={cn("font-mono font-medium", t.makerDelta >= 0 ? "text-positive" : "text-negative")}>
              {formatSigned(t.makerDelta)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div
        className={cn(
          "font-mono text-base font-semibold",
          ok === true && "text-positive",
          ok === false && "text-negative",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------- game over --------------------------- */

function GameOver() {
  const { players, history, reset } = useGameStore();
  useRecordGame();
  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="obsidian-glow">
        <CardContent className="space-y-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg">
              <Trophy className="h-7 w-7" />
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tight">Final standings</h2>
          </div>

          <ol className="mx-auto max-w-md space-y-2">
            {ranked.map((p, i) => (
              <li
                key={p.id}
                className={cn("flex items-center justify-between rounded-xl border px-4 py-3", p.isYou ? "border-accent/50 bg-accent/5" : "border-border bg-surface-2/40")}
              >
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted">#{i + 1}</span>
                  <span className="font-medium">{p.name}</span>
                  {p.isYou && <Badge tone="accent">You</Badge>}
                </span>
                <span className="font-mono font-semibold">{p.score}</span>
              </li>
            ))}
          </ol>

          <div className="flex justify-center">
            <Button size="lg" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Play again
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round-by-round recap</CardTitle>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <EyeOff className="h-3.5 w-3.5" /> Purple cards were face-down when you decided.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.map((r) => (
            <RecapRow key={r.round} record={r} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CardChip({ card }: { card: CardSnapshot }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <span
      className={cn(
        "inline-flex h-9 w-7 flex-col items-center justify-center rounded-md border bg-white text-[13px] font-bold leading-none",
        card.wasFaceUp ? "border-zinc-300" : "border-accent ring-1 ring-accent/40",
      )}
      style={{ color: red ? "#d4163c" : "#17171d" }}
      title={card.wasFaceUp ? "Was face-up" : "Was face-down"}
    >
      <span>{card.rank}</span>
      <span className="text-[11px]">{card.suit}</span>
    </span>
  );
}

function RecapRow({ record }: { record: RoundRecord }) {
  const { round, role, cards, quote, action, qty, trueSum, ev, finalPnl, guessedPnl, penalized, timedOut } = record;

  const detail = timedOut
    ? "timed out — skipped"
    : role === "maker"
      ? `you quoted ${quote?.bid}–${quote?.ask}`
      : action === "skip"
        ? `skipped (quote ${quote?.bid}–${quote?.ask})`
        : `${action} ${qty} @ ${action === "buy" ? quote?.ask : quote?.bid}`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5 text-sm">
      <span className="font-mono text-muted">R{round}</span>
      <Badge tone={role === "maker" ? "accent" : "outline"}>{role === "maker" ? "Maker" : "Trader"}</Badge>
      <div className="flex gap-1.5">
        {cards.map((c, i) => (
          <CardChip key={i} card={c} />
        ))}
      </div>
      <span className="text-muted">{detail}</span>
      <span className="ml-auto flex items-center gap-3 font-mono">
        <span className="text-muted">fair {ev.toFixed(0)}</span>
        <span className="text-foreground">true {trueSum}</span>
        {role === "trader" && !timedOut && (
          <span className={cn(penalized ? "text-negative" : "text-muted")}>
            guess {formatSigned(guessedPnl ?? 0)}
            {penalized && " ✗"}
          </span>
        )}
        <span className={cn("font-semibold", finalPnl > 0 && "text-positive", finalPnl < 0 && "text-negative")}>
          {formatSigned(finalPnl)}
        </span>
      </span>
    </div>
  );
}

function ResetButton() {
  const reset = useGameStore((s) => s.reset);
  return (
    <Button variant="ghost" size="sm" onClick={reset}>
      <RotateCcw className="h-4 w-4" /> Restart
    </Button>
  );
}

function EndGameButton() {
  const endGame = useGameStore((s) => s.endGame);
  return (
    <Button variant="ghost" size="sm" onClick={endGame}>
      <Flag className="h-4 w-4" /> End game
    </Button>
  );
}
