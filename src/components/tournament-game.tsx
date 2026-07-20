"use client";

import * as React from "react";
import {
  Play, RotateCcw, Flag, ArrowRight, Settings2, Trophy, Timer, Swords,
  TrendingUp, TrendingDown, MinusCircle, Check, X, Info, ArrowUp, ArrowDown, Equal,
} from "lucide-react";
import {
  buildGame,
  scoreTradeDecision,
  scoreInfoDecision,
  scoreEstimate,
  actualDirection,
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
import { Countdown as StartCountdown } from "@/components/countdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Phase = "intro" | "countdown" | "playing" | "over";

export function TournamentGame() {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [config, setConfig] = React.useState<TournamentConfig>(DEFAULT_TOURNAMENT_CONFIG);
  const [game, setGame] = React.useState<GameData | null>(null);
  const [roundIdx, setRoundIdx] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [history, setHistory] = React.useState<RoundOutcome[]>([]);

  const start = (cfg: TournamentConfig) => {
    setConfig(cfg);
    setGame(buildGame(cfg));
    setRoundIdx(0);
    setScore(0);
    setHistory([]);
    setPhase("countdown");
  };

  const onNext = (outcome: RoundOutcome) => {
    setScore((s) => s + outcome.totalPts);
    setHistory((h) => [...h, outcome]);
    if (!game || roundIdx + 1 >= game.rounds.length) setPhase("over");
    else setRoundIdx((i) => i + 1);
  };

  if (phase === "intro") return <Intro saved={config} onStart={start} />;
  if (phase === "countdown")
    return (
      <>
        <Intro saved={config} onStart={start} />
        <StartCountdown onDone={() => setPhase("playing")} />
      </>
    );
  if (phase === "over") return <GameOver history={history} score={score} onAgain={() => setPhase("intro")} />;

  if (!game) return null;
  const round = game.rounds[roundIdx];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Round" value={`${roundIdx + 1}/${game.rounds.length}`} />
        <StatTile label="Score" value={String(score)} accent />
        <StatTile label="Phase" value={round.kind === "trade" ? "Pricing" : "News"} />
      </div>

      <MatrixTable matrix={game.matrix} />

      <RoundCard key={roundIdx} round={round} decisionSeconds={config.decisionSeconds} onNext={onNext} />
    </div>
  );
}

/* ----------------------------------- intro --------------------------- */

