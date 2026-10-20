import { cardLabel, rankOf, suitOf, type Card } from "./cards";
import { CATEGORIES, bestFive, categoryOf, describe, evaluate } from "./evaluate";
import { inHand, legal, potTotal, type Action, type ActionRecord, type Game, type Street } from "./engine";
import { preflopStrength } from "./bot";

/**
 * Learning-mode coach. At each of your decisions from the flop on it builds each opponent's range from their line,
 * works out the right answer to a fixed checklist (your hand, their hand, equity, the decision), and grades you.
 * Ranges are a model, not the bots' actual logic, so reads are estimates; the hand maths is exact or simulated.
 */

/* ------------------------------------------------------------ hand reading */

export type HandClass = "monster" | "strong" | "medium" | "draw" | "nothing";
const CLASS_LABEL: Record<HandClass, string> = { monster: "Monster", strong: "Strong", medium: "Medium", draw: "Draw", nothing: "Nothing" };
const CLASSES = Object.keys(CLASS_LABEL) as HandClass[];

const rmask = (cs: Card[]) => cs.reduce((m, c) => m | (1 << rankOf(c)), 0);
function straightHi(mask: number): number {
  for (let hi = 12; hi >= 4; hi--) if ((mask & (0b11111 << (hi - 4))) === 0b11111 << (hi - 4)) return hi;
  const wheel = (1 << 12) | 0b1111;
  return (mask & wheel) === wheel ? 3 : -1;
}

/** Flush draw (four of a suit, one of yours) and straight draw (cards of two ranks complete it = open-ended). */
export function drawsOf(hole: Card[], board: Card[]) {
  if (board.length >= 5) return { flush: false, straight: null as "open" | "gutshot" | null };
  const all = [...hole, ...board];
  const flush = [0, 1, 2, 3].some((s) => all.filter((c) => suitOf(c) === s).length === 4 && hole.some((c) => suitOf(c) === s));
  const m = rmask(all);
  const bm = rmask(board);
  let completing = 0;
  if (straightHi(m) < 0) {
    for (let r = 0; r < 13; r++) if (!(m & (1 << r)) && straightHi(m | (1 << r)) >= 0 && straightHi(bm | (1 << r)) < 0) completing++;
  }
  return { flush, straight: completing >= 2 ? ("open" as const) : completing === 1 ? ("gutshot" as const) : null };
}

/** The board's own category, before anyone's hole cards. */
function boardCat(board: Card[]): number {
  if (board.length === 5) return categoryOf(evaluate(board));
  const counts = new Map<number, number>();
  for (const c of board) counts.set(rankOf(c), (counts.get(rankOf(c)) ?? 0) + 1);
  const n = [...counts.values()].sort((a, b) => b - a);
  return n[0] === 4 ? 7 : n[0] === 3 ? 3 : n[0] === 2 && n[1] === 2 ? 2 : n[0] === 2 ? 1 : 0;
}

/** Monster (two pair+ from your cards), strong (top pair, overpair), medium (other pairs), draw, or nothing. */
export function classify(hole: Card[], board: Card[]): HandClass {
  const cat = categoryOf(evaluate([...hole, ...board]));
  if (cat > boardCat(board)) {
    if (cat >= 3) return "monster";
    const hr = hole.map(rankOf);
    const br = board.map(rankOf);
    const top = Math.max(...br);
    if (cat === 2 && hr[0] !== hr[1] && hr.every((r) => br.includes(r))) return "monster";
    if (hr[0] === hr[1]) return hr[0] > top ? "strong" : "medium";
    const paired = hr.filter((r) => br.includes(r));
    if (paired.includes(top)) return "strong";
    if (paired.length) return "medium";
  }
  const d = drawsOf(hole, board);
  return d.flush || d.straight === "open" ? "draw" : "nothing";
}

/* ------------------------------------------------------------------ ranges */

export const GROUPS = ["Big pairs", "Small pairs", "Ax", "Broadway", "Suited", "Connectors", "Other"] as const;
export type Group = (typeof GROUPS)[number];
export const GROUP_HINT: Record<Group, string> = {
  "Big pairs": "TT+",
  "Small pairs": "22–99",
  Ax: "one ace",
  Broadway: "both T–K",
  Suited: "other suited",
  Connectors: "offsuit, gap ≤ 1",
  Other: "offsuit junk",
};

/** Groups don't overlap: a hand goes in the first one it fits. */
export function groupOf([a, b]: Card[]): Group {
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  if (hi === lo) return hi >= 8 ? "Big pairs" : "Small pairs";
  if (hi === 12) return "Ax";
  if (lo >= 8) return "Broadway";
  if (suitOf(a) === suitOf(b)) return "Suited";
  if (hi - lo <= 2) return "Connectors";
  return "Other";
}

type Combo = { cards: Card[]; w: number };
const ALL: Card[][] = [];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) ALL.push([a, b]);
const STRENGTH = ALL.map(preflopStrength);
const SORTED = [...STRENGTH].sort((x, y) => y - x);
/** Preflop strength at the edge of the top fraction of hands. */
const top = (f: number) => SORTED[Math.min(SORTED.length - 1, Math.floor(f * SORTED.length))];

