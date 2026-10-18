/** Self-check for the Figgie engine and bots. Run: npm run figgie:check */
import { ALL_LAYOUTS, PARTNER, POT, STARTING_CASH, SUITS, bid, buy, counts, dealRound, goalOf, handSize, newTable, offer, settle, type Figgie } from "../src/lib/figgie/engine";
import { botTick, goalBeliefs, randomFiggiePersona } from "../src/lib/figgie/bot";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error("FAIL:", msg);
  }
};

/* ------------------------------------------------------------------ deck */
check(ALL_LAYOUTS.length === 12, "12 layouts");
for (const l of ALL_LAYOUTS) {
  const c = counts(l);
  check(SUITS.reduce((a, s) => a + c[s], 0) === 40, "40 cards");
  check(goalOf(l) === PARTNER[l.twelve], "goal is the 12-suit's colour partner");
  check([8, 10].includes(c[goalOf(l)]), "goal suit has 8 or 10 cards");
}

/* ------------------------------------------------------------- order rules */
{
  let g = dealRound(newTable(["You", "A", "B", "C"]), 1);
  check(g.players.every((p) => handSize(p.hand) === 10 && p.cash === STARTING_CASH - 50), "4 players: 10 cards each, $50 ante");
  const s = SUITS.find((x) => g.players[1].hand[x] > 0)!;
  const r1 = bid(g, 0, s, 5);
  check(typeof r1 !== "string", "post a bid");
  g = r1 as Figgie;
  check(typeof bid(g, 2, s, 5) === "string", "an equal bid must not replace the best bid");
  const empty = SUITS.find((x) => g.players[3].hand[x] === 0);
  if (empty) check(typeof offer(g, 3, empty, 9) === "string", "can't offer a suit you don't hold");
  const r2 = offer(g, 1, s, 8);
  g = r2 as Figgie;
  const other = SUITS.find((x) => x !== s)!;
  const r3 = bid(g, 2, other, 3);
  g = r3 as Figgie;
  const before = g.players[0].hand[s];
  g = buy(g, 0, s) as Figgie;
  check(g.players[0].hand[s] === before + 1 && g.trades.length === 1 && g.trades[0].price === 8, "lifting the offer trades at the offer");
  check(SUITS.every((x) => !g.book[x].bid && !g.book[x].ask), "a trade clears every order on the board");
}

/* ------------------------------------------------------- simulated rounds */
let rounds = 0;
let trades = 0;
let goalGuessRight = 0;
let guesses = 0;
for (let t = 0; t < 600; t++) {
  const n = t % 2 ? 4 : 5;
  const names = ["You", "A", "B", "C", "D"].slice(0, n);
  let table = newTable(names);
  const personas = names.map(() => randomFiggiePersona());
  for (let round = 1; round <= 3; round++) {
    let g = dealRound(table, round);
    check(g.players.every((p) => handSize(p.hand) === 40 / n), "equal hands");
    const totalMoney = n * STARTING_CASH;
    const deckCounts = counts(g.layout);
    for (let tick = 0; tick < 300; tick++) {
      const seat = Math.floor(Math.random() * n);
      g = botTick(g, seat, personas[seat], tick / 300);
      const money = g.players.reduce((a, p) => a + p.cash, 0) + g.pot;
      if (money !== totalMoney) check(false, `money not conserved: ${money}`);
      for (const s of SUITS) {
        const held = g.players.reduce((a, p) => a + p.hand[s], 0);
        if (held !== deckCounts[s]) check(false, `${s} cards not conserved`);
      }
      if (g.players.some((p) => p.cash < 0 || SUITS.some((s) => p.hand[s] < 0))) check(false, "negative cash or cards");
    }
    for (let seat = 0; seat < n; seat++) {
      const b = goalBeliefs(g, seat);
      const top = SUITS.reduce((a, s) => (b[s] > b[a] ? s : a));
      guesses++;
      if (top === goalOf(g.layout)) goalGuessRight++;
    }
    trades += g.trades.length;
    g = settle(g);
    rounds++;
    const paid = g.result!.payout.reduce((a, b) => a + b, 0);
    check(paid === POT, `payouts ${paid} must equal the pot`);
    check(g.players.reduce((a, p) => a + p.cash, 0) === n * STARTING_CASH, "money conserved after settlement");
    table = g.players;
  }
  if (failures > 20) break;
}
console.log(`${rounds} rounds, ${(trades / rounds).toFixed(1)} trades per round, bots name the goal suit ${((100 * goalGuessRight) / guesses).toFixed(0)}% of the time (25% by chance)`);
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log("figgie engine OK");
