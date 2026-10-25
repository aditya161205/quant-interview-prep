import { normCdf, normInv, num, pct, round, type Answer, type Level, type Outcome, type Person, type Rng, type Task } from "./core";

/** A systematic equities research team: data, signals, backtests, and the PM who decides what goes live. */

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

/* 08:00 — the data */
const PIPELINE: { text: string; problem: boolean; why: string }[] = [
  { text: "The universe is today's index members, applied back to 2010.", problem: true, why: "Survivorship bias: stocks that fell out of the index (often the losers) are missing from history." },
  { text: "Delisted stocks are dropped from the price history.", problem: true, why: "Survivorship bias: bankruptcies and takeovers vanish, so returns look better than they were." },
  { text: "Earnings are stamped with the quarter-end date, not the release date.", problem: true, why: "Look-ahead: the backtest knows earnings weeks before they were published." },
  { text: "The signal is computed from today's close and traded at that same close.", problem: true, why: "Look-ahead: you can't trade at a price you needed to compute the signal." },
  { text: "When a stock stops trading, its last price is carried forward indefinitely.", problem: true, why: "Stale prices hide delisting losses and fake low volatility." },
  { text: "Prices are adjusted for splits and dividends before computing returns.", problem: false, why: "Correct: unadjusted prices create fake jumps." },
  { text: "Index membership is taken as of each historical date.", problem: false, why: "Correct: a point-in-time universe avoids survivorship bias." },
  { text: "Signals are lagged one day before they're traded.", problem: false, why: "Correct: a one-day lag avoids look-ahead." },
  { text: "Transaction costs are charged on every trade in the backtest.", problem: false, why: "Correct: costs belong in every backtest." },
];

const LOOKAHEAD = [
  {
    setup: "The news-sentiment score for each day is published at 18:00 ET. The backtest trades it at that day's 16:00 close.",
    right: "Trade it the next day: lag the signal so it's used only after it's published",
  },
  {
    setup: "Fundamentals come from today's database, which holds the latest restated numbers for every past quarter.",
    right: "Use a point-in-time database: only numbers as first reported, on the day they were known",
  },
  {
    setup: "Each stock's volatility is scaled using the full sample's standard deviation, 2010 to today.",
    right: "Scale with a trailing window: only data up to each day, never the full sample",
  },
];
const LOOKAHEAD_WRONG = ["Winsorise the signal at 3 standard deviations", "Add more stocks to the universe", "Charge higher transaction costs", "Use a longer lookback window"];

function data(r: Rng, L: Level): Task {
  if (L === "easy") {
    const ratio = r.pick([2, 3, 4]);
    let p = r.range(80, 300, 0.01);
    const splitDay = 3;
    const rows: string[][] = [];
    const dates = ["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16", "Mon 19"];
    for (let i = 0; i < 6; i++) {
      if (i > 0) p = p * (1 + r.range(-1.5, 1.5, 0.1) / 100);
      const shown = i >= splitDay ? p / ratio : p;
      const vol = (i >= splitDay ? ratio : 1) * r.range(1.2, 2.4, 0.1);
      rows.push([dates[i], num(shown), `${num(vol, 1)}m`]);
    }
    const right = `A ${ratio}-for-1 stock split the prices aren't adjusted for`;
    const drop = 1 - 1 / ratio;
    return {
      time: "08:00",
      where: "Data check",
      from: CLARA,
      title: "Something's off in the price file",
      message: `Your momentum backtest shows a ${pct(drop, 0)} loss on one stock on ${dates[splitDay]}. Nothing in the news. What happened?`,
      blocks: [{ kind: "table", head: ["Date", "Close", "Volume"], rows, mark: splitDay }],
      q: {
        kind: "choice",
        prompt: `What happened on ${dates[splitDay]}?`,
        options: shuffle(r, [right, `A ${pct(drop, 0)} crash on bad news`, "The vendor switched the price to another currency", "A special dividend was paid"]),
        answer: right,
      },
      why: [`The price fell by exactly 1/${ratio} and volume jumped about ${ratio}×: an unadjusted split.`, "Adjust all earlier prices (and volumes) by the split factor before computing returns."],
      outcome: cred("Clara fixes the adjustment; the fake loss disappears from your backtest.", "You flag it as a crash; Theo spots the split in five seconds."),
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
      title: "Review the backtest pipeline",
      message: "Before your backtest goes to Ivy, check how I built the data. Which of these are problems?",
      blocks: [{ kind: "table", head: ["#", "How the data is built"], rows: shown.map((x, i) => [String(i + 1), x.text]) }],
      q: { kind: "multi", prompt: "Pick every problem", options: shown.map((x) => x.text), answer: problems.map((x) => x.text) },
      why: shown.map((x) => `${x.problem ? "Problem" : "Fine"}: ${x.why}`),
      outcome: cred("You catch the biases before they reach the PM.", "A bias slips through; Ivy finds it in the review."),
    };
  }
  const s = r.pick(LOOKAHEAD);
  return {
    time: "08:00",
    where: "Data check",
    from: CLARA,
    title: "Is this backtest honest?",
    message: "The Sharpe on this one looks too good. Here's how it's built. What's the fix?",
    blocks: [{ kind: "text", text: s.setup }],
    q: { kind: "choice", prompt: "The fix", options: shuffle(r, [s.right, ...shuffle(r, LOOKAHEAD_WRONG).slice(0, 3)]), answer: s.right },
    why: ["The backtest uses information it wouldn't have had at the time: look-ahead bias.", `${s.right}.`],
    outcome: cred("With the fix the Sharpe drops to something believable, and nobody gets embarrassed in production.", "The look-ahead survives into the PM review. Awkward."),
  };
}

