/** Self-check for the options strategies game. Run: npm run strategies:check */
import { GREEKS, STRATEGIES, factsOf, legsText, makeQuestion, makeQueue, score, QTYPES } from "../src/lib/strategies";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error("FAIL:", msg);
  }
};
const by = (id: string) => STRATEGIES.find((s) => s.id === id)!;
const signs = (id: string) => GREEKS.map((g) => factsOf(by(id)).greeks[g].sign).join(" ");

for (const st of STRATEGIES) {
  const f = factsOf(st);
  const fmt = (x: number | null) => (x === null ? "unlimited" : x.toFixed(2));
  console.log(
    `${st.name.padEnd(22)} ${signs(st.id).padEnd(12)} profit ${fmt(f.maxProfit).padStart(9)} loss ${fmt(f.maxLoss).padStart(9)} BE ${f.breakevens.join("/").padEnd(12)} prem ${f.premium.toFixed(2).padStart(6)}  ${f.signature}`,
  );
}

// Textbook Greek signs (Δ Γ Θ ν), stock at the centre of the structure.
const expect: Record<string, string> = {
  "long-call": "+ + − +",
  "long-put": "− + − +",
  "short-put": "+ − + −",
  "covered-call": "+ − + −",
  "protective-put": "+ + − +",
  "long-straddle": "≈0 + − +",
  "short-straddle": "≈0 − + −",
  "long-strangle": "≈0 + − +",
  "short-strangle": "≈0 − + −",
  "iron-condor": "≈0 − + −",
  "iron-butterfly": "≈0 − + −",
  "long-call-butterfly": "≈0 − + −",
  "calendar": "≈0 − + +",
  "synthetic-long": "+ ≈0 ≈0 ≈0",
  "short-call": "− − + −",
};
for (const [id, want] of Object.entries(expect)) check(signs(id) === want, `${id} Greeks ${signs(id)}, want ${want}`);

const unlimitedProfit = ["long-call", "long-straddle", "long-strangle", "protective-put", "risk-reversal", "synthetic-long"];
const unlimitedLoss = ["short-straddle", "short-strangle", "call-ratio-spread", "short-call"];
for (const st of STRATEGIES) {
  const f = factsOf(st);
  check((f.maxProfit === null) === unlimitedProfit.includes(st.id), `${st.id} unlimited profit flag`);
  check((f.maxLoss === null) === unlimitedLoss.includes(st.id), `${st.id} unlimited loss flag`);
}
// Synthetic twins share a shape.
const sig = (id: string) => factsOf(by(id)).signature;
check(sig("covered-call") === sig("short-put"), "covered call ~ short put");
check(sig("protective-put") === sig("long-call"), "protective put ~ long call");
check(sig("bull-call-spread") === sig("bull-put-spread") && sig("collar") === sig("bull-call-spread"), "bull spreads ~ collar");
check(sig("iron-butterfly") === sig("long-call-butterfly"), "iron fly ~ long butterfly");
check(sig("iron-condor") !== sig("iron-butterfly"), "condor differs from fly");
// Breakevens.
check(factsOf(by("long-call")).breakevens.length === 1 && Math.abs(factsOf(by("long-call")).breakevens[0] - (100 + factsOf(by("long-call")).premium)) < 0.2, "long call breakeven = strike + premium");
check(factsOf(by("iron-condor")).breakevens.length === 2, "iron condor has two breakevens");

// Questions: every answer scores 1, options are unique and include the answer.
const queue = makeQueue(STRATEGIES, 300);
check(new Set(queue.slice(0, STRATEGIES.length).map((q) => q.id)).size === STRATEGIES.length, "every strategy before a repeat");
for (const item of queue) {
  const q = makeQuestion(by(item.id), item.type, STRATEGIES);
  check(score(q, q.answer) === 1, `${item.id}/${item.type}: answer scores 1`);
  if (q.kind === "choice") {
    check(q.options.length === 4 && new Set(q.options).size === 4 && q.options.includes(q.answer), `${item.id}/${item.type}: 4 unique options`);
    if (q.type === "curve") check(q.options.filter((o) => o !== q.answer).every((o) => factsOf(STRATEGIES.find((s) => s.name === o)!).signature !== factsOf(q.strategy).signature), "no twin distractors");
  }
}
check(QTYPES.every((t) => queue.some((q) => q.type === t)), "all question types appear");
check(new Set(STRATEGIES.map(legsText)).size === STRATEGIES.length, "legs text unique");

if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log(`${STRATEGIES.length} strategies · strategies OK`);
