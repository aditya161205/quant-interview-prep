import { money, normCdf, num, pct, round, signedMoney, type Answer, type Level, type Outcome, type Person, type Rng, type Task } from "./core";

/** A volatility research team: option data, realised vol, short-vol backtests, vol trades, and the PM who funds them. */

const IVY: Person = { name: "Ivy", role: "Portfolio manager" };
const THEO: Person = { name: "Theo", role: "Senior researcher" };
const CLARA: Person = { name: "Clara", role: "Data engineer" };
const MARCO: Person = { name: "Marco", role: "Head of risk" };

/** Credibility with the team: earned by being right, lost by being confidently wrong. */
const cred = (right: string, wrong: string) => (_: Answer, s: number): Outcome =>
  s === 1 ? { delta: 10, text: right } : s > 0 ? { delta: 4, text: `Partly there. ${right}` } : { delta: -6, text: wrong };

const shuffle = <T,>(r: Rng, xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function bsCall(S: number, K: number, vol: number, days: number) {
  const T = days / 365;
  const sd = vol * Math.sqrt(T);
  const d1 = (Math.log(S / K) + 0.5 * vol * vol * T) / sd;
  return S * normCdf(d1) - K * normCdf(d1 - sd);
}

/* 08:00 — the option data */
const PIPELINE: { text: string; problem: boolean; why: string }[] = [
  { text: "The backtest fills every option trade at the mid price.", problem: true, why: "Option spreads are wide: you buy at the ask and sell at the bid. Mid fills overstate returns." },
  { text: "Option closes (16:15) are matched with stock closes (16:00).", problem: true, why: "Asynchronous closes: the stock moved in those 15 minutes, which creates fake mispricings." },
  { text: "Implied vols are computed without the stocks' dividends.", problem: true, why: "The wrong forward biases every implied vol and breaks put-call parity." },
  { text: "American puts are priced with a European model.", problem: true, why: "It ignores the early-exercise premium, so deep in-the-money put vols come out wrong." },
  { text: "Quotes with a zero bid are kept and valued at mid.", problem: true, why: "Nobody will buy them: a zero bid means the mid is fiction." },
  { text: "Trades fill at the bid when selling and at the ask when buying.", problem: false, why: "Correct: that's the price you'd actually get." },
  { text: "Option and stock prices are snapshotted at the same moment.", problem: false, why: "Correct: synchronous prices avoid fake arbitrage." },
  { text: "Implied vols use the market's forward, dividends included.", problem: false, why: "Correct: the right forward gives consistent vols." },
  { text: "Quotes wider than half their mid price are dropped.", problem: false, why: "Correct: very wide quotes aren't real prices." },
];

const LOOKAHEAD = [
  {
    setup: "To pick trades, the backtest compares today's implied vol with realised vol over the next 21 days.",
    right: "Use trailing realised vol (up to today) for the signal; forward realised vol only to measure P&L",
  },
  {
    setup: "Trades happen at 10:00, but missing strikes are filled from that day's 16:00 vol surface.",
    right: "Build the surface only from data available at 10:00, when the trade happens",
  },
  {
    setup: "Earnings dates come from today's calendar, including dates that were only announced later.",
    right: "Use earnings dates as they were known at the time: a point-in-time calendar",
  },
];
const LOOKAHEAD_WRONG = ["Use a wider range of strikes", "Smooth the surface with a spline", "Charge higher transaction costs", "Use longer-dated options"];

function data(r: Rng, L: Level): Task {
  if (L === "easy") {
    const S = r.range(80, 200, 1);
    const vol = r.range(20, 40, 1) / 100;
    const base = Math.round(S / 5) * 5 - 10;
    const strikes = Array.from({ length: 6 }, (_, i) => base + 5 * (i - 1));
    const mids = strikes.map((K) => bsCall(S, K, vol, 30));
    const bad = r.range(1, 5, 1);
    const crossed = r.next() < 0.5;
    if (!crossed) mids[bad] = mids[bad - 1] + r.range(0.2, 0.6, 0.05);
    const rows = strikes.map((K, i) => {
      const half = Math.max(0.03, mids[i] * 0.02);
      const [b, a] = crossed && i === bad ? [mids[i] + half, mids[i] - half] : [mids[i] - half, mids[i] + half];
      return [`${K} call`, num(Math.max(0.01, b)), num(Math.max(0.01, a))];
    });
    const right = rows[bad][0];
    return {
      time: "08:00",
      where: "Data check",
      from: CLARA,
      title: "A bad option print",
      message: "Your vol surface has a spike in it this morning. One of these quotes is bad. Which one do I drop?",
      blocks: [{ kind: "table", head: ["Option", "Bid", "Ask"], rows }, { kind: "kv", items: [["HALC", money(S)], ["Expiry", "30 days"]] }],
      q: { kind: "choice", prompt: "Which quote is bad?", options: rows.map((x) => x[0]), answer: right },
      why: crossed
        ? [`The ${right} bid is above its ask: a crossed quote can't be traded. It's stale or a bad print.`]
        : [`The ${right} is priced above the ${rows[bad - 1][0]}. A higher-strike call pays less in every scenario, so it can never be worth more.`, "Bad prints like this become spikes in implied vol."],
      outcome: cred("Clara drops it; the spike in your surface disappears.", "You keep the bad print; your surface fits a spike that isn't there."),
    };
  }
  if (L === "medium") {
    const problems = shuffle(r, PIPELINE.filter((x) => x.problem)).slice(0, r.pick([2, 3]));
    const fine = shuffle(r, PIPELINE.filter((x) => !x.problem)).slice(0, 5 - problems.length);
    const shown = shuffle(r, [...problems, ...fine]);
    return {
      time: "08:00",
      where: "Data check",
      from: CLARA,
      title: "Review the options backtest",
      message: "Before your short-vol backtest goes to Ivy, check how I built it. Which of these are problems?",
      blocks: [{ kind: "table", head: ["#", "How the backtest is built"], rows: shown.map((x, i) => [String(i + 1), x.text]) }],
      q: { kind: "multi", prompt: "Pick every problem", options: shown.map((x) => x.text), answer: problems.map((x) => x.text) },
      why: shown.map((x) => `${x.problem ? "Problem" : "Fine"}: ${x.why}`),
      outcome: cred("You catch them before they reach the PM.", "A flaw slips through; Ivy finds it in the review."),
    };
  }
  const s = r.pick(LOOKAHEAD);
  return {
    time: "08:00",
    where: "Data check",
    from: CLARA,
    title: "Is this backtest honest?",
    message: "This vol strategy's Sharpe looks too good. Here's how it's built. What's the fix?",
    blocks: [{ kind: "text", text: s.setup }],
    q: { kind: "choice", prompt: "The fix", options: shuffle(r, [s.right, ...shuffle(r, LOOKAHEAD_WRONG).slice(0, 3)]), answer: s.right },
    why: ["The backtest uses information it wouldn't have had at the time: look-ahead bias.", `${s.right}.`],
    outcome: cred("With the fix the Sharpe drops to something believable.", "The look-ahead survives into the PM review. Awkward."),
  };
}

/* 09:30 — measure realised vol */
function realised(r: Rng, L: Level): Task {
  if (L === "easy") {
    const sd = r.range(0.8, 3, 0.05);
    const ann = round(sd * Math.sqrt(252), 1);
    return {
      time: "09:30",
      where: "Research",
      from: THEO,
      title: "Annualise the vol",
      message: "HALC's daily returns over the last month have a standard deviation you can see below. What's that as annualised vol, to compare with implied?",
      blocks: [{ kind: "kv", items: [["Std of daily returns", `${num(sd, 2)}%`], ["Trading days a year", "252"]] }],
      q: { kind: "number", prompt: "Annualised realised vol", unit: "%", answer: ann, tol: 0.3 },
      why: [`Vol scales with the square root of time: ${num(sd, 2)}% × √252 = ${num(sd, 2)} × 15.87 = ${num(ann, 1)}%.`],
      outcome: cred("Theo uses your number in the morning note.", "Theo spots you scaled by 252, not √252."),
    };
  }
  if (L === "medium") {
    const rets = Array.from({ length: 6 }, () => r.range(-3, 3, 0.1) || 0.4);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    const ann = round(Math.sqrt(variance) * Math.sqrt(252), 1);
    return {
      time: "09:30",
      where: "Research",
      from: THEO,
      title: "Realised vol from scratch",
      message: "The vendor feed is down. Here are HALC's last six daily returns. What's the annualised realised vol?",
      blocks: [{ kind: "table", head: ["Day", "1", "2", "3", "4", "5", "6"], rows: [["Return", ...rets.map((x) => `${num(x, 1)}%`)]] }],
      q: { kind: "number", prompt: "Annualised realised vol", unit: "%", answer: ann, tol: 0.6 },
      why: [
        `Mean = ${num(mean, 3)}%. Sample variance = Σ(r − mean)² ÷ 5 = ${num(variance, 3)}.`,
        `Daily vol = √${num(variance, 3)} = ${num(Math.sqrt(variance), 3)}%; annualised × √252 = ${num(ann, 1)}%.`,
      ],
      outcome: cred("Theo checks it against the feed when it's back: spot on.", "Theo's number from the feed is different; you divided by the wrong count or forgot √252."),
    };
  }
  const prev = r.range(15, 40, 0.5);
  const ret = r.sign() * r.range(0.5, 4, 0.1);
  const lam = 0.94;
  const dailyVar = (prev / 100) ** 2 / 252;
  const next = round(Math.sqrt((lam * dailyVar + (1 - lam) * (ret / 100) ** 2) * 252) * 100, 2);
  return {
    time: "09:30",
    where: "Research",
    from: THEO,
    title: "Update the EWMA vol",
    message: "Our vol forecast is an EWMA with λ = 0.94. Update it for today's return.",
    blocks: [{ kind: "kv", items: [["Yesterday's forecast", `${num(prev, 1)}% annualised`], ["Today's return", `${num(ret, 1)}%`], ["λ", "0.94"], ["Days a year", "252"]] }],
    q: { kind: "number", prompt: "Today's forecast", unit: "%", answer: next, tol: 0.3 },
    why: [
      `Daily variance yesterday = (${num(prev / 100, 3)})² ÷ 252 = ${num(dailyVar, 6)}.`,
      `σ²_today = 0.94 × ${num(dailyVar, 6)} + 0.06 × (${num(ret / 100, 3)})² = ${num(lam * dailyVar + (1 - lam) * (ret / 100) ** 2, 6)}.`,
      `Annualised: √(that × 252) = ${num(next, 2)}%.`,
    ],
    outcome: cred("Your forecast goes into today's vol signals.", "The forecast feeding today's signals is wrong; Theo catches it before the trades go out."),
  };
}

/* 11:00 — short-vol backtest */
function backtest(r: Rng, L: Level): Task {
  if (L === "easy") {
    const K = r.range(80, 200, 5);
    const prem = r.range(4, 12, 0.1);
    const n = r.range(10, 50, 10);
    const end = round(K + r.sign() * r.range(0, prem * 1.6, 0.5), 2);
    const pnl = Math.round(n * 100 * (prem - Math.abs(end - K)));
    return {
      time: "11:00",
      where: "Backtest review",
      from: IVY,
      title: "One month of a short straddle",
      message: "Walk me through one month of the short-straddle backtest. What did it make or lose at expiry?",
      blocks: [{ kind: "kv", items: [["Sold", `${n} straddles, ${K} strike`], ["Premium received", `${money(prem, 2)} per straddle`], ["HALC at expiry", money(end, 2)], ["Contract size", "100 shares"]] }],
      q: { kind: "number", prompt: "P&L at expiry", prefix: "$", answer: pnl, tol: Math.max(50, Math.abs(pnl) * 0.01) },
      why: [
        `At expiry the straddle is worth |S − K| = |${num(end)} − ${K}| = ${num(Math.abs(end - K))}.`,
        `P&L = ${n} × 100 × (${num(prem)} − ${num(Math.abs(end - K))}) = ${signedMoney(pnl)}.`,
        "You keep the premium if the stock stays close; you lose once it moves more than the premium either way.",
      ],
      outcome: cred("Ivy follows the walk-through and trusts the rest of the backtest.", "Ivy loses confidence when the first month doesn't add up."),
    };
  }
  if (L === "medium") {
    const months = Array.from({ length: 12 }, () => round(r.range(0.6, 1.8, 0.1), 1));
    const crash = r.range(0, 11, 1);
    months[crash] = -r.range(9, 18, 1);
    const right = "Crash risk: small steady gains, then rare large losses";
    return {
      time: "11:00",
      where: "Backtest review",
      from: IVY,
      title: "What is the Sharpe hiding?",
      message: "The short-put strategy shows a lovely Sharpe. Before I fund it: what's the risk the Sharpe hides?",
      blocks: [{ kind: "table", head: ["Month", ...months.map((_, i) => String(i + 1))], rows: [["Return", ...months.map((x) => `${x > 0 ? "+" : ""}${num(x, 1)}%`)]] }],
      q: { kind: "choice", prompt: "The main risk", options: shuffle(r, [right, "Trading costs are too high", "There isn't enough capacity", "It has look-ahead bias"]), answer: right },
      why: [
        `Eleven small gains and one ${num(months[crash], 0)}% month: selling puts is selling insurance.`,
        "Sharpe assumes symmetric returns. For short vol, look at the worst month, skew and a crash stress test, and size for the tail.",
      ],
      outcome: cred("Ivy sizes it for the crash, not the Sharpe.", "Ivy sizes it on the Sharpe. The next crash month hurts."),
    };
  }
  const is = r.range(2, 3, 0.1);
  const params = r.range(10, 25, 1);
  const oos = r.range(0.1, 0.6, 0.1);
  const right = "Overfit: too many parameters fitted to noise. Simplify and re-test on fresh data";
  return {
    time: "11:00",
    where: "Backtest review",
    from: IVY,
    title: "In-sample vs out-of-sample",
    message: "The delta-hedged strangle model looked fantastic in research. Two years out-of-sample, it doesn't. What do you tell me?",
    blocks: [
      { kind: "table", head: ["", "Sharpe", "Period"], rows: [["In-sample", num(is, 1), "2012–2020"], ["Out-of-sample", num(oos, 1), "2021–2022"]] },
      { kind: "kv", items: [["Parameters tuned", `${params} (strikes, tenors, hedge bands, filters)`]] },
    ],
    q: {
      kind: "choice",
      prompt: "Your read",
      options: shuffle(r, [right, "Regime change: scale it up, it will come back", "Two years is too short to judge: ship it", "Costs are too high: just trade less often"]),
      answer: right,
    },
    why: [`A Sharpe of ${num(is, 1)} in-sample falling to ${num(oos, 1)} out-of-sample, with ${params} tuned parameters, is the classic overfitting signature.`, "Cut the parameters, then test on data the model has never seen."],
    outcome: cred("Ivy shelves it until the simpler version is tested.", "Ivy allocates to it; it bleeds for a quarter."),
  };
}

/* 13:00 — the vol trade */
function volTrade(r: Rng, L: Level): Task {
  if (L === "easy") {
    const implied = r.range(18, 45, 1);
    const forecast = implied + r.sign() * r.range(3, 8, 1);
    const sell = "Sell vol: implied is above where you expect it to realise";
    const buy = "Buy vol: implied is below where you expect it to realise";
    return {
      time: "13:00",
      where: "Research",
      from: THEO,
      title: "Buy or sell vol?",
      message: "Here's 1-month implied vol and your realised-vol forecast. Which side of vol do we want?",
      blocks: [{ kind: "kv", items: [["1-month implied vol", `${implied}%`], ["Your realised-vol forecast", `${forecast}%`]] }],
      q: { kind: "choice", prompt: "Your trade", options: [sell, buy], answer: implied > forecast ? sell : buy },
      why: [
        `You earn the gap between implied and realised: ${implied}% implied vs ${forecast}% expected.`,
        implied > forecast ? "Sell options and delta-hedge: you collect more than the moves cost you." : "Buy options and delta-hedge: the moves should pay you more than the premium.",
      ],
      outcome: cred("Realised vol came in near your forecast: the trade worked.", "Realised came in near your forecast, against your trade."),
    };
  }
  if (L === "medium") {
    const n = r.range(100, 1000, 100);
    const vega = r.range(0.08, 0.3, 0.01);
    const implied = r.range(20, 40, 1);
    const realised = implied - r.sign() * r.range(2, 8, 1);
    const pnl = Math.round(n * 100 * vega * (implied - realised));
    return {
      time: "13:00",
      where: "Research",
      from: THEO,
      title: "Vega P&L of a short-vol trade",
      message: "We sold options at one vol and delta-hedged. Realised came in somewhere else. Roughly what did we make?",
      blocks: [{ kind: "kv", items: [["Position", `short ${n} options, delta-hedged`], ["Vega per option", `${num(vega, 2)} per share per vol pt`], ["Sold at", `${implied}% implied`], ["Realised vol", `${realised}%`]] }],
      q: { kind: "number", prompt: "Approximate P&L", prefix: "$", answer: pnl, tol: Math.max(50, Math.abs(pnl) * 0.02) },
      why: [
        `A delta-hedged short option earns roughly vega × (implied − realised).`,
        `${n} × 100 × ${num(vega, 2)} × (${implied} − ${realised}) = ${signedMoney(pnl)}.`,
        "It's an approximation: the path of the stock matters too.",
      ],
      outcome: cred("Theo's attribution matches yours.", "Theo's attribution has a different sign: think about which side you're on."),
    };
  }
  const notional = r.range(50, 200, 25) * 1000;
  const strike = r.range(15, 30, 1);
  const real = strike + r.sign() * r.range(2, 10, 1);
  const nVar = notional / (2 * strike);
  const pnl = Math.round(nVar * (real * real - strike * strike));
  return {
    time: "13:00",
    where: "Research",
    from: THEO,
    title: "Variance swap P&L",
    message: "We bought a variance swap. It just expired. What did it pay?",
    blocks: [{ kind: "kv", items: [["Vega notional", money(notional)], ["Strike", `${strike} vol`], ["Realised vol", `${real}`], ["Position", "long variance"]] }],
    q: { kind: "number", prompt: "P&L", prefix: "$", answer: pnl, tol: Math.max(100, Math.abs(pnl) * 0.01) },
    why: [
      `Variance notional = vega notional ÷ (2 × strike) = ${money(notional)} ÷ ${2 * strike} = ${money(nVar, 2)} per variance point.`,
      `P&L = ${money(nVar, 2)} × (${real}² − ${strike}²) = ${money(nVar, 2)} × ${real * real - strike * strike} = ${signedMoney(pnl)}.`,
      "Paying on variance, not vol, makes it convex: big realised moves pay more than linearly.",
    ],
    outcome: cred("Your P&L ties out with the confirm from the bank.", "Your number doesn't match the bank's confirm."),
  };
}

/* 14:30 — the PM decides */
const STRATS = ["Short index puts", "Dispersion", "Calendar carry", "Skew trades", "Short strangles", "Tail-hedged short vol"];

function choose(r: Rng, L: Level): Task {
  const names = shuffle(r, STRATS).slice(0, 3);
  const letters = ["A", "B", "C"];
  const book = 1.2;
  let rows: { sr: number; worst: number; cap: number; rho: number }[];
  let pick: number;
  let why: string[];
  if (L === "easy") {
    const best = r.range(1.4, 1.9, 0.1);
    rows = shuffle(r, [best, best - r.range(0.4, 0.6, 0.1), best - r.range(0.7, 0.9, 0.1)].map((sr) => ({ sr: round(sr, 1), worst: -r.range(4, 8, 1), cap: r.range(150, 500, 50), rho: r.range(0.1, 0.4, 0.1) })));
    pick = rows.reduce((b, x, i) => (x.sr > rows[b].sr ? i : b), 0);
    why = [`${letters[pick]} has the best Sharpe with a similar worst month and plenty of capacity: the clear choice.`];
  } else if (L === "medium") {
    const top = r.range(1.7, 2.2, 0.1);
    rows = shuffle(r, [
      { sr: round(top, 1), worst: -r.range(15, 25, 1), cap: r.range(300, 600, 50), rho: r.range(0.1, 0.4, 0.1) },
      { sr: round(top - r.range(0.3, 0.5, 0.1), 1), worst: -r.range(5, 9, 1), cap: r.range(300, 600, 50), rho: r.range(0.1, 0.4, 0.1) },
      { sr: round(top - r.range(0.7, 0.9, 0.1), 1), worst: -r.range(5, 9, 1), cap: r.range(300, 600, 50), rho: r.range(0.1, 0.4, 0.1) },
    ]);
    const ok = (x: (typeof rows)[number]) => x.worst >= -10;
    pick = rows.reduce((b, x, i) => (ok(x) && (!ok(rows[b]) || x.sr > rows[b].sr) ? i : b), rows.findIndex(ok));
    const tail = rows.findIndex((x) => !ok(x));
    why = [`${letters[tail]} has the best Sharpe, but a ${rows[tail].worst}% worst month breaks the −10% tail limit: that's short-vol crash risk.`, `Of the ones inside the limit, ${letters[pick]} has the best Sharpe.`];
  } else {
    const make = () => ({ sr: r.range(1, 1.8, 0.1), worst: -r.range(5, 9, 1), cap: r.range(300, 600, 50), rho: r.range(0, 0.8, 0.1) });
    let tries = 0;
    do {
      rows = [make(), make(), make()];
      const m = rows.map((x) => x.sr - x.rho * book).sort((a, b) => b - a);
      if (m[0] - m[1] >= 0.15) break;
    } while (++tries < 50);
    pick = rows.reduce((b, x, i) => (x.sr - x.rho * book > rows[b].sr - rows[b].rho * book ? i : b), 0);
    why = [
      `What matters is what each adds to the book (Sharpe ${book}): roughly Sharpe − correlation × ${book}.`,
      ...rows.map((x, i) => `${letters[i]}: ${num(x.sr, 1)} − ${num(x.rho, 1)} × ${book} = ${num(x.sr - x.rho * book)}`),
      `${letters[pick]} adds the most, even if it isn't the best on its own.`,
    ];
  }
  return {
    time: "14:30",
    where: "PM meeting",
    from: IVY,
    title: "Which one gets funded?",
    message:
      L === "medium"
        ? "I can fund one of these vol strategies. Risk's rule: no strategy with a worst month below −10%. Which one?"
        : L === "hard"
          ? `Our vol book runs at a Sharpe of ${book}. I can fund one of these. Which one?`
          : "I can fund one of these vol strategies. Which one?",
    blocks: [
      {
        kind: "table",
        head: ["", "Strategy", "Sharpe", "Worst month", "Capacity", "Corr. to book"],
        rows: rows.map((x, i) => [letters[i], names[i], num(x.sr, 1), `${x.worst}%`, `$${x.cap}m`, num(x.rho, 1)]),
      },
    ],
    q: { kind: "choice", prompt: "Your recommendation", options: letters.map((l, i) => `${l}: ${names[i]}`), answer: `${letters[pick]}: ${names[pick]}` },
    why,
    outcome: cred("Ivy funds your pick.", "Ivy goes with someone else's recommendation."),
  };
}

/* 16:30 — live monitoring */
function monitor(r: Rng, L: Level): Task {
  const sigma = r.range(8, 15, 1) / 100;
  const months = r.pick([1, 2, 3, 6]);
  const sd = sigma * Math.sqrt(months / 12);
  const sr = L === "easy" ? 0 : r.range(0.8, 2, 0.1);
  const expected = sr * sigma * (months / 12);
  const per = `${months} month${months > 1 ? "s" : ""}`;
  if (L !== "hard") {
    const R = -r.range(1, 6, 0.5) / 100;
    const z = round((R - expected) / sd, 2);
    return {
      time: "16:30",
      where: "Risk review",
      from: MARCO,
      title: "Is this drawdown normal?",
      message: `The short-vol strategy is ${pct(-R)} down over ${per}. How unusual is that? Give me a z-score.`,
      blocks: [{ kind: "kv", items: [["Return so far", pct(R)], ["Period", per], ["Target volatility", `${pct(sigma, 0)} a year`], ...(sr ? ([["Backtest Sharpe", num(sr, 1)]] as [string, string][]) : [])] }],
      q: { kind: "number", prompt: "z-score", answer: z, tol: 0.1 },
      why: [
        `Volatility over ${per} = ${pct(sigma, 0)} × √(${months}/12) = ${pct(sd)}.`,
        ...(sr ? [`Expected return over the period = Sharpe × vol × time = ${num(sr, 1)} × ${pct(sigma, 0)} × ${months}/12 = ${pct(expected)}.`] : []),
        `z = (${pct(R)}${sr ? ` − ${pct(expected)}` : ""}) ÷ ${pct(sd)} = ${num(z)}.`,
        Math.abs(z) < 1.5 ? "Within normal noise, though for short vol, check it isn't the start of a tail event." : "Unusual: worth a closer look.",
      ],
      outcome: cred("Marco is satisfied with the analysis.", "Marco sends your numbers back."),
    };
  }
  const band = r.pick(["keep", "cut", "off"] as const);
  const zTarget = band === "keep" ? r.range(-1, -0.2, 0.05) : band === "cut" ? r.range(-2.2, -1.45, 0.05) : r.range(-3.5, -2.5, 0.05);
  const R = round(expected + zTarget * sd, 3);
  const z = (R - expected) / sd;
  const p = normCdf(z);
  const keep = "Keep running: it's within normal noise";
  const cut = "Cut size and investigate";
  const off = "Switch it off and investigate";
  const answer = p >= 0.1 ? keep : p >= 0.01 ? cut : off;
  return {
    time: "16:30",
    where: "Risk review",
    from: MARCO,
    title: "Keep it or kill it?",
    message: `The short-vol strategy is ${R < 0 ? `${pct(-R)} down` : `only ${pct(R)} up`} over ${per}. If it works as backtested, how likely is a run this bad? What do we do?`,
    blocks: [
      {
        kind: "kv",
        items: [["Return so far", pct(R)], ["Period", per], ["Target volatility", `${pct(sigma, 0)} a year`], ["Backtest Sharpe", num(sr, 1)], ["Desk policy", "Keep above 10%, cut size 1–10%, switch off below 1%"]],
      },
    ],
    q: { kind: "choice", prompt: "Decision", options: [keep, cut, off], answer },
    why: [
      `Expected ${pct(expected)}, vol over the period ${pct(sd)}: z = (${pct(R)} − ${pct(expected)}) ÷ ${pct(sd)} = ${num(z)}.`,
      `P(this bad or worse | it works) = N(${num(z)}) = ${pct(p, 1)}.`,
      `${answer} under the desk policy. Short-vol returns have fat left tails, so if anything the normal model understates the risk.`,
    ],
    outcome: cred("Marco minutes your recommendation as the decision.", "Marco overrules you; the numbers didn't support it."),
  };
}

const TITLES: Record<Level, string[]> = {
  easy: ["First day in vol research", "Bad option prints", "Realised vs implied", "Short straddle post-mortem", "Friday PM meeting"],
  medium: ["Pipeline audit", "Measuring vol", "Hidden tail risk", "Vega P&L", "Tail-risk limits"],
  hard: ["Too good to be true", "EWMA day", "Out-of-sample day", "Variance swaps", "Kill or keep"],
};

export function researcherTasks(r: Rng, L: Level): Task[] {
  return [data, realised, backtest, volTrade, choose, monitor].map((f) => f(r, L));
}
export const researcherTitle = (L: Level, i: number) => TITLES[L][i % 5];