/* 09:30 — is the signal real? */
function stats(r: Rng, L: Level): Task {
  if (L === "easy") {
    const m = r.range(0.02, 0.08, 0.005);
    const sd = r.range(0.5, 1.5, 0.05);
    const sr = round((m / sd) * Math.sqrt(252), 2);
    return {
      time: "09:30",
      where: "Research",
      from: THEO,
      title: "Annualise the Sharpe",
      message: "Your strategy's daily returns are in. What's the annualised Sharpe ratio?",
      blocks: [{ kind: "kv", items: [["Mean daily return", `${num(m, 3)}%`], ["Daily volatility", `${num(sd, 2)}%`], ["Trading days a year", "252"]] }],
      q: { kind: "number", prompt: "Annualised Sharpe", answer: sr, tol: 0.05 },
      why: [`Sharpe = mean ÷ vol × √252 = ${num(m, 3)} ÷ ${num(sd, 2)} × 15.87 = ${num(sr)}.`, "Returns scale with time, volatility with its square root."],
      outcome: cred("Theo nods: the number is right.", "Theo redoes it on the whiteboard. You forgot to annualise properly."),
    };
  }
  if (L === "medium") {
    const ic = r.range(0.01, 0.04, 0.002);
    const sd = r.range(0.06, 0.15, 0.005);
    const n = r.pick([250, 500, 750, 1000]);
    const t = round((ic / sd) * Math.sqrt(n), 2);
    return {
      time: "09:30",
      where: "Research",
      from: THEO,
      title: "Is the IC significant?",
      message: "Your signal's daily information coefficient looks positive. Is it statistically significant? Give me the t-stat.",
      blocks: [{ kind: "kv", items: [["Mean daily IC", num(ic, 3)], ["Std of daily IC", num(sd, 3)], ["Days", String(n)]] }],
      q: { kind: "number", prompt: "t-statistic", answer: t, tol: Math.max(0.1, t * 0.03) },
      why: [`t = mean ÷ std × √n = ${num(ic, 3)} ÷ ${num(sd, 3)} × √${n} = ${num(t)}.`, t > 2 ? "Above 2: significant at the usual 5% level." : "Below 2: not significant yet."],
      outcome: cred("Theo agrees with the read.", "Theo points out the t-stat is off by a factor of √n."),
    };
  }
  const N = r.pick([20, 50, 100, 200]);
  const z = normInv(1 - 0.05 / (2 * N));
  const t = round(z + r.sign() * r.range(0.25, 0.9, 0.05), 2);
  return {
    time: "09:30",
    where: "Research",
    from: THEO,
    title: "Multiple testing",
    message: `You tried ${N} variations and the best one has a t-stat of ${num(t)}. Is it significant once you account for the search?`,
    blocks: [{ kind: "kv", items: [["Variations tried", String(N)], ["Best t-stat", num(t)], ["Target false-positive rate", "5%"]] }],
    q: { kind: "choice", prompt: "Significant after correcting for the search?", options: ["Yes", "No"], answer: t > z ? "Yes" : "No" },
    why: [
      `Bonferroni: each test must pass at 5% ÷ ${N} = ${num(5 / N, 3)}%, two-sided, which needs |t| > ${num(z)}.`,
      t > z ? `${num(t)} clears it.` : `${num(t)} doesn't. With enough tries, a t-stat that high turns up by luck.`,
    ],
    outcome: cred("Good discipline: Theo trusts your results more.", "You'd have shipped noise. Theo walks you through the search correction."),
  };
}

