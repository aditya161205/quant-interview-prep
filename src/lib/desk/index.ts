import { WEEKDAYS, levelOf, rng, type Day, type Role } from "./core";
import { traderTasks, traderTitle } from "./trader";
import { researcherTasks, researcherTitle } from "./researcher";

export * from "./core";

export const CAREERS: Record<Role, { title: string; desk: string; blurb: string; metric: string }> = {
  trader: {
    title: "Quant Trader",
    desk: "Options market-making",
    blurb: "Mark the vol surface, flatten your Greeks, quote options to clients, price their requests, trade the earnings straddle and explain your P&L before you go home.",
    metric: "Desk P&L",
  },
  researcher: {
    title: "Quant Researcher",
    desk: "Options & volatility research",
    blurb: "Clean option prices, measure realised vol, backtest short-vol strategies, size vol trades and variance swaps, pick what the PM funds, and decide when to switch a strategy off.",
    metric: "Credibility",
  },
};

/** One day of a career. The same day and seed always give the same numbers. */
export function makeDay(role: Role, n: number, seed: number): Day {
  const r = rng(seed);
  const level = levelOf(n);
  const i = (n - 1) % 5;
  return {
    role,
    n,
    level,
    title: role === "trader" ? traderTitle(level, i) : researcherTitle(level, i),
    weekday: WEEKDAYS[i],
    tasks: role === "trader" ? traderTasks(r, level) : researcherTasks(r, level),
  };
}
