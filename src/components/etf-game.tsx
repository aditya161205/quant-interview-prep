"use client";

import * as React from "react";
import { RotateCcw, ArrowRight, Lock, CheckCircle2, Zap, AlertTriangle, Flag } from "lucide-react";
import {
  useEtfStore,
  DEFAULT_ETF_CONFIG,
  type EtfConfig,
  type PlayerResult,
  type RoundRecord,
} from "@/store/etf-store";
import {
  TX_COST,
  ROUND_OPTIONS,
  MAX_UNITS_OPTIONS,
  SECONDS_OPTIONS,
  optimalAction,
} from "@/lib/etf-game";
import { cn } from "@/lib/utils";
import { useRecordGame } from "@/store/practice-store";
import { useHideRulesWhile } from "@/components/how-to-play";
import {
  ActionPlate,
  FinalBand,
  Note,
  Panel,
  QuietButton,
  QuotePlates,
  Scoreboard,
  Segmented,
  Standings,
  Stat,
  Ticket,
  Timer,
} from "@/components/pit/game-kit";

/* money helpers — this game is denominated in dollars */
const money = (x: number) => `$${x.toFixed(2)}`;
const total$ = (x: number) => `$${Math.round(x)}`;
const signed$ = (x: number) =>
  `${x > 0 ? "+" : x < 0 ? "-" : ""}$${Math.abs(x).toFixed(2)}`;

