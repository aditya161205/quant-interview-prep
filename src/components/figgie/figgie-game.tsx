"use client";

import * as React from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { useRecordGame } from "@/store/practice-store";
import { useHideRulesWhile } from "@/components/how-to-play";
import { ActionPlate, FinalBand, Panel, Scoreboard, Segmented, Standings, Stat, Ticket, TimerBar, ToggleRow } from "@/components/pit/game-kit";
import {
  SUITS,
  SUIT_RED,
  SUIT_SYMBOL,
  STARTING_CASH,
  bid,
  buy,
  cancel,
  counts,
  dealRound,
  handSize,
  newTable,
  offer,
  sell,
  settle,
  type Figgie,
  type FPlayer,
  type Suit,
} from "@/lib/figgie/engine";
import { botTick, fairValues, randomFiggiePersona, type FiggiePersona } from "@/lib/figgie/bot";
import { cn } from "@/lib/utils";

const BOT_NAMES = ["Clara", "Kaito", "Lena", "Omar", "Zane", "Ivy", "Rafa", "Theo", "Viktor", "Ayla", "Jules", "Kofi", "Hugo", "Nora", "Felix", "Marco"];

type Settings = { opponents: number; minutes: number; rounds: number; hints: boolean; learning: boolean };
const DEFAULT_SETTINGS: Settings = { opponents: 3, minutes: 4, rounds: 3, hints: false, learning: false };

type Session = {
  settings: Settings;
  personas: FiggiePersona[];
  g: Figgie;
  endsAt: number;
};

function start(settings: Settings, players?: FPlayer[], round = 1): Session {
  const names = ["You", ...[...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, settings.opponents)];
  const table = players ?? newTable(names);
  return {
    settings,
    personas: table.map(() => randomFiggiePersona()),
    g: dealRound(table, round),
    endsAt: Date.now() + settings.minutes * 60_000,
  };
}

export function FiggieGame() {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [session, setSession] = React.useState<Session | null>(null);
  const [over, setOver] = React.useState(false);
  useHideRulesWhile(!!session && !over);

  if (over && session) return <GameOver session={session} onAgain={() => { setSession(null); setOver(false); }} />;
  if (!session) {
    return (
      <Ticket onStart={() => setSession(start(settings))} startLabel="Deal the cards">
        <Segmented label="Opponents" options={[3, 4]} value={settings.opponents} onChange={(v) => setSettings({ ...settings, opponents: v })} />
        <Segmented label="Round length" options={[2, 3, 4, 5]} value={settings.minutes} onChange={(v) => setSettings({ ...settings, minutes: v })} suffix=" min" />
        <Segmented label="Rounds" options={[1, 3, 5]} value={settings.rounds} onChange={(v) => setSettings({ ...settings, rounds: v })} />
        <ToggleRow
          label="Learning mode (slower bots)"
          checked={settings.learning}
          onChange={(v) => setSettings({ ...settings, learning: v, hints: v || settings.hints })}
        />
        <ToggleRow label="Fair-value hints" checked={settings.hints} onChange={(v) => setSettings({ ...settings, hints: v })} />
      </Ticket>
    );
  }
  return (
    <Table
      session={session}
      setSession={setSession}
      onNextRound={() =>
        setSession((s) => {
          if (!s) return s;
          const next = start(s.settings, s.g.players, s.g.round + 1);
          return { ...next, personas: s.personas };
        })
      }
      onFinish={() => setOver(true)}
    />
  );
}

/* ------------------------------------------------------------------- table */

