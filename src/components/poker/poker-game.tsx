"use client";

import * as React from "react";
import { ArrowRight, Flag, RotateCcw } from "lucide-react";
import { useRecordGame } from "@/store/practice-store";
import { ActionPlate, FinalBand, Panel, QuietButton, Scoreboard, Segmented, Stat, Standings, Ticket, ToggleRow } from "@/components/pit/game-kit";
import { CardSlot, PokerCard } from "@/components/poker/poker-card";
import { bestFive, describe, evaluate } from "@/lib/poker/evaluate";
import {
  act,
  canAct,
  inHand,
  isGameOver,
  legal,
  newGame,
  nextStreet,
  potTotal,
  startHand,
  type Action,
  type Game,
} from "@/lib/poker/engine";
import { decide, emptyModel, randomPersonality, thinkingMs, type HumanModel, type Personality } from "@/lib/poker/bot";
import { coach, judge, reviewQuestion, type Summary, type Verdict } from "@/lib/poker/coach";
import { CoachQuiz, HandReview } from "@/components/poker/coach";
import { cn } from "@/lib/utils";

const BOT_NAMES = ["Clara", "Kaito", "Lena", "Omar", "Zane", "Ivy", "Rafa", "Theo", "Viktor", "Ayla", "Jules", "Kofi", "Hugo", "Nora", "Felix", "Marco"];
const SMALL_BLIND = 5;
const BIG_BLIND = 10;

type Settings = {
  opponents: number;
  stackBb: number;
  risingBlinds: boolean;
  blindsEvery: number;
  fast: boolean;
  shotClock: boolean;
  clockSeconds: number;
  /** The coach quizzes you before every decision from the flop on. */
  learning: boolean;
};
const DEFAULT_SETTINGS: Settings = {
  opponents: 5,
  stackBb: 100,
  risingBlinds: true,
  blindsEvery: 15,
  fast: false,
  shotClock: false,
  clockSeconds: 30,
  learning: false,
};
/** Extra seconds for the whole game, spent automatically once a shot clock runs out (as online). */
const TIME_BANK = 60;

type Stats = { handsPlayed: number; handsWon: number; biggestPot: number; bestHand: number };