/** How likely each hand class is to take each action. */
const RESPONSE: Record<"big" | "small" | "call" | "check", Record<HandClass, number>> = {
  big: { monster: 1, strong: 0.8, medium: 0.25, draw: 0.6, nothing: 0.15 },
  small: { monster: 0.8, strong: 1, medium: 0.6, draw: 0.6, nothing: 0.3 },
  call: { monster: 0.5, strong: 1, medium: 0.8, draw: 0.9, nothing: 0.1 },
  check: { monster: 0.35, strong: 0.6, medium: 1, draw: 0.8, nothing: 1 },
};
/** How likely each class is to continue against a bet of that size. */
const CONTINUE: Record<"small" | "big", Record<HandClass, number>> = {
  small: { monster: 1, strong: 1, medium: 0.75, draw: 0.7, nothing: 0.1 },
  big: { monster: 1, strong: 0.85, medium: 0.3, draw: 0.55, nothing: 0.05 },
};
const RAISE: Record<HandClass, number> = { monster: 1, strong: 0.2, medium: 0.03, draw: 0.3, nothing: 0.06 };

const BOARD_LEN: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
const isAggro = (a: ActionRecord) => a.type === "bet" || a.type === "raise";
const kindOf = (a: ActionRecord) =>
  a.type === "check" ? "check" : a.type === "call" ? "call" : a.type === "raise" ? "big" : a.type === "bet" ? (a.paid >= 0.6 * a.pot ? "big" : "small") : null;

function preflopWeight(g: Game, seat: number): (s: number) => number {
  const pre = g.actions.filter((a) => a.street === "preflop");
  const raises = pre.filter((a) => a.seat === seat && isAggro(a)).length;
  const firstCall = pre.findIndex((a) => a.seat === seat && a.type === "call");
  const facedRaise = firstCall > 0 && pre.slice(0, firstCall).some(isAggro);
  if (raises >= 2) return (s) => (s >= top(0.08) ? 1 : 0.03);
  if (raises === 1) return (s) => (s >= top(0.22) ? 1 : 0.05);
  if (firstCall >= 0 && facedRaise) return (s) => (s >= top(0.03) ? 0.3 : s >= top(0.35) ? 1 : 0.05);
  if (firstCall >= 0) return (s) => (s >= top(0.55) ? 1 : 0.1);
  return (s) => (s >= top(0.08) ? 0.4 : 1); // big blind: anything, minus most hands that would have raised
}

/** A player's range: every hand they could hold, weighted by how well it fits what they've done this hand. */
export function rangeOf(g: Game, seat: number, dead: Set<Card>): Combo[] {
  const pw = preflopWeight(g, seat);
  const post = g.actions.filter((a) => a.seat === seat && a.street !== "preflop");
  const out: Combo[] = [];
  ALL.forEach((cards, i) => {
    if (dead.has(cards[0]) || dead.has(cards[1])) return;
    let w = pw(STRENGTH[i]);
    for (const a of post) {
      const k = kindOf(a);
      if (k) w *= RESPONSE[k][classify(cards, g.board.slice(0, BOARD_LEN[a.street]))];
    }
    if (w > 0.002) out.push({ cards, w });
  });
  return out;
}

/* ------------------------------------------------------------------ equity */

const DECK = Array.from({ length: 52 }, (_, i) => i);
const showdown = (hero: Card[], opp: Card[], board: Card[]) => {
  const a = evaluate([...hero, ...board]);
  const b = evaluate([...opp, ...board]);
  return a > b ? 1 : a === b ? 0.5 : 0;
};

/** Your share of the pot against one hand, over the cards to come (exact on the turn, sampled on the flop). */
function comboEquity(hero: Card[], board: Card[], opp: Card[]): number {
  if (board.length === 5) return showdown(hero, opp, board);
  const used = new Set([...hero, ...board, ...opp]);
  const rest = DECK.filter((c) => !used.has(c));
  let s = 0;
  if (board.length === 4) {
    for (const c of rest) s += showdown(hero, opp, [...board, c]);
    return s / rest.length;
  }
  const N = 40;
  for (let k = 0; k < N; k++) {
    const i = Math.floor(Math.random() * rest.length);
    let j = Math.floor(Math.random() * (rest.length - 1));
    if (j >= i) j++;
    s += showdown(hero, opp, [...board, rest[i], rest[j]]);
  }
  return s / N;
}

/** Equity against several ranges at once, by sampling a hand from each and running the board out. */
function multiwayEquity(hero: Card[], board: Card[], ranges: Combo[][], sims = 2000): number {
  const cums = ranges.map((r) => {
    let t = 0;
    return r.map((c) => (t += c.w));
  });
  const pick = (k: number) => {
    const cum = cums[k];
    const x = Math.random() * cum[cum.length - 1];
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return ranges[k][lo].cards;
  };
  let won = 0;
  let done = 0;
  for (let s = 0; s < sims; s++) {
    const used = new Set([...hero, ...board]);
    const hands: Card[][] = [];
    for (let k = 0; k < ranges.length; k++) {
      let h: Card[] | null = null;
      for (let t = 0; t < 20 && !h; t++) {
        const c = pick(k);
        if (!used.has(c[0]) && !used.has(c[1])) h = c;
      }
      if (!h) break;
      h.forEach((c) => used.add(c));
      hands.push(h);
    }
    if (hands.length < ranges.length) continue;
    const b = [...board];
    while (b.length < 5) {
      const c = DECK[Math.floor(Math.random() * 52)];
      if (!used.has(c)) {
        used.add(c);
        b.push(c);
      }
    }
    const mine = evaluate([...hero, ...b]);
    const scores = hands.map((h) => evaluate([...h, ...b]));
    const best = Math.max(mine, ...scores);
    if (mine === best) won += 1 / (1 + scores.filter((x) => x === best).length);
    done++;
  }
  return done ? won / done : 0;
}

