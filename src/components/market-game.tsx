"use client";

import * as React from "react";
import { RotateCcw, ArrowRight, SkipForward, EyeOff, Eye, Lock, AlertTriangle, ArrowLeftRight, Flag } from "lucide-react";
import {
  useGameStore,
  YOU_INDEX,
  REVEAL_SECONDS,
  WRONG_PNL_PENALTY,
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
import { useHideRulesWhile } from "@/components/how-to-play";
import { PlayingCard } from "@/components/playing-card";
import {
  ActionPlate,
  FinalBand,
  Note,
  Panel,
  PriceField,
  QuietButton,
  QuotePlates,
  Scoreboard,
  Segmented,
  Standings,
  Stat,
  Ticket,
  Timer,
} from "@/components/pit/game-kit";

export function MarketGame() {
  const phase = useGameStore((s) => s.phase);
  useHideRulesWhile(phase !== "intro" && phase !== "gameover");

  return (
    <>
      <Announcer />
      {phase === "intro" ? <Intro /> : phase === "gameover" ? <GameOver /> : <Table />}
    </>
  );
}

/* --------------------------------- announcer ------------------------- */

/**
 * One polite live region for the whole game. Only the round verdict and the
 * final standings are spoken — the board and score cards stay silent so a
 * screen reader isn't re-reading four player panels on every tick.
 */
function Announcer() {
  const { phase, round, result, players } = useGameStore();

  let message = "";
  if (phase === "result" && result) {
    const parts = [
      `Round ${round} settled at ${result.trueSum}.`,
      `Round PnL ${formatSigned(result.finalPnl ?? 0)}.`,
    ];
    if (result.timedOut) parts.push("Timed out — round skipped.");
    else if (result.penalized) parts.push(`Wrong PnL guess, ${WRONG_PNL_PENALTY}-point penalty.`);
    message = parts.join(" ");
  } else if (phase === "gameover") {
    const ranked = [...players].sort((a, b) => b.score - a.score);
    const place = ranked.findIndex((p) => p.isYou) + 1;
    message = `Game over. You finished ${place} of ${ranked.length} on ${players[YOU_INDEX].score} points.`;
  }

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

/* ----------------------------------- intro --------------------------- */

function Intro() {
  const start = useGameStore((s) => s.start);
  const savedConfig = useGameStore((s) => s.config);
  const [config, setConfig] = React.useState<GameConfig>(savedConfig ?? DEFAULT_CONFIG);

  const set = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));

  return (
    <Ticket onStart={() => start(config)}>
      <Segmented label="Cards per round" options={CONFIG_OPTIONS.numCards} value={config.numCards} onChange={(v) => set("numCards", v)} />
      <Segmented label="Rounds" options={CONFIG_OPTIONS.totalRounds} value={config.totalRounds} onChange={(v) => set("totalRounds", v)} />
      <Segmented label="Quote timer" options={CONFIG_OPTIONS.makeSeconds} value={config.makeSeconds} onChange={(v) => set("makeSeconds", v)} suffix="s" />
      <Segmented label="Trade timer" options={CONFIG_OPTIONS.tradeSeconds} value={config.tradeSeconds} onChange={(v) => set("tradeSeconds", v)} suffix="s" />
    </Ticket>
  );
}

/* ----------------------------------- table --------------------------- */