/* 11:00 — the backtest review */
function backtest(r: Rng, L: Level): Task {
  if (L === "easy") {
    const g = r.range(8, 20, 1);
    const x = r.range(5, 40, 5);
    const c = r.range(5, 20, 1);
    const net = round(g - (x * c) / 100, 2);
    return {
      time: "11:00",
      where: "Backtest review",
      from: IVY,
      title: "After costs",
      message: "Your backtest is gross of costs. What does it make after trading costs?",
      blocks: [{ kind: "kv", items: [["Gross return", `${g}% a year`], ["Turnover", `${x}× capital a year (buys and sells)`], ["Cost", `${c} bps per dollar traded`]] }],
      q: { kind: "number", prompt: "Net return", unit: "% a year", answer: net, tol: 0.1 },
      why: [`Cost drag = turnover × cost = ${x} × ${c} bps = ${num((x * c) / 100, 2)}% a year.`, `Net = ${g}% − ${num((x * c) / 100, 2)}% = ${num(net, 2)}%.`],
      outcome: cred("Ivy likes that you led with net numbers.", "Ivy asks why your net return doesn't add up."),
    };
  }
  if (L === "medium") {
    const g = r.range(4, 12, 0.5);
    const x = r.range(20, 80, 5);
    const be = round((g / x) * 100, 1);
    return {
      time: "11:00",
      where: "Backtest review",
      from: IVY,
      title: "Break-even cost",
      message: "Execution says costs could be anywhere from 5 to 25 bps. At what cost does this strategy stop making money?",
      blocks: [{ kind: "kv", items: [["Gross return", `${num(g, 1)}% a year`], ["Turnover", `${x}× capital a year`]] }],
      q: { kind: "number", prompt: "Break-even cost", unit: " bps", answer: be, tol: Math.max(0.5, be * 0.02) },
      why: [`Break even when turnover × cost = gross return: cost = ${num(g, 1)}% ÷ ${x} = ${num(be, 1)} bps per dollar traded.`, be < 15 ? "That's inside the range execution quoted: too fragile to trade as is." : "Comfortably above the expected costs."],
      outcome: cred("Ivy uses your number to set the turnover budget.", "Your break-even is off; execution sends a correction."),
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
    message: "The new model looked fantastic in research. Two years of out-of-sample later, it doesn't. What do you tell me?",
    blocks: [{ kind: "table", head: ["", "Sharpe", "Period"], rows: [["In-sample", num(is, 1), "2012–2020"], ["Out-of-sample", num(oos, 1), "2021–2022"]] }, { kind: "kv", items: [["Parameters fitted", String(params)]] }],
    q: {
      kind: "choice",
      prompt: "Your read",
      options: shuffle(r, [right, "Regime change: scale it up, it will come back", "Two years is too short to judge: ship it", "Costs are too high: just trade less often"]),
      answer: right,
    },
    why: [`A Sharpe of ${num(is, 1)} in-sample falling to ${num(oos, 1)} out-of-sample, with ${params} fitted parameters, is the classic overfitting signature.`, "Cut the parameters, then test on data the model has never seen."],
    outcome: cred("Ivy shelves it until the simpler version is tested. Money saved.", "Ivy allocates to it; it bleeds for a quarter."),
  };
}

/* 13:00 — combining signals */
function combine(r: Rng, L: Level): Task {
  if (L === "hard") {
    const book = r.range(1, 1.8, 0.1);
    const rho = r.range(0.2, 0.9, 0.1);
    const threshold = rho * book;
    const s = round(Math.max(0.1, threshold + r.sign() * r.range(0.1, 0.4, 0.05)), 2);
    const add = s > threshold;
    return {
      time: "13:00",
      where: "Research",
      from: THEO,
      title: "Does it add anything?",
      message: "New signal, decent Sharpe on its own. But does it improve the book we already run?",
      blocks: [{ kind: "kv", items: [["Current book Sharpe", num(book, 1)], ["New signal Sharpe", num(s)], ["Correlation with the book", num(rho, 1)]] }],
      q: { kind: "choice", prompt: "Add it to the book?", options: ["Yes, it raises the book's Sharpe", "No, it won't help"], answer: add ? "Yes, it raises the book's Sharpe" : "No, it won't help" },
      why: [`A new strategy improves the book when its Sharpe beats correlation × book Sharpe: ${num(rho, 1)} × ${num(book, 1)} = ${num(threshold)}.`, add ? `${num(s)} beats it: add it.` : `${num(s)} doesn't: it mostly repeats what you already own.`],
      outcome: cred("Theo backs your call in the meeting.", "Theo shows the combined Sharpe going the other way."),
    };
  }
  const s1 = r.range(0.6, 1.4, 0.1);
  const s2 = L === "easy" ? s1 : r.range(0.5, 1.4, 0.1);
  const rho = L === "easy" ? 0 : r.range(-0.2, 0.6, 0.1);
  const c = round((s1 + s2) / Math.sqrt(2 + 2 * rho), 2);
  return {
    time: "13:00",
    where: "Research",
    from: THEO,
    title: "Combine two signals",
    message: "Run both signals together at equal risk. What Sharpe should the combination have?",
    blocks: [{ kind: "kv", items: [["Signal A Sharpe", num(s1, 1)], ["Signal B Sharpe", num(s2, 1)], ["Correlation", num(rho, 1)]] }],
    q: { kind: "number", prompt: "Combined Sharpe", answer: c, tol: 0.03 },
    why: [`At equal risk, combined Sharpe = (S_A + S_B) ÷ √(2 + 2ρ) = ${num(s1 + s2, 1)} ÷ √${num(2 + 2 * rho, 1)} = ${num(c)}.`, rho < 0.5 ? "Low correlation is what makes the combination better than either alone." : "High correlation limits the gain."],
    outcome: cred("Theo uses your number in the allocation memo.", "Theo corrects the diversification maths."),
  };
}

/* 14:30 — the PM decides */
function choose(r: Rng, L: Level): Task {
  const names = ["A", "B", "C"];
  const aum = L === "easy" ? 100 : 200;
  const book = 1.2;
  let rows: { sr: number; dd: number; cap: number; rho: number }[];
  let pickIdx: number;
  let why: string[];
  if (L === "easy") {
    const best = r.range(1.4, 1.9, 0.1);
    rows = [best, best - r.range(0.4, 0.6, 0.1), best - r.range(0.7, 0.9, 0.1)].map((sr) => ({ sr: round(sr, 1), dd: r.range(8, 14, 1), cap: r.range(150, 500, 50), rho: r.range(0.1, 0.4, 0.1) }));
    rows = shuffle(r, rows);
    pickIdx = rows.reduce((b, x, i) => (x.sr > rows[b].sr ? i : b), 0);
    why = [`Strategy ${names[pickIdx]} has the best Sharpe, enough capacity for ${aum}m and a similar drawdown: it's the clear choice.`];
  } else if (L === "medium") {
    const top = r.range(1.7, 2.2, 0.1);
    rows = [
      { sr: round(top, 1), dd: r.range(6, 10, 1), cap: r.range(40, 120, 20), rho: r.range(0.1, 0.4, 0.1) },
      { sr: round(top - r.range(0.3, 0.5, 0.1), 1), dd: r.range(8, 12, 1), cap: r.range(300, 600, 50), rho: r.range(0.1, 0.4, 0.1) },
      { sr: round(top - r.range(0.7, 0.9, 0.1), 1), dd: r.range(8, 12, 1), cap: r.range(300, 600, 50), rho: r.range(0.1, 0.4, 0.1) },
    ];
    rows = shuffle(r, rows);
    pickIdx = rows.reduce((b, x, i) => (x.cap >= aum && (rows[b].cap < aum || x.sr > rows[b].sr) ? i : b), rows.findIndex((x) => x.cap >= aum));
    const tiny = rows.findIndex((x) => x.cap < aum);
    why = [`Strategy ${names[tiny]} has the best Sharpe but only $${rows[tiny].cap}m of capacity: at $${aum}m its own trading would eat the edge.`, `Among those that can take $${aum}m, ${names[pickIdx]} has the best Sharpe.`];
  } else {
    const make = () => ({ sr: r.range(1, 1.8, 0.1), dd: r.range(8, 14, 1), cap: r.range(300, 600, 50), rho: r.range(0, 0.8, 0.1) });
    let tries = 0;
    do {
      rows = [make(), make(), make()];
      const m = rows.map((x) => x.sr - x.rho * book).sort((a, b) => b - a);
      if (m[0] - m[1] >= 0.15) break;
    } while (++tries < 50);
    pickIdx = rows.reduce((b, x, i) => (x.sr - x.rho * book > rows[b].sr - rows[b].rho * book ? i : b), 0);
    why = [
      `What matters is what each adds to the book (Sharpe ${book}): roughly Sharpe − correlation × ${book}.`,
      ...rows.map((x, i) => `${names[i]}: ${num(x.sr, 1)} − ${num(x.rho, 1)} × ${book} = ${num(x.sr - x.rho * book)}`),
      `${names[pickIdx]} adds the most, even if it isn't the best on its own.`,
    ];
  }
  return {
    time: "14:30",
    where: "PM meeting",
    from: IVY,
    title: "Which one goes live?",
    message: L === "hard" ? `We run a book with a Sharpe of ${book}. I can fund one of these. Which one?` : `I have $${aum}m to allocate to one new strategy. Which one?`,
    blocks: [
      {
        kind: "table",
        head: ["Strategy", "Sharpe", "Max drawdown", "Capacity", "Corr. to book"],
        rows: rows.map((x, i) => [names[i], num(x.sr, 1), `−${x.dd}%`, `$${x.cap}m`, num(x.rho, 1)]),
      },
    ],
    q: { kind: "choice", prompt: "Your recommendation", options: names.map((n) => `Strategy ${n}`), answer: `Strategy ${names[pickIdx]}` },
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
  if (L !== "hard") {
    const R = -r.range(1, 6, 0.5) / 100;
    const z = round((R - expected) / sd, 2);
    return {
      time: "16:30",
      where: "Risk review",
      from: MARCO,
      title: "Is this drawdown normal?",
      message: `The strategy is ${pct(-R)} down over ${months} month${months > 1 ? "s" : ""}. How unusual is that? Give me a z-score.`,
      blocks: [{ kind: "kv", items: [["Return so far", pct(R)], ["Period", `${months} month${months > 1 ? "s" : ""}`], ["Target volatility", `${pct(sigma, 0)} a year`], ...(sr ? ([["Backtest Sharpe", num(sr, 1)]] as [string, string][]) : [])] }],
      q: { kind: "number", prompt: "z-score", answer: z, tol: 0.1 },
      why: [
        `Volatility over ${months} month${months > 1 ? "s" : ""} = ${pct(sigma, 0)} × √(${months}/12) = ${pct(sd)}.`,
        ...(sr ? [`Expected return over the period = Sharpe × vol × time = ${num(sr, 1)} × ${pct(sigma, 0)} × ${months}/12 = ${pct(expected)}.`] : []),
        `z = (${pct(R)}${sr ? ` − ${pct(expected)}` : ""}) ÷ ${pct(sd)} = ${num(z)}.`,
        Math.abs(z) < 1.5 ? "Well within normal noise." : "Unusual: worth a closer look.",
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
    message: `The strategy is ${R < 0 ? `${pct(-R)} down` : `only ${pct(R)} up`} over ${months} month${months > 1 ? "s" : ""}. If it works as backtested, how likely is a run this bad? What do we do?`,
    blocks: [{ kind: "kv", items: [["Return so far", pct(R)], ["Period", `${months} month${months > 1 ? "s" : ""}`], ["Target volatility", `${pct(sigma, 0)} a year`], ["Backtest Sharpe", num(sr, 1)], ["Desk policy", "Keep above 10%, cut size 1–10%, switch off below 1%"]] }],
    q: { kind: "choice", prompt: "Decision", options: [keep, cut, off], answer },
    why: [
      `Expected ${pct(expected)}, vol over the period ${pct(sd)}: z = (${pct(R)} − ${pct(expected)}) ÷ ${pct(sd)} = ${num(z)}.`,
      `P(this bad or worse | it works) = N(${num(z)}) = ${pct(p, 1)}.`,
      `${answer} under the desk policy.`,
    ],
    outcome: cred("Marco minutes your recommendation as the decision.", "Marco overrules you; the numbers didn't support it."),
  };
}

const TITLES: Record<Level, string[]> = {
  easy: ["First day in research", "A new data vendor", "Signal review", "Costs reality check", "Friday PM meeting"],
  medium: ["Pipeline audit", "IC season", "The turnover budget", "Two signals, one book", "Month-end review"],
  hard: ["Too good to be true", "The search problem", "Out-of-sample day", "Capacity crunch", "Kill or keep"],
};

export function researcherTasks(r: Rng, L: Level): Task[] {
  return [data, stats, backtest, combine, choose, monitor].map((f) => f(r, L));
}
export const researcherTitle = (L: Level, i: number) => TITLES[L][i % 5];
