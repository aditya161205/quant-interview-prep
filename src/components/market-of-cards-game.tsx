"use client";

import * as React from "react";
import { RotateCcw, ArrowRight, Flag, Check, Minus } from "lucide-react";
import {
  useMocStore,
  playerPnl,
  TOTAL_ROUNDS,
  DEFAULT_MOC_CONFIG,
  MOC_OPTIONS,
  type MocConfig,
  type Player,
} from "@/store/market-of-cards-store";
import {
  isRed, sumValue, quickTotalEV, exactTotalEV, TABLE_MID,
  type Card,
} from "@/lib/market-of-cards";
import { cn, formatSigned } from "@/lib/utils";
import { useRecordGame } from "@/store/practice-store";
import { useHideRulesWhile } from "@/components/how-to-play";
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
  Ticket,
  Timer,
  ToggleRow,
} from "@/components/pit/game-kit";

export function MarketOfCardsGame() {
  const phase = useMocStore((s) => s.phase);
  useHideRulesWhile(phase !== "intro" && phase !== "gameover");

  return (
    <>
      <Announcer />
      {phase === "intro" ? <Intro /> : phase === "gameover" ? <GameOver /> : <GameScreen />}
    </>
  );
}

/* --------------------------------- announcer ------------------------- */

/**
 * One polite live region for the whole game. It speaks how the AIs traded your
 * market and the final settlement — the felt, the game log and the trade log
 * stay silent so a screen reader isn't re-reading 11 cards every round.
 */
