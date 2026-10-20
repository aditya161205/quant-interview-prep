/**
 * Self-check for the poker engine, evaluator and bots. Run: npm run poker:check
 * Fails loudly (non-zero exit) on the first broken rule.
 */
import { evaluate, describe, categoryOf, bestFive } from "../src/lib/poker/evaluate";
import { act, isGameOver, legal, newGame, nextStreet, potTotal, startHand, canAct, type Game } from "../src/lib/poker/engine";
import { decide, emptyModel, randomPersonality } from "../src/lib/poker/bot";
import { classify, coach, drawsOf, grade, judge } from "../src/lib/poker/coach";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error("FAIL:", msg);
  }
};

// Cards by text, e.g. "As Kd 10h": rank then suit (s h d c).
const R = "23456789TJQKA";
const card = (t: string) => {
  const rank = R.indexOf(t.length === 3 ? "T" : t[0]);
  const suit = "shdc".indexOf(t[t.length - 1]);
  return rank * 4 + suit;
};
const hand = (t: string) => t.split(" ").map(card);
const score = (t: string) => evaluate(hand(t));

/* ------------------------------------------------------------- evaluator */
check(describe(score("As Ks Qs Js 10s 2d 3c")) === "Royal flush", "royal flush");
check(score("As Ks Qs Js 10s") > score("Ks Qs Js 10s 9s"), "royal beats K-high straight flush");
check(describe(score("Ah 2d 3c 4s 5h 9d Jc")) === "Straight, Five high", "wheel is five-high");
check(score("2d 3c 4s 5h 6h") > score("Ah 2d 3c 4s 5h"), "six-high straight beats wheel");
check(categoryOf(score("Kh Kd Kc 7s 7h 7d 2c")) === 6, "two trips make a full house");
check(describe(score("Kh Kd Kc 7s 7h 7d 2c")) === "Full house, Kings full of Sevens", "full house names");
check(score("Ah Ad 9c 9s 4h") > score("Ah Ad 9c 9s 3h"), "two pair kicker");
check(score("2h 4h 6h 8h Th") > score("9c Td Jh Qs Kd"), "flush beats straight");
check(score("Qh Qd Qc Qs 2h 3d 9c") > score("Jh Jd Jc Js As Ad Ac"), "higher quads win");
check(score("Ah Kd 9c 7s 4h 3d 2c") === score("Ac Kh 9d 7c 4s 3h 2d"), "equal high cards tie");
check(categoryOf(score("Ah Kh Qh Jh 9h 10c")) === 5, "six cards: flush over straight");

// 7-card scoring must equal the best of the 21 five-card hands, for random deals.
for (let t = 0; t < 20000; t++) {
  const deck = Array.from({ length: 52 }, (_, i) => i).sort(() => Math.random() - 0.5);
  const seven = deck.slice(0, 7);
  let best = -1;
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++) best = Math.max(best, evaluate(seven.filter((_, i) => i !== a && i !== b)));
  if (evaluate(seven) !== best) {
    check(false, `7-card score differs from best 5 for ${seven}`);
    break;
  }
  if (evaluate(bestFive(seven)) !== best) {
    check(false, `bestFive wrong for ${seven}`);
    break;
  }
}

/* ---------------------------------------------------------------- engine */
const NAMES = ["You", "A", "B", "C", "D", "E", "F", "G"];

function randomAction(g: Game) {
  const L = legal(g);
  const r = Math.random();
  if (r < 0.15 && !L.canCheck) return { type: "fold" as const };
  if (r < 0.55) return { type: L.canCheck ? ("check" as const) : ("call" as const) };
  if (L.canRaise) {
    const to = L.minTo + Math.floor(Math.random() * (L.maxTo - L.minTo + 1));
    return { type: "raise" as const, to: Math.random() < 0.15 ? L.maxTo : to };
  }
  return { type: "call" as const };
}

