"use client";

import * as React from "react";
import { RotateCcw, ArrowRight, Flag, Dices, Coins, Spade, ChevronDown, Check, X } from "lucide-react";
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
import { useHideRulesWhile } from "@/components/how-to-play";
import { ActionPlate, FinalBand, Panel, QuietButton, Scoreboard, Segmented, Stat, Ticket, ToggleRow } from "@/components/pit/game-kit";

const CAT_ICON: Record<Category, typeof Dices> = { Dice: Dices, Cards: Spade, Coins: Coins };

export function BettingGame() {
  const phase = useBettingStore((s) => s.phase);
  useHideRulesWhile(phase !== "intro" && phase !== "gameover");

  return (
    <>
      <Announcer />
      {phase === "intro" ? <Intro /> : phase === "gameover" ? <GameOver /> : <BoardScreen />}
    </>
  );
}

/* --------------------------------- announcer ------------------------- */

/**
 * One polite live region for the whole game. Only the round settlement and the
 * final bankroll are spoken — the board of ~10 props stays silent so taking a
 * bet doesn't trigger a wall of speech.
 */
function Announcer() {
  const { phase, round, result, bankroll } = useBettingStore();

  let message = "";
  if (phase === "result" && result) {
    const won = result.lines.filter((l) => !l.voided && l.won).length;
    message =
      result.lines.length === 0
        ? `Round ${round} resolved. You placed no bets. Bankroll ${bankroll}.`
        : `Round ${round} resolved. ${won} of ${result.lines.length} bets won. Round ${formatSigned(result.roundPnl)}. Bankroll ${bankroll}.`;
  } else if (phase === "gameover") {
    message = `Game over. Final bankroll ${bankroll}, ${formatSigned(bankroll - STARTING_BANKROLL)} net.`;
  }

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

/* ----------------------------------- intro --------------------------- */

function Intro() {
  const start = useBettingStore((s) => s.start);
  const saved = useBettingStore((s) => s.config);
  const [config, setConfig] = React.useState<BettingConfig>(saved ?? DEFAULT_BETTING_CONFIG);
  const set = <K extends keyof BettingConfig>(k: K, v: BettingConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));

  return (
    <Ticket onStart={() => start(config)}>
      <Segmented label="Rounds" options={BETTING_OPTIONS.rounds} value={config.rounds} onChange={(v) => set("rounds", v)} />
      <Segmented label="Events per category" options={BETTING_OPTIONS.eventsPerCategory} value={config.eventsPerCategory} onChange={(v) => set("eventsPerCategory", v)} />
      <Segmented label="Minutes per round" options={BETTING_OPTIONS.roundMinutes} value={config.roundMinutes} onChange={(v) => set("roundMinutes", v)} suffix="m" />
      <ToggleRow label="Skip results animation" checked={config.skipAnimation} onChange={(v) => set("skipAnimation", v)} />
    </Ticket>
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
  return (
    <span className={cn(left <= 30 && "text-[#ff7c8a]")}>
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

/* ---------------------------------- board ---------------------------- */

function BoardScreen() {
  const { phase, round, config, bankroll, committed, endGame, resolve } = useBettingStore();
  const available = bankroll - committed();

  return (
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Round", value: `${round}/${config.rounds}` },
          { label: "Bankroll", value: bankroll },
          ...(phase === "betting"
            ? [
                { label: "Available", value: available, tone: "hot" as const },
                { label: "Clock", value: <MinutesCountdown key={round} minutes={config.roundMinutes} onExpire={resolve} /> },
              ]
            : []),
        ]}
        aside={
          <QuietButton onClick={endGame} className="text-white/70 hover:bg-white/10 hover:text-white">
            <Flag className="h-4 w-4" /> End
          </QuietButton>
        }
      />

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
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {cats.map((cat) => {
          const Icon = CAT_ICON[cat];
          const props = board.filter((b) => b.prop.category === cat);
          return (
            <Panel key={cat} title={cat} meta={<Icon className="h-5 w-5 text-muted" />} className="animate-pop">
              <ul className="-my-2 divide-y divide-border">
                {props.map((bp) => (
                  <PropRow key={bp.prop.id} bp={bp} />
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>

      <Panel title="Specials" className="animate-pop">
        <ul className="grid gap-x-8 sm:grid-cols-2">
          <SpecialRow kind="put" label="Put" sub="Wins if your other bets net a loss" b={putOdds.b} />
          <SpecialRow kind="call" label="Call" sub="Wins if your other bets net a profit" b={callOdds.b} />
        </ul>
      </Panel>

      <ActionPlate tone="jacket" onClick={resolve} label="Resolve round" icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </div>
  );
}

function OddsPlate({ b }: { b: number }) {
  return (
    <span className="font-xx shrink-0 rounded-[4px] bg-gold px-2.5 py-1.5 text-sm font-black tabular-nums text-[#1a1300]">{b.toFixed(2)}:1</span>
  );
}

function StakeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="numeric"
      aria-label="Stake"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      className="font-xx h-10 w-20 rounded-[6px] border-[1.5px] border-foreground bg-surface px-2 text-center font-black tabular-nums outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function TakenPlate({ stake, onRemove }: { stake: number; onRemove: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-[6px] bg-foreground px-3 py-2 text-sm text-background">
      <span className="font-x font-extrabold">Taken · {stake}</span>
      <button onClick={onRemove} aria-label="Remove bet" className="opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function TakeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-x h-10 flex-1 rounded-[6px] bg-jacket text-sm font-extrabold uppercase text-jacket-ink transition hover:brightness-110"
    >
      Take
    </button>
  );
}

function PropRow({ bp }: { bp: BoardProp }) {
  const { bets, placeBet, removeBet } = useBettingStore();
  const taken = bets[bp.prop.id];
  const [stake, setStake] = React.useState("10");

  return (
    <li className="space-y-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold leading-snug">{bp.prop.label}</span>
        <OddsPlate b={bp.odds.b} />
      </div>
      <div className="flex items-center gap-2">
        {taken ? (
          <TakenPlate stake={taken.stake} onRemove={() => removeBet(bp.prop.id)} />
        ) : (
          <>
            <StakeInput value={stake} onChange={setStake} />
            <TakeButton
              onClick={() => {
                const ok = placeBet({ id: bp.prop.id, category: bp.prop.category, label: bp.prop.label, b: bp.odds.b, stake: Number(stake) });
                if (ok) setStake("10");
              }}
            />
          </>
        )}
      </div>
    </li>
  );
}

function SpecialRow({ kind, label, sub, b }: { kind: "put" | "call"; label: string; sub: string; b: number }) {
  const { specials, placeSpecial, removeSpecial } = useBettingStore();
  const taken = specials[kind];
  const [stake, setStake] = React.useState("10");

  return (
    <li className="space-y-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <span>
          <span className="font-x block font-extrabold uppercase">{label}</span>
          <span className="block text-xs text-muted">{sub}</span>
        </span>
        <OddsPlate b={b} />
      </div>
      <div className="flex items-center gap-2">
        {taken ? (
          <TakenPlate stake={taken.stake} onRemove={() => removeSpecial(kind)} />
        ) : (
          <>
            <StakeInput value={stake} onChange={setStake} />
            <TakeButton onClick={() => placeSpecial(kind, Number(stake), b)} />
          </>
        )}
      </div>
    </li>
  );
}

/* ---------------------------------- result --------------------------- */

const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function OutcomeStrip({ outcome, compact = false }: { outcome: RoundOutcome; compact?: boolean }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", !compact && "rounded-2xl bg-jacket p-4 text-jacket-ink shadow-(--shadow-card)")}>
      <OutcomeTile title="Dice" compact={compact}>
        {outcome.dice.map((d, i) => (
          <span key={i} className={cn("leading-none", compact ? "text-4xl" : "text-6xl")}>
            {DIE_FACES[d]}
          </span>
        ))}
      </OutcomeTile>
      <OutcomeTile title="Cards" compact={compact}>
        {outcome.cards.map((c, i) => {
          const red = c.suit === "♥" || c.suit === "♦";
          return (
            <span
              key={i}
              className={cn(
                "inline-flex flex-col items-center justify-center rounded-[6px] border border-zinc-300 bg-white font-bold leading-none shadow-(--shadow-raised)",
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
              "font-xx grid place-items-center rounded-full font-black",
              compact ? "h-9 w-9 text-xs" : "h-14 w-14 text-lg",
              c === "H" ? "bg-[#1a1300] text-gold" : "bg-white text-[#1a1300]",
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
    <div className={cn("rounded-[8px] text-center", compact ? "bg-surface-2 p-2.5" : "bg-black/12 p-4")}>
      <div className="font-x mb-2 text-xs font-extrabold uppercase tracking-[0.08em] opacity-80">{title}</div>
      <div className={cn("flex items-center justify-center", compact ? "gap-2" : "gap-3")}>{children}</div>
    </div>
  );
}

function ResultView() {
  const { result, next, round, config } = useBettingStore();
  if (!result) return null;
  const isLast = round >= config.rounds;

  return (
    <div className="animate-pop space-y-5">
      <OutcomeStrip outcome={result.outcome} />

      <Panel
        title="Your bets"
        meta={
          <span className={cn("font-xx text-2xl font-black tabular-nums", result.roundPnl >= 0 ? "text-positive" : "text-negative")}>
            {formatSigned(result.roundPnl)}
          </span>
        }
      >
        {result.lines.length === 0 ? (
          <p className="text-sm text-muted">You placed no bets this round.</p>
        ) : (
          <ul className="-my-2 divide-y divide-border">
            {result.lines.map((l) => (
              <ResultLine key={l.id} line={l} />
            ))}
          </ul>
        )}
      </Panel>

      <ActionPlate tone="jacket" onClick={next} label={isLast ? "Final results" : "Next round"} icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </div>
  );
}

function ResultLine({ line }: { line: ResolvedLine }) {
  const trueProb = line.trueProb;
  const implied = 1 / (line.b + 1);
  const hadEdge = trueProb !== null && implied < trueProb;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-[4px] text-white",
          line.voided ? "bg-surface-2 text-muted" : line.won ? "bg-positive" : "bg-negative",
        )}
      >
        {line.voided ? "–" : line.won ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{line.label}</span>
        <span className="text-xs text-muted">
          stake {line.stake} @ {line.b.toFixed(2)}:1
          {trueProb !== null && (
            <>
              {" · "}true {(trueProb * 100).toFixed(0)}% vs implied {(implied * 100).toFixed(0)}%{" · "}
              <span className={cn("font-bold", hadEdge ? "text-positive" : "text-negative")}>{hadEdge ? "+EV" : "−EV"}</span>
            </>
          )}
        </span>
      </span>
      <span className={cn("font-x shrink-0 font-black tabular-nums", line.pnl > 0 && "text-positive", line.pnl < 0 && "text-negative", line.pnl === 0 && "text-muted")}>
        {formatSigned(line.pnl)}
      </span>
    </li>
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
    <div className="mx-auto max-w-4xl space-y-6">
      <FinalBand
        title="Final bankroll"
        figure={bankroll}
        figureLabel={`${formatSigned(net)} net · peak ${peak}`}
        actions={<ActionPlate tone="jacket" onClick={reset} label="Play again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Bets placed" value={String(totalBets)} />
          <Stat label="Bets won" value={`${wins}/${totalBets}`} />
          <Stat label="Rounds" value={String(history.length)} />
        </div>
      </FinalBand>

      {history.length > 0 && (
        <Panel title="Round by round">
          <div className="space-y-2">
            {history.map((r, i) => (
              <RoundBreakdown key={i} index={i} result={r} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function RoundBreakdown({ index, result }: { index: number; result: RoundResult }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-[8px] bg-surface-2">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm">
        <span className="font-xx grid h-9 w-11 place-items-center rounded-[4px] bg-surface font-black">R{index + 1}</span>
        <span className="text-muted">
          {result.lines.length} bet{result.lines.length === 1 ? "" : "s"}
        </span>
        <span className={cn("font-x ml-auto font-black tabular-nums", result.roundPnl > 0 && "text-positive", result.roundPnl < 0 && "text-negative", result.roundPnl === 0 && "text-muted")}>
          {formatSigned(result.roundPnl)}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-pop space-y-3 bg-surface p-4">
          <OutcomeStrip outcome={result.outcome} compact />
          {result.lines.length === 0 ? (
            <p className="text-xs text-muted">No bets placed.</p>
          ) : (
            <ul className="divide-y divide-border">
              {result.lines.map((l) => (
                <ResultLine key={l.id} line={l} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
