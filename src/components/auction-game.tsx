"use client";

import * as React from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { HIGH, LOW, adapt, botBid, bounds, breakEven, drawLot, makeBidders, resolve, type Bidder, type Lot, type Outcome } from "@/lib/auction";
import { useRecordGame } from "@/store/practice-store";
import { useHideRulesWhile } from "@/components/how-to-play";
import { ActionPlate, FinalBand, Panel, Scoreboard, Segmented, Stat, Standings, Ticket, Timer } from "@/components/pit/game-kit";
import { cn } from "@/lib/utils";

const BOT_NAMES = ["Clara", "Kaito", "Lena", "Omar", "Zane", "Ivy", "Rafa", "Theo", "Viktor", "Ayla", "Jules", "Kofi", "Hugo", "Nora", "Felix", "Marco"];

type Settings = { bidders: number; noise: number; rounds: number; seconds: number };
type Played = { lot: Lot; outcome: Outcome };
type Game = { settings: Settings; bidders: Bidder[]; lot: Lot; outcome: Outcome | null; history: Played[] };

const usd = (x: number) => `${x < 0 ? "−" : ""}$${Math.abs(Math.round(x))}`;

function newGame(settings: Settings): Game {
  const names = ["You", ...[...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, settings.bidders - 1)];
  return { settings, bidders: makeBidders(names), lot: drawLot(settings.bidders, settings.noise), outcome: null, history: [] };
}

export function AuctionGame() {
  const [settings, setSettings] = React.useState<Settings>({ bidders: 6, noise: 25, rounds: 10, seconds: 20 });
  const [game, setGame] = React.useState<Game | null>(null);
  const over = !!game && game.history.length >= game.settings.rounds && !game.outcome;
  useHideRulesWhile(!!game && !over);

  const submit = React.useCallback(
    (bid: number | null) =>
      setGame((g) => {
        if (!g || g.outcome) return g;
        const bids = g.bidders.map((b, i) => (b.human ? bid : botBid(b, g.lot.estimates[i], g.lot.noise)));
        const outcome = resolve(g.lot, bids);
        return { ...g, outcome, bidders: adapt(g.bidders, outcome), history: [...g.history, { lot: g.lot, outcome }] };
      }),
    [],
  );
  const next = () =>
    setGame((g) => g && { ...g, outcome: null, lot: g.history.length >= g.settings.rounds ? g.lot : drawLot(g.settings.bidders, g.settings.noise) });

  if (!game) {
    return (
      <Ticket onStart={() => setGame(newGame(settings))} startLabel="Open the auction">
        <Segmented label="Bidders" options={[4, 6, 8]} value={settings.bidders} onChange={(v) => setSettings({ ...settings, bidders: v })} />
        <Segmented label="Estimate noise ±$" options={[10, 25, 50]} value={settings.noise} onChange={(v) => setSettings({ ...settings, noise: v })} />
        <Segmented label="Lots" options={[5, 10, 15]} value={settings.rounds} onChange={(v) => setSettings({ ...settings, rounds: v })} />
        <Segmented label="Seconds to bid" options={[10, 20, 30]} value={settings.seconds} onChange={(v) => setSettings({ ...settings, seconds: v })} suffix="s" />
      </Ticket>
    );
  }
  if (over) return <GameOver game={game} onAgain={() => setGame(null)} />;

  return <Floor game={game} onBid={submit} onNext={next} />;
}

const totals = (g: Game) => g.bidders.map((_, i) => g.history.reduce((a, h) => a + h.outcome.profit[i], 0));

/* ------------------------------------------------------------------- floor */