function Intro({ saved, onStart }: { saved: TournamentConfig; onStart: (c: TournamentConfig) => void }) {
  const [config, setConfig] = React.useState<TournamentConfig>(saved);
  const set = <K extends keyof TournamentConfig>(k: K, v: TournamentConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  return (
    <Card className="obsidian-glow mx-auto max-w-2xl">
      <CardContent className="space-y-7 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg">
            <Swords className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-black uppercase tracking-tight">Tournament Market</h2>
          <p className="max-w-lg text-muted">
            Four teams, a win-probability matrix, and a group stage that breaks
            every tie before crowning a champion. Each round you&apos;re quoted a
            market on an outcome — decide whether to <span className="text-positive">buy</span> or{" "}
            <span className="text-negative">sell</span>, then estimate its true fair value. Later,
            live results drop and you re-price on the news.
          </p>
        </div>

        <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4 text-accent" /> Game settings
          </div>
          <Segmented label="Pricing rounds" options={TOURNAMENT_OPTIONS.tradeRounds} value={config.tradeRounds} onChange={(v) => set("tradeRounds", v)} />
          <Segmented label="News rounds" options={TOURNAMENT_OPTIONS.infoRounds} value={config.infoRounds} onChange={(v) => set("infoRounds", v)} />
          <Segmented label="Seconds to decide" options={TOURNAMENT_OPTIONS.decisionSeconds} value={config.decisionSeconds} onChange={(v) => set("decisionSeconds", v)} suffix="s" />
        </div>

        <div className="flex justify-center">
          <Button size="lg" onClick={() => onStart(config)}>
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

/* --------------------------------- matrix ---------------------------- */

function MatrixTable({ matrix, highlight }: { matrix: Matrix; highlight?: string }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          Win-probability matrix
          <span className="font-normal text-muted">— P(row beats column)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center pb-6">
        <table className="border-separate border-spacing-1.5 text-center font-mono text-sm sm:border-spacing-2">
          <thead>
            <tr>
              <th className="h-10 w-10" />
              {TEAMS.map((t) => (
                <th key={t} className="p-0">
                  <div className="mx-auto grid h-9 w-14 place-items-center rounded-lg bg-accent/10 text-xs font-bold uppercase tracking-wider text-accent sm:w-16">
                    {t}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEAMS.map((row, i) => (
              <tr key={row}>
                <th className="p-0">
                  <div className="grid h-14 w-10 place-items-center rounded-lg bg-accent/10 text-xs font-bold uppercase tracking-wider text-accent">
                    {row}
                  </div>
                </th>
                {TEAMS.map((col, j) => {
                  const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
                  const isHi = highlight === key && i !== j;
                  if (i === j) {
                    return (
                      <td key={col} className="p-0">
                        <div className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-border bg-surface-2/30 text-border sm:w-16">
                          —
                        </div>
                      </td>
                    );
                  }
                  const p = matrix[i][j];
                  const strong = p >= 0.65 || p <= 0.35;
                  return (
                    <td key={col} className="p-0">
                      <div
                        className={cn(
                          "grid h-14 w-14 place-items-center rounded-lg border font-semibold tabular-nums shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md sm:w-16",
                          p >= 0.5
                            ? "border-positive/30 bg-positive/10 text-positive"
                            : "border-negative/30 bg-negative/10 text-negative",
                          strong && (p >= 0.5 ? "bg-positive/20" : "bg-negative/20"),
                          isHi && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
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
      </CardContent>
    </Card>
  );
}

/* --------------------------------- round ----------------------------- */

type Step = "decide" | "estimate" | "result";

function RoundCard({ round, decisionSeconds, onNext }: { round: Round; decisionSeconds: number; onNext: (o: RoundOutcome) => void }) {
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
    setStep("result");
  };

  return (
    <Card className="obsidian-glow">
      <CardContent className="space-y-5 p-6">
        {round.kind === "info" && round.reveal && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <span className="font-semibold text-foreground">{round.reveal.text}</span>{" "}
              Your earlier fair value was <span className="font-mono text-foreground">{round.priorValue}</span>.
              Re-price it.
            </span>
          </div>
        )}

        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {round.kind === "trade" ? "Price this market" : "Re-price on the news"}
          </div>
          <h3 className="mt-1 text-xl font-black uppercase leading-tight tracking-tight sm:text-2xl">
            {round.event.label}
          </h3>
        </div>

        {step === "decide" && (
          <>
            <DecisionTimer left={left} total={decisionSeconds} />
            {round.kind === "trade" ? (
              <div className="space-y-3">
                <QuoteBar quote={round.quote!} />
                <div className="grid grid-cols-3 gap-2">
                  <DecisionBtn tone="positive" icon={TrendingUp} label="Buy" sub={`@ ${round.quote!.ask}`} onClick={() => choose("buy")} />
                  <DecisionBtn tone="neutral" icon={MinusCircle} label="Pass" onClick={() => choose("pass")} />
                  <DecisionBtn tone="negative" icon={TrendingDown} label="Sell" sub={`@ ${round.quote!.bid}`} onClick={() => choose("sell")} />
                </div>
                <p className="text-center text-xs text-muted">
                  Buy if you think fair value is above {round.quote!.ask}; sell if below {round.quote!.bid}.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-center text-sm text-muted">Does this outcome&apos;s fair value move?</p>
                <div className="grid grid-cols-3 gap-2">
                  <DecisionBtn tone="positive" icon={ArrowUp} label="Up" onClick={() => choose("up")} />
                  <DecisionBtn tone="neutral" icon={Equal} label="Same" onClick={() => choose("same")} />
                  <DecisionBtn tone="negative" icon={ArrowDown} label="Down" onClick={() => choose("down")} />
                </div>
              </div>
            )}
          </>
        )}

        {step === "estimate" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-center text-sm text-muted">
              You chose{" "}
              <span className={cn("font-semibold", decisionTone(decision!))}>{decisionLabel(decision!)}</span>
              {timedOut && <span className="text-negative"> (timed out)</span>}. Now lock in your estimate.
            </div>
            <label className="block text-center text-sm text-muted">
              Your fair-value estimate (0–100)
            </label>
            <div className="mx-auto flex max-w-xs items-center gap-2">
              <input
                autoFocus
                inputMode="numeric"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                onKeyDown={(e) => e.key === "Enter" && estimate !== "" && submitEstimate()}
                placeholder="e.g. 42"
                className="h-11 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-center font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
              />
              <Button onClick={submitEstimate} disabled={estimate === ""}>
                Lock in <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "result" && outcome && <ResultView outcome={outcome} onNext={() => onNext(outcome)} />}
      </CardContent>
    </Card>
  );
}

function DecisionTimer({ left, total }: { left: number; total: number }) {
  const pctLeft = Math.max(0, (left / total) * 100);
  const danger = left <= total * 0.3;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted"><Timer className="h-3.5 w-3.5" /> Decide</span>
        <span className={cn("font-mono font-semibold", danger ? "text-negative" : "text-foreground")}>{Math.ceil(left)}s</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", danger ? "bg-negative" : "bg-accent")} style={{ width: `${pctLeft}%` }} />
      </div>
    </div>
  );
}

function QuoteBar({ quote }: { quote: { bid: number; ask: number } }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-border">
      <div className="flex-1 bg-negative/10 px-4 py-3 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Bid (sell here)</div>
        <div className="font-mono text-2xl font-bold text-negative">{quote.bid}</div>
      </div>
      <div className="flex-1 bg-positive/10 px-4 py-3 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Ask (buy here)</div>
        <div className="font-mono text-2xl font-bold text-positive">{quote.ask}</div>
      </div>
    </div>
  );
}

function DecisionBtn({
  tone, icon: Icon, label, sub, onClick,
}: { tone: "positive" | "negative" | "neutral"; icon: typeof TrendingUp; label: string; sub?: string; onClick: () => void }) {
  const tones = {
    positive: "border-positive/40 bg-positive/10 text-positive hover:bg-positive/20",
    negative: "border-negative/40 bg-negative/10 text-negative hover:bg-negative/20",
    neutral: "border-border bg-surface-2/50 text-foreground hover:border-foreground/25",
  }[tone];
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 rounded-xl border py-3 font-semibold transition-colors", tones)}>
      <Icon className="h-5 w-5" />
      {label}
      {sub && <span className="font-mono text-xs opacity-80">{sub}</span>}
    </button>
  );
}

function ResultView({ outcome, onNext }: { outcome: RoundOutcome; onNext: () => void }) {
  const won = outcome.totalPts > 0;
  return (
    <div className="animate-pop space-y-4">
      <div className="rounded-xl border border-border bg-surface-2/40 p-4 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">True fair value</div>
        <div className="font-mono text-4xl font-black">{outcome.trueValue}</div>
        {outcome.kind === "info" && outcome.priorValue != null && (
          <div className="mt-1 text-xs text-muted">
            was <span className="font-mono">{outcome.priorValue}</span> → {" "}
            <span className={outcome.trueValue >= outcome.priorValue ? "text-positive" : "text-negative"}>
              {actualDirection(outcome.priorValue, outcome.trueValue)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ScoreLine
          ok={outcome.decisionCorrect}
          label={outcome.kind === "trade" ? "Decision" : "Direction"}
          detail={decisionLabel(outcome.decision)}
          pts={outcome.decisionPts}
        />
        <ScoreLine
          ok={outcome.estimatePts > 0}
          label="Estimate"
          detail={`you said ${outcome.estimate}`}
          pts={outcome.estimatePts}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-2.5">
        <span className="text-sm text-muted">Round total</span>
        <span className={cn("font-mono text-lg font-bold", won ? "text-positive" : outcome.totalPts < 0 ? "text-negative" : "text-muted")}>
          {formatSigned(outcome.totalPts)}
        </span>
      </div>

      <Button size="lg" className="w-full" onClick={onNext}>
        Next <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ScoreLine({ ok, label, detail, pts }: { ok: boolean; label: string; detail: string; pts: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className={cn("grid h-5 w-5 place-items-center rounded-full", ok ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative")}>
          {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </span>
      </div>
      <div className="mt-1 truncate text-sm">{detail}</div>
      <div className={cn("font-mono text-sm font-semibold", pts > 0 ? "text-positive" : pts < 0 ? "text-negative" : "text-muted")}>
        {formatSigned(pts)}
      </div>
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

function StatTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="px-4 py-3 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
        <div className={cn("mt-0.5 font-mono text-2xl font-bold tabular-nums", accent && "text-accent")}>{value}</div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- game over ------------------------- */

function GameOver({ history, score, onAgain }: { history: RoundOutcome[]; score: number; onAgain: () => void }) {
  useRecordGame();
  const decisions = history.filter((h) => h.decisionCorrect).length;
  const estimates = history.filter((h) => h.estimatePts > 0).length;
  const avgErr = history.length
    ? Math.round(history.reduce((s, h) => s + Math.abs(h.estimate - h.trueValue), 0) / history.length)
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="obsidian-glow">
        <CardContent className="space-y-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg">
              <Trophy className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tight">Final score</h2>
            <div className="font-mono text-4xl font-bold">{score}</div>
          </div>

          <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
            <Stat label="Right calls" value={`${decisions}/${history.length}`} />
            <Stat label="Good estimates" value={`${estimates}/${history.length}`} />
            <Stat label="Avg error" value={`${avgErr}`} />
          </div>

          <div className="flex justify-center">
            <Button size="lg" onClick={onAgain}>
              <RotateCcw className="h-4 w-4" /> Play again
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Round-by-round</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface-2/30 px-3 py-2.5 text-sm">
              <Badge tone={h.kind === "trade" ? "outline" : "accent"}>{h.kind === "trade" ? "Price" : "News"}</Badge>
              <span className="min-w-0 flex-1 truncate">{h.eventLabel}</span>
              <span className="font-mono text-xs text-muted">true {h.trueValue} · you {h.estimate}</span>
              <span className={cn("font-mono font-semibold", h.totalPts > 0 ? "text-positive" : h.totalPts < 0 ? "text-negative" : "text-muted")}>
                {formatSigned(h.totalPts)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
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
