import { WEEKDAYS, levelOf, rng, type Day, type Role } from "./core";
import { traderTasks, traderTitle } from "./trader";
import { researcherTasks, researcherTitle } from "./researcher";

export * from "./core";

export const CAREERS: Record<Role, { title: string; desk: string; blurb: string; metric: string }> = {
  trader: {
    title: "Quant Trader",
    desk: "Equity derivatives market-making",
    blurb: "Open the book, flatten your risk, quote clients, price their requests, trade the earnings print and explain your P&L before you go home.",
    metric: "Desk P&L",
  },
  researcher: {
    title: "Quant Researcher",
    desk: "Systematic equities",
    blurb: "Audit the data, test whether a signal is real, review backtests, combine strategies, convince the PM, and decide what to do when live returns disappoint.",
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
