/** Self-check for the options drill and the auction. Run: npm run drills:check */
import { isRight, makeQuestion, parseAnswer, type Level } from "../src/lib/options-drill";
import { adapt, botBid, breakEven, drawLot, makeBidders, resolve } from "../src/lib/auction";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error("FAIL:", msg);
  }
};

/* ---------------------------------------------------------------- options */
const topics = new Set<string>();
for (const level of [1, 2, 3] as Level[]) {
  let last: string | undefined;
  for (let i = 0; i < 3000; i++) {
    const q = makeQuestion(level, last);
    topics.add(q.topic);
    check(q.topic !== last, "no topic twice in a row");
    check(Number.isFinite(q.answer) && q.tol > 0, `${q.topic}: finite answer and tolerance`);
    check(isRight(q, q.answer) && !isRight(q, q.answer + q.tol + 0.02), `${q.topic}: tolerance window`);
    check(q.facts.every((f) => !/NaN|undefined/.test(f.value)) && !/NaN|undefined/.test(q.why), `${q.topic}: clean text`);
    if (q.topic === "Put-call parity") check(q.answer > 0, "parity: option prices positive");
    last = q.topic;
  }
}
check(parseAnswer("1,200") === 1200 && parseAnswer("−4.5") === -4.5 && parseAnswer("$12") === 12 && parseAnswer(".5") === 0.5, "parse numbers");
check(parseAnswer("") === null && parseAnswer("abc") === null && parseAnswer("1-2") === null, "reject junk");

/* ---------------------------------------------------------------- auction */
// Everyone bidding the same rule: the winner holds the top estimate. Bidding your estimate should lose about
// E(n-1)/(n+1) a win; shading to the break-even should roughly break even; shading by E should make money.
const n = 6;
const E = 40;
const avgProfit = (shade: (est: number) => number) => {
  let total = 0;
  let wins = 0;
  for (let i = 0; i < 40000; i++) {
    const lot = drawLot(n, E);
    if (lot.value < 100 + E || lot.value > 500 - E) continue; // away from the range edges
    const o = resolve(lot, lot.estimates.map(shade));
    total += o.profit[o.winner];
    wins++;
  }
  return total / wins;
};
const curse = avgProfit((x) => x);
const even = avgProfit((x) => breakEven(x, E, n));
const sharp = avgProfit((x) => x - E);
const expected = (E * (n - 1)) / (n + 1);
check(Math.abs(curse + expected) < 1.5, `bid = estimate loses ~${expected.toFixed(1)} (got ${curse.toFixed(1)})`);
check(Math.abs(even) < 1.5, `break-even bid nets ~0 (got ${even.toFixed(1)})`);
check(Math.abs(sharp - (2 * E) / (n + 1)) < 1.5, `bid = estimate − E earns ~2E/(n+1) (got ${sharp.toFixed(1)})`);
{
  const lot = { item: "x", value: 200, noise: 10, estimates: [0, 0, 0] };
  check(resolve(lot, [null, null, null]).winner === -1, "no bids, no winner");
  const o = resolve(lot, [150, null, 180]);
  check(o.winner === 2 && o.profit[2] === 20 && o.profit[0] === 0, "highest bid wins and pays its bid");
}

// A learning room of bots: nobody should take nearly every lot, and the room shouldn't bleed money.
{
  const wins = new Array(n).fill(0);
  let roomPnl = 0;
  let bidders = makeBidders(["You", "A", "B", "C", "D", "E"]);
  bidders[0] = { ...bidders[0], human: false, shade: 0.6 };
  for (let i = 0; i < 400; i++) {
    const lot = drawLot(n, E);
    const o = resolve(lot, bidders.map((b, j) => botBid(b, lot.estimates[j], E)));
    wins[o.winner]++;
    roomPnl += o.profit[o.winner];
    bidders = adapt(bidders, o);
  }
  check(Math.max(...wins) < 400 * 0.6, `wins spread across the room (${wins.join(",")})`);
  check(roomPnl / 400 > -6, `learning room roughly breaks even (${(roomPnl / 400).toFixed(1)} a lot)`);
}

console.log(`${topics.size} option topics; auction with n=${n}, ±${E}: bid estimate ${curse.toFixed(1)}, break-even ${even.toFixed(1)}, estimate−E ${sharp.toFixed(1)}`);
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log("drills OK");
