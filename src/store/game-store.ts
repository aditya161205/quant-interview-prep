"use client";

import { create } from "zustand";
import {
  dealHand,
  botQuote,
  simulateMakerFlow,
  traderPnl,
  canAfford,
  DEFAULT_CONFIG,
  type BotTrade,
  type Card,
  type GameConfig,
  type Hand,
  type Quote,
  type TradeAction,
} from "@/lib/market-game";

export const STARTING_BUDGET = 500;
export const YOU_INDEX = 1; // "Player 2 — You", matching the table order
export const REVEAL_SECONDS = 5;
export const WRONG_PNL_PENALTY = 50;

export interface Player {
  id: number;
  name: string;
  isYou: boolean;
  score: number;
}

type Phase = "intro" | "make" | "trade" | "reveal" | "settle" | "result" | "gameover";
type Role = "maker" | "trader";

export interface CardSnapshot {
  rank: Card["rank"];
  suit: Card["suit"];
  value: number;
  wasFaceUp: boolean;
}

export interface RoundResult {
  round: number;
  role: Role;
  cards: CardSnapshot[];
  quote: Quote | null;
  action?: TradeAction;
  qty?: number;
  trueSum: number;
  ev: number;
  actualPnl: number; // PnL from the trade/market itself, before any penalty
  timedOut: boolean;
  botTrades?: BotTrade[]; // how the bots traded against YOUR market (maker rounds)
  // filled in once the round is finalised:
  guessedPnl?: number | null;
  guessedSettlement?: number | null;
  penalized?: boolean;
  finalPnl?: number;
  perPlayer?: number[];
}

export type RoundRecord = Required<RoundResult>;

interface GameState {
  phase: Phase;
  config: GameConfig;
  players: Player[];
  round: number;
  mmIndex: number;
  hand: Hand | null;
  quote: Quote | null;
  dealId: number;
  result: RoundResult | null;
  history: RoundRecord[];

  start: (config: GameConfig) => void;
  submitMarket: (bid: number, ask: number) => void;
  trade: (action: TradeAction, qty: number) => void;
  finishReveal: () => void;
  submitSettlement: (settlement: number, pnl: number) => void;
  timeoutRound: () => void;
  next: () => void;
  endGame: () => void;
  reset: () => void;
}

function freshPlayers(): Player[] {
  return [
    { id: 1, name: "Player 1", isYou: false, score: STARTING_BUDGET },
    { id: 2, name: "Player 2", isYou: true, score: STARTING_BUDGET },
    { id: 3, name: "Player 3", isYou: false, score: STARTING_BUDGET },
    { id: 4, name: "Player 4", isYou: false, score: STARTING_BUDGET },
  ];
}

/** Small plausible PnL for the bot players, so the leaderboard stays alive. */
function botFlavor(): number {
  return Math.round((Math.random() - 0.45) * 8);
}

const snapshot = (hand: Hand): CardSnapshot[] =>
  hand.cards.map((c) => ({
    rank: c.rank,
    suit: c.suit,
    value: c.value,
    wasFaceUp: c.faceUp,
  }));

const setAllFaceUp = (hand: Hand, faceUp: boolean): Hand => ({
  ...hand,
  cards: hand.cards.map((c) => ({ ...c, faceUp })),
});

