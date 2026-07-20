// Tournament Market Making — price outcomes of a 4-team knockout tournament.
//
// A 4×4 matrix gives P(row team beats column team). A group stage (round-robin
// among all four) ranks the teams; ties are broken by replaying a round-robin
// among the tied teams until every tie is resolved. The top two are the
// finalists and play once to decide the champion.
//
// True probabilities of events (reaches final, is champion, wins ≥1 game, …)
// are estimated by Monte-Carlo simulation, so the market maker never has a
// closed form — they must reason and estimate, exactly like a real desk.

export const TEAMS = ["A", "B", "C", "D"] as const;

export type Matrix = number[][]; // 4×4; matrix[i][j] = P(i beats j); diagonal NaN

export interface SimResult {
  groupWins: number[]; // wins in the initial 4-team round-robin, per team
  ranking: number[]; // final ranking, best → worst
  finalists: [number, number];
  champion: number;
}

export type EventType =
  | "final" | "champ" | "win1" | "win3" | "noundef" | "somewinless" | "champpair" | "bothfinal";

export interface EventDef {
  id: string;
  label: string;
  test: (r: SimResult) => boolean;
  type: EventType;
  teams: number[];
}

export type TradeDecision = "buy" | "sell" | "pass";
export type InfoDecision = "up" | "down" | "same";

export interface Quote {
  bid: number;
  ask: number;
}

export interface Reveal {
  text: string;
  matchKey: string; // "a-b" with a<b
  winner: number;
  loser: number;
}

export interface Round {
  kind: "trade" | "info";
  event: EventDef;
  trueValue: number; // 0..100
  quote?: Quote; // trade rounds
  priorValue?: number; // info rounds: value before the reveal
  reveal?: Reveal; // info rounds
}

export interface GameData {
  matrix: Matrix;
  rounds: Round[];
}

export interface TournamentConfig {
  tradeRounds: number;
  infoRounds: number;
  decisionSeconds: number;
}

export const TOURNAMENT_OPTIONS = {
  tradeRounds: [4, 6, 8],
  infoRounds: [2, 3],
  decisionSeconds: [10, 15, 20],
} as const;

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  tradeRounds: 6,
  infoRounds: 2,
  decisionSeconds: 15,
};

const TRIALS = 15000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const randInt = (n: number) => Math.floor(Math.random() * n);

/* ------------------------------- the matrix ------------------------------ */

/** Random consistent matrix: p(i,j) in 0.20..0.80 (step 0.05), p(j,i) = 1−p. */
export function makeMatrix(): Matrix {
  const m: Matrix = [
    [NaN, NaN, NaN, NaN],
    [NaN, NaN, NaN, NaN],
    [NaN, NaN, NaN, NaN],
    [NaN, NaN, NaN, NaN],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const p = (4 + randInt(13)) / 20; // 0.20 … 0.80
      m[i][j] = p;
      m[j][i] = Math.round((1 - p) * 100) / 100;
    }
  }
  return m;
}

/* ------------------------------- simulation ------------------------------ */

const playMatch = (i: number, j: number, m: Matrix) => (Math.random() < m[i][j] ? i : j);

/** Rank a set of teams by a fresh round-robin among them, recursing on ties. */
function subRank(teams: number[], m: Matrix, depth: number): number[] {
  if (teams.length <= 1) return teams.slice();
  if (depth > 40) return teams.slice(); // vanishingly rare; avoid infinite loops

  const wins: Record<number, number> = {};
  for (const t of teams) wins[t] = 0;
  for (let a = 0; a < teams.length; a++) {
    for (let b = a + 1; b < teams.length; b++) {
      wins[playMatch(teams[a], teams[b], m)]++;
    }
  }
  const uniq = [...new Set(teams.map((t) => wins[t]))].sort((a, b) => b - a);
  const out: number[] = [];
  for (const w of uniq) {
    const g = teams.filter((t) => wins[t] === w);
    if (g.length === 1) out.push(g[0]);
    else out.push(...subRank(g, m, depth + 1));
  }
  return out;
}

