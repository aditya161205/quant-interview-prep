"use client";

import * as React from "react";
import { RotateCcw, ArrowRight, Check, X, Info, ArrowUp, ArrowDown, Equal, ChevronDown } from "lucide-react";
import {
  buildGame,
  scoreTradeDecision,
  scoreInfoDecision,
  scoreEstimate,
  actualDirection,
  explainEvent,
  explainReveal,
  TEAMS,
  TOURNAMENT_OPTIONS,
  DEFAULT_TOURNAMENT_CONFIG,
  type TournamentConfig,
  type GameData,
  type Matrix,
  type Round,
  type RoundOutcome,
  type TradeDecision,
  type InfoDecision,
} from "@/lib/tournament-game";
import { cn, formatSigned } from "@/lib/utils";
import { useRecordGame } from "@/store/practice-store";
import { useHideRulesWhile } from "@/components/how-to-play";
import { Countdown as StartCountdown } from "@/components/countdown";
import {
  ActionPlate,
  FinalBand,
  Note,
  Panel,
  PriceField,
  QuotePlates,
  Scoreboard,
  Segmented,
  Stat,
  Ticket,
  TimerBar,
} from "@/components/pit/game-kit";

type Phase = "intro" | "countdown" | "playing" | "over";

export function TournamentGame() {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [config, setConfig] = React.useState<TournamentConfig>(DEFAULT_TOURNAMENT_CONFIG);
  const [game, setGame] = React.useState<GameData | null>(null);
  const [roundIdx, setRoundIdx] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [history, setHistory] = React.useState<RoundOutcome[]>([]);
  useHideRulesWhile(phase === "playing");
  // One polite live region for the whole game: the round verdict and the final
  // score. The matrix and the stat tiles are left out of it on purpose.
  const [status, setStatus] = React.useState("");

  const start = (cfg: TournamentConfig) => {
    setConfig(cfg);
    setGame(buildGame(cfg));
    setRoundIdx(0);
    setScore(0);
    setHistory([]);
    setStatus("");
    setPhase("countdown");
  };

  const onResult = React.useCallback((o: RoundOutcome) => {
    setStatus(
      `True fair value ${o.trueValue}. Your ${o.kind === "trade" ? "call" : "direction"} ` +
        `${decisionLabel(o.decision)} was ${o.decisionCorrect ? "right" : "wrong"}, ` +
        `you estimated ${o.estimate}. Round total ${formatSigned(o.totalPts)}.`,
    );
  }, []);

  const onNext = (outcome: RoundOutcome) => {
    const total = score + outcome.totalPts;
    setScore(total);
    setHistory((h) => [...h, outcome]);
    if (!game || roundIdx + 1 >= game.rounds.length) {
      setStatus(`Game over. Final score ${total} over ${history.length + 1} rounds.`);
      setPhase("over");
    } else {
      setStatus("");
      setRoundIdx((i) => i + 1);
    }
  };

  const round = game?.rounds[roundIdx];
  let content: React.ReactNode = null;
  if (phase === "intro" || phase === "countdown") {
    content = (
      <>
        <Intro saved={config} onStart={start} />
        {phase === "countdown" && <StartCountdown onDone={() => setPhase("playing")} />}
      </>
    );
  } else if (phase === "over" && game) {
    content = <GameOver history={history} score={score} matrix={game.matrix} onAgain={() => setPhase("intro")} />;
  } else if (game && round) {
    content = (
      <div className="space-y-5">
        <Scoreboard
          cells={[
            { label: "Round", value: `${roundIdx + 1}/${game.rounds.length}` },
            { label: "Score", value: score, tone: "hot" },
            { label: "Phase", value: round.kind === "trade" ? "Pricing" : "News" },
          ]}
        />
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <MatrixTable matrix={game.matrix} />
          <RoundCard key={roundIdx} round={round} decisionSeconds={config.decisionSeconds} onResult={onResult} onNext={onNext} />
        </div>
      </div>
    );
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {content}
    </>
  );
}

/* ----------------------------------- intro --------------------------- */

function Intro({ saved, onStart }: { saved: TournamentConfig; onStart: (c: TournamentConfig) => void }) {
  const [config, setConfig] = React.useState<TournamentConfig>(saved);
  const set = <K extends keyof TournamentConfig>(k: K, v: TournamentConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));

  return (
    <Ticket onStart={() => onStart(config)} countdown={false}>
      <Segmented label="Pricing rounds" options={TOURNAMENT_OPTIONS.tradeRounds} value={config.tradeRounds} onChange={(v) => set("tradeRounds", v)} />
      <Segmented label="News rounds" options={TOURNAMENT_OPTIONS.infoRounds} value={config.infoRounds} onChange={(v) => set("infoRounds", v)} />
      <Segmented label="Seconds to decide" options={TOURNAMENT_OPTIONS.decisionSeconds} value={config.decisionSeconds} onChange={(v) => set("decisionSeconds", v)} suffix="s" />
    </Ticket>
  );
}