function Table({
  session,
  setSession,
  onNextRound,
  onFinish,
}: {
  session: Session;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  onNextRound: () => void;
  onFinish: () => void;
}) {
  const { g, settings } = session;
  const me = g.players[0];
  const [left, setLeft] = React.useState(settings.minutes * 60);
  const [message, setMessage] = React.useState<string | null>(null);
  const nextAt = React.useRef<number[]>([]);

  // The trading loop: bots act on their own randomised timers until the clock runs out.
  React.useEffect(() => {
    if (g.phase !== "trading") return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setLeft(Math.max(0, (session.endsAt - now) / 1000));
      setSession((s) => {
        if (!s || s.g.phase !== "trading") return s;
        if (now >= s.endsAt) return { ...s, g: settle(s.g) };
        const total = s.settings.minutes * 60_000;
        const urgency = Math.min(1, 1 - (s.endsAt - now) / total);
        let next = s.g;
        for (let seat = 1; seat < next.players.length; seat++) {
          if ((nextAt.current[seat] ?? 0) > now) continue;
          next = botTick(next, seat, s.personas[seat], urgency);
          // Learning mode: bots think about three times longer, so you can follow the flow.
          nextAt.current[seat] = now + (700 + Math.random() * 1600) * (s.settings.learning ? 3 : 1);
        }
        return next === s.g ? s : { ...s, g: next };
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [g.phase, session.endsAt, setSession]);

  // Clear the last error after a moment.
  React.useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 2500);
    return () => window.clearTimeout(t);
  }, [message]);

  const run = (f: (g: Figgie) => Figgie | string) => {
    // Check against what's on screen for the message, then apply to the latest book (a bot may have just moved).
    const preview = f(g);
    if (typeof preview === "string") return setMessage(preview);
    setSession((s) => {
      const r = s && f(s.g);
      return s && r && typeof r !== "string" ? { ...s, g: r } : s;
    });
  };

  const values = settings.hints && g.phase === "trading" ? fairValues(g, 0) : null;
  const isLast = g.round >= settings.rounds;

  return (
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Round", value: `${g.round}/${settings.rounds}` },
          { label: "Time", value: g.phase === "trading" ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}` : "Done" },
          { label: "Your cash", value: `$${me.cash}`, tone: "hot" },
          { label: "Your cards", value: handSize(me.hand) },
          { label: "Pot", value: `$${g.pot || 200}` },
        ]}
      />

      {g.phase === "trading" ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <TimerBar left={left} total={settings.minutes * 60} label="Trading closes in" />
            <Book g={g} values={values} run={run} />
            <div role="status" aria-live="polite" className="min-h-6 text-sm font-semibold text-negative">
              {message}
            </div>
          </div>
          <div className="space-y-5">
            <Players g={g} />
            <Tape g={g} />
          </div>
        </div>
      ) : (
        <Reveal g={g} onNext={isLast ? onFinish : onNextRound} isLast={isLast} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- book */

function SuitPlate({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <span
      className={cn(
        "font-xx grid h-12 w-12 shrink-0 place-items-center rounded-[6px] bg-white text-2xl shadow-(--shadow-raised)",
        SUIT_RED[suit] ? "text-[#d4163c]" : "text-[#14161c]",
        className,
      )}
      aria-label={suit}
    >
      {SUIT_SYMBOL[suit]}
    </span>
  );
}

function Book({ g, values, run }: { g: Figgie; values: Record<Suit, number> | null; run: (f: (g: Figgie) => Figgie | string) => void }) {
  const me = g.players[0];
  const name = (i: number) => (i === 0 ? "You" : g.players[i].name);
  const lastPrice = (s: Suit) => [...g.trades].reverse().find((t) => t.suit === s)?.price;
  const lastTrade = g.trades[g.trades.length - 1];

  return (
    <section aria-label="Order book" className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
      <div className="font-x hidden grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_4rem_minmax(0,15rem)] gap-4 border-b-[3px] border-jacket px-5 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-muted lg:grid">
        <span>Suit</span>
        <span>You hold</span>
        <span>Best bid</span>
        <span>Best offer</span>
        <span>Last</span>
        <span>Your quote</span>
      </div>
      <ul className="divide-y divide-border">
        {SUITS.map((s) => {
          const q = g.book[s];
          const traded = lastTrade?.suit === s;
          return (
            <li
              key={s}
              className={cn(
                "grid grid-cols-2 items-center gap-3 px-5 py-4 transition-colors lg:grid-cols-[3.5rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_4rem_minmax(0,15rem)] lg:gap-4",
                traded && "animate-pop bg-(--gold-wash)",
              )}
            >
              <div className="col-span-2 flex items-center gap-3 lg:contents">
                <SuitPlate suit={s} />
                <div>
                  <div className="font-xx text-2xl font-black tabular-nums">{me.hand[s]}</div>
                  {values && <div className="text-[0.65rem] font-bold uppercase tracking-[0.06em] text-muted">≈ ${values[s]}</div>}
                </div>
              </div>

              <QuoteCell
                tone="bid"
                order={q.bid}
                who={q.bid ? name(q.bid.player) : null}
                mine={q.bid?.player === 0}
                actionLabel={q.bid ? `Sell $${q.bid.price}` : "No bid"}
                disabled={!q.bid || q.bid.player === 0 || me.hand[s] < 1}
                onAction={() => run((x) => sell(x, 0, s))}
                onCancel={() => run((x) => cancel(x, 0, s, "bid"))}
              />
              <QuoteCell
                tone="ask"
                order={q.ask}
                who={q.ask ? name(q.ask.player) : null}
                mine={q.ask?.player === 0}
                actionLabel={q.ask ? `Buy $${q.ask.price}` : "No offer"}
                disabled={!q.ask || q.ask.player === 0 || me.cash < q.ask.price}
                onAction={() => run((x) => buy(x, 0, s))}
                onCancel={() => run((x) => cancel(x, 0, s, "ask"))}
              />

              <div className="hidden text-sm font-bold tabular-nums text-muted lg:block">{lastPrice(s) !== undefined ? `$${lastPrice(s)}` : "—"}</div>

              <QuoteForm suit={s} canOffer={me.hand[s] > 0} onBid={(p) => run((x) => bid(x, 0, s, p))} onOffer={(p) => run((x) => offer(x, 0, s, p))} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function QuoteCell({
  tone,
  order,
  who,
  mine,
  actionLabel,
  disabled,
  onAction,
  onCancel,
}: {
  tone: "bid" | "ask";
  order: { price: number } | null;
  who: string | null;
  mine: boolean;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
  onCancel: () => void;
}) {
  if (!order) {
    return <div className="rounded-[6px] border-[1.5px] border-dashed border-border px-3 py-2.5 text-center text-xs font-bold uppercase text-muted">{actionLabel}</div>;
  }
  if (mine) {
    return (
      <div className={cn("flex items-center justify-between rounded-[6px] px-3 py-2 text-white", tone === "bid" ? "bg-positive" : "bg-negative")}>
        <span className="font-xx text-lg font-black tabular-nums">${order.price}</span>
        <span className="flex items-center gap-1 text-xs font-bold">
          Yours
          <button onClick={onCancel} aria-label={`Cancel your ${tone === "bid" ? "bid" : "offer"}`} className="rounded-[3px] p-0.5 hover:bg-white/20">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    );
  }
  return (
    <button
      onClick={onAction}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start rounded-[6px] px-3 py-2 text-left text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40",
        tone === "bid" ? "bg-positive" : "bg-negative",
      )}
    >
      <span className="font-xx text-lg font-black leading-tight">{actionLabel}</span>
      <span className="text-[0.65rem] font-semibold opacity-85">{tone === "bid" ? "bid" : "offer"} by {who}</span>
    </button>
  );
}

function QuoteForm({ suit, canOffer, onBid, onOffer }: { suit: Suit; canOffer: boolean; onBid: (p: number) => void; onOffer: (p: number) => void }) {
  const [price, setPrice] = React.useState("");
  const n = Number(price);
  const ok = price !== "" && n >= 1;
  return (
    <form
      className="col-span-2 flex items-center gap-1.5 lg:col-span-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) {
          onBid(n);
          setPrice("");
        }
      }}
    >
      <input
        inputMode="numeric"
        value={price}
        onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
        placeholder="$"
        aria-label={`Price for ${suit}`}
        className="font-xx h-10 w-16 rounded-[6px] border-[1.5px] border-foreground bg-surface px-2 text-center font-black tabular-nums outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={!ok}
        className="font-x h-10 flex-1 rounded-[6px] bg-positive px-2 text-xs font-extrabold uppercase text-white transition hover:brightness-110 disabled:opacity-40"
      >
        Bid
      </button>
      <button
        type="button"
        disabled={!ok || !canOffer}
        onClick={() => {
          onOffer(n);
          setPrice("");
        }}
        className="font-x h-10 flex-1 rounded-[6px] bg-negative px-2 text-xs font-extrabold uppercase text-white transition hover:brightness-110 disabled:opacity-40"
      >
        Offer
      </button>
    </form>
  );
}

/* ----------------------------------------------------------------- players */

function Players({ g }: { g: Figgie }) {
  return (
    <Panel title="Table">
      <ul className="-my-2 divide-y divide-border">
        {g.players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <span className={cn("font-xx grid h-9 w-11 place-items-center rounded-[4px] text-xs font-black", p.human ? "bg-jacket text-jacket-ink" : "bg-surface-2")}>
              {p.human ? "YOU" : p.name.slice(0, 3).toUpperCase()}
            </span>
            <span className="flex-1 font-bold">{p.human ? "You" : p.name}</span>
            <span className="text-xs text-muted">{handSize(p.hand)} cards</span>
            <span className="font-xx w-16 text-right font-black tabular-nums">${p.cash}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Tape({ g }: { g: Figgie }) {
  const name = (i: number) => (i === 0 ? "You" : g.players[i].name);
  const recent = [...g.trades].reverse().slice(0, 14);
  return (
    <Panel title="Trades" meta={<span className="text-xs text-muted">{g.trades.length} this round</span>}>
      {recent.length === 0 ? (
        <p className="text-sm text-muted">No trades yet. Post a bid or offer, or take one from the board.</p>
      ) : (
        <ol className="-my-1 space-y-1.5 text-sm">
          {recent.map((t, i) => (
            <li key={`${t.at}-${i}`} className="flex items-center gap-2">
              <span className={cn("w-5 text-center text-lg leading-none", SUIT_RED[t.suit] ? "text-[#d4163c]" : "text-foreground")}>{SUIT_SYMBOL[t.suit]}</span>
              <span className="min-w-0 flex-1 truncate">
                <strong>{name(t.buyer)}</strong> <span className="text-muted">bought from</span> <strong>{name(t.seller)}</strong>
              </span>
              <span className="font-x font-black tabular-nums">${t.price}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ reveal */

function Reveal({ g, onNext, isLast }: { g: Figgie; onNext: () => void; isLast: boolean }) {
  const r = g.result!;
  const deck = counts(r.layout);
  const order = [...g.players].sort((a, b) => r.net[b.id] - r.net[a.id]);
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-jacket text-jacket-ink shadow-(--shadow-card)">
        <div className="flex flex-wrap items-center gap-6 px-6 py-7 sm:px-8">
          <SuitPlate suit={r.goal} className="h-20 w-20 text-5xl" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">Round {g.round} · goal suit</p>
            <h2 className="font-xx text-[2.4rem] font-black uppercase leading-none">{r.goal}</h2>
            <p className="mt-2 text-sm opacity-85">
              {SUIT_SYMBOL[r.layout.twelve]} had 12 cards, so its partner {SUIT_SYMBOL[r.goal]} was the goal with {deck[r.goal]} cards. Bonus
              pot ${r.bonus}.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 bg-black/15">
          {SUITS.map((s) => (
            <div key={s} className="px-4 py-3 text-center">
              <div className={cn("text-2xl", s === r.goal && "font-black")}>{SUIT_SYMBOL[s]}</div>
              <div className="font-xx text-sm font-black tabular-nums">{deck[s]} cards</div>
            </div>
          ))}
        </div>
      </section>

      <Panel title="Payouts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="font-x text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                <th className="pb-2">Player</th>
                <th className="pb-2">Hand</th>
                <th className="pb-2 text-right">Goal cards</th>
                <th className="pb-2 text-right">Payout</th>
                <th className="pb-2 text-right">Round P&amp;L</th>
                <th className="pb-2 text-right">Cash</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {order.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2.5 font-bold">
                    {p.human ? "You" : p.name}
                    {r.bonusWinners.includes(p.id) && <span className="font-x ml-2 rounded-[3px] bg-gold px-1.5 py-0.5 text-[0.6rem] font-extrabold text-[#1a1300]">MOST</span>}
                  </td>
                  <td className="py-2.5 whitespace-nowrap">
                    {SUITS.map((s) => (
                      <span key={s} className={cn("mr-2.5", s === r.goal ? "font-black" : "text-muted")}>
                        <span className={SUIT_RED[s] ? "text-[#d4163c]" : undefined}>{SUIT_SYMBOL[s]}</span>
                        {p.hand[s]}
                      </span>
                    ))}
                  </td>
                  <td className="py-2.5 text-right">{r.goalCounts[p.id]}</td>
                  <td className="py-2.5 text-right">${r.payout[p.id]}</td>
                  <td className={cn("font-x py-2.5 text-right font-black", r.net[p.id] > 0 ? "text-positive" : r.net[p.id] < 0 ? "text-negative" : "")}>
                    {r.net[p.id] > 0 ? "+" : ""}
                    {r.net[p.id]}
                  </td>
                  <td className="py-2.5 text-right font-bold">${p.cash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ActionPlate tone="jacket" onClick={onNext} label={isLast ? "Final results" : "Next round"} icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </div>
  );
}

/* ---------------------------------------------------------------- game over */

function GameOver({ session, onAgain }: { session: Session; onAgain: () => void }) {
  useRecordGame();
  const { g, personas } = session;
  const ranked = [...g.players].sort((a, b) => b.cash - a.cash);
  const place = ranked.findIndex((p) => p.human) + 1;
  const profit = g.players[0].cash - STARTING_CASH;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <FinalBand
        title={place === 1 ? "You won the table" : `You finished #${place}`}
        figure={`${profit >= 0 ? "+" : "-"}$${Math.abs(profit)}`}
        figureLabel={`over ${g.round} round${g.round === 1 ? "" : "s"}`}
        actions={<ActionPlate tone="jacket" onClick={onAgain} label="New table" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <Standings rows={ranked.map((p) => ({ name: p.human ? "You" : p.name, score: `$${p.cash}`, you: p.human }))} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {g.players
            .filter((p) => !p.human)
            .map((p) => (
              <Stat key={p.id} label={p.name} value={personas[p.id].style} />
            ))}
        </div>
      </FinalBand>
    </div>
  );
}