export const useGameStore = create<GameState>((set, get) => {
  function beginRound(round: number) {
    const { config } = get();
    if (round > config.totalRounds) {
      set({ phase: "gameover" });
      return;
    }
    const mmIndex = (round - 1) % 4;
    const hand = dealHand(config.numCards);
    const youAreMaker = mmIndex === YOU_INDEX;
    set((s) => ({
      round,
      mmIndex,
      hand,
      quote: youAreMaker ? null : botQuote(hand.ev),
      phase: youAreMaker ? "make" : "trade",
      result: null,
      dealId: s.dealId + 1,
    }));
  }

  /** Apply a finalised round to scores + history. */
  function finalize(result: RoundResult, finalPnl: number, perPlayer: number[]) {
    const finished: RoundRecord = {
      ...result,
      botTrades: result.botTrades ?? [],
      guessedPnl: result.guessedPnl ?? null,
      guessedSettlement: result.guessedSettlement ?? null,
      penalized: result.penalized ?? false,
      finalPnl,
      perPlayer,
    } as RoundRecord;

    set((s) => ({
      // A player's balance can never drop below 0.
      players: s.players.map((p, i) => ({ ...p, score: Math.max(0, p.score + perPlayer[i]) })),
      result: finished,
      history: [...s.history, finished],
      phase: "result",
      hand: s.hand ? setAllFaceUp(s.hand, true) : s.hand,
    }));
  }

  return {
    phase: "intro",
    config: DEFAULT_CONFIG,
    players: freshPlayers(),
    round: 0,
    mmIndex: 0,
    hand: null,
    quote: null,
    dealId: 0,
    result: null,
    history: [],

    start: (config) => {
      set({ config, players: freshPlayers(), round: 0, result: null, history: [] });
      beginRound(1);
    },

    // You are the maker → the bots trade against your quote and PnL is settled
    // automatically from that flow.
    submitMarket: (bid, ask) => {
      const { hand, round } = get();
      if (!hand) return;
      const quote: Quote = { bid, ask };
      const traderIndices = [0, 1, 2, 3].filter((i) => i !== YOU_INDEX);
      const { trades, makerPnl: pnl } = simulateMakerFlow(quote, hand.trueSum, traderIndices);

      const perPlayer = [0, 0, 0, 0];
      perPlayer[YOU_INDEX] = pnl;
      for (const t of trades) perPlayer[t.player] = -t.makerDelta;

      set({ quote });
      finalize(
        {
          round,
          role: "maker",
          cards: snapshot(hand),
          quote,
          trueSum: hand.trueSum,
          ev: hand.ev,
          actualPnl: pnl,
          timedOut: false,
          botTrades: trades,
        },
        pnl,
        perPlayer,
      );
    },

    // A bot is the maker → you trade. Buying/selling needs a self-computed PnL;
    // a skip is trivially 0 so it settles immediately.
    trade: (action, qty) => {
      const { hand, quote, mmIndex, round, players, config } = get();
      if (!hand || !quote) return;

      // Never let a trade exceed the player's balance.
      if (action !== "skip" && !canAfford(action, quote, qty, config.numCards, players[YOU_INDEX].score)) {
        return;
      }

      if (action === "skip") {
        const perPlayer = [botFlavor(), botFlavor(), botFlavor(), botFlavor()];
        perPlayer[YOU_INDEX] = 0;
        perPlayer[mmIndex] = botFlavor();
        finalize(
          {
            round,
            role: "trader",
            cards: snapshot(hand),
            quote,
            action: "skip",
            qty,
            trueSum: hand.trueSum,
            ev: hand.ev,
            actualPnl: 0,
            timedOut: false,
          },
          0,
          perPlayer,
        );
        return;
      }

      const actualPnl = traderPnl(action, quote, hand.trueSum, qty);
      set({
        result: {
          round,
          role: "trader",
          cards: snapshot(hand),
          quote,
          action,
          qty,
          trueSum: hand.trueSum,
          ev: hand.ev,
          actualPnl,
          timedOut: false,
        },
        phase: "reveal",
        hand: setAllFaceUp(hand, true), // reveal for memorising
      });
    },

    // The 5s reveal elapsed: hide the cards again so the user works from memory.
    finishReveal: () => {
      const { hand } = get();
      set({
        phase: "settle",
        hand: hand ? setAllFaceUp(hand, false) : hand,
      });
    },

    submitSettlement: (settlement, pnl) => {
      const { result, mmIndex } = get();
      if (!result) return;
      const penalized = pnl !== result.actualPnl;
      const finalPnl = result.actualPnl - (penalized ? WRONG_PNL_PENALTY : 0);

      const perPlayer = [botFlavor(), botFlavor(), botFlavor(), botFlavor()];
      perPlayer[YOU_INDEX] = finalPnl;
      perPlayer[mmIndex] = -result.actualPnl + botFlavor();

      finalize(
        { ...result, guessedPnl: pnl, guessedSettlement: settlement, penalized },
        finalPnl,
        perPlayer,
      );
    },

    // Time ran out → the round is skipped for you: 0 PnL, no penalty.
    timeoutRound: () => {
      const { hand, quote, mmIndex, round } = get();
      if (!hand) return;
      const role: Role = mmIndex === YOU_INDEX ? "maker" : "trader";
      const perPlayer = [botFlavor(), botFlavor(), botFlavor(), botFlavor()];
      perPlayer[YOU_INDEX] = 0;

      finalize(
        {
          round,
          role,
          cards: snapshot(hand),
          quote: role === "trader" ? quote : null,
          action: role === "trader" ? "skip" : undefined,
          trueSum: hand.trueSum,
          ev: hand.ev,
          actualPnl: 0,
          timedOut: true,
        },
        0,
        perPlayer,
      );
    },

    next: () => beginRound(get().round + 1),

    endGame: () => set({ phase: "gameover" }),

    reset: () =>
      set({
        phase: "intro",
        players: freshPlayers(),
        round: 0,
        mmIndex: 0,
        hand: null,
        quote: null,
        result: null,
        history: [],
      }),
  };
});
