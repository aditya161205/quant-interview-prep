"use client";

import { create } from "zustand";
import {
  dealFirstRound,
  nextEtfRound,
  etfPnl,
  optimalAction,
  makeBotPlan,
  BOT_NAMES,
  type BotPlan,
  type EtfAction,
  type EtfRound,
} from "@/lib/etf-game";

export interface EtfConfig {
  rounds: number;
  maxUnits: number;
  seconds: number;
}

export const DEFAULT_ETF_CONFIG: EtfConfig = { rounds: 6, maxUnits: 20, seconds: 30 };

type Phase = "intro" | "trading" | "result" | "gameover";

export interface PlayerResult {
  name: string;
  isYou: boolean;
  action: EtfAction;
  units: number;
  pnl: number;
  first: boolean;
}

export interface RoundRecord {
  round: number;
  nav: number;
  etfBid: number;
  etfAsk: number;
  event: string | null;
  action: EtfAction;
  units: number;
  pnl: number;
  speed: number;
  correct: boolean;
}

interface EtfState {
  phase: Phase;
  config: EtfConfig;
  round: number;
  data: EtfRound | null;
  botPlans: BotPlan[];
  results: PlayerResult[] | null;
  totals: Record<string, number>; // name -> cumulative pnl ("You" + bots)
  bots: string[];
  roundStart: number;
  history: RoundRecord[];

  start: (config: EtfConfig) => void;
  submitTrade: (action: EtfAction, units: number) => void;
  timeout: () => void;
  next: () => void;
  endGame: () => void;
  reset: () => void;
}

function pickBots(): string[] {
  return [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, 3);
}

export const useEtfStore = create<EtfState>((set, get) => {
  function beginRound(round: number, data: EtfRound) {
    const { config, bots } = get();
    set({
      round,
      data,
      botPlans: bots.map((b) => makeBotPlan(b, data, config.maxUnits)),
      results: null,
      phase: "trading",
      roundStart: Date.now(),
    });
  }

  function settle(action: EtfAction, units: number, speed: number) {
    const { data, botPlans, totals, history, round } = get();
    if (!data) return;

    // Who traded, and who was fastest among them → first-trader bonus.
    const traders = [
      { name: "You", speed, traded: action !== "skip" },
      ...botPlans.map((b) => ({ name: b.name, speed: b.speed, traded: b.action !== "skip" })),
    ].filter((t) => t.traded);
    const firstName = traders.length
      ? traders.reduce((a, b) => (b.speed < a.speed ? b : a)).name
      : null;

    const youPnl = etfPnl(action, units, data, firstName === "You");
    const results: PlayerResult[] = [
      { name: "You", isYou: true, action, units, pnl: youPnl, first: firstName === "You" },
      ...botPlans.map((b) => ({
        name: b.name,
        isYou: false,
        action: b.action,
        units: b.units,
        pnl: etfPnl(b.action, b.units, data, firstName === b.name),
        first: firstName === b.name,
      })),
    ];

    const nextTotals = { ...totals };
    for (const r of results) nextTotals[r.name] = (nextTotals[r.name] ?? 0) + r.pnl;

    const record: RoundRecord = {
      round,
      nav: data.nav,
      etfBid: data.etfBid,
      etfAsk: data.etfAsk,
      event: data.event,
      action,
      units,
      pnl: youPnl,
      speed,
      correct: action === optimalAction(data),
    };

    set({
      results,
      totals: nextTotals,
      history: [...history, record],
      phase: "result",
    });
  }

  return {
    phase: "intro",
    config: DEFAULT_ETF_CONFIG,
    round: 0,
    data: null,
    botPlans: [],
    results: null,
    totals: {},
    bots: [],
    roundStart: 0,
    history: [],

    start: (config) => {
      const bots = pickBots();
      const totals: Record<string, number> = { You: 0 };
      for (const b of bots) totals[b] = 0;
      set({ config, bots, totals, history: [], round: 0, results: null });
      beginRound(1, dealFirstRound());
    },

    submitTrade: (action, units) => {
      const { roundStart, config } = get();
      const speed = Math.min(config.seconds, (Date.now() - roundStart) / 1000);
      settle(action, units, Math.round(speed * 10) / 10);
    },

    timeout: () => {
      const { config } = get();
      settle("skip", 0, config.seconds);
    },

    next: () => {
      const { round, config, data } = get();
      if (round >= config.rounds || !data) {
        set({ phase: "gameover" });
        return;
      }
      beginRound(round + 1, nextEtfRound(data));
    },

    endGame: () => set({ phase: "gameover" }),

    reset: () =>
      set({
        phase: "intro",
        round: 0,
        data: null,
        botPlans: [],
        results: null,
        totals: {},
        bots: [],
        history: [],
      }),
  };
});
