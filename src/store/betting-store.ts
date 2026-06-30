"use client";

import { create } from "zustand";
import {
  generateProps,
  rollOutcome,
  skewedOdds,
  betPnl,
  STARTING_BANKROLL,
  type Category,
  type Odds,
  type Proposition,
  type RoundOutcome,
} from "@/lib/betting-game";

export { STARTING_BANKROLL };

export interface BettingConfig {
  rounds: number;
  eventsPerCategory: number;
  roundMinutes: number;
  skipAnimation: boolean;
}

export const DEFAULT_BETTING_CONFIG: BettingConfig = {
  rounds: 6,
  eventsPerCategory: 2,
  roundMinutes: 5,
  skipAnimation: false,
};

export const BETTING_OPTIONS = {
  rounds: [4, 6, 8],
  eventsPerCategory: [1, 2, 3],
  roundMinutes: [4, 5, 6, 7],
} as const;

type Phase = "intro" | "betting" | "result" | "gameover";
type SpecialKind = "put" | "call";

export interface BoardProp {
  prop: Proposition;
  odds: Odds;
}

export interface TakenBet {
  id: string;
  category: Category;
  label: string;
  b: number;
  stake: number;
}

export interface ResolvedLine {
  id: string;
  label: string;
  category: Category | "Special";
  stake: number;
  b: number;
  trueProb: number | null; // null for special bets
  won: boolean;
  voided: boolean;
  pnl: number;
}

export interface RoundResult {
  outcome: RoundOutcome;
  lines: ResolvedLine[];
  roundPnl: number;
}

interface BettingState {
  phase: Phase;
  config: BettingConfig;
  bankroll: number;
  peak: number;
  round: number;
  board: BoardProp[];
  putOdds: Odds;
  callOdds: Odds;
  bets: Record<string, TakenBet>;
  specials: Partial<Record<SpecialKind, { stake: number; b: number }>>;
  result: RoundResult | null;
  history: RoundResult[];

  start: (config: BettingConfig) => void;
  placeBet: (bet: TakenBet) => boolean;
  removeBet: (id: string) => void;
  placeSpecial: (kind: SpecialKind, stake: number, b: number) => boolean;
  removeSpecial: (kind: SpecialKind) => void;
  committed: () => number;
  resolve: () => void;
  next: () => void;
  endGame: () => void;
  reset: () => void;
}


function buildBoard(perCat: number): BoardProp[] {
  const cats: Category[] = ["Dice", "Cards", "Coins"];
  const out: BoardProp[] = [];
  for (const cat of cats) {
    for (const prop of generateProps(cat, perCat)) {
      // unique id per round position so taken bets map cleanly
      prop.id = `${cat}-${out.length}`;
      out.push({ prop, odds: skewedOdds(prop.trueProb) });
    }
  }
  return out;
}

const round2 = (lo: number, hi: number) =>
  Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;

export const useBettingStore = create<BettingState>((set, get) => {
  function beginRound(round: number, perCat: number) {
    set({
      round,
      board: buildBoard(perCat),
      putOdds: { b: round2(0.8, 1.2), implied: 0 },
      callOdds: { b: round2(0.85, 1.3), implied: 0 },
      bets: {},
      specials: {},
      result: null,
      phase: "betting",
    });
  }

  return {
    phase: "intro",
    config: DEFAULT_BETTING_CONFIG,
    bankroll: STARTING_BANKROLL,
    peak: STARTING_BANKROLL,
    round: 0,
    board: [],
    putOdds: { b: 0.9, implied: 0 },
    callOdds: { b: 1, implied: 0 },
    bets: {},
    specials: {},
    result: null,
    history: [],

    start: (config) => {
      set({ config, bankroll: STARTING_BANKROLL, peak: STARTING_BANKROLL, history: [] });
      beginRound(1, config.eventsPerCategory);
    },

    committed: () => {
      const { bets, specials } = get();
      const b = Object.values(bets).reduce((s, x) => s + x.stake, 0);
      const sp = (specials.put?.stake ?? 0) + (specials.call?.stake ?? 0);
      return b + sp;
    },

    placeBet: (bet) => {
      if (bet.stake <= 0) return false;
      const { bets, bankroll } = get();
      const others = Object.values(bets).filter((x) => x.id !== bet.id).reduce((s, x) => s + x.stake, 0);
      const specials = get().specials;
      const sp = (specials.put?.stake ?? 0) + (specials.call?.stake ?? 0);
      if (others + sp + bet.stake > bankroll) return false;
      set({ bets: { ...bets, [bet.id]: bet } });
      return true;
    },

    removeBet: (id) =>
      set((s) => {
        const next = { ...s.bets };
        delete next[id];
        return { bets: next };
      }),

    placeSpecial: (kind, stake, b) => {
      if (stake <= 0) return false;
      const { specials, bets, bankroll } = get();
      const betsTotal = Object.values(bets).reduce((s, x) => s + x.stake, 0);
      const otherSpecial = kind === "put" ? specials.call?.stake ?? 0 : specials.put?.stake ?? 0;
      if (betsTotal + otherSpecial + stake > bankroll) return false;
      set({ specials: { ...specials, [kind]: { stake, b } } });
      return true;
    },

    removeSpecial: (kind) =>
      set((s) => {
        const next = { ...s.specials };
        delete next[kind];
        return { specials: next };
      }),

    resolve: () => {
      const { bets, specials, board, bankroll, peak, history } = get();
      const outcome = rollOutcome();
      const lines: ResolvedLine[] = [];

      let normalPnl = 0;
      const normalBets = Object.values(bets);
      for (const bet of normalBets) {
        const prop = board.find((bp) => bp.prop.id === bet.id)?.prop;
        if (!prop) continue;
        const won = prop.evaluate(outcome);
        const pnl = betPnl(won, bet.stake, bet.b);
        normalPnl += pnl;
        lines.push({ id: bet.id, label: bet.label, category: bet.category, stake: bet.stake, b: bet.b, trueProb: prop.trueProb, won, voided: false, pnl });
      }

      const settleSpecial = (kind: SpecialKind, label: string, winsWhen: boolean) => {
        const s = specials[kind];
        if (!s) return;
        const voided = normalBets.length === 0;
        const won = !voided && winsWhen;
        const pnl = voided ? 0 : betPnl(won, s.stake, s.b);
        lines.push({ id: kind, label, category: "Special", stake: s.stake, b: s.b, trueProb: null, won, voided, pnl });
      };
      settleSpecial("put", "Put — other bets net negative", normalPnl < 0);
      settleSpecial("call", "Call — other bets net positive", normalPnl > 0);

      const roundPnl = lines.reduce((s, l) => s + l.pnl, 0);
      const newBankroll = Math.max(0, bankroll + roundPnl);
      const result: RoundResult = { outcome, lines, roundPnl };

      set({
        phase: "result",
        result,
        bankroll: newBankroll,
        peak: Math.max(peak, newBankroll),
        history: [...history, result],
      });
    },

    next: () => {
      const { round, config } = get();
      if (round >= config.rounds) {
        set({ phase: "gameover" });
        return;
      }
      beginRound(round + 1, config.eventsPerCategory);
    },

    endGame: () => set({ phase: "gameover" }),

    reset: () =>
      set({
        phase: "intro",
        bankroll: STARTING_BANKROLL,
        peak: STARTING_BANKROLL,
        round: 0,
        board: [],
        bets: {},
        specials: {},
        result: null,
        history: [],
      }),
  };
});
