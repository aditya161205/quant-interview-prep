import { shuffledDeck, secureRandom, type Card } from "./cards";
import { describe, evaluate } from "./evaluate";

/**
 * No-limit Texas Hold'em, as pure functions over a Game value. Every function returns a new Game.
 *
 * Rules followed: the button moves to the next seat still in the game; heads-up the button posts the small
 * blind and acts first preflop, last after; a short all-in blind still makes the full big blind the bet to
 * call; the minimum raise is the size of the last full raise (the big blind to open); an all-in raise smaller
 * than that does not reopen the betting to players who already acted (they may only call or fold); uncalled
 * chips come back through the side-pot layering; split pots give odd chips to the first winner left of the
 * button.
 */

export type Street = "preflop" | "flop" | "turn" | "river";
export type Phase = "betting" | "street-end" | "hand-over" | "game-over";
export type ActionType = "fold" | "check" | "call" | "raise";
export type Action = { type: ActionType; to?: number };

export interface Player {
  id: number;
  name: string;
  human: boolean;
  stack: number;
  hole: Card[];
  /** Chips put in on this street. */
  bet: number;
  /** Chips put in this hand. */
  total: number;
  folded: boolean;
  allIn: boolean;
  /** Has acted since the last full raise (or street start). */
  acted: boolean;
  /** Faced only an incomplete all-in raise after acting: may call or fold, not raise. */
  raiseLocked: boolean;
  /** Busted: no chips left at the start of a hand. */
  out: boolean;
  lastAction: string | null;
  /** Read by bots to weight this player's range. */
  handRaises: number;
  handCalls: number;
  voluntary: boolean;
}

export interface PotResult {
  amount: number;
  winners: number[];
  hand: string | null;
}

export interface HandResult {
  pots: PotResult[];
  /** Seats whose cards are shown (everyone who reached a contested showdown). */
  shown: number[];
  /** Net chips each player won or lost this hand. */
  net: Record<number, number>;
  showdown: boolean;
}

/** One betting action, for reading a player's line. `pot` is the pot before it; `paid` is what it put in. */
export interface ActionRecord {
  seat: number;
  street: Street;
  type: "fold" | "check" | "call" | "bet" | "raise";
  paid: number;
  pot: number;
}

export interface LogLine {
  hand: number;
  street: Street;
  text: string;
}

export interface Config {
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  /** Double the blinds every N hands; 0 keeps them fixed. */
  blindsEvery: number;
}

export interface Game {
  config: Config;
  players: Player[];
  dealer: number;
  sb: number;
  bb: number;
  sbSeat: number;
  bbSeat: number;
  handNo: number;
  deck: Card[];
  board: Card[];
  street: Street;
  phase: Phase;
  toAct: number;
  currentBet: number;
  minRaise: number;
  raisesThisStreet: number;
  /** Last player to bet or raise preflop, for continuation-bet logic. */
  preflopAggressor: number | null;
  lastAggressor: number | null;
  log: LogLine[];
  /** This hand's betting actions (blinds excluded). */
  actions: ActionRecord[];
  result: HandResult | null;
  /** Stack of each player when the hand started, for net results. */
  startStacks: number[];
}

/* ------------------------------------------------------------------ helpers */

const clone = (g: Game): Game => ({
  ...g,
  players: g.players.map((p) => ({ ...p, hole: [...p.hole] })),
  deck: [...g.deck],
  board: [...g.board],
  log: [...g.log],
  actions: [...g.actions],
  startStacks: [...g.startStacks],
});

export const inHand = (p: Player) => !p.out && !p.folded;
export const canAct = (p: Player) => inHand(p) && !p.allIn;

/** Next seat after `from` (exclusive) matching `ok`, or -1. */
function nextSeat(g: Game, from: number, ok: (p: Player) => boolean): number {
  const n = g.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (ok(g.players[i])) return i;
  }
  return -1;
}

export const potTotal = (g: Game) => g.players.reduce((a, p) => a + p.total, 0);
/** Chips already gathered into the middle (excludes bets still in front of players). */
export const potCollected = (g: Game) => g.players.reduce((a, p) => a + p.total - p.bet, 0);

function say(g: Game, text: string) {
  g.log.push({ hand: g.handNo, street: g.street, text });
}