function Table() {
  const { players, round, mmIndex, hand, quote, phase, dealId, config, result } = useGameStore();
  const youAreMaker = mmIndex === YOU_INDEX;
  const makerName = players[mmIndex].isYou ? "Your" : `${players[mmIndex].name}'s`;

  return (
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Round", value: `${round}/${config.totalRounds}` },
          ...players.map((p, i) => ({
            label: `${p.isYou ? "You" : p.name}${i === mmIndex ? " · maker" : ""}`,
            value: p.score,
            tone: i === mmIndex ? ("hot" as const) : undefined,
          })),
        ]}
      />

      <div key={round} className="animate-round grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="overflow-hidden rounded-2xl bg-jacket text-jacket-ink shadow-(--shadow-card)">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
            <h2 className="font-xx text-2xl font-black uppercase">The pit</h2>
            <span className="font-x rounded-[4px] bg-jacket-ink px-2.5 py-1 text-xs font-extrabold uppercase tracking-[0.06em] text-jacket">
              {youAreMaker ? "You are making the market" : `${players[mmIndex].name} is making`}
            </span>
          </div>
          <div key={dealId} className="flex min-h-[14rem] flex-wrap items-center justify-center gap-3 px-6 py-8">
            {hand?.cards.map((c, i) => (
              <PlayingCard key={`${dealId}-${i}`} card={c} delayMs={i * 100} />
            ))}
          </div>
          {quote && <QuoteBar quote={quote} makerName={makerName} result={result} />}
        </section>

        <Panel title={PHASE_TITLE[phase] ?? "Trade"}>
          {phase === "make" && <MakeMarket />}
          {phase === "trade" && <TradePhase />}
          {phase === "reveal" && <RevealPanel />}
          {phase === "settle" && <SettlePanel />}
          {phase === "result" && <ResultPanel />}
        </Panel>
      </div>

      <div className="flex justify-end gap-1">
        <EndGameButton />
        <ResetButton />
      </div>
    </div>
  );
}

const PHASE_TITLE: Record<string, string> = {
  make: "Make the market",
  trade: "Your trade",
  reveal: "Memorise",
  settle: "Settle from memory",
  result: "Round result",
};

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
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-black/20 px-6 py-4">
      <span className="text-xs font-bold uppercase tracking-[0.1em] opacity-85">{makerName} market</span>
      <QuotePlates bid={quote.bid} ask={quote.ask} />
      {showTrade && (
        <span className="font-x inline-flex items-center gap-1.5 text-sm font-extrabold">
          {result.action === "skip" ? (
            <>
              <SkipForward className="h-4 w-4" /> You skipped
            </>
          ) : (
            // Neutral on purpose: colour would hint at profit or loss before settlement.
            <>
              <ArrowLeftRight className="h-4 w-4" />
              You {result.action === "buy" ? "bought" : "sold"} {result.qty} @ {result.action === "buy" ? quote.ask : quote.bid}
            </>
          )}
        </span>
      )}
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
      <Timer seconds={makeSeconds} onExpire={timeoutRound} />
      <Note>
        Quote a bid and ask on the total of all the cards. The bots trade against you and your P&amp;L settles
        automatically. Spread {MIN_SPREAD} to {MAX_SPREAD}.
      </Note>
      <div className="grid grid-cols-2 gap-3">
        <PriceField label="Your bid" value={bid} onChange={setBid} placeholder="e.g. 20" />
        <PriceField label="Your ask" value={ask} onChange={setAsk} placeholder="e.g. 24" />
      </div>
      {error && <p className="text-sm font-semibold text-negative">{error}</p>}
      <ActionPlate type="submit" tone="jacket" label="Submit market" icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </form>
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
    <div className="animate-pop space-y-5">
      <Timer seconds={tradeSeconds} onExpire={timeoutRound} />
      <Note>Lift the offer if it&apos;s cheap, hit the bid if it&apos;s rich, or skip.</Note>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-x text-xs font-extrabold uppercase tracking-[0.08em] text-muted">Size</span>
          <span className="font-xx text-2xl font-black tabular-nums">{qty}</span>
        </div>
        <input
          type="range"
          min={1}
          max={MAX_SIZE}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{ accentColor: "var(--jacket)" }}
          className="w-full"
          aria-label="Order size"
        />
        <p className="mt-1 text-xs text-muted">Balance {balance}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ActionPlate tone="buy" disabled={!canBuy} onClick={() => trade("buy", qty)} label="Buy" sub={`at ${quote.ask}`} />
        <ActionPlate tone="sell" disabled={!canSell} onClick={() => trade("sell", qty)} label="Sell" sub={`at ${quote.bid}`} />
        <ActionPlate tone="neutral" onClick={() => trade("skip", qty)} label="Skip" sub="no trade" />
      </div>

      {(!canBuy || !canSell) && (
        <p className="text-xs text-muted">Greyed-out trades would risk more than your balance of {balance} at size {qty}.</p>
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
      <Timer seconds={REVEAL_SECONDS} onExpire={finishReveal} label="Hiding in" />
      <Note tone="warn" icon={<Eye className="h-4 w-4" />}>
        Every card is face-up. <strong>Memorise them</strong>: you&apos;ll work out the settlement and your P&amp;L
        from memory next.
      </Note>
      <ActionPlate tone="neutral" onClick={finishReveal} label="Hide now" icon={<EyeOff className="h-5 w-5" />} className="w-full" />
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
      <Note icon={<EyeOff className="h-4 w-4" />}>
        From memory: the <strong>settlement</strong> (the sum of every card) and your <strong>P/L</strong>. A wrong
        P/L costs {WRONG_PNL_PENALTY} points.
      </Note>
      <div className="grid grid-cols-2 gap-3">
        <PriceField label="Settlement" value={settlement} onChange={setSettlement} placeholder="sum" />
        <PriceField label="Your P/L" value={pnl} onChange={setPnl} placeholder="P/L" />
      </div>
      {error && <p className="text-sm font-semibold text-negative">{error}</p>}
      <ActionPlate type="submit" tone="jacket" label="Lock in" icon={<Lock className="h-5 w-5" />} className="w-full" />
    </form>
  );
}