/** Full ranking from group-stage wins, breaking ties with sub round-robins. */
function rankFromGroup(groupWins: number[], m: Matrix): number[] {
  const teams = [0, 1, 2, 3];
  const uniq = [...new Set(teams.map((t) => groupWins[t]))].sort((a, b) => b - a);
  const out: number[] = [];
  for (const w of uniq) {
    const g = teams.filter((t) => groupWins[t] === w);
    if (g.length === 1) out.push(g[0]);
    else out.push(...subRank(g, m, 0));
  }
  return out;
}

/** Play the whole tournament once. `forced` fixes specific group-stage results. */
export function simulate(m: Matrix, forced?: Record<string, number>): SimResult {
  const groupWins = [0, 0, 0, 0];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const key = `${a}-${b}`;
      const w = forced && key in forced ? forced[key] : playMatch(a, b, m);
      groupWins[w]++;
    }
  }
  const ranking = rankFromGroup(groupWins, m);
  const finalists: [number, number] = [ranking[0], ranking[1]];
  const champion = playMatch(finalists[0], finalists[1], m);
  return { groupWins, ranking, finalists, champion };
}

/** Monte-Carlo probability (0..1) of an event, optionally conditioned. */
export function probability(
  m: Matrix,
  test: (r: SimResult) => boolean,
  forced?: Record<string, number>,
  trials = TRIALS,
): number {
  let c = 0;
  for (let i = 0; i < trials; i++) if (test(simulate(m, forced))) c++;
  return c / trials;
}

const pct = (p: number) => Math.round(p * 100);

/* --------------------------------- events -------------------------------- */

const evReachFinal = (t: number): EventDef => ({
  id: `final-${t}`,
  label: `${TEAMS[t]} reaches the final`,
  test: (r) => r.finalists.includes(t),
  type: "final",
  teams: [t],
});
const evChampion = (t: number): EventDef => ({
  id: `champ-${t}`,
  label: `${TEAMS[t]} wins the tournament`,
  test: (r) => r.champion === t,
  type: "champ",
  teams: [t],
});
const evWinAtLeastOne = (t: number): EventDef => ({
  id: `win1-${t}`,
  label: `${TEAMS[t]} wins at least one group-stage match`,
  test: (r) => r.groupWins[t] >= 1,
  type: "win1",
  teams: [t],
});
const evWinAll = (t: number): EventDef => ({
  id: `win3-${t}`,
  label: `${TEAMS[t]} wins all three group-stage matches`,
  test: (r) => r.groupWins[t] === 3,
  type: "win3",
  teams: [t],
});
const evNoUndefeated: EventDef = {
  id: "no-undefeated",
  label: "No team wins all its group-stage matches",
  test: (r) => Math.max(...r.groupWins) < 3,
  type: "noundef",
  teams: [],
};
const evSomeWinless: EventDef = {
  id: "some-winless",
  label: "At least one team loses all its group-stage matches",
  test: (r) => Math.min(...r.groupWins) === 0,
  type: "somewinless",
  teams: [],
};
const evChampFromPair = (a: number, b: number): EventDef => ({
  id: `champ-${a}${b}`,
  label: `The champion is ${TEAMS[a]} or ${TEAMS[b]}`,
  test: (r) => r.champion === a || r.champion === b,
  type: "champpair",
  teams: [a, b],
});
const evBothFinalists = (a: number, b: number): EventDef => ({
  id: `both-${a}${b}`,
  label: `${TEAMS[a]} and ${TEAMS[b]} are the two finalists`,
  test: (r) => r.finalists.includes(a) && r.finalists.includes(b),
  type: "bothfinal",
  teams: [a, b],
});

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function eventPool(): EventDef[] {
  const pool: EventDef[] = [evNoUndefeated, evSomeWinless];
  for (let t = 0; t < 4; t++) {
    pool.push(evReachFinal(t), evChampion(t), evWinAtLeastOne(t), evWinAll(t));
  }
  pool.push(evChampFromPair(0, 1), evChampFromPair(2, 3), evBothFinalists(0, 1), evBothFinalists(2, 3));
  return shuffle(pool);
}

const ALL_PAIRS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

/* -------------------------------- rounds --------------------------------- */