let hands = 0;
let showdowns = 0;
let sidePots = 0;
for (let gameNo = 0; gameNo < 400; gameNo++) {
  const n = 2 + Math.floor(Math.random() * 7);
  const stack = [50, 200, 1000][gameNo % 3];
  let g = newGame({ startingStack: stack, smallBlind: 5, bigBlind: 10, blindsEvery: gameNo % 2 ? 6 : 0 }, NAMES.slice(0, n));
  const total = n * stack;
  const useBots = gameNo % 4 === 0;
  const personas = NAMES.map(() => randomPersonality());
  for (let h = 0; h < 120; h++) {
    g = startHand(g);
    if (g.phase === "game-over") break;
    hands++;
    let steps = 0;
    while (g.phase === "betting" || g.phase === "street-end") {
      if (++steps > 500) {
        check(false, `hand ${g.handNo} did not finish`);
        break;
      }
      const inPlay = g.players.reduce((a, p) => a + p.stack, 0) + potTotal(g);
      check(inPlay === total, `chips not conserved mid-hand: ${inPlay} vs ${total}`);
      check(g.players.every((p) => p.stack >= 0 && p.bet >= 0), "negative stack or bet");
      if (g.phase === "street-end") {
        g = nextStreet(g);
        continue;
      }
      check(g.toAct >= 0 && canAct(g.players[g.toAct]), `toAct ${g.toAct} cannot act`);
      const L = legal(g);
      check(L.minTo <= L.maxTo, "minTo above maxTo");
      const a = useBots && !g.players[g.toAct].human ? decide(g, g.toAct, personas[g.toAct], emptyModel()) : randomAction(g);
      g = act(g, a);
    }
    check(g.phase === "hand-over", `hand ended in phase ${g.phase}`);
    const after = g.players.reduce((a, p) => a + p.stack, 0);
    check(after === total, `chips not conserved after hand: ${after} vs ${total}`);
    if (g.result?.showdown) showdowns++;
    if ((g.result?.pots.length ?? 0) > 1) sidePots++;
    const net = Object.values(g.result!.net).reduce((a, b) => a + b, 0);
    check(net === 0, `net results don't sum to zero: ${net}`);
    if (isGameOver(g)) break;
  }
  if (failures > 20) break;
}

/* ------------------------------------------------------- exact scenarios */
const cfg = { startingStack: 0, smallBlind: 5, bigBlind: 10, blindsEvery: 0 };

// Side pot: A (50 chips) has the best hand, B (200) second, C (200) worst. All in preflop.
{
  let g = newGame({ ...cfg, startingStack: 200 }, ["A", "B", "C"], () => 0);
  g.players[0].stack = 50;
  g = startHand(g, Math.random);
  g.players[0].hole = hand("As Ad");
  g.players[1].hole = hand("Ks Kd");
  g.players[2].hole = hand("Qs Jd");
  // Board pops from the end of the deck (burn, then cards): 2c 7h 9d / 3s / 4h — no straights or flushes.
  g.deck = hand("5c 4h 6c 3s 8c 9d 7h 2c 10c");
  let guard = 0;
  while ((g.phase === "betting" || g.phase === "street-end") && guard++ < 50) {
    g = g.phase === "street-end" ? nextStreet(g) : act(g, legal(g).canRaise ? { type: "raise", to: legal(g).maxTo } : { type: "call" });
  }
  const [A, B, C] = g.players.map((p) => p.stack);
  check(A === 150, `side pot: A should win the 150 main pot, has ${A}`);
  check(B === 300, `side pot: B should win the 300 side pot, has ${B}`);
  check(C === 0, `side pot: C should lose everything, has ${C}`);
}

// Incomplete all-in raise: it must not reopen raising for players who already acted.
{
  let g = newGame({ ...cfg, startingStack: 1000 }, ["A", "B", "C"], () => 0);
  g = startHand(g, Math.random);
  // With 3 players the first to act preflop is the button.
  g.players[g.sbSeat].stack = 1000 - 5;
  const first = g.toAct;
  g = act(g, { type: "raise", to: 100 }); // full raise of 90
  const second = g.toAct;
  g.players[second].stack = 130 - g.players[second].bet; // can only go all-in to 130: a 30 raise, short of 90
  g = act(g, { type: "raise", to: 130 });
  const third = g.toAct;
  g = act(g, { type: "call" });
  check(g.toAct === first, "short all-in: action returns to the original raiser");
  check(!legal(g).canRaise, "short all-in: the original raiser may not re-raise");
  check(third !== first && third !== second, "short all-in: third player acted");
}

// Heads-up: the button posts the small blind and acts first preflop, the big blind first after the flop.
{
  let g = newGame({ ...cfg, startingStack: 1000 }, ["A", "B"], () => 0);
  g = startHand(g, Math.random);
  check(g.sbSeat === g.dealer, "heads-up: button is the small blind");
  check(g.toAct === g.dealer, "heads-up: button acts first preflop");
  g = act(g, { type: "call" });
  g = act(g, { type: "check" });
  g = nextStreet(g);
  check(g.toAct === g.bbSeat, "heads-up: big blind acts first after the flop");
}