function put(p: Player, amount: number): number {
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.bet += paid;
  p.total += paid;
  if (p.stack === 0) p.allIn = true;
  return paid;
}

/* --------------------------------------------------------------- game setup */

export function newGame(config: Config, names: string[], rand: () => number = secureRandom): Game {
  const players: Player[] = names.map((name, i) => ({
    id: i,
    name,
    human: i === 0,
    stack: config.startingStack,
    hole: [],
    bet: 0,
    total: 0,
    folded: false,
    allIn: false,
    acted: false,
    raiseLocked: false,
    out: false,
    lastAction: null,
    handRaises: 0,
    handCalls: 0,
    voluntary: false,
  }));
  return {
    config,
    players,
    // The first button is drawn at random; startHand moves it one seat before dealing.
    dealer: Math.floor(rand() * players.length),
    sb: config.smallBlind,
    bb: config.bigBlind,
    sbSeat: -1,
    bbSeat: -1,
    handNo: 0,
    deck: [],
    board: [],
    street: "preflop",
    phase: "hand-over",
    toAct: -1,
    currentBet: 0,
    minRaise: config.bigBlind,
    raisesThisStreet: 0,
    preflopAggressor: null,
    lastAggressor: null,
    log: [],
    actions: [],
    result: null,
    startStacks: players.map((p) => p.stack),
  };
}

export const isGameOver = (g: Game) => {
  const alive = g.players.filter((p) => p.stack > 0);
  return g.players[0].stack === 0 || alive.length <= 1;
};

export function startHand(prev: Game, rand: () => number = secureRandom): Game {
  const g = clone(prev);
  for (const p of g.players) {
    if (p.stack === 0) p.out = true;
    Object.assign(p, {
      hole: [],
      bet: 0,
      total: 0,
      folded: false,
      allIn: false,
      acted: false,
      raiseLocked: false,
      lastAction: null,
      handRaises: 0,
      handCalls: 0,
      voluntary: false,
    });
  }
  if (isGameOver(g)) {
    g.phase = "game-over";
    return g;
  }

  g.handNo += 1;
  if (g.config.blindsEvery > 0 && g.handNo > 1 && (g.handNo - 1) % g.config.blindsEvery === 0) {
    g.sb *= 2;
    g.bb *= 2;
  }
  g.dealer = nextSeat(g, g.dealer, (p) => !p.out);
  g.board = [];
  g.street = "preflop";
  g.result = null;
  g.currentBet = 0;
  g.minRaise = g.bb;
  g.raisesThisStreet = 0;
  g.preflopAggressor = null;
  g.lastAggressor = null;
  g.startStacks = g.players.map((p) => p.stack);
  g.actions = [];
  g.deck = shuffledDeck(rand);

  const active = g.players.filter((p) => !p.out).length;
  g.sbSeat = active === 2 ? g.dealer : nextSeat(g, g.dealer, (p) => !p.out);
  g.bbSeat = nextSeat(g, g.sbSeat, (p) => !p.out);

  say(g, `Hand #${g.handNo} · blinds ${g.sb}/${g.bb}`);
  // Two cards each, one at a time, starting left of the button.
  for (let round = 0; round < 2; round++) {
    let seat = g.dealer;
    for (let k = 0; k < active; k++) {
      seat = nextSeat(g, seat, (p) => !p.out);
      g.players[seat].hole.push(g.deck.pop()!);
    }
  }

  const sbP = g.players[g.sbSeat];
  const bbP = g.players[g.bbSeat];
  say(g, `${sbP.name} posts small blind ${put(sbP, g.sb)}`);
  say(g, `${bbP.name} posts big blind ${put(bbP, g.bb)}`);
  sbP.lastAction = "SB";
  bbP.lastAction = "BB";
  // Even a short all-in big blind sets the full big blind as the amount to call.
  g.currentBet = g.bb;
  g.minRaise = g.bb;

  g.phase = "betting";
  g.toAct = nextSeat(g, g.bbSeat, canAct);
  return settle(g, g.bbSeat);
}

/* ---------------------------------------------------------------- actions */

export interface Legal {
  toCall: number;
  canCheck: boolean;
  callAmount: number;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
}