function Announcer() {
  const { phase, round, reactions, trades, trueSum } = useMocStore();

  let message = "";
  if (phase === "reactions") {
    const acted = reactions.filter((r) => r.action !== "passed");
    message =
      acted.length === 0
        ? `Round ${round}: every AI passed on your market — no edge.`
        : `Round ${round}: ${acted.map((r) => `${r.name} ${r.action} at ${r.price}`).join(", ")}.`;
  } else if (phase === "gameover") {
    message = `Settled. The 11 cards summed to ${trueSum}. Your PnL ${formatSigned(playerPnl(trades, trueSum)[0])}.`;
  }

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

/* ---------------------------------- cards ---------------------------- */

function MiniCard({ card }: { card: Card }) {
  if (!card.faceUp) {
    return (
      <div className="grid h-[6.5rem] w-[4.5rem] shrink-0 place-items-center rounded-[6px] border-4 border-white bg-[#1a1300] shadow-(--shadow-raised)">
        <span className="font-xx text-xs font-black text-gold">QP</span>
      </div>
    );
  }
  const ink = isRed(card.suit) ? "#d4163c" : "#17171d";
  return (
    <div className="relative h-[6.5rem] w-[4.5rem] shrink-0 rounded-[6px] border border-zinc-300 bg-white shadow-(--shadow-raised)" style={{ color: ink }}>
      <span className="absolute left-1.5 top-1 text-base font-bold leading-none">{card.rank}</span>
      <span className="absolute left-1.5 top-[1.375rem] text-xs leading-none">{card.suit}</span>
      <span className="absolute inset-0 grid place-items-center text-4xl">{card.suit}</span>
      <span className="absolute bottom-1 right-1.5 rotate-180 text-base font-bold leading-none">{card.rank}</span>
    </div>
  );
}

function PlayerSpot({ player, pnl, align = "center" }: { player: Player; pnl?: number; align?: "center" | "left" | "right" }) {
  return (
    <div className={cn("flex flex-col gap-1.5", align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center")}>
      <span
        className={cn(
          "font-x rounded-[3px] px-2 py-0.5 text-xs font-extrabold uppercase tracking-[0.06em]",
          player.isYou ? "bg-[#1a1300] text-gold" : "bg-black/15",
        )}
      >
        {player.name}
        {pnl !== undefined && <span className="ml-2 tabular-nums">{formatSigned(pnl)}</span>}
      </span>
      <div className="flex gap-1.5">
        {player.hand.map((c, i) => (
          <MiniCard key={i} card={c} />
        ))}
      </div>
    </div>
  );
}

/** The table: the gold pit, with the four seats around the shared cards. */
function Felt({ pnls }: { pnls?: number[] }) {
  const { players, table } = useMocStore();
  return (
    <div className="space-y-5 overflow-x-auto rounded-2xl bg-jacket p-6 text-jacket-ink shadow-(--shadow-card)">
      <div className="flex justify-center">
        <PlayerSpot player={players[2]} pnl={pnls?.[2]} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <PlayerSpot player={players[1]} pnl={pnls?.[1]} align="left" />
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-x text-xs font-extrabold uppercase tracking-[0.1em] opacity-80">Table</span>
          <div className="flex gap-1.5">
            {table.map((c, i) => (
              <MiniCard key={i} card={c} />
            ))}
          </div>
        </div>
        <PlayerSpot player={players[3]} pnl={pnls?.[3]} align="right" />
      </div>
      <div className="flex justify-center">
        <PlayerSpot player={players[0]} pnl={pnls?.[0]} />
      </div>
    </div>
  );
}

/* ---------------------------------- intro ---------------------------- */

function Intro() {
  const start = useMocStore((s) => s.start);
  const saved = useMocStore((s) => s.config);
  const [config, setConfig] = React.useState<MocConfig>(saved ?? DEFAULT_MOC_CONFIG);

  return (
    <Ticket onStart={() => start(config)}>
      <Segmented
        label="Decision timer"
        options={MOC_OPTIONS.decisionSeconds}
        value={config.decisionSeconds}
        onChange={(v) => setConfig((c) => ({ ...c, decisionSeconds: v }))}
        suffix="s"
      />
      <ToggleRow label="EV hints" checked={config.showEV} onChange={(v) => setConfig((c) => ({ ...c, showEV: v }))} />
      <ToggleRow label="Game log" checked={config.showLog} onChange={(v) => setConfig((c) => ({ ...c, showLog: v }))} />
    </Ticket>
  );
}

/* -------------------------------- game screen ------------------------ */

const PHASE_TITLE: Record<string, string> = { quote: "Your quote", reactions: "The AIs react", trade: "Trade their markets" };

function GameScreen() {
  const { phase, round, config, players, table, revealed, endGame } = useMocStore();
  const you = players[0];
  const known = [...you.hand, ...table.slice(0, revealed)];
  const quick = quickTotalEV(sumValue(known), known.length);
  const exact = exactTotalEV(sumValue(known), known.length);

  return (
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Round", value: `${round}/${TOTAL_ROUNDS}` },
          { label: "Cards known", value: `${known.length}/11` },
          ...(config.showEV
            ? [
                { label: "Quick EV", value: quick.toFixed(0) },
                { label: "Exact EV", value: exact.toFixed(0), tone: "hot" as const },
                { label: "Table mid", value: TABLE_MID },
              ]
            : []),
        ]}
        aside={
          <QuietButton onClick={endGame} className="text-white/70 hover:bg-white/10 hover:text-white">
            <Flag className="h-4 w-4" /> Settle
          </QuietButton>
        }
      />

      <div key={round} className="animate-round grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Felt />
        <Panel title={PHASE_TITLE[phase] ?? "Trade"}>
          {phase === "quote" && <QuotePanel />}
          {phase === "reactions" && <ReactionsPanel />}
          {phase === "trade" && <TradePanel />}
        </Panel>
      </div>

      <div className={cn("grid gap-5", config.showLog && "lg:grid-cols-2")}>
        {config.showLog && <GameLog />}
        <TradeLog />
      </div>
    </div>
  );
}

function ReactionsPanel() {
  const { reactions, continueToTrade } = useMocStore();
  return (
    <div className="animate-pop space-y-4">
      <ul className="-my-2 divide-y divide-border">
        {reactions.map((r) => {
          const acted = r.action !== "passed";
          return (
            <li key={r.name} className="flex items-center gap-3 py-3 text-sm">
              <span className={cn("grid h-8 w-8 place-items-center rounded-[4px]", acted ? "bg-jacket text-jacket-ink" : "bg-surface-2 text-muted")}>
                {acted ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </span>
              <span className="font-bold">{r.name}</span>
              <span className={cn("ml-auto text-right", !acted && "text-muted")}>
                {r.action === "bought" ? `bought from you @ ${r.price}` : r.action === "sold" ? `sold to you @ ${r.price}` : "passed"}
              </span>
            </li>
          );
        })}
      </ul>
      <ActionPlate tone="jacket" onClick={continueToTrade} label="Trade their markets" icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </div>
  );
}

function QuotePanel() {
  const submitQuote = useMocStore((s) => s.submitQuote);
  const [bid, setBid] = React.useState("");
  const [ask, setAsk] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const b = Number(bid);
    const a = Number(ask);
    if (bid === "" || ask === "" || Number.isNaN(b) || Number.isNaN(a)) return setError("Enter a bid and an ask.");
    if (a <= b) return setError("Your ask must be above your bid.");
    setError(null);
    submitQuote(b, a);
  };

  return (
    <form onSubmit={submit} className="animate-pop space-y-4">
      <Note>Quote a two-way market on the total value of all 11 cards.</Note>
      <div className="grid grid-cols-2 gap-3">
        <PriceField label="Bid (you buy)" value={bid} onChange={(v) => setBid(v.replace(/[^0-9]/g, ""))} placeholder="e.g. 450" />
        <PriceField label="Ask (you sell)" value={ask} onChange={(v) => setAsk(v.replace(/[^0-9]/g, ""))} placeholder="e.g. 480" />
      </div>
      {error && <p className="text-sm font-semibold text-negative">{error}</p>}
      <ActionPlate type="submit" tone="jacket" label="Submit quote" icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </form>
  );
}

function TradePanel() {
  const { aiQuotes, currentAi, tradeWithAi, players, config } = useMocStore();
  const q = aiQuotes[currentAi];
  if (!q) return null;
  const name = players[currentAi + 1].name;

  return (
    <div className="animate-pop space-y-5">
      <Timer key={currentAi} seconds={config.decisionSeconds} onExpire={() => tradeWithAi("pass")} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-x font-extrabold">{name} quotes</span>
        <QuotePlates bid={q.bid} ask={q.ask} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ActionPlate tone="buy" onClick={() => tradeWithAi("buy")} label="Buy" sub={`at ${q.ask}`} />
        <ActionPlate tone="sell" onClick={() => tradeWithAi("sell")} label="Sell" sub={`at ${q.bid}`} />
        <ActionPlate tone="neutral" onClick={() => tradeWithAi("pass")} label="Pass" sub="no trade" />
      </div>
    </div>
  );
}

/* ---------------------------------- logs ----------------------------- */

function GameLog() {
  const log = useMocStore((s) => s.log);
  return (
    <Panel title="Game log">
      <div className="h-44 overflow-y-auto rounded-[6px] bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted">
        {[...log].reverse().map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </Panel>
  );
}

function TradeLog() {
  const { trades, players } = useMocStore();
  const nm = (i: number) => players[i]?.name ?? `P${i}`;
  return (
    <Panel title="Trade log">
      <div className="h-44 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="font-x sticky top-0 bg-surface text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="pb-2">Round</th>
              <th className="pb-2">Buyer</th>
              <th className="pb-2">Seller</th>
              <th className="pb-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-muted">
                  No trades yet.
                </td>
              </tr>
            ) : (
              trades.map((t, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2">R{t.round}</td>
                  <td className={cn("py-2 font-bold", t.buyer === 0 ? "text-jacket-text" : "text-positive")}>{nm(t.buyer)}</td>
                  <td className={cn("py-2 font-bold", t.seller === 0 ? "text-jacket-text" : "text-negative")}>{nm(t.seller)}</td>
                  <td className="font-x py-2 text-right font-black">{t.price}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* -------------------------------- game over -------------------------- */

function GameOver() {
  const { trades, trueSum, players, reset } = useMocStore();
  useRecordGame();
  const pnls = playerPnl(trades, trueSum);
  const ranked = players.map((p, i) => ({ p, i, pnl: pnls[i] })).sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FinalBand
        title={`Settled at ${trueSum}`}
        figure={formatSigned(pnls[0])}
        figureLabel="Your P&L"
        actions={<ActionPlate tone="jacket" onClick={reset} label="Play again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <Standings rows={ranked.map((r) => ({ name: r.p.name, score: formatSigned(r.pnl), you: r.p.isYou }))} />
      </FinalBand>

      <Felt pnls={pnls} />

      <div className="grid gap-5 lg:grid-cols-2">
        <GameLog />
        <TradeLog />
      </div>
    </div>
  );
}