/* ------------------------------------------------------------ bot sanity */
{
  // Aces are never folded preflop, and decisions stay fast enough for a smooth table.
  let aceFolds = 0;
  let decisions = 0;
  let slowest = 0;
  const t0 = Date.now();
  const stats = new Map<string, { hands: number; vpip: number; pfr: number }>();
  for (let gameNo = 0; gameNo < 60; gameNo++) {
    const n = 6;
    let g = newGame({ startingStack: 1000, smallBlind: 5, bigBlind: 10, blindsEvery: 0 }, NAMES.slice(0, n));
    const personas = NAMES.map(() => randomPersonality());
    for (let h = 0; h < 40; h++) {
      g = startHand(g);
      if (g.phase === "game-over") break;
      const seen = new Set<number>();
      let guard = 0;
      while ((g.phase === "betting" || g.phase === "street-end") && guard++ < 400) {
        if (g.phase === "street-end") {
          g = nextStreet(g);
          continue;
        }
        const seat = g.toAct;
        const t = Date.now();
        const a = decide(g, seat, personas[seat], emptyModel());
        slowest = Math.max(slowest, Date.now() - t);
        decisions++;
        const hole = g.players[seat].hole;
        const aces = hole.every((c) => c >> 2 === 12);
        if (g.street === "preflop" && aces && a.type === "fold") aceFolds++;
        g = act(g, a);
      }
      for (const p of g.players) {
        if (p.out || seen.has(p.id)) continue;
        seen.add(p.id);
        const st = stats.get(personas[p.id].style) ?? { hands: 0, vpip: 0, pfr: 0 };
        st.hands++;
        if (p.voluntary) st.vpip++;
        if (g.preflopAggressor === p.id || p.handRaises > 0) st.pfr++;
        stats.set(personas[p.id].style, st);
      }
    }
  }
  check(aceFolds === 0, `bots folded aces preflop ${aceFolds} times`);
  console.log(`bots: ${decisions} decisions, avg ${((Date.now() - t0) / decisions).toFixed(1)}ms, slowest ${slowest}ms`);
  for (const [style, st] of stats)
    console.log(`  ${style.padEnd(17)} plays ${((100 * st.vpip) / st.hands).toFixed(0).padStart(3)}% of hands, raises in ${((100 * st.pfr) / st.hands).toFixed(0).padStart(3)}%`);
}

/* ------------------------------------------------------------------ coach */
{
  const cs = (t: string) => t.split(" ").map(card);
  check(classify(cs("As Kd"), cs("5c Jd 5s Ah")) === "strong", "AK on 5J5A is top pair (strong)");
  check(classify(cs("Js 5h"), cs("5c Jd 5s")) === "monster", "J5 on 5J5 is a full house");
  check(classify(cs("Ad Kd"), cs("2c 2s 7h")) === "nothing", "AK on a paired board with no help is nothing");
  check(classify(cs("9h 8h"), cs("7c 6d 2h")) === "draw", "98 on 762 is an open-ended draw");
  check(classify(cs("Qh Qd"), cs("Jc 7d 2h")) === "strong", "QQ on J72 is an overpair");
  const fd = drawsOf(cs("Ah 4h"), cs("Kh 9h 2c"));
  check(fd.flush && fd.straight === null, "A4 of hearts on Kh9h2c: flush draw only");
  check(drawsOf(cs("9c 8d"), cs("Jh 7s 2c")).straight === "gutshot", "98 on J72 is a gutshot (10)");

  // Coach on random postflop spots: every question's own answer must grade as fully right, and judging works.
  let spots = 0;
  let questions = 0;
  const t0 = Date.now();
  for (let k = 0; k < 400 && spots < 40; k++) {
    const personas = [0, 1, 2, 3].map(() => randomPersonality());
    let g = startHand(newGame({ startingStack: 1000, smallBlind: 5, bigBlind: 10, blindsEvery: 0 }, ["You", "A", "B", "C"]));
    for (let steps = 0; steps < 60 && g.phase !== "hand-over"; steps++) {
      if (g.phase === "street-end") {
        g = nextStreet(g);
        continue;
      }
      if (g.toAct === 0 && g.street !== "preflop") {
        const c = coach(g, true);
        spots++;
        for (const q of c.questions) {
          questions++;
          check(grade(q, q.answer) === 1, `coach ${q.id}: its own answer grades ${grade(q, q.answer)}`);
          check(q.why.every((w) => !/NaN|undefined/.test(w)), `coach ${q.id}: clean explanation`);
        }
        check(c.summary.equity >= 0 && c.summary.equity <= 1, "coach equity in [0, 1]");
        const L = legal(g, 0);
        judge(c.summary, { type: L.canCheck ? "check" : "call" }, L.callAmount);
      }
      g = act(g, g.toAct === 0 ? { type: legal(g, 0).canCheck ? "check" : "call" } : decide(g, g.toAct, personas[g.toAct], emptyModel()));
    }
  }
  check(spots >= 20, `coach saw enough spots (${spots})`);
  console.log(`coach: ${spots} spots, ${questions} questions, avg ${((Date.now() - t0) / Math.max(1, spots)).toFixed(0)}ms a spot`);
}

console.log(`${hands} hands played, ${showdowns} showdowns, ${sidePots} with side pots or returns`);
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log("poker engine OK");
