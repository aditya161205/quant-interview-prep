"use client";

import { create } from "zustand";
import {
  buildDeck,
  shuffle,
  sumValue,
  aiQuote,
  aiFair,
  TABLE_MID,
  type Card,
  type Quote,
} from "@/lib/market-of-cards";

export const TOTAL_ROUNDS = 4; // round 1 (no table cards) → reveal → … → round 4
export const AI_NAMES = ["AI 1", "AI 2", "AI 3"];

export interface MocConfig {
  decisionSeconds: number;
  showEV: boolean;
  showLog: boolean;
}
export const DEFAULT_MOC_CONFIG: MocConfig = {
  decisionSeconds: 10,
  showEV: false,
  showLog: true,
};
export const MOC_OPTIONS = {
  decisionSeconds: [8, 10, 15],
} as const;

export interface MarketReaction {
  name: string;
  action: "bought" | "sold" | "passed";
  price: number | null;
}

export interface Player {
  name: string;
  isYou: boolean;
  hand: Card[];
}

export interface Trade {
  round: number;
  buyer: number; // player index (0 = You)
  seller: number;
  price: number;
}

type Phase = "intro" | "quote" | "reactions" | "trade" | "gameover";

interface MocState {
  phase: Phase;
  config: MocConfig;
  round: number;
  players: Player[];
  table: Card[];
  revealed: number; // table cards turned over so far
  trueSum: number;
  yourQuote: Quote | null;
  aiQuotes: Quote[];
  reactions: MarketReaction[]; // what each AI did to YOUR market
  currentAi: number; // 0..2 during the trade phase
  trades: Trade[];
  log: string[];

  start: (config: MocConfig) => void;
  submitQuote: (bid: number, ask: number) => void;
  continueToTrade: () => void;
  tradeWithAi: (action: "buy" | "sell" | "pass") => void;
  endGame: () => void;
  reset: () => void;
}

const time = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const cardLabel = (c: Card) => `${c.rank}${c.suit}`;

export const useMocStore = create<MocState>((set, get) => {
  const append = (line: string) => set((s) => ({ log: [...s.log, `[${time()}] ${line}`] }));

  function aiKnown(p: Player): Card[] {
    const { table, revealed } = get();
    return [...p.hand, ...table.slice(0, revealed)];
  }

  function beginRound(round: number) {
    set({ round, phase: "quote", yourQuote: null, aiQuotes: [], currentAi: 0 });
    append(`Round ${round}: make your two-way market.`);
  }

  function finishRound() {
    const { round, table, revealed } = get();
    if (round < TOTAL_ROUNDS) {
      // reveal the next table card
      const next = [...table];
      next[revealed] = { ...next[revealed], faceUp: true };
      set({ table: next, revealed: revealed + 1 });
      append(`Table card revealed: ${cardLabel(next[revealed])}.`);
      beginRound(round + 1);
    } else {
      // settlement — reveal everything
      set((s) => ({
        phase: "gameover",
        players: s.players.map((p) => ({ ...p, hand: p.hand.map((c) => ({ ...c, faceUp: true })) })),
        table: s.table.map((c) => ({ ...c, faceUp: true })),
        revealed: 3,
      }));
      append(`Settlement — the 11 cards sum to ${get().trueSum}.`);
    }
  }

  return {
    phase: "intro",
    config: DEFAULT_MOC_CONFIG,
    round: 0,
    players: [],
    table: [],
    revealed: 0,
    trueSum: 0,
    yourQuote: null,
    aiQuotes: [],
    reactions: [],
    currentAi: 0,
    trades: [],
    log: [],

    start: (config) => {
      const deck = shuffle(buildDeck());
      const players: Player[] = [
        { name: "You", isYou: true, hand: [{ ...deck[0], faceUp: true }, { ...deck[1], faceUp: true }] },
        { name: "AI 1", isYou: false, hand: [deck[2], deck[3]] },
        { name: "AI 2", isYou: false, hand: [deck[4], deck[5]] },
        { name: "AI 3", isYou: false, hand: [deck[6], deck[7]] },
      ];
      const table = [deck[8], deck[9], deck[10]];
      const inPlay = [...players.flatMap((p) => p.hand), ...table];
      const trueSum = sumValue(inPlay);

      set({
        config,
        players,
        table,
        revealed: 0,
        trueSum,
        trades: [],
        log: [`[${time()}] Game started — your hand sums to ${sumValue(players[0].hand)}.`],
      });
      beginRound(1);
    },

    submitQuote: (bid, ask) => {
      const { players, trades, round } = get();
      set({ yourQuote: { bid, ask } });
      append(`You quote: Buy ${bid}, Sell ${ask}.`);

      const newTrades: Trade[] = [];
      const reactions: MarketReaction[] = [];
      const margin = 3;
      // AIs pick off your market if it is clearly mispriced against you.
      players.forEach((p, idx) => {
        if (idx === 0) return;
        const fair = aiFair(aiKnown(p));
        if (ask < fair - margin) {
          newTrades.push({ round, buyer: idx, seller: 0, price: ask });
          reactions.push({ name: p.name, action: "bought", price: ask });
          append(`${p.name} bought from you at ${ask}.`);
        } else if (bid > fair + margin) {
          newTrades.push({ round, buyer: 0, seller: idx, price: bid });
          reactions.push({ name: p.name, action: "sold", price: bid });
          append(`${p.name} sold to you at ${bid}.`);
        } else {
          reactions.push({ name: p.name, action: "passed", price: null });
        }
      });

      // Each AI now posts its own market for you to trade against.
      const yourMid = (bid + ask) / 2;
      const humanBias = yourMid > TABLE_MID + 40 ? 15 : yourMid < TABLE_MID - 40 ? -15 : 0;
      const aiQuotes = players.slice(1).map((p) =>
        aiQuote(aiKnown(p), { blend: 0.65, spread: 16 + Math.floor(Math.random() * 12), humanBias }),
      );

      set({ trades: [...trades, ...newTrades], aiQuotes, reactions, phase: "reactions", currentAi: 0 });
    },

    continueToTrade: () => set({ phase: "trade", currentAi: 0 }),

    tradeWithAi: (action) => {
      const { aiQuotes, currentAi, trades, round, players } = get();
      const q = aiQuotes[currentAi];
      const aiIdx = currentAi + 1;
      const name = players[aiIdx].name;

      if (action === "buy") {
        set({ trades: [...trades, { round, buyer: 0, seller: aiIdx, price: q.ask }] });
        append(`You bought from ${name} at ${q.ask}.`);
      } else if (action === "sell") {
        set({ trades: [...trades, { round, buyer: aiIdx, seller: 0, price: q.bid }] });
        append(`You sold to ${name} at ${q.bid}.`);
      } else {
        append(`You passed on ${name}.`);
      }

      if (currentAi < 2) set({ currentAi: currentAi + 1 });
      else finishRound();
    },

    endGame: () => finishRound(),

    reset: () =>
      set({
        phase: "intro",
        round: 0,
        players: [],
        table: [],
        revealed: 0,
        trueSum: 0,
        yourQuote: null,
        aiQuotes: [],
        reactions: [],
        currentAi: 0,
        trades: [],
        log: [],
      }),
  };
});

/** Net PnL of each player given the final true sum. */
export function playerPnl(trades: Trade[], trueSum: number): number[] {
  const pnl = [0, 0, 0, 0];
  for (const t of trades) {
    pnl[t.buyer] += trueSum - t.price;
    pnl[t.seller] += t.price - trueSum;
  }
  return pnl;
}