/* --------------------------------------------------------------- questions */

export type Part = "My hand" | "Their hand" | "Compare" | "Decision";
interface Base {
  id: string;
  part: Part;
  title: string;
  prompt: string;
  why: string[];
  table?: { head: string[]; rows: string[][] };
}
export type Question =
  | (Base & { kind: "choice"; options: string[]; answer: string; accept: string[] })
  | (Base & { kind: "multi"; options: string[]; answer: string[] })
  | (Base & { kind: "number"; unit: string; answer: number; tol: number })
  | (Base & { kind: "grid"; rows: string[]; options: string[]; answer: string[] });
export type Answer = string | string[] | number | null;

/** 1 right, 0.5 close, 0 wrong. */
export function grade(q: Question, a: Answer): number {
  if (q.kind === "choice") return typeof a === "string" && q.accept.includes(a) ? 1 : 0;
  if (q.kind === "number") {
    const x = typeof a === "string" ? parseFloat(a) : a;
    if (typeof x !== "number" || !Number.isFinite(x)) return 0;
    const d = Math.abs(x - q.answer);
    return d <= q.tol ? 1 : d <= 2 * q.tol ? 0.5 : 0;
  }
  const given = Array.isArray(a) ? a : [];
  if (q.kind === "grid") return q.answer.reduce((s, x, i) => s + (given[i] === x ? 1 : 0), 0) / Math.max(1, q.answer.length);
  const C = new Set(q.answer);
  const G = new Set(given);
  const union = new Set([...C, ...G]).size;
  if (union === 0) return 1;
  const inter = [...C].filter((x) => G.has(x)).length;
  return inter === union ? 1 : inter / union >= 0.5 ? 0.5 : 0;
}

export const answerText = (q: Question): string =>
  q.kind === "number" ? `${q.answer}${q.unit}` : q.kind === "choice" ? q.answer : q.kind === "multi" ? q.answer.join(", ") || "None" : q.rows.map((r, i) => `${r}: ${q.answer[i]}`).join(" · ");

/** What the decision review needs to judge the action you then take. */
export interface Summary {
  street: Street;
  pot: number;
  equity: number;
  need: number | null;
  called: Record<"small" | "big", number>;
  folds: Record<"small" | "big", number>;
  semi: boolean;
}

