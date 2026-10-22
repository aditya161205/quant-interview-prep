"use client";

import * as React from "react";
import { DAYS, GREEKS, GREEK_LABEL, S0, factsOf, horizon, legText, pnl, position, type GreekName, type Strategy } from "@/lib/strategies";
import { cn } from "@/lib/utils";

const LO = 70;
const HI = 130;
const STEP = 0.5;
const xs = Array.from({ length: (HI - LO) / STEP + 1 }, (_, i) => LO + i * STEP);

/** Track an element's rendered width so charts draw at real pixels (text stays 11px on phones). */
function useWidth(fallback: number) {
  const [w, setW] = React.useState(fallback);
  // Measure as soon as the element mounts (no first frame at the fallback width), then follow resizes.
  const ref = React.useCallback((el: HTMLElement | null) => {
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(lo: number, hi: number, n = 5): number[] {
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const sgn = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v < 0 ? `−${Math.abs(v).toFixed(2)}` : "0.00");
const strikes = (st: Strategy) => [...new Set(st.legs.filter((l) => l.kind !== "stock").map((l) => l.strike!))].sort((a, b) => a - b);
const expiryLabel = (st: Strategy) => (st.legs.some((l) => l.days && l.days !== DAYS) ? `At first expiry (${horizon(st)}d)` : "At expiry");

/** P&L against the stock price: at expiry (solid) and today (dashed), profit shaded green and loss red. */
export function PayoffChart({ st, height = 260 }: { st: Strategy; height?: number }) {
  const [wrap, W] = useWidth(640);
  const id = React.useId().replace(/:/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const exp = React.useMemo(() => xs.map((S) => pnl(st, S, true)), [st]);
  const now = React.useMemo(() => xs.map((S) => pnl(st, S, false)), [st]);

  const all = [...exp, ...now, 0];
  const pad = (Math.max(...all) - Math.min(...all)) * 0.1 || 1;
  const yMin = Math.min(...all) - pad;
  const yMax = Math.max(...all) + pad;
  const m = { l: 44, r: 12, t: 12, b: 28 };
  const H = height;
  const sx = (S: number) => m.l + ((S - LO) / (HI - LO)) * (W - m.l - m.r);
  const sy = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  const area = `M${sx(LO)},${sy(0)}${exp.map((v, i) => `L${sx(xs[i]).toFixed(1)},${sy(v).toFixed(1)}`).join("")}L${sx(HI)},${sy(0)}Z`;
  // Strike labels, dropping any that would sit within 26px of one already placed (the current price goes first).
  const ticksX: number[] = [];
  for (const S of [S0, LO, HI, ...strikes(st)]) if (ticksX.every((t) => Math.abs(sx(t) - sx(S)) >= 26)) ticksX.push(S);

  const at = (S: number) => {
    const i = Math.round((S - LO) / STEP);
    return { exp: exp[i], now: now[i] };
  };
  const toS = (clientX: number, rect: DOMRect) => {
    const S = LO + ((clientX - rect.left - m.l) / (W - m.l - m.r)) * (HI - LO);
    return Math.min(HI, Math.max(LO, Math.round(S / STEP) * STEP));
  };
  const h = hover !== null ? at(hover) : null;

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="1" y1="3" x2="17" y2="3" stroke="var(--viz-1)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {expiryLabel(st)}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="1" y1="3" x2="17" y2="3" stroke="var(--viz-2)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
          </svg>
          Today ({horizon(st)} days to {expiryLabel(st) === "At expiry" ? "expiry" : "first expiry"})
        </span>
      </figcaption>
      <div ref={wrap} className="relative">
        <svg
          width={W}
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`Profit and loss from stock ${LO} to ${HI}. Use the arrow keys to read values.`}
          className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerMove={(e) => setHover(toS(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover((v) => v ?? S0)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            setHover((v) => Math.min(HI, Math.max(LO, (v ?? S0) + (e.key === "ArrowRight" ? 1 : -1))));
          }}
        >
          <defs>
            <clipPath id={`up-${id}`}>
              <rect x={m.l} y={m.t} width={W} height={Math.max(0, sy(0) - m.t)} />
            </clipPath>
            <clipPath id={`down-${id}`}>
              <rect x={m.l} y={sy(0)} width={W} height={Math.max(0, H - m.b - sy(0))} />
            </clipPath>
          </defs>
          {niceTicks(yMin, yMax).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1.5 : 1} opacity={v === 0 ? 1 : 0.6} />
              <text x={m.l - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {v > 0 ? `+${v}` : v}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--positive)" opacity={0.12} clipPath={`url(#up-${id})`} />
          <path d={area} fill="var(--negative)" opacity={0.12} clipPath={`url(#down-${id})`} />
          <line x1={sx(S0)} x2={sx(S0)} y1={m.t} y2={H - m.b} stroke="var(--border)" />
          <path d={line(now)} fill="none" stroke="var(--viz-2)" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
          <path d={line(exp)} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {ticksX.map((S) => (
            <text key={S} x={sx(S)} y={H - m.b + 16} textAnchor="middle" className={cn("text-[11px] tabular-nums", S === S0 ? "fill-foreground font-bold" : "fill-muted")}>
              {S}
            </text>
          ))}
          {hover !== null && h && (
            <g pointerEvents="none">
              <line x1={sx(hover)} x2={sx(hover)} y1={m.t} y2={H - m.b} stroke="var(--muted)" strokeWidth={1} />
              <circle cx={sx(hover)} cy={sy(h.now)} r={4} fill="var(--viz-2)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={sx(hover)} cy={sy(h.exp)} r={4} fill="var(--viz-1)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover !== null && h && (
          <div
            className="pointer-events-none absolute top-2 rounded-[6px] bg-surface px-3 py-2 text-xs shadow-(--shadow-raised) ring-1 ring-border"
            style={{ left: sx(hover), transform: `translateX(${sx(hover) > W * 0.6 ? "calc(-100% - 10px)" : "10px"})` }}
          >
            <div className="font-bold">Stock {hover}</div>
            {[
              { v: h.exp, label: expiryLabel(st), color: "var(--viz-1)", dash: undefined },
              { v: h.now, label: "Today", color: "var(--viz-2)", dash: "4 3" },
            ].map((r) => (
              <div key={r.label} className="mt-1 flex items-center gap-2 whitespace-nowrap">
                <svg width="14" height="6" aria-hidden>
                  <line x1="1" y1="3" x2="13" y2="3" stroke={r.color} strokeWidth="2" strokeDasharray={r.dash} />
                </svg>
                <strong className="tabular-nums">{sgn(r.v)}</strong>
                <span className="text-muted">{r.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

/** One Greek across stock prices 70–130, today, with a dot at the current price. */
function GreekSpark({ st, g }: { st: Strategy; g: GreekName }) {
  const vals = React.useMemo(() => xs.filter((_, i) => i % 2 === 0).map((S) => position(st, S)[g]), [st, g]);
  const W = 160;
  const H = 44;
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const sx = (i: number) => (i / (vals.length - 1)) * W;
  const sy = (v: number) => 4 + ((hi - v) / span) * (H - 8);
  const mid = Math.round((S0 - LO) / 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-11 w-full" aria-hidden>
      <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path
        d={vals.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join("")}
        fill="none"
        stroke="var(--viz-1)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      <line x1={sx(mid)} x2={sx(mid)} y1={0} y2={H} stroke="var(--muted)" strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Fixed decimals, without a "−0.00" for values that round to zero. */
const num = (v: number, dp: number) => (Math.abs(v) < 0.5 * 10 ** -dp ? 0 : v).toFixed(dp);
const GREEK_UNIT: Record<GreekName, (v: number) => string> = {
  delta: (v) => num(v, 2),
  gamma: (v) => num(v, 3),
  theta: (v) => `${num(v, 3)}/day`,
  vega: (v) => `${num(v, 3)}/vol pt`,
};

/** Everything worth remembering about one strategy. */
export function StrategyCard({ st, className }: { st: Strategy; className?: string }) {
  const f = factsOf(st);
  const premium = Math.abs(f.premium) < 0.005 ? "Zero cost" : `${f.premium > 0 ? "Debit" : "Credit"} ${Math.abs(f.premium).toFixed(2)}`;
  const facts = [
    { label: "Max profit", value: f.maxProfit === null ? "Unlimited" : sgn(f.maxProfit) },
    { label: "Max loss", value: f.maxLoss === null ? "Unlimited" : sgn(f.maxLoss) },
    { label: f.breakevens.length > 1 ? "Breakevens" : "Breakeven", value: f.breakevens.join(" / ") || "—" },
    { label: f.hasStock ? "Options premium" : "Net premium", value: premium + (f.hasStock ? " + stock" : "") },
  ];
  return (
    <article className={cn("space-y-5", className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-x text-2xl font-black">{st.name}</h3>
          <span className="font-x rounded-[3px] bg-surface-2 px-2 py-0.5 text-xs font-extrabold uppercase tracking-[0.06em] text-muted">{st.view}</span>
        </div>
        <p className="text-sm">{st.idea}</p>
        <ul className="flex flex-wrap gap-1.5">
          {st.legs.map((l, i) => (
            <li
              key={i}
              className={cn("font-x rounded-[4px] px-2.5 py-1 text-xs font-extrabold", l.qty > 0 ? "bg-positive/12 text-foreground" : "bg-negative/12 text-foreground")}
            >
              {legText(l)}
            </li>
          ))}
        </ul>
      </header>

      <PayoffChart st={st} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map((x) => (
          <div key={x.label} className="rounded-[6px] bg-surface-2 px-3 py-2.5">
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted">{x.label}</dt>
            <dd className="font-x mt-0.5 font-black tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h4 className="font-x mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
          Greeks at {S0}, {DAYS} days · and how each moves from {LO} to {HI}
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GREEKS.map((g) => (
            <div key={g} className="rounded-[6px] bg-surface-2 px-3 pb-2 pt-2.5">
              <div className="flex items-baseline justify-between gap-2">
                {/* The Greek letter stays lowercase: uppercase ν reads as N. */}
                <span className="text-[0.65rem] font-bold tracking-[0.1em] text-muted">
                  <span className="uppercase">{GREEK_LABEL[g].split(" ")[0]}</span> {GREEK_LABEL[g].split(" ")[1]}
                </span>
                <span className="font-xx text-xl font-black">{f.greeks[g].sign}</span>
              </div>
              <div className="text-[0.7rem] tabular-nums text-muted">{GREEK_UNIT[g](f.greeks[g].value)}</div>
              <GreekSpark st={st} g={g} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[8px] bg-(--hint-bg) px-4 py-3 text-sm">
        <span className="font-x font-extrabold">When to use it: </span>
        {st.useCase}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-bold text-muted hover:text-foreground">P&amp;L as a table</summary>
        <table className="mt-2 w-full max-w-md tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-1 font-bold">Stock</th>
              <th className="pb-1 text-right font-bold">{expiryLabel(st)}</th>
              <th className="pb-1 text-right font-bold">Today</th>
            </tr>
          </thead>
          <tbody>
            {[80, 90, 95, 100, 105, 110, 120].map((S) => (
              <tr key={S} className="border-t border-border">
                <td className="py-1">{S}</td>
                <td className="py-1 text-right">{sgn(pnl(st, S, true))}</td>
                <td className="py-1 text-right">{sgn(pnl(st, S, false))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}