function Floor({ game, onBid, onNext }: { game: Game; onBid: (bid: number | null) => void; onNext: () => void }) {
  const { lot, outcome, settings, bidders } = game;
  const pnl = totals(game);
  const lotNo = game.history.length + (outcome ? 0 : 1);
  const won = game.history.filter((h) => h.outcome.winner === 0).length;
  const pass = React.useCallback(() => onBid(null), [onBid]);

  return (
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Lot", value: `${lotNo}/${settings.rounds}` },
          { label: "Your P&L", value: usd(pnl[0]), tone: pnl[0] > 0 ? "good" : pnl[0] < 0 ? "bad" : "hot" },
          { label: "Lots won", value: won },
          { label: "Bidders", value: bidders.length },
        ]}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {outcome ? (
            <Reveal game={game} lot={lot} outcome={outcome} onNext={onNext} isLast={game.history.length >= settings.rounds} />
          ) : (
            <>
              <Timer key={lotNo} seconds={settings.seconds} onExpire={pass} label="Bids close in" />
              <BidSheet lot={lot} n={bidders.length} onBid={onBid} />
            </>
          )}
        </div>
        <Panel title="P&L">
          <ul className="-my-2 divide-y divide-border">
            {bidders
              .map((b, i) => ({ b, v: pnl[i] }))
              .sort((x, y) => y.v - x.v)
              .map(({ b, v }) => (
                <li key={b.name} className="flex items-center justify-between py-2.5">
                  <span className={cn(b.human ? "font-black" : "font-bold")}>{b.name}</span>
                  <span className={cn("font-x font-black tabular-nums", v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-muted")}>{usd(v)}</span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function BidSheet({ lot, n, onBid }: { lot: Lot; n: number; onBid: (bid: number | null) => void }) {
  const [input, setInput] = React.useState("");
  const est = lot.estimates[0];
  const { lo, hi } = bounds(est, lot.noise);
  const bid = /^\d{1,4}$/.test(input) ? Number(input) : null;
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
      <div className="flex flex-wrap items-end justify-between gap-4 bg-jacket px-6 py-6 text-jacket-ink sm:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">On the block · worth the same to all {n} bidders</p>
          <h2 className="font-xx mt-1 text-[2.2rem] font-black uppercase leading-none">{lot.item}</h2>
        </div>
        <p className="text-sm font-bold opacity-80">
          Worth ${LOW}–${HIGH}
        </p>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
        <div>
          <p className="font-x text-xs font-extrabold uppercase tracking-[0.08em] text-muted">Your estimate</p>
          <p className="font-xx mt-1 text-[3.4rem] font-black leading-none tabular-nums">${est}</p>
          <p className="mt-2 text-sm text-muted">
            ±${lot.noise}, so the value is between <strong className="text-foreground">${lo}</strong> and{" "}
            <strong className="text-foreground">${hi}</strong>.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (bid !== null) onBid(bid);
          }}
        >
          <label htmlFor="auction-bid" className="font-x block text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
            Your sealed bid
          </label>
          <input
            id="auction-bid"
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="$"
            className="font-xx h-16 w-full rounded-[6px] border-[1.5px] border-foreground bg-surface px-4 text-3xl font-black tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <ActionPlate tone="jacket" type="submit" disabled={bid === null || bid < 1} label="Bid" />
            <ActionPlate tone="neutral" type="button" onClick={() => onBid(null)} label="Pass" />
          </div>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ reveal */

function Reveal({ game, lot, outcome, onNext, isLast }: { game: Game; lot: Lot; outcome: Outcome; onNext: () => void; isLast: boolean }) {
  const { bidders } = game;
  const n = bidders.length;
  const rows = bidders.map((b, i) => ({ b, i, est: lot.estimates[i], bid: outcome.bids[i] })).sort((x, y) => (y.bid ?? -1) - (x.bid ?? -1));
  const w = outcome.winner;
  const myEst = lot.estimates[0];
  const cursed = w >= 0 && outcome.profit[w] < 0;
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        <div className="flex flex-wrap items-end justify-between gap-4 bg-[#0f131a] px-6 py-6 text-white sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-60">{lot.item} · true value</p>
            <p className="font-xx mt-1 text-[3.2rem] font-black leading-none tabular-nums text-gold">${lot.value}</p>
          </div>
          <p className="max-w-xs text-right text-sm">
            {w < 0 ? (
              "Nobody bid."
            ) : (
              <>
                <strong>{w === 0 ? "You" : bidders[w].name}</strong> won at ${outcome.bids[w]} and {cursed ? "lost" : "made"}{" "}
                <strong className={cursed ? "text-[#ff7c8a]" : "text-[#5ee09a]"}>{usd(Math.abs(outcome.profit[w]))}</strong>.
                {cursed && " Winner's curse."}
              </>
            )}
          </p>
        </div>
        <div className="overflow-x-auto px-4 py-4 sm:px-8">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="font-x text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                <th className="pb-2">Bidder</th>
                <th className="pb-2 text-right">Estimate</th>
                <th className="pb-2 text-right">Bid</th>
                <th className="hidden pb-2 text-right sm:table-cell">Shaded</th>
                <th className="pb-2 text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, i, est, bid }) => (
                <tr key={b.name} className={cn("border-t border-border", i === w && "bg-(--gold-wash)")}>
                  <td className="py-2.5 font-bold">{b.name}</td>
                  <td className="py-2.5 text-right">${est}</td>
                  <td className="py-2.5 text-right font-bold">{bid === null ? "pass" : `$${bid}`}</td>
                  <td className="hidden py-2.5 text-right text-muted sm:table-cell">{bid === null ? "—" : usd(est - bid)}</td>
                  <td className={cn("font-x py-2.5 text-right font-black", i === w ? (outcome.profit[i] >= 0 ? "text-positive" : "text-negative") : "text-muted")}>
                    {i === w ? usd(outcome.profit[i]) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-6 py-4 text-sm text-muted sm:px-8">
          With {n} bidders and ±${lot.noise} noise, the winning estimate runs about{" "}
          <strong className="text-foreground">${Math.round((lot.noise * (n - 1)) / (n + 1))}</strong> high. Your break-even bid on ${myEst} was about{" "}
          <strong className="text-foreground">${Math.round(breakEven(myEst, lot.noise, n))}</strong>.
        </p>
      </section>
      <ActionPlate tone="jacket" onClick={onNext} label={isLast ? "Final results" : "Next lot"} icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </div>
  );
}

/* ---------------------------------------------------------------- game over */

function GameOver({ game, onAgain }: { game: Game; onAgain: () => void }) {
  useRecordGame();
  const pnl = totals(game);
  const ranked = game.bidders.map((b, i) => ({ b, v: pnl[i] })).sort((x, y) => y.v - x.v);
  const place = pnl.filter((v) => v > pnl[0]).length + 1;
  const mine = game.history.filter((h) => h.outcome.winner === 0);
  const cursed = mine.filter((h) => h.outcome.profit[0] < 0).length;
  const bids = game.history.flatMap((h) => (h.outcome.bids[0] === null ? [] : [h.lot.estimates[0] - h.outcome.bids[0]!]));
  const shade = bids.length ? bids.reduce((a, b) => a + b, 0) / bids.length : null;

  return (
    <div className="mx-auto max-w-4xl">
      <FinalBand
        title={place === 1 ? "Top of the room" : `You finished #${place}`}
        figure={usd(pnl[0])}
        figureLabel={`over ${game.history.length} lots`}
        actions={<ActionPlate tone="jacket" onClick={onAgain} label="New auction" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Lots won" value={mine.length} />
          <Stat label="Won at a loss" value={cursed} ok={cursed === 0} />
          <Stat label="Avg shade" value={shade === null ? "—" : usd(shade)} />
          <Stat label="Noise" value={`±$${game.settings.noise}`} />
        </div>
        <Standings rows={ranked.map(({ b, v }) => ({ name: b.human ? "You" : `${b.name} · ${b.style}`, score: usd(v), you: b.human }))} />
      </FinalBand>
    </div>
  );
}