export function EtfGame() {
  const phase = useEtfStore((s) => s.phase);
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
 * final placing are spoken — the basket table and the bots' running P&L are
 * left out so a screen reader isn't re-reading the board every round.
 */
function Announcer() {
  const { phase, round, data, results, totals, bots } = useEtfStore();

  let message = "";
  if (phase === "result" && data && results) {
    const you = results.find((r) => r.name === "You");
    const best = optimalAction(data);
    if (you) {
      message = [
        `Round ${round}: NAV ${money(data.nav)} against ${money(data.etfBid)} bid, ${money(data.etfAsk)} ask.`,
        you.action === best ? "Correct call." : `Best move was to ${best}.`,
        `Round PnL ${signed$(you.pnl)}.`,
      ].join(" ");
    }
  } else if (phase === "gameover") {
    const ranked = ["You", ...bots].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
    const place = ranked.indexOf("You") + 1;
    message = `Game over. You finished ${ordinal(place)} of ${ranked.length} on ${total$(totals["You"] ?? 0)}.`;
  }

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

/* ----------------------------------- intro --------------------------- */

function Intro() {
  const start = useEtfStore((s) => s.start);
  const saved = useEtfStore((s) => s.config);
  const [config, setConfig] = React.useState<EtfConfig>(saved ?? DEFAULT_ETF_CONFIG);
  const set = <K extends keyof EtfConfig>(k: K, v: EtfConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));

  return (
    <Ticket onStart={() => start(config)}>
      <Segmented label="Rounds" options={ROUND_OPTIONS} value={config.rounds} onChange={(v) => set("rounds", v)} />
      <Segmented label="Max units" options={MAX_UNITS_OPTIONS} value={config.maxUnits} onChange={(v) => set("maxUnits", v)} />
      <Segmented label="Timer" options={SECONDS_OPTIONS} value={config.seconds} onChange={(v) => set("seconds", v)} suffix="s" />
    </Ticket>
  );
}

/* ----------------------------------- table --------------------------- */

function Table() {
  const { phase, config, round, data, results, totals, timeout, endGame, bots } = useEtfStore();
  if (!data) return null;
  const hasChanges = data.stocks.some((s) => s.change !== 0);
  const tone = (x: number) => (x > 0 ? ("good" as const) : x < 0 ? ("bad" as const) : undefined);

  return (
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Round", value: `${round}/${config.rounds}` },
          ...["You", ...bots].map((name) => ({ label: name, value: total$(totals[name] ?? 0), tone: tone(totals[name] ?? 0) })),
        ]}
        aside={
          <QuietButton onClick={endGame} className="text-white/70 hover:bg-white/10 hover:text-white">
            <Flag className="h-4 w-4" /> End
          </QuietButton>
        }
      />

      <div key={round} className="animate-round space-y-5">
        {data.event && (
          <Note tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>
            <strong>News:</strong> {data.event}
          </Note>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <Panel title={data.basket} meta={<QuotePlates bid={money(data.etfBid)} ask={money(data.etfAsk)} />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-x text-left text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                    <th className="pb-3">Ticker</th>
                    <th className="pb-3 text-right">Price</th>
                    {hasChanges && <th className="pb-3 text-right">Change</th>}
                    <th className="pb-3 text-right">Weight</th>
                    <th className="pb-3 text-right">W × P</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.stocks.map((s) => (
                    <tr key={s.ticker} className="border-t border-border">
                      <td className="py-3">
                        <span className="font-xx rounded-[3px] bg-foreground px-2 py-1 text-xs font-black tracking-[0.06em] text-background">{s.ticker}</span>
                      </td>
                      <td className="font-x py-3 text-right font-bold">{money(s.price)}</td>
                      {hasChanges && (
                        <td className={cn("font-x py-3 text-right font-bold", s.change > 0 ? "text-positive" : s.change < 0 ? "text-negative" : "text-muted")}>
                          {s.change > 0 ? "+" : ""}
                          {s.change.toFixed(2)}
                        </td>
                      )}
                      <td className="py-3 text-right text-muted">{s.weight.toFixed(2)}</td>
                      <td className="font-x py-3 text-right font-black">{money(s.weight * s.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-[8px] bg-[#0f131a] text-white dark:ring-1 dark:ring-white/10 px-5 py-4">
              <span className="font-x text-xs font-extrabold uppercase tracking-[0.1em] opacity-75">NAV = Σ (W × P)</span>
              {phase === "trading" ? (
                <span className="font-xx inline-flex items-center gap-2 text-2xl font-black opacity-60">
                  <Lock className="h-5 w-5" /> ???
                </span>
              ) : (
                <span className="animate-pop font-xx text-3xl font-black tabular-nums text-gold">{money(data.nav)}</span>
              )}
            </div>
            <p className="text-xs text-muted">Transaction cost ${TX_COST} per trade.</p>
          </Panel>

          <div className="space-y-5">
            <Panel title={phase === "trading" ? "Your trade" : "Round result"}>
              {phase === "trading" ? <TradeControls seconds={config.seconds} onExpire={timeout} /> : <ResultFooter />}
            </Panel>
            <Panel title="The race">
              <PlayersPanel results={results} totals={totals} trading={phase === "trading"} />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayersPanel({
  results,
  totals,
  trading,
}: {
  results: PlayerResult[] | null;
  totals: Record<string, number>;
  trading: boolean;
}) {
  const bots = useEtfStore((s) => s.bots);
  const order = ["You", ...bots];

  return (
    <ol className="-my-2 divide-y divide-border">
      {order.map((name, i) => {
        const isYou = name === "You";
        const res = results?.find((r) => r.name === name);
        const tot = totals[name] ?? 0;
        return (
          <li key={name} style={{ animationDelay: `${i * 70}ms` }} className="animate-pop flex items-center gap-3 py-3">
            <span className={cn("font-xx grid h-9 w-11 place-items-center rounded-[4px] text-xs font-black", isYou ? "bg-jacket text-jacket-ink" : "bg-surface-2")}>
              {isYou ? "YOU" : name.slice(0, 3).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="flex items-center gap-1.5 font-bold">
                {name}
                {res?.first && (
                  <span className="font-x inline-flex items-center gap-0.5 rounded-[3px] bg-gold px-1.5 text-[0.65rem] font-extrabold text-[#1a1300]">
                    <Zap className="h-2.5 w-2.5" /> 1ST
                  </span>
                )}
              </span>
              <span className="block text-xs text-muted">{trading || !res ? (isYou ? "your move…" : "calculating…") : <RoundActionLine result={res} />}</span>
            </span>
            <span className={cn("font-xx text-lg font-black tabular-nums", tot > 0 && "text-positive", tot < 0 && "text-negative")}>{total$(tot)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function RoundActionLine({ result }: { result: PlayerResult }) {
  if (result.action === "skip") return <>Passed</>;
  return (
    <>
      {result.action === "buy" ? "Bought" : "Sold"} {result.units} ·{" "}
      <span className={cn("font-bold", result.pnl > 0 ? "text-positive" : result.pnl < 0 ? "text-negative" : "")}>{signed$(result.pnl)}</span>
    </>
  );
}

/* ---------------------------- trade controls ------------------------- */

function TradeControls({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const { submitTrade, config } = useEtfStore();
  const [units, setUnits] = React.useState(5);

  return (
    <div className="animate-pop space-y-5">
      <Timer seconds={seconds} onExpire={onExpire} />
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-x text-xs font-extrabold uppercase tracking-[0.08em] text-muted">Units</span>
          <span className="font-xx text-2xl font-black tabular-nums">{units}</span>
        </div>
        <input
          type="range"
          min={1}
          max={config.maxUnits}
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
          style={{ accentColor: "var(--jacket)" }}
          className="w-full"
          aria-label="Units"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ActionPlate tone="buy" onClick={() => submitTrade("buy", units)} label="Buy" sub="at the ask" />
        <ActionPlate tone="sell" onClick={() => submitTrade("sell", units)} label="Sell" sub="at the bid" />
        <ActionPlate tone="neutral" onClick={() => submitTrade("skip", 0)} label="Skip" sub="no trade" />
      </div>
    </div>
  );
}

function ResultFooter() {
  const { results, data, next, round, config } = useEtfStore();
  const you = results?.find((r) => r.name === "You");
  if (!you || !data) return null;
  const correct = you.action === optimalAction(data);
  const isLast = round >= config.rounds;

  return (
    <div className="animate-pop space-y-4">
      <div className={cn("rounded-[8px] px-5 py-4 text-white", you.pnl > 0 ? "bg-positive" : you.pnl < 0 ? "bg-negative" : "bg-foreground")}>
        <div className="text-xs font-bold uppercase tracking-[0.1em] opacity-85">Round P&amp;L</div>
        <div className="font-xx text-[2.6rem] font-black leading-none tabular-nums">{signed$(you.pnl)}</div>
      </div>
      {correct ? (
        <Note tone="good" icon={<CheckCircle2 className="h-4 w-4 text-positive" />}>
          Correct call.
        </Note>
      ) : (
        <Note>
          Best move was to <strong>{optimalAction(data)}</strong>.
        </Note>
      )}
      <ActionPlate tone="jacket" onClick={next} label={isLast ? "See results" : "Next round"} icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
    </div>
  );
}

/* ------------------------------- game over --------------------------- */

function GameOver() {
  const { totals, bots, history, reset } = useEtfStore();
  useRecordGame();
  const ranked = ["You", ...bots]
    .map((name) => ({ name, isYou: name === "You", total: totals[name] ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const youRank = ranked.findIndex((r) => r.isYou) + 1;
  const youTotal = totals["You"] ?? 0;
  const correct = history.filter((h) => h.correct).length;
  const skipped = history.filter((h) => h.action === "skip").length;
  const traded = history.filter((h) => h.action !== "skip");
  const avgSpeed = traded.length ? (traded.reduce((s, h) => s + h.speed, 0) / traded.length).toFixed(1) : "—";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <FinalBand
        title={`You finished ${ordinal(youRank)}`}
        figure={total$(youTotal)}
        figureLabel="Your P&L"
        actions={<ActionPlate tone="jacket" onClick={reset} label="Play again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <Standings rows={ranked.map((p) => ({ name: p.name, score: total$(p.total), you: p.isYou }))} />
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Correct trades" value={`${correct}/${history.length}`} />
          <Stat label="Avg speed" value={avgSpeed === "—" ? "—" : `${avgSpeed}s`} />
          <Stat label="Skipped" value={String(skipped)} />
        </div>
      </FinalBand>

      <Panel title="Round by round">
        <ol className="divide-y divide-border">
          {history.map((r) => (
            <RecapRow key={r.round} record={r} />
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function RecapRow({ record }: { record: RoundRecord }) {
  const detail =
    record.action === "skip"
      ? "skipped"
      : `${record.action === "buy" ? "bought" : "sold"} ${record.units} @ ${money(record.action === "buy" ? record.etfAsk : record.etfBid)}`;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
      <span className="font-xx grid h-9 w-11 place-items-center rounded-[4px] bg-surface-2 font-black">R{record.round}</span>
      <span className={cn("font-x rounded-[3px] px-2 py-1 text-[0.65rem] font-extrabold uppercase", record.correct ? "bg-positive text-white" : "bg-surface-2")}>
        {record.correct ? "Correct" : "Miss"}
      </span>
      <span className="text-muted">{detail}</span>
      <span className="ml-auto flex items-center gap-4 tabular-nums">
        <span className="text-muted">NAV {money(record.nav)}</span>
        <span className="text-muted">
          {money(record.etfBid)}/{money(record.etfAsk)}
        </span>
        <span className={cn("font-x font-black", record.pnl > 0 && "text-positive", record.pnl < 0 && "text-negative")}>{signed$(record.pnl)}</span>
      </span>
    </li>
  );
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