export interface Coaching {
  villainName: string;
  questions: Question[];
  summary: Summary;
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const sizeWord = (f: number) => (f < 0.4 ? "⅓" : f < 0.6 ? "½" : f < 0.85 ? "¾" : f < 1.2 ? "pot" : `${f.toFixed(1)}×`);

/** Builds the checklist for the human's current decision. `withHand` adds the questions that only change street to street. */
export function coach(g: Game, withHand: boolean): Coaching {
  const meP = g.players[0];
  const hero = meP.hole;
  const board = g.board;
  const street = g.street;
  const L = legal(g, 0);
  const pot = potTotal(g);
  const opponents = g.players.filter((p) => inHand(p) && p.id !== 0).map((p) => p.id);
  // The main opponent: the last player still in who bet or raised, else the first one still in.
  const aggro = [...g.actions].reverse().find((a) => isAggro(a) && opponents.includes(a.seat));
  const villain = aggro?.seat ?? opponents[0];
  const vName = g.players[villain].name;
  const dead = new Set([...hero, ...board]);
  const range = rangeOf(g, villain, dead);
  const total = range.reduce((a, c) => a + c.w, 0) || 1;
  const cls = range.map((c) => classify(c.cards, board));
  const eq = range.map((c) => comboEquity(hero, board, c.cards));
  const hu = range.reduce((a, c, i) => a + c.w * eq[i], 0) / total;
  const equity = opponents.length > 1 ? multiwayEquity(hero, board, opponents.map((s) => (s === villain ? range : rangeOf(g, s, dead)))) : hu;
  const heroScore = evaluate([...hero, ...board]);
  const draws = drawsOf(hero, board);
  const river = street === "river";
  const qs: Question[] = [];

  const weighted = (f: (i: number) => number) => {
    let a = 0;
    let b = 0;
    range.forEach((c, i) => {
      const m = f(i);
      a += c.w * m * eq[i];
      b += c.w * m;
    });
    return { eq: b ? a / b : 0, share: b / total };
  };

  /* Part 1: my hand */
  if (withHand) {
    const five = bestFive([...hero, ...board]);
    const cat = CATEGORIES[categoryOf(heroScore)];
    qs.push({
      id: "made",
      part: "My hand",
      title: "What exactly do I have?",
      prompt: "Your best five-card hand.",
      kind: "choice",
      options: [...CATEGORIES],
      answer: cat,
      accept: [cat],
      why: [`${describe(heroScore)}: ${five.map(cardLabel).join(" ")}.`],
    });
    const boardPlays = board.length === 5 && evaluate(board) === heroScore;
    const onePlays = board.length >= 4 && hero.some((h) => evaluate([h, ...board]) === heroScore);
    const plays = boardPlays ? "Neither: the board plays" : onePlays ? "Only one of mine" : "Both of mine";
    qs.push({
      id: "plays",
      part: "My hand",
      title: "Do my cards play?",
      prompt: "Which of your hole cards are in that best five?",
      kind: "choice",
      options: ["Both of mine", "Only one of mine", "Neither: the board plays"],
      answer: plays,
      accept: [plays],
      why: [
        boardPlays
          ? "The board alone makes your hand, so everyone still in has at least this. Only a better kicker or hand beats it."
          : onePlays
            ? `One card does the work: ${hero.filter((h) => evaluate([h, ...board]) === heroScore).map(cardLabel).join(" or ")} with the board makes the same hand.`
            : board.length === 3
              ? "On the flop you have exactly five cards, so both of yours are in the hand."
              : "You need both hole cards for this hand.",
      ],
    });

    if (!river) {
      const ans = [draws.flush && "Flush draw", draws.straight === "open" && "Open-ended straight", draws.straight === "gutshot" && "Gutshot"].filter(Boolean) as string[];
      qs.push({
        id: "draws",
        part: "My hand",
        title: "What draws do I have?",
        prompt: "Pick all that apply, or none.",
        kind: "multi",
        options: ["Flush draw", "Open-ended straight", "Gutshot"],
        answer: ans,
        why: [
          draws.flush ? "Four cards of one suit with at least one of yours: 9 cards make the flush." : "No flush draw: you don't have four of a suit.",
          draws.straight === "open"
            ? "Cards of two different ranks complete your straight: 8 outs."
            : draws.straight === "gutshot"
              ? "Only one rank fills the gap in your straight: 4 outs."
              : "No straight draw that uses your cards.",
        ],
      });
    }
  }

  // Outs: against the hands that beat you right now, the next cards that turn it around (ties count half).
  const beating = range.map((c) => evaluate([...c.cards, ...board]) > heroScore);
  const behindW = range.reduce((a, c, i) => a + (beating[i] ? c.w : 0), 0);
  const behind = behindW / total;
  if (!river && behind >= 0.05) {
    const unseen = DECK.filter((c) => !dead.has(c));
    const perCard = new Map<Card, number>();
    let outs = 0;
    range.forEach((c, i) => {
      if (!beating[i]) return;
      let n = 0;
      for (const x of unseen) {
        if (c.cards.includes(x)) continue;
        const r = showdown(hero, c.cards, [...board, x]);
        n += r;
        perCard.set(x, (perCard.get(x) ?? 0) + (c.w * r) / behindW);
      }
      outs += (c.w * n) / behindW;
    });
    outs = Math.round(outs * 2) / 2;
    const clean = [...perCard].filter(([, v]) => v >= 0.6).map(([c]) => c);
    const dirty = [...perCard].filter(([, v]) => v >= 0.2 && v < 0.6).map(([c]) => c);
    const list = (cs: Card[]) => (cs.length ? cs.sort((a, b) => b - a).map(cardLabel).join(" ") : "none");
    qs.push({
      id: "outs",
      part: "My hand",
      title: "How many outs?",
      prompt: "Cards that turn a losing hand into a winner. Dirty outs count half.",
      kind: "number",
      unit: "",
      answer: outs,
      tol: Math.max(1.5, outs * 0.2),
      why: [
        `You're behind ${pc(behind)} of ${vName}'s range. Against those hands, about ${outs} of the ${unseen.length} unseen cards win it for you.`,
        `Clean outs: ${list(clean)}.`,
        `Dirty outs (win only some of the time): ${list(dirty)}.`,
      ],
    });
    const allIn = L.callAmount >= meP.stack || opponents.some((s) => g.players[s].allIn);
    const mult = street === "flop" && allIn ? 4 : 2;
    const u = unseen.length;
    const exact = mult === 4 ? 1 - (1 - outs / u) * (1 - outs / (u - 1)) : outs / u;
    qs.push({
      id: "hit",
      part: "My hand",
      title: "What's my chance to hit?",
      prompt: "In %. Outs × 2 with one card to come, × 4 with two (only if all-in).",
      kind: "number",
      unit: "%",
      answer: Math.round(outs * mult),
      tol: 4,
      why: [
        `${outs} × ${mult} = ${Math.round(outs * mult)}% (${mult === 4 ? "two cards to come and nobody can bet you off it" : street === "flop" ? "only the turn is guaranteed: more betting comes before the river" : "one card to come"}).`,
        `Exact: ${outs} ÷ ${u}${mult === 4 ? " over two cards" : ""} = ${pc(exact)}.`,
      ],
    });
  }

  /* Part 2: their hand */
  const vActs = g.actions.filter((a) => a.seat === villain);
  const line = (["preflop", "flop", "turn", "river"] as Street[])
    .map((st) => {
      const acts = vActs.filter((a) => a.street === st);
      if (!acts.length) return null;
      const words = acts.map((a) =>
        a.type === "bet" ? `bet ${sizeWord(a.paid / a.pot)} pot` : a.type === "raise" ? (st === "preflop" ? "raised" : `raised (${sizeWord(a.paid / a.pot)} pot)`) : `${a.type}${a.type.endsWith("e") ? "d" : "ed"}`,
      );
      return `${cap(st)}: ${words.join(", then ")}`;
    })
    .filter(Boolean)
    .join(" · ");
  const post = vActs.filter((a) => a.street !== "preflop");
  const prev: Street = street === "river" ? "turn" : street === "turn" ? "flop" : "preflop";
  const recent = post.filter((a) => a.street === street || a.street === prev);
  const preRaised = vActs.some((a) => a.street === "preflop" && isAggro(a));
  const preCalled = vActs.some((a) => a.street === "preflop" && a.type === "call");
  let read: string;
  let readWhy: string;
  if (post.some((a) => a.type === "raise") || recent.some((a) => a.type === "bet" && a.paid >= 0.6 * a.pot)) {
    read = "Strong";
    readWhy = "A raise or a big bet after the flop usually means a strong hand.";
  } else if (post.some((a) => a.type === "bet" || a.type === "call")) {
    read = "Medium";
    readWhy = "Small bets and calls are mostly medium hands and draws.";
  } else if (post.length) {
    read = "Weak or drawing";
    readWhy = "Only checks after the flop: usually medium or weak.";
  } else if (preRaised) {
    read = "Strong";
    readWhy = "They raised preflop, so they started with strong cards. Nothing since has said otherwise.";
  } else if (preCalled) {
    read = "Medium";
    readWhy = "They called preflop: playable but not premium cards.";
  } else {
    read = "Weak or drawing";
    readWhy = "No voluntary action: the big blind can hold anything.";
  }
  qs.push({
    id: "line",
    part: "Their hand",
    title: `What has ${vName} done?`,
    prompt: `${line || "Nothing yet"}. What does that line say?`,
    kind: "choice",
    options: ["Strong", "Medium", "Weak or drawing"],
    answer: read,
    accept: [read],
    why: [
      aggro ? `${vName} is the main opponent: the last player to bet or raise.` : opponents.length > 1 ? `Nobody has bet, so ${vName} stands in for the table.` : `${vName} is your only opponent.`,
      readWhy,
    ],
  });

  const groupW = new Map<Group, { w: number; cls: Record<HandClass, number> }>();
  range.forEach((c, i) => {
    const gp = groupOf(c.cards);
    const e = groupW.get(gp) ?? { w: 0, cls: { monster: 0, strong: 0, medium: 0, draw: 0, nothing: 0 } };
    e.w += c.w;
    e.cls[cls[i]] += c.w;
    groupW.set(gp, e);
  });
  const share = (gp: Group) => (groupW.get(gp)?.w ?? 0) / total;
  const ordered = GROUPS.filter((gp) => share(gp) > 0).sort((a, b) => share(b) - share(a));
  qs.push({
    id: "groups",
    part: "Their hand",
    title: "What's their range, in groups?",
    prompt: "Pick the groups that make up most of it (15% or more each).",
    kind: "multi",
    options: [...GROUPS],
    answer: GROUPS.filter((gp) => share(gp) >= 0.15),
    why: [`${vName}'s range by group: ${ordered.map((gp) => `${gp} ${pc(share(gp))}`).join(" · ")}.`, "Built from their preflop action, then narrowed street by street by what they did."],
  });

  const shown = ordered.filter((gp) => share(gp) >= 0.08);
  const hitOf = (gp: Group) => {
    const c = groupW.get(gp)!.cls;
    const hit = c.monster + c.strong + c.medium;
    const all = hit + c.draw + c.nothing || 1;
    return { hit: hit / all, draw: c.draw / all, miss: c.nothing / all };
  };
  if (shown.length) {
    qs.push({
      id: "hits",
      part: "Their hand",
      title: "How did the board hit each group?",
      prompt: "Mostly a pair or better (hit), a draw, or nothing (missed)?",
      kind: "grid",
      rows: shown.map(String),
      options: ["Hit", "Draw", "Missed"],
      answer: shown.map((gp) => {
        const h = hitOf(gp);
        return h.hit >= h.draw && h.hit >= h.miss ? "Hit" : h.draw >= h.miss ? "Draw" : "Missed";
      }),
      why: ["Each group's hands on this board, weighted by how likely they are:"],
      table: { head: ["Group", "Hit", "Draw", "Missed"], rows: shown.map((gp) => [gp, pc(hitOf(gp).hit), pc(hitOf(gp).draw), pc(hitOf(gp).miss)]) },
    });
  }

  // Card removal: how much of their strong part each of your cards takes away (counted with that card back in the deck).
  const blocks = hero.map((x) => {
    const r = rangeOf(g, villain, new Set([...hero.filter((h) => h !== x), ...board]));
    let strong = 0;
    let withX = 0;
    for (const c of r) {
      const k = classify(c.cards, board);
      if (k !== "monster" && k !== "strong") continue;
      strong += c.w;
      if (c.cards.includes(x)) withX += c.w;
    }
    return { x, share: strong ? withX / strong : 0 };
  });
  qs.push({
    id: "blockers",
    part: "Their hand",
    title: "Card removal",
    prompt: "Which of your cards make their strong hands (top pair or better) noticeably less likely? None is an answer.",
    kind: "multi",
    options: hero.map(cardLabel),
    answer: blocks.filter((b) => b.share >= 0.12).map((b) => cardLabel(b.x)),
    why: [
      ...blocks.map((b) => `${cardLabel(b.x)} takes away ${pc(b.share)} of their strong hands.`),
      "12% or more is worth noticing. Board cards remove combinations too, and that's already counted.",
    ],
  });

  if (withHand) {
    const br = board.map(rankOf);
    const paired = new Set(br).size < br.length;
    const suited = [0, 1, 2, 3].some((s) => board.filter((c) => suitOf(c) === s).length >= 3);
    const bm = rmask(board);
    let connected = false;
    for (let lo = -1; lo <= 8; lo++) {
      let n = 0;
      for (let r = lo; r < lo + 5; r++) if (bm & (1 << (r === -1 ? 12 : r))) n++;
      if (n >= 3) connected = true;
    }
    qs.push({
      id: "danger",
      part: "Their hand",
      title: "Danger check",
      prompt: "What can the board give someone? Pick all that apply.",
      kind: "multi",
      options: ["Paired: full houses possible", "3+ of a suit: flushes possible", "3+ connected: straights possible"],
      answer: [paired && "Paired: full houses possible", suited && "3+ of a suit: flushes possible", connected && "3+ connected: straights possible"].filter(Boolean) as string[],
      why: [
        paired ? "The board is paired: trips and full houses are live." : "No pair on the board, so no full houses yet.",
        suited ? "Three or more of one suit: anyone with two of that suit has a flush." : "No three of a suit on the board.",
        connected ? "Three ranks fit inside a five-card window: a straight is possible." : "No three cards close enough for a straight.",
      ],
    });
  }

  /* Part 3: compare */
  qs.push({
    id: "equity",
    part: "Compare",
    title: "Am I ahead overall?",
    prompt: `Your equity in %: your share of the pot if all the cards came out now${opponents.length > 1 ? `, against all ${opponents.length} players` : ""}.`,
    kind: "number",
    unit: "%",
    answer: Math.round(equity * 100),
    tol: 10,
    why: [
      `Weighted against ${vName}: Σ share × equity = ${pc(hu)}. A weighted average, not a count of groups.`,
      opponents.length > 1
        ? `Against all ${opponents.length} opponents together: ${pc(equity)}. Your fair share with ${opponents.length + 1} players is ${pc(1 / (opponents.length + 1))}.`
        : hu >= 0.5
          ? "Above 50%: you're ahead."
          : "Below 50%: you're behind.",
    ],
    table: {
      head: ["Group", "Share", "Your equity"],
      rows: ordered.map((gp) => {
        const w = groupW.get(gp)!.w;
        const e = range.reduce((a, c, i) => a + (groupOf(c.cards) === gp ? c.w * eq[i] : 0), 0) / w;
        return [gp, pc(w / total), pc(e)];
      }),
    },
  });

  /* Part 4: the decision */
  const called = { small: weighted((i) => CONTINUE.small[cls[i]]), big: weighted((i) => CONTINUE.big[cls[i]]) };
  const semi = !river && (draws.flush || draws.straight === "open") && called.big.eq < 0.5;
  const villainStack = Math.max(...opponents.map((s) => g.players[s].stack));
  const effective = Math.min(meP.stack, villainStack);
  const need = L.toCall > 0 ? L.callAmount / (pot + L.callAmount) : null;
  const planOpts = (raiseWord: string) => ["Fold", "Call", raiseWord];
  const planAnswer = (e: number, n: number, raiseWord: string) => {
    const ans = e >= 0.65 ? raiseWord : e >= n ? "Call" : "Fold";
    const accept = [ans];
    if (Math.abs(e - n) < 0.04) accept.push(ans === "Call" ? "Fold" : "Call");
    if (Math.abs(e - 0.65) < 0.04) accept.push(ans === raiseWord ? "Call" : raiseWord);
    return { answer: ans, accept: [...new Set(accept)] };
  };

  if (need === null) {
    const size: "small" | "big" = (g.handNo + BOARD_LEN[street]) % 2 ? "small" : "big";
    const sizeLabel = size === "small" ? "⅓ pot" : "¾ pot";
    qs.push({
      id: "who",
      part: "Decision",
      title: "Who calls, and who folds?",
      prompt: `If you bet ${sizeLabel}, which of their hand types continue?`,
      kind: "multi",
      options: CLASSES.map((c) => CLASS_LABEL[c]),
      answer: CLASSES.filter((c) => CONTINUE[size][c] >= 0.5).map((c) => CLASS_LABEL[c]),
      why: [
        size === "small" ? "A small bet gives medium hands a good price, so they call." : "A big bet prices medium hands out: they mostly fold. Strong hands and good draws continue.",
        `Of ${vName}'s range, ${pc(called[size].share)} continues and ${pc(1 - called[size].share)} folds.`,
      ],
    });
    const ahead = called[size].eq;
    qs.push({
      id: "value",
      part: "Decision",
      title: "Am I ahead when called?",
      prompt: `Against the hands that call your ${sizeLabel} bet.`,
      kind: "choice",
      options: ["Ahead: value bet", "Behind: not a value bet"],
      answer: ahead >= 0.5 ? "Ahead: value bet" : "Behind: not a value bet",
      accept: Math.abs(ahead - 0.5) < 0.05 ? ["Ahead: value bet", "Behind: not a value bet"] : [ahead >= 0.5 ? "Ahead: value bet" : "Behind: not a value bet"],
      why: [
        `When ${vName} calls, you have ${pc(ahead)} equity.`,
        ahead < 0.35 ? "Only better hands call: that's adverse selection. Betting for value here loses money." : ahead >= 0.5 ? "Worse hands call you: that's a value bet." : "Close to a coin flip when called: thin.",
      ],
    });
    qs.push({
      id: "semi",
      part: "Decision",
      title: "Is it a semi-bluff?",
      prompt: "A big draw that can win two ways: they fold now, or you hit later.",
      kind: "choice",
      options: ["Yes", "No"],
      answer: semi ? "Yes" : "No",
      accept: [semi ? "Yes" : "No"],
      why: [
        river
          ? "No cards to come on the river, so there's nothing to semi-bluff with."
          : !(draws.flush || draws.straight === "open")
            ? "No big draw (flush or open-ended), so there's no second way to win."
            : called.big.eq >= 0.5
              ? "You have a draw, but you're already ahead when called: that's a value bet."
              : `A ¾-pot bet folds out ${pc(1 - called.big.share)} of their range, and when called you still have ${pc(called.big.eq)} equity.`,
      ],
    });
    const value = called.small.eq >= 0.5 || called.big.eq >= 0.5;
    const spr = effective / pot;
    let bet: string;
    let betWhy: string;
    if (!value && !semi) {
      bet = "Check";
      betWhy = "Not ahead when called and no semi-bluff: check.";
    } else if (spr < 1.5) {
      bet = "All-in";
      betWhy = `Stack-to-pot ratio is ${spr.toFixed(1)}: with less than about one and a half pots behind, just get it in.`;
    } else if (semi || called.big.eq >= 0.6) {
      bet = "Big (¾ pot+)";
      betWhy = semi ? "Draws bet big: it maximises fold equity." : `Strong: still ${pc(called.big.eq)} against the hands that call a big bet, so charge them.`;
    } else {
      bet = "Small (⅓ pot)";
      betWhy = `Thin value: ${pc(called.small.eq)} when a small bet is called but ${pc(called.big.eq)} against a big one. Bet small to keep medium hands in.`;
    }
    qs.push({
      id: "size",
      part: "Decision",
      title: "What size?",
      prompt: "Small for thin value, big for strong hands or draws, all-in at a low stack-to-pot ratio.",
      kind: "choice",
      options: ["Check", "Small (⅓ pot)", "Big (¾ pot+)", "All-in"],
      answer: bet,
      accept: bet === "All-in" ? ["All-in", "Big (¾ pot+)"] : [bet],
      why: [betWhy],
    });
    // Plan: if you bet, what if they raise? If you'd check, what if they bet?
    const raising = bet !== "Check";
    const scen = weighted((i) => (raising ? RAISE : RESPONSE.big)[cls[i]]);
    const n = raising ? 1.5 / 5.5 : 0.75 / 2.5;
    const raiseWord = raising ? "Re-raise" : "Raise";
    const p = planAnswer(scen.eq, n, raiseWord);
    qs.push({
      id: "plan",
      part: "Decision",
      title: "What's my plan?",
      prompt: raising ? `You bet ¾ pot and ${vName} raises to 3×. You…` : `You check and ${vName} bets ¾ pot. You…`,
      kind: "choice",
      options: planOpts(raiseWord),
      ...p,
      why: [
        `Against the hands that ${raising ? "raise" : "bet big"} you have ${pc(scen.eq)} equity, and calling needs ${pc(n)}.`,
        scen.eq >= 0.65 ? "Well ahead even of that range: raise." : scen.eq >= n ? "Enough to call." : "Their range there is too strong: fold.",
      ],
    });
  } else {
    qs.push({
      id: "odds",
      part: "Decision",
      title: "What are my pot odds?",
      prompt: "In %: call ÷ (pot after you call).",
      kind: "number",
      unit: "%",
      answer: Math.round(need * 100),
      tol: 2,
      why: [`${L.callAmount} ÷ (${pot} + ${L.callAmount}) = ${pc(need)}. You need at least that much equity to call.`],
    });
    const yes = "Yes: call (or raise)";
    const no = "No: fold";
    qs.push({
      id: "call",
      part: "Decision",
      title: "Is my equity higher?",
      prompt: "Compare your equity with the pot odds.",
      kind: "choice",
      options: [yes, no],
      answer: equity >= need ? yes : no,
      accept: Math.abs(equity - need) < 0.03 ? [yes, no] : [equity >= need ? yes : no],
      why: [`${pc(equity)} equity against ${pc(need)} needed${behind < 0.9 ? " (weighted, since you may already be ahead)" : ""}: ${equity >= need ? "calling makes money" : "calling loses money"}.`],
    });
    const strongShare = range.reduce((a, c, i) => a + (cls[i] === "monster" || cls[i] === "strong" ? c.w : 0), 0) / total;
    const deep = effective - L.callAmount >= 3 * (pot + L.callAmount);
    const drawing = draws.flush || draws.straight !== null;
    const implied = !river && drawing && strongShare >= 0.3 && deep;
    qs.push({
      id: "implied",
      part: "Decision",
      title: "Implied odds?",
      prompt: "If you hit, will they realistically pay you more later?",
      kind: "choice",
      options: ["Yes, realistic", "No"],
      answer: implied ? "Yes, realistic" : "No",
      accept: [implied ? "Yes, realistic" : "No"],
      why: [
        river
          ? "No cards to come: there's nothing to hit."
          : !drawing
            ? "You're not drawing, so implied odds don't apply."
            : !deep
              ? "Stacks are too short to win much more after you hit."
              : strongShare < 0.3
                ? `Only ${pc(strongShare)} of their range is strong enough to pay you off.`
                : `${pc(strongShare)} of their range is strong, and there are ${effective - L.callAmount} chips behind: they can pay you.`,
      ],
    });
    if (!river) {
      const scen = weighted((i) => RESPONSE.big[cls[i]]);
      const n = 0.75 / 2.5;
      const p = planAnswer(scen.eq, n, "Raise");
      qs.push({
        id: "plan",
        part: "Decision",
        title: "What's my plan?",
        prompt: `You call, and ${vName} bets ¾ pot again next street. You…`,
        kind: "choice",
        options: planOpts("Raise"),
        ...p,
        why: [`Against the hands that keep betting big you have ${pc(scen.eq)}, and calling needs ${pc(n)}.`],
      });
    }
  }

  return {
    villainName: vName,
    questions: qs,
    summary: {
      street,
      pot,
      equity,
      need,
      called: { small: called.small.eq, big: called.big.eq },
      folds: { small: 1 - called.small.share, big: 1 - called.big.share },
      semi,
    },
  };
}

/* ------------------------------------------------------------ hand review */

export interface Verdict {
  street: Street;
  action: string;
  good: boolean;
  why: string;
}

/** Was this action +EV, judged by the numbers at the time, whatever happened next? */
export function judge(s: Summary, a: Action, toCall: number): Verdict {
  const e = pc(s.equity);
  if (s.need !== null) {
    const n = pc(s.need);
    if (a.type === "fold") {
      const good = s.equity < s.need + 0.03;
      return { street: s.street, action: "Fold", good, why: `${e} equity, ${n} needed: ${good ? "folding was right" : "you had the price to call"}.` };
    }
    if (a.type === "raise") {
      const good = s.equity >= Math.max(s.need, 0.5) - 0.03 || s.semi;
      return { street: s.street, action: "Raise", good, why: good ? `${e} equity: raising for value${s.semi ? " or as a semi-bluff" : ""}.` : `${e} equity: not enough to raise.` };
    }
    const good = s.equity >= s.need - 0.03;
    return { street: s.street, action: `Call ${toCall}`, good, why: `${e} equity, ${n} needed: ${good ? "a profitable call" : "calling loses money over time"}.` };
  }
  if (a.type !== "raise") {
    const good = s.called.big < 0.6;
    return { street: s.street, action: "Check", good, why: good ? "Nothing to gain by betting." : `You'd have ${pc(s.called.big)} even against the hands that call a big bet: checking missed value.` };
  }
  const size = (a.to ?? 0) / s.pot < 0.5 ? "small" : "big";
  const good = s.called[size] >= 0.5 || (s.semi && s.folds[size] >= 0.3);
  return {
    street: s.street,
    action: `Bet ${a.to}`,
    good,
    why: good
      ? s.called[size] >= 0.5
        ? `${pc(s.called[size])} when called: value.`
        : `A semi-bluff: ${pc(s.folds[size])} fold, and you can still hit.`
      : `Only ${pc(s.called[size])} when called and not a semi-bluff: better hands call, worse fold.`,
  };
}

export function reviewQuestion(verdicts: Verdict[], net: number): Question {
  const good = verdicts.filter((v) => v.good).length;
  const answer = good === verdicts.length ? "All +EV" : good / verdicts.length <= 0.34 ? "Mostly −EV" : "Some mistakes";
  return {
    id: "review",
    part: "Decision",
    title: "Was I +EV, whatever the result?",
    prompt: `You ${net > 0 ? `won ${net}` : net < 0 ? `lost ${-net}` : "broke even"} this hand. Judge the decisions, not the result.`,
    kind: "choice",
    options: ["All +EV", "Some mistakes", "Mostly −EV"],
    answer,
    accept: [answer],
    why: [
      ...verdicts.map((v) => `${cap(v.street)} · ${v.action}: ${v.good ? "+EV" : "−EV"}. ${v.why}`),
      net > 0 && good < verdicts.length ? "You won, but luck covered a mistake." : net < 0 && good === verdicts.length ? "You lost, but you played it right: that's variance." : "",
    ].filter(Boolean),
  };
}