export function legal(g: Game, seat = g.toAct): Legal {
  const p = g.players[seat];
  const toCall = Math.max(0, g.currentBet - p.bet);
  const callAmount = Math.min(toCall, p.stack);
  const othersCanRespond = g.players.some((q) => q.id !== p.id && canAct(q));
  const maxTo = p.bet + p.stack;
  const fullMin = g.currentBet === 0 ? g.bb : g.currentBet + g.minRaise;
  const canRaise = !p.raiseLocked && p.stack > toCall && othersCanRespond;
  return { toCall, canCheck: toCall === 0, callAmount, canRaise, minTo: Math.min(fullMin, maxTo), maxTo };
}

export function act(prev: Game, action: Action): Game {
  if (prev.phase !== "betting") return prev;
  const g = clone(prev);
  const seat = g.toAct;
  const p = g.players[seat];
  const L = legal(g, seat);

  let type = action.type;
  if (type === "check" && !L.canCheck) type = "call";
  if (type === "fold" && L.canCheck) type = "check"; // never fold for free
  if (type === "raise" && !L.canRaise) type = L.canCheck ? "check" : "call";
  const potBefore = potTotal(g);
  const stackBefore = p.stack;
  const opensBetting = g.currentBet === 0;

  if (type === "fold") {
    p.folded = true;
    p.lastAction = "Fold";
    say(g, `${p.name} folds`);
  } else if (type === "check") {
    p.lastAction = "Check";
    say(g, `${p.name} checks`);
  } else if (type === "call") {
    const paid = put(p, L.callAmount);
    p.handCalls += 1;
    if (g.street === "preflop") p.voluntary = true;
    p.lastAction = p.allIn ? "All-in" : `Call ${paid}`;
    say(g, `${p.name} calls ${paid}${p.allIn ? " (all-in)" : ""}`);
  } else {
    const to = Math.round(Math.max(L.minTo, Math.min(L.maxTo, action.to ?? L.minTo)));
    const raiseSize = to - g.currentBet;
    const opening = g.currentBet === 0;
    put(p, to - p.bet);
    const full = raiseSize >= g.minRaise || opening;
    if (full) {
      g.minRaise = Math.max(raiseSize, g.bb);
      for (const q of g.players) if (q.id !== p.id && canAct(q)) {
        q.acted = false;
        q.raiseLocked = false;
      }
    } else {
      // An all-in short of a full raise: everyone must answer it, but those who already acted cannot re-raise.
      for (const q of g.players) if (q.id !== p.id && canAct(q) && q.acted) {
        q.acted = false;
        q.raiseLocked = true;
      }
    }
    g.currentBet = Math.max(g.currentBet, to);
    g.raisesThisStreet += 1;
    g.lastAggressor = seat;
    if (g.street === "preflop") {
      g.preflopAggressor = seat;
      p.voluntary = true;
    }
    p.handRaises += 1;
    const verb = opening ? "bets" : "raises to";
    p.lastAction = p.allIn ? "All-in" : opening ? `Bet ${to}` : `Raise ${to}`;
    say(g, `${p.name} ${verb} ${to}${p.allIn ? " (all-in)" : ""}`);
  }
  p.acted = true;
  if (type !== "raise") p.raiseLocked = false;
  g.actions.push({ seat, street: g.street, type: type === "raise" && opensBetting ? "bet" : type, paid: stackBefore - p.stack, pot: potBefore });
  return settle(g, seat);
}

/** After an action: award an uncontested pot, move to the next player, or close the street. */
function settle(g: Game, lastSeat: number): Game {
  const live = g.players.filter(inHand);
  if (live.length === 1) return award(g, live[0].id);

  const pending = g.players.filter((p) => canAct(p) && (!p.acted || p.bet < g.currentBet));
  // A lone player who can still act and already matches the bet has nobody to bet into.
  const someoneCanBet = g.players.filter(canAct).length > 1;
  if (pending.length > 0 && (someoneCanBet || pending.some((p) => p.bet < g.currentBet))) {
    g.toAct = nextSeat(g, lastSeat, (p) => canAct(p) && (!p.acted || p.bet < g.currentBet));
    g.phase = "betting";
    return g;
  }
  g.phase = "street-end";
  g.toAct = -1;
  return g;
}