function makeQuote(trueValue: number): Quote {
  // Tight two-sided market (spread 2–4) whose midpoint is usually mispriced by
  // a moderate amount — the point is a quick approximate read, not the exact
  // value. ~30% of markets sit roughly fair, the rest are off by 3–13 points.
  const mag = Math.random() < 0.3 ? randInt(3) : 3 + randInt(11); // 0..2 or 3..13
  const dir = Math.random() < 0.5 ? -1 : 1;
  const half = 1 + randInt(2); // spread 2 or 4
  const center = clamp(trueValue + dir * mag, 3 + half, 97 - half);
  const bid = clamp(Math.round(center - half), 1, 98);
  const ask = clamp(Math.round(center + half), bid + 2, 99);
  return { bid, ask };
}

/** Build a full game: one matrix, N trade rounds, then M info-reveal rounds. */
export function buildGame(cfg: TournamentConfig): GameData {
  const matrix = makeMatrix();
  const pool = eventPool();
  const rounds: Round[] = [];

  for (let i = 0; i < cfg.tradeRounds; i++) {
    const event = pool[i % pool.length];
    const trueValue = pct(probability(matrix, event.test));
    rounds.push({ kind: "trade", event, trueValue, quote: makeQuote(trueValue) });
  }

  for (let i = 0; i < cfg.infoRounds; i++) {
    const [a, b] = ALL_PAIRS[randInt(ALL_PAIRS.length)];
    const winner = Math.random() < 0.5 ? a : b;
    const loser = winner === a ? b : a;
    const key = `${a}-${b}`;
    // An event about one of the two teams that just played — its odds shift.
    const focus = Math.random() < 0.5 ? winner : loser;
    const event = Math.random() < 0.5 ? evReachFinal(focus) : evChampion(focus);
    const priorValue = pct(probability(matrix, event.test));
    const trueValue = pct(probability(matrix, event.test, { [key]: winner }));
    rounds.push({
      kind: "info",
      event,
      trueValue,
      priorValue,
      reveal: {
        matchKey: key,
        winner,
        loser,
        text: `Group stage result: ${TEAMS[winner]} beat ${TEAMS[loser]}.`,
      },
    });
  }

  return { matrix, rounds };
}

/* -------------------------------- scoring -------------------------------- */

export const ESTIMATE_TOLERANCE = 8; // ± percentage points for full-ish credit
export const DIRECTION_DEADBAND = 2; // ± points counted as "unchanged"

export interface RoundOutcome {
  kind: "trade" | "info";
  event: EventDef;
  eventLabel: string;
  decision: TradeDecision | InfoDecision;
  decisionCorrect: boolean;
  decisionPts: number;
  estimate: number;
  estimatePts: number;
  trueValue: number;
  priorValue?: number;
  quote?: Quote;
  reveal?: Reveal;
  totalPts: number;
  timedOut: boolean;
}

export function scoreTradeDecision(decision: TradeDecision, q: Quote, trueValue: number) {
  const edgeBuy = trueValue > q.ask;
  const edgeSell = trueValue < q.bid;
  const noEdge = !edgeBuy && !edgeSell;
  let correct: boolean;
  let pts: number;
  if (decision === "buy") {
    correct = edgeBuy;
    pts = edgeBuy ? 10 : -8;
  } else if (decision === "sell") {
    correct = edgeSell;
    pts = edgeSell ? 10 : -8;
  } else {
    correct = noEdge;
    pts = noEdge ? 6 : 0; // fine to pass a thin edge; only rewarded when truly flat
  }
  return { correct, pts };
}

export function actualDirection(prior: number, trueValue: number): InfoDecision {
  const diff = trueValue - prior;
  if (diff > DIRECTION_DEADBAND) return "up";
  if (diff < -DIRECTION_DEADBAND) return "down";
  return "same";
}

export function scoreInfoDecision(decision: InfoDecision, prior: number, trueValue: number) {
  const correct = decision === actualDirection(prior, trueValue);
  return { correct, pts: correct ? 8 : -5 };
}

/** Estimate scoring: up to +10 within tolerance, small penalty when far off. */
export function scoreEstimate(estimate: number, trueValue: number) {
  const err = Math.abs(estimate - trueValue);
  if (err <= ESTIMATE_TOLERANCE) return Math.max(1, Math.round(10 * (1 - err / ESTIMATE_TOLERANCE)));
  return -Math.min(6, Math.round((err - ESTIMATE_TOLERANCE) / 4));
}

/* ------------------------------ explanations ----------------------------- */