/* -------------------------------- result ----------------------------- */

function ResultPanel() {
  const { result, next, config, round } = useGameStore();
  if (!result) return null;

  const final = result.finalPnl ?? 0;
  const isLast = round >= config.totalRounds;

  return (
    <div className="animate-pop space-y-4">
      <div className={cn("rounded-[8px] px-5 py-4 text-white", final >= 0 ? "bg-positive" : "bg-negative")}>
        <div className="text-xs font-bold uppercase tracking-[0.1em] opacity-85">Round P&amp;L</div>
        <div className="font-xx text-[2.6rem] font-black leading-none tabular-nums">{formatSigned(final)}</div>
        {result.timedOut && <div className="mt-1 text-sm font-semibold">Timed out: round skipped</div>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Settlement" value={String(result.trueSum)} />
        {result.role === "maker" ? (
          <Stat label="Bot-flow P&L" value={formatSigned(result.actualPnl)} />
        ) : (
          !result.timedOut && <Stat label="Trade P&L" value={formatSigned(result.actualPnl)} />
        )}
        {result.role === "trader" && !result.timedOut && (
          <Stat
            label="Your settlement"
            value={String(result.guessedSettlement ?? "—")}
            ok={result.guessedSettlement === result.trueSum}
          />
        )}
      </div>

      {result.role === "trader" && !result.timedOut &&
        (result.penalized ? (
          <Note tone="bad" icon={<AlertTriangle className="h-4 w-4 text-negative" />}>
            Your P/L {formatSigned(result.guessedPnl ?? 0)} was wrong (actual {formatSigned(result.actualPnl)}):{" "}
            {WRONG_PNL_PENALTY}-point penalty.
          </Note>
        ) : (
          <Note tone="good">Correct P/L, no penalty. Nicely counted.</Note>
        ))}

      {result.role === "maker" && !result.timedOut && <BotTrades trades={result.botTrades ?? []} />}

      <ActionPlate
        tone="jacket"
        onClick={next}
        label={isLast ? "Final standings" : "Next round"}
        icon={<ArrowRight className="h-5 w-5" />}
        className="w-full"
      />
    </div>
  );
}

function BotTrades({ trades }: { trades: BotTrade[] }) {
  const players = useGameStore((s) => s.players);
  if (trades.length === 0) return null;

  return (
    <div>
      <div className="font-x mb-1 text-xs font-extrabold uppercase tracking-[0.08em] text-muted">How the bots traded you</div>
      <ul className="divide-y divide-border">
        {trades.map((t) => {
          const name = players[t.player]?.name ?? `Player ${t.player + 1}`;
          return (
            <li key={t.player} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-bold">{name}</span>{" "}
                <span className="text-muted">
                  {t.action === "skip"
                    ? "passed"
                    : `${t.action === "buy" ? "lifted your offer" : "hit your bid"}: ${t.qty} @ ${t.price}`}
                </span>
              </span>
              <span className={cn("font-x font-black tabular-nums", t.makerDelta > 0 && "text-positive", t.makerDelta < 0 && "text-negative")}>
                {formatSigned(t.makerDelta)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------- game over --------------------------- */

function GameOver() {
  const { players, history, reset } = useGameStore();
  useRecordGame();
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const place = ranked.findIndex((p) => p.isYou) + 1;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <FinalBand
        title="Final standings"
        figure={`#${place}`}
        figureLabel={`of ${ranked.length}`}
        actions={
          <ActionPlate tone="jacket" onClick={reset} label="Play again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />
        }
      >
        <Standings rows={ranked.map((p) => ({ name: p.name, score: p.score, you: p.isYou }))} />
      </FinalBand>

      <Panel title="Round by round" meta={<span className="text-xs text-muted">Cards with a jacket rim were face-down when you decided.</span>}>
        <ol className="divide-y divide-border">
          {history.map((r) => (
            <RecapRow key={r.round} record={r} />
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function CardChip({ card }: { card: CardSnapshot }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <span
      className={cn(
        "inline-flex h-9 w-7 flex-col items-center justify-center rounded-[4px] bg-white text-[0.8125rem] font-bold leading-none",
        card.wasFaceUp ? "border border-zinc-300" : "border-2 border-jacket",
      )}
      style={{ color: red ? "#d4163c" : "#17171d" }}
      title={card.wasFaceUp ? "Was face-up" : "Was face-down"}
    >
      <span>{card.rank}</span>
      <span className="text-2xs">{card.suit}</span>
    </span>
  );
}

function RecapRow({ record }: { record: RoundRecord }) {
  const { round, role, cards, quote, action, qty, trueSum, ev, finalPnl, guessedPnl, penalized, timedOut } = record;

  const detail = timedOut
    ? "timed out"
    : role === "maker"
      ? `quoted ${quote?.bid}–${quote?.ask}`
      : action === "skip"
        ? `skipped ${quote?.bid}–${quote?.ask}`
        : `${action} ${qty} @ ${action === "buy" ? quote?.ask : quote?.bid}`;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
      <span className="font-xx grid h-9 w-11 place-items-center rounded-[4px] bg-surface-2 font-black">R{round}</span>
      <span className={cn("font-x rounded-[3px] px-2 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.06em]", role === "maker" ? "bg-jacket text-jacket-ink" : "bg-surface-2")}>
        {role === "maker" ? "Maker" : "Trader"}
      </span>
      <div className="flex gap-1">
        {cards.map((c, i) => (
          <CardChip key={i} card={c} />
        ))}
      </div>
      <span className="text-muted">{detail}</span>
      <span className="ml-auto flex items-center gap-4 tabular-nums">
        <span className="text-muted">fair {ev.toFixed(0)}</span>
        <span>true {trueSum}</span>
        {role === "trader" && !timedOut && (
          <span className={cn(penalized ? "text-negative" : "text-muted")}>
            guess {formatSigned(guessedPnl ?? 0)}
            {penalized && " ✗"}
          </span>
        )}
        <span className={cn("font-x font-black", finalPnl > 0 && "text-positive", finalPnl < 0 && "text-negative")}>{formatSigned(finalPnl)}</span>
      </span>
    </li>
  );
}

function ResetButton() {
  const reset = useGameStore((s) => s.reset);
  return (
    <QuietButton onClick={reset}>
      <RotateCcw className="h-4 w-4" /> Restart
    </QuietButton>
  );
}

function EndGameButton() {
  const endGame = useGameStore((s) => s.endGame);
  return (
    <QuietButton onClick={endGame}>
      <Flag className="h-4 w-4" /> End game
    </QuietButton>
  );
}