/** Deal the next street (or go to showdown). Called by the UI after a short pause between streets. */
export function nextStreet(prev: Game): Game {
  if (prev.phase !== "street-end") return prev;
  const g = clone(prev);
  for (const p of g.players) {
    p.bet = 0;
    p.acted = false;
    p.raiseLocked = false;
    if (canAct(p) && p.lastAction !== "Fold") p.lastAction = null;
  }
  g.currentBet = 0;
  g.minRaise = g.bb;
  g.raisesThisStreet = 0;
  g.lastAggressor = null;

  if (g.street === "river") return showdown(g);
  g.deck.pop(); // burn
  if (g.street === "preflop") {
    g.board.push(g.deck.pop()!, g.deck.pop()!, g.deck.pop()!);
    g.street = "flop";
  } else if (g.street === "flop") {
    g.board.push(g.deck.pop()!);
    g.street = "turn";
  } else {
    g.board.push(g.deck.pop()!);
    g.street = "river";
  }
  say(g, `${g.street[0].toUpperCase()}${g.street.slice(1)}`);

  if (g.players.filter(canAct).length <= 1) {
    // Everyone left is all-in (or one player covers them): run the board out with no betting.
    g.phase = "street-end";
    g.toAct = -1;
    return g;
  }
  g.phase = "betting";
  g.toAct = nextSeat(g, g.dealer, canAct);
  return g;
}

/* ----------------------------------------------------------------- payouts */

function finish(g: Game, pots: PotResult[], shown: number[], showdownHappened: boolean): Game {
  const net: Record<number, number> = {};
  for (const p of g.players) net[p.id] = p.stack - g.startStacks[p.id];
  g.result = { pots, shown, net, showdown: showdownHappened };
  g.phase = "hand-over";
  g.toAct = -1;
  for (const p of g.players) p.bet = 0;
  return g;
}

function award(g: Game, winner: number): Game {
  const amount = potTotal(g);
  g.players[winner].stack += amount;
  say(g, `${g.players[winner].name} wins ${amount}`);
  return finish(g, [{ amount, winners: [winner], hand: null }], [], false);
}

/** Split `amount` among winners; odd chips go to the first winners clockwise from the button. */
function split(g: Game, amount: number, winners: number[]) {
  const n = g.players.length;
  const order = [...winners].sort((a, b) => ((a - g.dealer - 1 + n) % n) - ((b - g.dealer - 1 + n) % n));
  const share = Math.floor(amount / order.length);
  let odd = amount - share * order.length;
  for (const w of order) {
    g.players[w].stack += share + (odd > 0 ? 1 : 0);
    if (odd > 0) odd -= 1;
  }
}

function showdown(g: Game): Game {
  const contenders = g.players.filter(inHand);
  const scores = new Map<number, number>();
  for (const p of contenders) scores.set(p.id, evaluate([...p.hole, ...g.board]));

  // Layer the pot by contribution level: each layer is won among contenders who paid into it.
  const levels = [...new Set(g.players.filter((p) => p.total > 0).map((p) => p.total))].sort((a, b) => a - b);
  const pots: PotResult[] = [];
  let prevLevel = 0;
  for (const level of levels) {
    const payers = g.players.filter((p) => p.total >= level).length;
    const amount = (level - prevLevel) * payers;
    const eligible = contenders.filter((p) => p.total >= level).map((p) => p.id);
    prevLevel = level;
    if (amount === 0) continue;
    if (eligible.length === 0) {
      // Only folded players reached this level: it belongs to the deepest contender (returns their excess).
      const deepest = contenders.reduce((a, b) => (b.total > a.total ? b : a));
      deepest.stack += amount;
      continue;
    }
    const best = Math.max(...eligible.map((id) => scores.get(id)!));
    const winners = eligible.filter((id) => scores.get(id) === best);
    split(g, amount, winners);
    const last = pots[pots.length - 1];
    // Merge consecutive layers with the same winners and eligibility, so the UI shows one main pot.
    if (last && last.winners.join() === winners.join() && eligible.length > 1) last.amount += amount;
    else pots.push({ amount, winners, hand: eligible.length > 1 ? describe(best) : null });
  }
  for (const pot of pots) {
    const who = pot.winners.map((w) => g.players[w].name).join(" & ");
    if (!pot.hand) say(g, `Uncalled ${pot.amount} returned to ${who}`);
    else say(g, `${who} win${pot.winners.length > 1 ? "" : "s"} ${pot.amount} with ${pot.hand}`);
  }
  return finish(g, pots, contenders.map((p) => p.id), contenders.length > 1);
}