const others = (t: number) => [0, 1, 2, 3].filter((k) => k !== t);
const nm = (t: number) => TEAMS[t];

/** Plain-English reasoning for why an event's fair value is what it is. */
export function explainEvent(ev: EventDef, m: Matrix): string[] {
  const p = (i: number, j: number) => m[i][j];
  switch (ev.type) {
    case "win3": {
      const [a] = ev.teams;
      const os = others(a);
      const prod = os.reduce((s, j) => s * p(a, j), 1);
      return [
        `${nm(a)} sweeps the group only if it beats all three opponents.`,
        `Group games are independent, so P = ${os.map((j) => p(a, j).toFixed(2)).join(" × ")} = ${(prod * 100).toFixed(0)}% (vs ${os.map(nm).join(", ")}).`,
      ];
    }
    case "win1": {
      const [a] = ev.teams;
      const os = others(a);
      const lose = os.reduce((s, j) => s * (1 - p(a, j)), 1);
      return [
        `“Wins at least one” = 1 − P(loses all three).`,
        `P(loses all) = ${os.map((j) => (1 - p(a, j)).toFixed(2)).join(" × ")} = ${(lose * 100).toFixed(0)}%, so fair value = ${((1 - lose) * 100).toFixed(0)}%.`,
      ];
    }
    case "final": {
      const [a] = ev.teams;
      const os = others(a);
      return [
        `${nm(a)} reaches the final by finishing in the group-stage top two (after every tie is replayed and broken).`,
        `Driven by its pairwise edges — vs ${os.map((j) => `${nm(j)} ${p(a, j).toFixed(2)}`).join(", ")}: the more expected group wins, the more likely a top-two finish.`,
        `No clean closed form (tie-break replays), so it's estimated by simulating the whole tournament many times.`,
      ];
    }
    case "champ": {
      const [a] = ev.teams;
      const os = others(a);
      return [
        `${nm(a)} is champion = reach the final AND win it.`,
        `First a top-two group finish (edges vs ${os.map((j) => `${nm(j)} ${p(a, j).toFixed(2)}`).join(", ")}), then beat whichever team also gets through.`,
        `Roughly P(reach final) × P(win the final) — computed exactly by simulation.`,
      ];
    }
    case "noundef":
      return [
        `Fails only if some team goes 3-0. Each team's sweep chance is the product of its three win probabilities.`,
        `Fair value = 1 − P(any team sweeps); teams share matches, so it's estimated by simulation.`,
      ];
    case "somewinless":
      return [
        `= 1 − P(no team goes 0-3). A team's winless chance is the product of its three loss probabilities.`,
        `Because the four teams share the same six matches, it's estimated by simulation rather than a single product.`,
      ];
    case "champpair": {
      const [a, b] = ev.teams;
      return [
        `Champion is ${nm(a)} or ${nm(b)}: each must reach the final and win it.`,
        `They can't both be champion, so it's simply P(${nm(a)} champion) + P(${nm(b)} champion).`,
      ];
    }
    case "bothfinal": {
      const [a, b] = ev.teams;
      return [
        `${nm(a)} and ${nm(b)} are the two finalists ⇔ both finish ahead of the other two in the group stage.`,
        `Needs both to do well in the same group at once, so it's usually well below either one's individual "reach the final" chance. Estimated by simulation.`,
      ];
    }
  }
  return [];
}

/** Why the fair value moved once a group result was revealed. */
export function explainReveal(ev: EventDef, reveal: Reveal, prior: number, trueValue: number): string {
  const dir = actualDirection(prior, trueValue);
  const move = dir === "up" ? "rises" : dir === "down" ? "falls" : "barely moves";
  const [focus] = ev.teams;
  const focusNote =
    focus === reveal.winner
      ? `${nm(reveal.winner)} banked a win, so it's closer to a top-two finish`
      : focus === reveal.loser
        ? `${nm(reveal.loser)} took a loss, denting its group standing`
        : `it reshuffles the group table around ${nm(reveal.winner)} and ${nm(reveal.loser)}`;
  return `${nm(reveal.winner)} beating ${nm(reveal.loser)} fixes one of the six group results. ${focusNote}, so the fair value ${move} from ${prior} to ${trueValue}.`;
}