/* --------------------------------- matrix ---------------------------- */

function MatrixTable({ matrix, highlight }: { matrix: Matrix; highlight?: string }) {
  return (
    <Panel title="Win probabilities" meta={<span className="text-xs text-muted">P(row beats column)</span>}>
      <div className="flex justify-center overflow-x-auto">
        <table className="border-separate border-spacing-1.5 text-center sm:border-spacing-2">
          <thead>
            <tr>
              <th className="h-10 w-10" />
              {TEAMS.map((t) => (
                <th key={t} className="p-0">
                  <div className="font-xx mx-auto grid h-9 w-14 place-items-center rounded-[4px] bg-foreground text-xs font-black uppercase text-background sm:w-16">{t}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEAMS.map((row, i) => (
              <tr key={row}>
                <th className="p-0">
                  <div className="font-xx grid h-14 w-10 place-items-center rounded-[4px] bg-foreground text-xs font-black uppercase text-background">{row}</div>
                </th>
                {TEAMS.map((col, j) => {
                  const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
                  const isHi = highlight === key && i !== j;
                  if (i === j) {
                    return (
                      <td key={col} className="p-0">
                        <div className="grid h-14 w-14 place-items-center rounded-[4px] bg-surface-2 text-muted sm:w-16">—</div>
                      </td>
                    );
                  }
                  const p = matrix[i][j];
                  const strong = p >= 0.65 || p <= 0.35;
                  return (
                    <td key={col} className="p-0">
                      <div
                        className={cn(
                          "font-xx grid h-14 w-14 place-items-center rounded-[4px] text-sm font-black tabular-nums sm:w-16",
                          p >= 0.5 ? (strong ? "bg-positive text-white" : "bg-positive/25 text-foreground") : strong ? "bg-negative text-white" : "bg-negative/25 text-foreground",
                          isHi && "ring-[3px] ring-jacket ring-offset-2 ring-offset-surface",
                        )}
                      >
                        {p.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* --------------------------------- round ----------------------------- */

type Step = "decide" | "estimate" | "result";

function RoundCard({
  round,
  decisionSeconds,
  onResult,
  onNext,
}: {
  round: Round;
  decisionSeconds: number;
  onResult: (o: RoundOutcome) => void;
  onNext: (o: RoundOutcome) => void;
}) {
  const [step, setStep] = React.useState<Step>("decide");
  const [decision, setDecision] = React.useState<TradeDecision | InfoDecision | null>(null);
  const [timedOut, setTimedOut] = React.useState(false);
  const [estimate, setEstimate] = React.useState("");
  const [outcome, setOutcome] = React.useState<RoundOutcome | null>(null);
  const [left, setLeft] = React.useState(decisionSeconds);

  const choose = React.useCallback((d: TradeDecision | InfoDecision, viaTimeout = false) => {
    setDecision(d);
    setTimedOut(viaTimeout);
    setStep("estimate");
  }, []);

  // Decision timer — on expiry, default to the neutral choice.
  React.useEffect(() => {
    if (step !== "decide") return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const l = Math.max(0, decisionSeconds - (Date.now() - startedAt) / 1000);
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(id);
        choose(round.kind === "trade" ? "pass" : "same", true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [step, decisionSeconds, round.kind, choose]);

  const submitEstimate = () => {
    const est = clampPct(Number(estimate || 0));
    let decisionCorrect: boolean;
    let decisionPts: number;
    if (round.kind === "trade") {
      const r = scoreTradeDecision(decision as TradeDecision, round.quote!, round.trueValue);
      decisionCorrect = r.correct;
      decisionPts = r.pts;
    } else {
      const r = scoreInfoDecision(decision as InfoDecision, round.priorValue!, round.trueValue);
      decisionCorrect = r.correct;
      decisionPts = r.pts;
    }
    const estimatePts = scoreEstimate(est, round.trueValue);
    const o: RoundOutcome = {
      kind: round.kind,
      event: round.event,
      eventLabel: round.event.label,
      decision: decision!,
      decisionCorrect,
      decisionPts,
      estimate: est,
      estimatePts,
      trueValue: round.trueValue,
      priorValue: round.priorValue,
      quote: round.quote,
      reveal: round.reveal,
      totalPts: decisionPts + estimatePts,
      timedOut,
    };
    setOutcome(o);
    onResult(o);
    setStep("result");
  };

  return (
    <Panel title={round.kind === "trade" ? "Price this market" : "Re-price on the news"}>
      {round.kind === "info" && round.reveal && (
        <Note tone="warn" icon={<Info className="h-4 w-4" />}>
          <strong>{round.reveal.text}</strong> Your earlier fair value was <strong>{round.priorValue}</strong>. Re-price it.
        </Note>
      )}

      <h3 className="font-xx text-[1.6rem] font-black leading-tight tracking-[-0.01em]">{round.event.label}</h3>

      {step === "decide" && (
        <>
          <TimerBar left={left} total={decisionSeconds} label="Decide" />
          {round.kind === "trade" ? (
            <div className="space-y-3">
              <QuotePlates bid={round.quote!.bid} ask={round.quote!.ask} />
              <div className="grid grid-cols-3 gap-2">
                <ActionPlate tone="buy" label="Buy" sub={`@ ${round.quote!.ask}`} onClick={() => choose("buy")} />
                <ActionPlate tone="neutral" label="Pass" onClick={() => choose("pass")} />
                <ActionPlate tone="sell" label="Sell" sub={`@ ${round.quote!.bid}`} onClick={() => choose("sell")} />
              </div>
              <p className="text-xs text-muted">
                Buy if fair value is above {round.quote!.ask}; sell if below {round.quote!.bid}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Does this outcome&apos;s fair value move?</p>
              <div className="grid grid-cols-3 gap-2">
                <ActionPlate tone="buy" label="Up" icon={<ArrowUp className="h-5 w-5" />} onClick={() => choose("up")} />
                <ActionPlate tone="neutral" label="Same" icon={<Equal className="h-5 w-5" />} onClick={() => choose("same")} />
                <ActionPlate tone="sell" label="Down" icon={<ArrowDown className="h-5 w-5" />} onClick={() => choose("down")} />
              </div>
            </div>
          )}
        </>
      )}

      {step === "estimate" && (
        <div className="space-y-4">
          <Note>
            You chose <strong className={decisionTone(decision!)}>{decisionLabel(decision!)}</strong>
            {timedOut && <span className="text-negative"> (timed out)</span>}. Now lock in your estimate.
          </Note>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <PriceField label="Fair value (0–100)" value={estimate} onChange={(v) => setEstimate(v.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="e.g. 42" />
            </div>
            <ActionPlate tone="jacket" label="Lock in" onClick={submitEstimate} disabled={estimate === ""} className="h-14 min-h-0" />
          </div>
        </div>
      )}

      {step === "result" && outcome && <ResultView outcome={outcome} onNext={() => onNext(outcome)} />}
    </Panel>
  );
}

function ResultView({ outcome, onNext }: { outcome: RoundOutcome; onNext: () => void }) {
  return (
    <div className="animate-pop space-y-4">
      <div className="flex items-end justify-between gap-4 rounded-[8px] bg-[#0f131a] text-white dark:ring-1 dark:ring-white/10 px-5 py-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.1em] opacity-70">True fair value</div>
          <div className="font-xx text-[2.6rem] font-black leading-none tabular-nums text-gold">{outcome.trueValue}</div>
        </div>
        {outcome.kind === "info" && outcome.priorValue != null && (
          <div className="text-right text-sm">
            was {outcome.priorValue} →{" "}
            <span className={cn("font-bold", outcome.trueValue >= outcome.priorValue ? "text-[#5ee09a]" : "text-[#ff7c8a]")}>
              {actualDirection(outcome.priorValue, outcome.trueValue)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ScoreLine ok={outcome.decisionCorrect} label={outcome.kind === "trade" ? "Decision" : "Direction"} detail={decisionLabel(outcome.decision)} pts={outcome.decisionPts} />
        <ScoreLine ok={outcome.estimatePts > 0} label="Estimate" detail={`you said ${outcome.estimate}`} pts={outcome.estimatePts} />
      </div>

      <div className={cn("flex items-center justify-between rounded-[8px] px-5 py-3 text-white", outcome.totalPts > 0 ? "bg-positive" : outcome.totalPts < 0 ? "bg-negative" : "bg-foreground")}>
        <span className="font-x text-sm font-extrabold uppercase">Round total</span>
        <span className="font-xx text-2xl font-black tabular-nums">{formatSigned(outcome.totalPts)}</span>
      </div>

      <ActionPlate tone="jacket" label="Next" icon={<ArrowRight className="h-5 w-5" />} onClick={onNext} className="w-full" />
    </div>
  );
}

function ScoreLine({ ok, label, detail, pts }: { ok: boolean; label: string; detail: string; pts: number }) {
  return (
    <div className="rounded-[6px] bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted">{label}</span>
        <span className={cn("grid h-6 w-6 place-items-center rounded-[3px] text-white", ok ? "bg-positive" : "bg-negative")}>
          {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </span>
      </div>
      <div className="mt-1 truncate text-sm">{detail}</div>
      <div className={cn("font-xx text-xl font-black tabular-nums", pts > 0 ? "text-positive" : pts < 0 ? "text-negative" : "text-muted")}>{formatSigned(pts)}</div>
    </div>
  );
}

/* --------------------------------- helpers --------------------------- */

const clampPct = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

function decisionLabel(d: TradeDecision | InfoDecision): string {
  return { buy: "Buy", sell: "Sell", pass: "Pass", up: "Up", down: "Down", same: "Same" }[d];
}
function decisionTone(d: TradeDecision | InfoDecision): string {
  if (d === "buy" || d === "up") return "text-positive";
  if (d === "sell" || d === "down") return "text-negative";
  return "text-foreground";
}

/* --------------------------------- game over ------------------------- */

function GameOver({ history, score, matrix, onAgain }: { history: RoundOutcome[]; score: number; matrix: Matrix; onAgain: () => void }) {
  useRecordGame();
  const decisions = history.filter((h) => h.decisionCorrect).length;
  const estimates = history.filter((h) => h.estimatePts > 0).length;
  const avgErr = history.length ? Math.round(history.reduce((s, h) => s + Math.abs(h.estimate - h.trueValue), 0) / history.length) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FinalBand
        title="Final score"
        figure={score}
        figureLabel={`${history.length} rounds`}
        actions={<ActionPlate tone="jacket" onClick={onAgain} label="Play again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Right calls" value={`${decisions}/${history.length}`} />
          <Stat label="Good estimates" value={`${estimates}/${history.length}`} />
          <Stat label="Avg error" value={`${avgErr}`} />
        </div>
      </FinalBand>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <MatrixTable matrix={matrix} />
        <Panel title="Round by round" meta={<span className="text-xs text-muted">Open a round for the working</span>}>
          <div className="space-y-2">
            {history.map((h, i) => (
              <RoundBreakdown key={i} outcome={h} matrix={matrix} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RoundBreakdown({ outcome: h, matrix }: { outcome: RoundOutcome; matrix: Matrix }) {
  const [open, setOpen] = React.useState(false);
  const bullets = explainEvent(h.event, matrix);

  // What the right trade/direction call was, and why.
  let verdict = "";
  if (h.kind === "trade" && h.quote) {
    const { bid, ask } = h.quote;
    if (h.trueValue > ask) verdict = `Fair value ${h.trueValue} is above the ask ${ask}: Buy was the +EV call.`;
    else if (h.trueValue < bid) verdict = `Fair value ${h.trueValue} is below the bid ${bid}: Sell was the +EV call.`;
    else verdict = `Fair value ${h.trueValue} sits inside the ${bid}–${ask} market: Pass was correct (no edge).`;
  } else if (h.kind === "info" && h.reveal && h.priorValue != null) {
    verdict = explainReveal(h.event, h.reveal, h.priorValue, h.trueValue);
  }

  return (
    <div className="overflow-hidden rounded-[8px] bg-surface-2">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm">
        <span className={cn("font-x rounded-[3px] px-2 py-1 text-[0.65rem] font-extrabold uppercase", h.kind === "trade" ? "bg-surface" : "bg-jacket text-jacket-ink")}>
          {h.kind === "trade" ? "Price" : "News"}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{h.eventLabel}</span>
        <span className="text-xs text-muted">
          true {h.trueValue} · you {h.estimate}
        </span>
        <span className={cn("font-x font-black tabular-nums", h.totalPts > 0 ? "text-positive" : h.totalPts < 0 ? "text-negative" : "text-muted")}>
          {formatSigned(h.totalPts)}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="animate-pop space-y-3 bg-surface px-4 py-4 text-sm">
          {h.kind === "trade" && h.quote && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                Market <strong className="text-foreground">{h.quote.bid} / {h.quote.ask}</strong>
              </span>
              <span>
                Fair value <strong className="text-foreground">{h.trueValue}</strong>
              </span>
              <span>
                Your estimate <strong className="text-foreground">{h.estimate}</strong>
              </span>
            </div>
          )}
          <ul className="space-y-1.5 text-muted">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-jacket" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {verdict && <Note>{verdict}</Note>}
        </div>
      )}
    </div>
  );
}