type Session = {
  game: Game;
  personas: Personality[];
  model: HumanModel;
  stats: Stats;
  settings: Settings;
  /** Seconds left in the human's time bank. */
  timeBank: number;
  /** Learning mode: quiz points so far, and this hand's judged decisions. */
  coach: { points: number; max: number };
  verdicts: Verdict[];
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newSession(settings: Settings): Session {
  const names = ["You", ...shuffle(BOT_NAMES).slice(0, settings.opponents)];
  const game = newGame(
    {
      startingStack: settings.stackBb * BIG_BLIND,
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      blindsEvery: settings.risingBlinds ? settings.blindsEvery : 0,
    },
    names,
  );
  return {
    game: startHand(game),
    personas: names.map(() => randomPersonality()),
    model: emptyModel(),
    stats: { handsPlayed: 1, handsWon: 0, biggestPot: 0, bestHand: -1 },
    // The coach and a shot clock don't mix: the quiz takes as long as it takes.
    settings: { ...settings, shotClock: settings.shotClock && !settings.learning },
    timeBank: TIME_BANK,
    coach: { points: 0, max: 0 },
    verdicts: [],
  };
}

/** Folds what the human just did into the bots' read on them. */
function learn(model: HumanModel, before: Game, a: Action): HumanModel {
  const L = legal(before, 0);
  const m = { ...model };
  if (L.toCall > 0 && before.street !== "preflop") {
    m.betsFaced += 1;
    if (a.type === "fold") m.foldsToBet += 1;
  }
  if (a.type === "raise") m.raises += 1;
  if (a.type === "call") m.calls += 1;
  return m;
}

export function PokerGame() {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [session, setSession] = React.useState<Session | null>(null);

  if (!session) return <Setup settings={settings} onChange={setSettings} onStart={() => setSession(newSession(settings))} />;
  if (session.game.phase === "game-over") return <GameOver session={session} onAgain={() => setSession(null)} />;
  return <Table session={session} setSession={setSession} />;
}

/* ------------------------------------------------------------------ setup */

const RANKINGS = [
  ["Royal flush", "A K Q J 10, one suit"],
  ["Straight flush", "Five in a row, one suit"],
  ["Four of a kind", "Four cards of one rank"],
  ["Full house", "Three of a kind plus a pair"],
  ["Flush", "Five cards of one suit"],
  ["Straight", "Five in a row (A-2-3-4-5 counts)"],
  ["Three of a kind", "Three cards of one rank"],
  ["Two pair", "Two different pairs"],
  ["Pair", "Two cards of one rank"],
  ["High card", "Nothing else: highest card plays"],
];

function Setup({ settings, onChange, onStart }: { settings: Settings; onChange: (s: Settings) => void; onStart: () => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Ticket
        onStart={onStart}
        startLabel="Take a seat"
        note={
          <span>
            No-limit Texas Hold&apos;em, blinds {SMALL_BLIND}/{BIG_BLIND}. Each bot gets a new playing style every game, and they
            adapt to how you play.
            {settings.shotClock && ` With the shot clock on you also get a ${TIME_BANK}s time bank; run out of both and you check, or fold.`}
          </span>
        }
      >
        <Segmented label="Opponents" options={[1, 2, 3, 4, 5, 6, 7]} value={settings.opponents} onChange={(v) => set("opponents", v)} />
        <Segmented label="Starting stack" options={[50, 100, 200]} value={settings.stackBb} onChange={(v) => set("stackBb", v)} suffix=" BB" />
        <ToggleRow label="Rising blinds" checked={settings.risingBlinds} onChange={(v) => set("risingBlinds", v)} />
        {settings.risingBlinds && (
          <Segmented label="Blinds double every" options={[10, 15, 25]} value={settings.blindsEvery} onChange={(v) => set("blindsEvery", v)} suffix=" hands" />
        )}
        <ToggleRow label="Fast bots" checked={settings.fast} onChange={(v) => set("fast", v)} />
        <ToggleRow label="Learning mode (coach quizzes you)" checked={settings.learning} onChange={(v) => set("learning", v)} />
        {!settings.learning && <ToggleRow label="Shot clock" checked={settings.shotClock} onChange={(v) => set("shotClock", v)} />}
        {settings.shotClock && !settings.learning && (
          <Segmented label="Seconds per decision" options={[15, 30, 45]} value={settings.clockSeconds} onChange={(v) => set("clockSeconds", v)} suffix="s" />
        )}
      </Ticket>
      <Panel title="Hand rankings">
        <ol className="-my-2 divide-y divide-border">
          {RANKINGS.map(([name, desc], i) => (
            <li key={name} className="flex items-baseline gap-3 py-2 text-sm">
              <span className="font-xx w-6 shrink-0 text-xs font-black text-muted">{i + 1}</span>
              <span className="font-x font-extrabold">{name}</span>
              <span className="ml-auto text-right text-xs text-muted">{desc}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

function Table({ session, setSession }: { session: Session; setSession: React.Dispatch<React.SetStateAction<Session | null>> }) {
  const { game: g, personas, settings } = session;
  const me = g.players[0];
  const myTurn = g.phase === "betting" && g.toAct === 0;

  // Bots act, and streets are dealt, on a timer so the table plays at a human pace.
  React.useEffect(() => {
    if (g.phase === "betting" && g.toAct > 0) {
      const seat = g.toAct;
      const t = window.setTimeout(() => {
        setSession((s) => {
          if (!s || s.game.phase !== "betting" || s.game.toAct !== seat) return s;
          const a = decide(s.game, seat, s.personas[seat], s.model);
          return { ...s, game: act(s.game, a) };
        });
      }, thinkingMs(g, seat, settings.fast));
      return () => window.clearTimeout(t);
    }
    if (g.phase === "street-end") {
      const t = window.setTimeout(() => setSession((s) => (s ? { ...s, game: nextStreet(s.game) } : s)), settings.fast ? 500 : 950);
      return () => window.clearTimeout(t);
    }
  }, [g, setSession, settings.fast]);

  // Tally the hand once it ends.
  const tallied = React.useRef(0);
  React.useEffect(() => {
    if (g.phase !== "hand-over" || !g.result || tallied.current === g.handNo) return;
    tallied.current = g.handNo;
    const won = g.result.net[0] > 0;
    const shownScore = g.result.shown.includes(0) ? evaluate([...me.hole, ...g.board]) : -1;
    setSession((s) =>
      s && {
        ...s,
        model: {
          ...s.model,
          hands: s.model.hands + 1,
          voluntary: s.model.voluntary + (s.game.players[0].voluntary ? 1 : 0),
        },
        stats: {
          ...s.stats,
          handsWon: s.stats.handsWon + (won ? 1 : 0),
          biggestPot: won ? Math.max(s.stats.biggestPot, potTotal(s.game)) : s.stats.biggestPot,
          bestHand: Math.max(s.stats.bestHand, shownScore),
        },
      },
    );
  }, [g, me.hole, setSession]);

  // Time-bank seconds spent on the current decision, reported by the shot clock as it runs.
  const bankUsed = React.useRef(0);
  const onBankUse = React.useCallback((seconds: number) => {
    bankUsed.current = seconds;
  }, []);

  // Learning mode: quiz once per decision from the flop on. Hand questions only on the first decision of a street.
  const decisionKey = `${g.handNo}-${g.actions.length}`;
  const [quizzed, setQuizzed] = React.useState({ decision: "", street: "" });
  const needQuiz = settings.learning && myTurn && g.street !== "preflop" && quizzed.decision !== decisionKey;
  const withHand = quizzed.street !== `${g.handNo}-${g.street}`;
  const coaching = React.useMemo(() => (needQuiz ? coach(g, withHand) : null), [needQuiz, g, withHand]);
  // The numbers behind this decision, kept so the action you then take can be judged.
  const summary = React.useRef<{ key: string; s: Summary } | null>(null);
  React.useEffect(() => {
    if (coaching) summary.current = { key: decisionKey, s: coaching.summary };
  }, [coaching, decisionKey]);
  const finishQuiz = (points: number, max: number) => {
    setQuizzed({ decision: decisionKey, street: `${g.handNo}-${g.street}` });
    setSession((s) => s && { ...s, coach: { points: s.coach.points + points, max: s.coach.max + max } });
  };

  const humanAct = React.useCallback(
    (a: Action, timedOut = false) => {
      const spent = bankUsed.current;
      bankUsed.current = 0;
      const judged = summary.current;
      setSession((s) => {
        if (!s || s.game.phase !== "betting" || s.game.toAct !== 0) return s;
        const key = `${s.game.handNo}-${s.game.actions.length}`;
        const verdict = judged?.key === key ? judge(judged.s, a, legal(s.game, 0).callAmount) : null;
        const before = timedOut
          ? { ...s.game, log: [...s.game.log, { hand: s.game.handNo, street: s.game.street, text: "You ran out of time" }] }
          : s.game;
        return {
          ...s,
          timeBank: Math.max(0, s.timeBank - spent),
          model: learn(s.model, s.game, a),
          game: act(before, a),
          verdicts: verdict ? [...s.verdicts, verdict] : s.verdicts,
        };
      });
    },
    [setSession],
  );
  // Out of time: check when free, otherwise fold (act() turns a free fold into a check).
  const onTimeout = React.useCallback(() => humanAct({ type: "fold" }, true), [humanAct]);
  const clock = settings.shotClock
    ? { seconds: settings.clockSeconds, bank: session.timeBank, turn: `${g.handNo}-${g.log.length}`, onBankUse, onTimeout }
    : undefined;

  const nextHand = () =>
    setSession((s) => {
      if (!s) return s;
      const game = startHand(s.game);
      return { ...s, game, verdicts: [], stats: { ...s.stats, handsPlayed: s.stats.handsPlayed + (game.phase === "game-over" ? 0 : 1) } };
    });

  const quit = () => setSession((s) => s && { ...s, game: { ...s.game, phase: "game-over" } });

  const alive = g.players.filter((p) => !p.out).length;
  const winningCards = React.useMemo(() => {
    if (g.phase !== "hand-over" || !g.result?.showdown) return new Set<number>();
    const top = g.result.pots[0]?.winners ?? [];
    return new Set(top.flatMap((w) => bestFive([...g.players[w].hole, ...g.board])));
  }, [g]);

  return (
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Hand", value: `#${g.handNo}` },
          { label: "Blinds", value: `${g.sb}/${g.bb}` },
          { label: "Players", value: alive },
          { label: "Your stack", value: me.stack, tone: "hot" },
          { label: "Pot", value: potTotal(g) },
          ...(settings.shotClock ? [{ label: "Time bank", value: `${Math.round(session.timeBank)}s` }] : []),
          ...(settings.learning
            ? [{ label: "Coach", value: session.coach.max ? `${Math.round((session.coach.points / session.coach.max) * 100)}%` : "—", tone: "hot" as const }]
            : []),
        ]}
        aside={
          <QuietButton onClick={quit} className="text-white/70 hover:bg-white/10 hover:text-white">
            <Flag className="h-4 w-4" /> Leave
          </QuietButton>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Felt game={g} personas={personas} winningCards={winningCards} />
          {coaching ? (
            <CoachQuiz key={decisionKey} coaching={coaching} onDone={finishQuiz} />
          ) : (
            <ActionBar game={g} myTurn={myTurn} onAct={humanAct} onNext={nextHand} clock={clock} />
          )}
          {settings.learning && g.phase === "hand-over" && session.verdicts.length > 0 && (
            <HandReview
              key={g.handNo}
              question={reviewQuestion(session.verdicts, g.result?.net[0] ?? 0)}
              onScore={(p) => setSession((s) => s && { ...s, coach: { points: s.coach.points + p, max: s.coach.max + 1 } })}
            />
          )}
        </div>
        <HandLog game={g} />
      </div>
      {/* Spoken summary of what just happened, for screen readers. */}
      <p role="status" aria-live="polite" className="sr-only">
        {g.phase === "hand-over" && g.result ? resultLine(g) : myTurn ? `Your turn. ${legal(g, 0).toCall ? `${legal(g, 0).toCall} to call.` : "You can check."}` : ""}
      </p>
    </div>
  );
}

function resultLine(g: Game): string {
  if (!g.result) return "";
  return g.result.pots
    .map((p) => {
      const names = p.winners.map((w) => (w === 0 ? "You" : g.players[w].name)).join(" & ");
      // At a showdown, a one-player layer is an uncalled bet coming back, not a pot won.
      if (g.result?.showdown && !p.hand) return `${p.amount} uncalled returned to ${names === "You" ? "you" : names}`;
      const verb = p.winners.length === 1 && p.winners[0] === 0 ? "win" : p.winners.length > 1 ? "split" : "wins";
      return `${names} ${verb} ${p.amount}${p.hand ? ` with ${p.hand}` : ""}`;
    })
    .join(" · ");
}

/* ------------------------------------------------------------------- felt */

/** Board cards shrink to the small size on phones so five fit across the felt. */
const BOARD_SMALL = "max-sm:h-14 max-sm:w-10 max-sm:text-sm";

/** Seat positions around an oval, the human at the bottom centre, going clockwise. */
function seatPosition(i: number, n: number) {
  const angle = Math.PI / 2 + (i / n) * Math.PI * 2;
  return { x: 50 + Math.cos(angle) * 43, y: 50 + Math.sin(angle) * 40 };
}

function Felt({ game: g, personas, winningCards }: { game: Game; personas: Personality[]; winningCards: Set<number> }) {
  const n = g.players.length;
  const showAll = g.phase === "hand-over" && g.result?.showdown;
  const winners = new Set(g.phase === "hand-over" ? (g.result?.pots.flatMap((p) => p.winners) ?? []) : []);

  const board = (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1.5 sm:gap-2">
        {Array.from({ length: 5 }, (_, i) =>
          g.board[i] !== undefined ? (
            <PokerCard key={`${g.handNo}-${i}`} card={g.board[i]} size="lg" glow={winningCards.has(g.board[i])} className={BOARD_SMALL} />
          ) : (
            <CardSlot key={i} size="lg" className={BOARD_SMALL} />
          ),
        )}
      </div>
      <div className="font-xx rounded-[4px] bg-black/25 px-4 py-1.5 text-sm font-black tabular-nums text-white">
        POT {potTotal(g)}
      </div>
      {g.phase === "hand-over" && g.result && (
        <div className="animate-pop max-w-md rounded-[8px] bg-white px-4 py-3 text-center text-sm font-bold text-[#14161c] shadow-(--shadow-raised)">
          {resultLine(g)}
        </div>
      )}
    </div>
  );

  return (
    <section aria-label="Poker table" className="overflow-hidden rounded-2xl bg-surface p-3 shadow-(--shadow-card) sm:p-4">
      {/* Wide screens: an oval table with seats around it. */}
      <div className="relative hidden aspect-[16/10] lg:block">
        <div className="absolute inset-[9%] rounded-[50%] border-[10px] border-[#0f131a]/85 bg-jacket shadow-[inset_0_0_60px_rgba(0,0,0,0.35)]" />
        <div className="absolute inset-0 grid place-items-center">{board}</div>
        {g.players.map((p, i) => {
          const pos = seatPosition(i, n);
          const chip = { x: 50 + (pos.x - 50) * 0.6, y: 50 + (pos.y - 50) * 0.55 };
          return (
            <React.Fragment key={p.id}>
              <div className="absolute w-44 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                <Seat game={g} seat={i} persona={personas[i]} reveal={!!showAll} winner={winners.has(i)} winningCards={winningCards} />
              </div>
              {p.bet > 0 && (
                <span
                  className="font-xx absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0f131a] px-3 py-1 text-xs font-black tabular-nums text-gold shadow-(--shadow-raised)"
                  style={{ left: `${chip.x}%`, top: `${chip.y}%` }}
                >
                  {p.bet}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Narrow screens: the board on felt, seats in a grid below. */}
      <div className="space-y-3 lg:hidden">
        <div className="rounded-[2rem] border-[6px] border-[#0f131a]/85 bg-jacket px-3 py-6">{board}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {g.players.map((p, i) => (
            <Seat key={p.id} game={g} seat={i} persona={personas[i]} reveal={!!showAll} winner={winners.has(i)} winningCards={winningCards} showBet />
          ))}
        </div>
      </div>
    </section>
  );
}

const ACTION_TONE: Record<string, string> = {
  Fold: "bg-surface-2 text-muted",
  Check: "bg-surface-2 text-foreground",
  "All-in": "bg-negative text-white",
  SB: "bg-surface-2 text-muted",
  BB: "bg-surface-2 text-muted",
};

function Seat({
  game: g,
  seat,
  persona,
  reveal,
  winner,
  winningCards,
  showBet,
}: {
  game: Game;
  seat: number;
  persona: Personality;
  reveal: boolean;
  winner: boolean;
  winningCards: Set<number>;
  showBet?: boolean;
}) {
  const p = g.players[seat];
  const toAct = g.phase === "betting" && g.toAct === seat;
  const faceUp = p.human || (reveal && inHand(p));
  const action = p.lastAction;
  const actionTone = action ? (ACTION_TONE[action] ?? (action.startsWith("Call") ? "bg-positive text-white" : "bg-jacket text-jacket-ink")) : "";
  const net = g.phase === "hand-over" ? g.result?.net[seat] : undefined;

  if (p.out) {
    return (
      <div className="rounded-[8px] bg-surface-2/70 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {p.name} · out
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[10px] bg-surface p-2.5 shadow-(--shadow-raised) transition-[box-shadow,opacity]",
        toAct && "ring-4 ring-gold",
        winner && "ring-4 ring-positive",
        p.folded && g.phase !== "hand-over" && "opacity-55",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("font-x min-w-0 flex-1 truncate text-sm font-extrabold", p.human && "text-jacket-text")}>{p.human ? "You" : p.name}</span>
        {seat === g.dealer && (
          <span title="Dealer button" className="font-xx grid h-5 w-5 place-items-center rounded-full bg-gold text-[0.6rem] font-black text-[#1a1300]">
            D
          </span>
        )}
        {toAct && !p.human && <ThinkingDots />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {p.hole.length === 2 ? (
          p.hole.map((c, k) => (
            <PokerCard
              key={`${g.handNo}-${k}`}
              card={c}
              hidden={!faceUp}
              size="sm"
              dim={p.folded}
              glow={winningCards.has(c) && faceUp}
            />
          ))
        ) : (
          <span className="h-14" />
        )}
        <div className="ml-auto text-right">
          <div className="font-xx text-lg font-black leading-none tabular-nums">{p.stack}</div>
          {p.allIn && !p.folded ? (
            <div className="mt-1 text-[0.6rem] font-black uppercase tracking-[0.08em] text-negative">All-in</div>
          ) : (
            showBet && p.bet > 0 && <div className="mt-1 text-[0.65rem] font-bold text-muted">bet {p.bet}</div>
          )}
        </div>
      </div>
      <div className="mt-2 flex min-h-5 items-center gap-1.5">
        {net !== undefined && net !== 0 ? (
          <span className={cn("font-xx rounded-[3px] px-1.5 py-0.5 text-[0.65rem] font-black tabular-nums", net > 0 ? "bg-positive text-white" : "bg-surface-2 text-muted")}>
            {net > 0 ? `+${net}` : net}
          </span>
        ) : (
          action && <span className={cn("font-x rounded-[3px] px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase", actionTone)}>{action}</span>
        )}
        {reveal && inHand(p) && (
          <span className="truncate text-[0.65rem] font-semibold text-muted">{describe(evaluate([...p.hole, ...g.board]))}</span>
        )}
        {g.phase === "game-over" && !p.human && <span className="truncate text-[0.65rem] text-muted">{persona.style}</span>}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span aria-label="Thinking" className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------- action bar */

type ClockProps = { seconds: number; bank: number; turn: string; onBankUse: (s: number) => void; onTimeout: () => void };

/** The shot clock for one decision; when it runs out the time bank drains, then onTimeout fires. */
function ShotClock({ seconds, bank, onBankUse, onTimeout }: Omit<ClockProps, "turn">) {
  const [elapsed, setElapsed] = React.useState(0);
  const fired = React.useRef(false);
  React.useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const e = (Date.now() - start) / 1000;
      setElapsed(e);
      onBankUse(Math.max(0, Math.min(bank, e - seconds)));
      if (e >= seconds + bank && !fired.current) {
        fired.current = true;
        window.clearInterval(id);
        onTimeout();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, bank, onBankUse, onTimeout]);

  const inBank = elapsed > seconds;
  const left = inBank ? Math.max(0, seconds + bank - elapsed) : seconds - elapsed;
  const total = inBank ? Math.max(1, bank) : seconds;
  const danger = inBank || left <= seconds * 0.3;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs font-bold uppercase tracking-[0.08em]">
        <span className={cn(inBank ? "text-[#ff7c8a]" : "text-white/60")}>{inBank ? "Time bank" : "Shot clock"}</span>
        <span className="flex items-baseline gap-3">
          {!inBank && <span className="text-white/50 normal-case tracking-normal">+{Math.round(bank)}s bank</span>}
          <span className={cn("font-xx text-xl font-black tabular-nums", danger ? "text-[#ff7c8a]" : "text-white")}>{Math.ceil(left)}s</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-[2px] bg-white/10">
        <div className={cn("h-full transition-[width] duration-100 ease-linear", danger ? "bg-[#ff5c6e]" : "bg-gold")} style={{ width: `${(left / total) * 100}%` }} />
      </div>
    </div>
  );
}

function ActionBar({
  game: g,
  myTurn,
  onAct,
  onNext,
  clock,
}: {
  game: Game;
  myTurn: boolean;
  onAct: (a: Action) => void;
  onNext: () => void;
  clock?: ClockProps;
}) {
  const me = g.players[0];
  const L = myTurn ? legal(g, 0) : null;
  const pot = potTotal(g);
  const [raiseTo, setRaiseTo] = React.useState(0);

  // Reset the raise amount to the minimum whenever it becomes your turn.
  const turnKey = `${g.handNo}-${g.street}-${g.currentBet}-${myTurn}`;
  const [lastKey, setLastKey] = React.useState("");
  if (L && turnKey !== lastKey) {
    setLastKey(turnKey);
    setRaiseTo(L.minTo);
  }

  const preset = (f: number) => {
    if (!L) return 0;
    const to = g.currentBet === 0 ? pot * f : g.currentBet + f * (pot + L.toCall);
    return Math.round(Math.max(L.minTo, Math.min(L.maxTo, to)));
  };

  // Keyboard: F fold, C check/call, R raise, Enter next hand.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      // Enter/space on a focused button already clicks it; don't also deal the next hand.
      if (g.phase === "hand-over" && (k === "enter" || k === " ") && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onNext();
      }
      if (!L) return;
      if (k === "f" && !L.canCheck) onAct({ type: "fold" });
      if (k === "c") onAct({ type: L.canCheck ? "check" : "call" });
      if (k === "r" && L.canRaise) onAct({ type: "raise", to: raiseTo });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [L, g.phase, onAct, onNext, raiseTo]);

  if (g.phase === "hand-over") {
    const net = g.result?.net[0] ?? 0;
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0f131a] px-5 py-4 text-white shadow-(--shadow-card) dark:ring-1 dark:ring-white/10">
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] opacity-60">This hand</div>
          <div className={cn("font-xx text-2xl font-black tabular-nums", net > 0 ? "text-[#5ee09a]" : net < 0 ? "text-[#ff7c8a]" : "")}>
            {net > 0 ? `+${net}` : net}
          </div>
        </div>
        <ActionPlate
          tone="jacket"
          onClick={onNext}
          label={isGameOver(g) ? "See results" : "Next hand"}
          icon={<ArrowRight className="h-5 w-5" />}
          className="min-w-52"
        />
      </div>
    );
  }

  if (!L) {
    const waiting = g.phase === "betting" ? g.players[g.toAct] : null;
    return (
      <div className="flex min-h-[5.5rem] items-center justify-between gap-3 rounded-2xl bg-[#0f131a] px-5 py-4 text-white/80 shadow-(--shadow-card) dark:ring-1 dark:ring-white/10">
        <span className="font-x text-sm font-extrabold uppercase tracking-[0.06em]">
          {me.folded ? "You folded · " : me.allIn ? "You're all-in · " : ""}
          {waiting ? `${waiting.name} is thinking…` : "Dealing…"}
        </span>
        {canAct(me) && <span className="text-xs opacity-60">Your turn comes next round of action</span>}
      </div>
    );
  }

  const sizes = [
    { label: "Min", to: L.minTo },
    { label: "½ pot", to: preset(0.5) },
    { label: "¾ pot", to: preset(0.75) },
    { label: "Pot", to: preset(1) },
    { label: "All-in", to: L.maxTo },
  ];
  const opening = g.currentBet === 0;

  return (
    <div className="animate-pop space-y-4 rounded-2xl bg-[#0f131a] p-4 text-white shadow-(--shadow-card) ring-4 ring-gold sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-xx text-lg font-black uppercase">Your turn</span>
        <span className="text-sm text-white/70">{L.toCall > 0 ? `${L.callAmount} to call · pot ${pot}` : `Pot ${pot}`}</span>
      </div>
      {clock && <ShotClock key={clock.turn} seconds={clock.seconds} bank={clock.bank} onBankUse={clock.onBankUse} onTimeout={clock.onTimeout} />}
      <div className="grid gap-2 sm:grid-cols-3">
        {L.canCheck ? (
          <ActionPlate tone="neutral" label="Check" sub="C" onClick={() => onAct({ type: "check" })} className="border-white text-white hover:bg-white hover:text-[#0f131a]" />
        ) : (
          <ActionPlate tone="neutral" label="Fold" sub="F" onClick={() => onAct({ type: "fold" })} className="border-white text-white hover:bg-white hover:text-[#0f131a]" />
        )}
        {!L.canCheck && (
          <ActionPlate tone="buy" label={L.callAmount >= me.stack ? `All-in ${L.callAmount}` : `Call ${L.callAmount}`} sub="C" onClick={() => onAct({ type: "call" })} />
        )}
        {L.canRaise && (
          <ActionPlate
            tone="jacket"
            label={raiseTo >= L.maxTo ? `All-in ${raiseTo}` : `${opening ? "Bet" : "Raise to"} ${raiseTo}`}
            sub="R"
            onClick={() => onAct({ type: "raise", to: raiseTo })}
            className={cn(L.canCheck && "sm:col-span-2")}
          />
        )}
      </div>
      {L.canRaise && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((s) => (
              <button
                key={s.label}
                onClick={() => setRaiseTo(s.to)}
                className={cn(
                  "font-x rounded-[4px] px-3 py-1.5 text-xs font-extrabold uppercase transition-colors",
                  raiseTo === s.to ? "bg-gold text-[#1a1300]" : "bg-white/10 hover:bg-white/20",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={L.minTo}
              max={L.maxTo}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              aria-label="Raise amount"
              className="flex-1"
              style={{ accentColor: "var(--gold)" }}
            />
            <input
              inputMode="numeric"
              value={raiseTo}
              onChange={(e) => {
                const v = Number(e.target.value.replace(/[^0-9]/g, ""));
                setRaiseTo(Number.isFinite(v) ? v : L.minTo);
              }}
              onBlur={() => setRaiseTo((v) => Math.max(L.minTo, Math.min(L.maxTo, v)))}
              aria-label="Raise to"
              className="font-xx h-10 w-24 rounded-[6px] bg-white/10 px-2 text-center font-black tabular-nums outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- hand log */

/** The engine writes "You calls 40"; the log reads "You call 40". */
const youGrammar = (text: string) => text.replace(/^You (\w+?)s\b/, "You $1");

function HandLog({ game: g }: { game: Game }) {
  const lines = g.log.filter((l) => l.hand === g.handNo);
  const list = React.useRef<HTMLOListElement>(null);
  // Scroll the log itself, never the page.
  React.useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [lines.length]);
  return (
    <Panel title="Hand log" meta={<span className="text-xs text-muted">#{g.handNo}</span>}>
      <ol ref={list} className="max-h-[28rem] space-y-1 overflow-y-auto text-sm">
        {lines.map((l, i) => {
          const header = /^(Hand #|Flop|Turn|River)/.test(l.text);
          return (
            <li key={i} className={cn(header ? "font-x mt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-muted" : "")}>
              {youGrammar(l.text)}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ---------------------------------------------------------------- game over */

function GameOver({ session, onAgain }: { session: Session; onAgain: () => void }) {
  useRecordGame();
  const { game: g, personas, stats } = session;
  const ranked = [...g.players].sort((a, b) => b.stack - a.stack);
  const won = g.players[0].stack > 0 && g.players.filter((p) => p.stack > 0).length === 1;
  const busted = g.players[0].stack === 0;
  const place = ranked.findIndex((p) => p.human) + 1;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <FinalBand
        title={won ? "You won the table" : busted ? `Busted on hand ${g.handNo}` : "You left the table"}
        figure={won ? "1st" : busted ? "Out" : `#${place}`}
        figureLabel={busted ? `of ${g.players.length}` : `${g.players[0].stack} chips`}
        actions={<ActionPlate tone="jacket" onClick={onAgain} label="New table" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Hands" value={stats.handsPlayed} />
          <Stat label="Hands won" value={stats.handsWon} />
          <Stat label="Biggest pot" value={stats.biggestPot || "—"} />
          <Stat label="Best hand shown" value={stats.bestHand >= 0 ? describe(stats.bestHand).split(",")[0] : "—"} />
          {session.coach.max > 0 && <Stat label="Coach score" value={`${Math.round((session.coach.points / session.coach.max) * 100)}%`} />}
        </div>
        <Standings rows={ranked.map((p) => ({ name: p.human ? "You" : p.name, score: p.stack, you: p.human }))} />
      </FinalBand>

      <Panel title="Who you played">
        <ul className="grid gap-2 sm:grid-cols-2">
          {g.players
            .filter((p) => !p.human)
            .map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-[8px] bg-surface-2 px-4 py-3 text-sm">
                <span className="font-x font-extrabold">{p.name}</span>
                <span className="text-muted">{personas[p.id].style}</span>
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
}
