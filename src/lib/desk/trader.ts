import { money, normCdf, num, pct, round, signedMoney, stake, type Answer, type Level, type Outcome, type Person, type Rng, type Task } from "./core";

/** An equity-derivatives market-making desk, trading options on one stock: Halcyon Systems (HALC). */

const HUGO: Person = { name: "Hugo", role: "Head of desk" };
const NORA: Person = { name: "Nora", role: "Risk manager" };
const FELIX: Person = { name: "Felix", role: "Sales trader" };

const toNum = (a: Answer) => (typeof a === "number" ? a : typeof a === "string" ? parseFloat(a.replace(/[,$%\s]/g, "").replace(/[−–]/g, "-")) : NaN);
const cents = (x: number) => `${num(x * 100, 0)}¢`;
function bsCall(S: number, K: number, vol: number, days: number) {
  const T = days / 365;
  const sd = vol * Math.sqrt(T);
  const d1 = (Math.log(S / K) + 0.5 * vol * vol * T) / sd;
  return S * normCdf(d1) - K * normCdf(d1 - sd);
}
const shuffle = <T,>(r: Rng, xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* 07:30 — where will it open? */
function preOpen(r: Rng, L: Level): Task {
  const out = stake(r.range(1500, 3500, 100), r.range(1500, 4000, 100), "You leaned the right way in the opening auction.", "You leaned the wrong way in the opening auction and paid to get out.");
  if (L === "hard") {
    const l0 = r.range(70, 95, 0.05);
    const l1 = round(l0 * (1 + (r.sign() * r.range(0.5, 3, 0.1)) / 100), 2);
    const fx0 = r.range(1.22, 1.32, 0.001);
    const fx1 = round(fx0 + r.sign() * r.range(0.002, 0.012, 0.001), 3);
    const ratio = r.pick([0.5, 2]);
    const prev = round(l0 * fx0 * ratio, 2);
    const fair = round(l1 * fx1 * ratio, 2);
    return {
      time: "07:30",
      where: "Pre-market",
      from: HUGO,
      title: "Price the ADR",
      message: "HALC's London line has been trading all morning and sterling has moved. Where should the New York ADR open?",
      blocks: [
        {
          kind: "kv",
          items: [
            ["London close yesterday", `£${num(l0)}`],
            ["London now", `£${num(l1)}`],
            ["GBP/USD yesterday", num(fx0, 3)],
            ["GBP/USD now", num(fx1, 3)],
            ["1 ADR", `${ratio} London shares`],
            ["ADR close yesterday", money(prev, 2)],
          ],
        },
      ],
      q: { kind: "number", prompt: "Fair ADR open", prefix: "$", answer: fair, tol: Math.max(0.05, fair * 0.002) },
      why: [
        `Fair ADR = London price × GBP/USD × shares per ADR = £${num(l1)} × ${num(fx1, 3)} × ${ratio} = ${money(fair, 2)}.`,
        `That's ${pct(fair / prev - 1, 2)} from yesterday's close: the stock move and the currency move together.`,
      ],
      outcome: out,
    };
  }
  const S = r.range(60, 240, 0.01);
  const f = (r.sign() * r.range(0.3, 2, 0.1)) / 100;
  const beta = L === "easy" ? 1 : r.range(0.6, 1.8, 0.1);
  const fair = round(S * (1 + beta * f), 2);
  return {
    time: "07:30",
    where: "Pre-market",
    from: HUGO,
    title: "Where will HALC open?",
    message:
      L === "easy"
        ? "Index futures moved overnight and there's no company news. HALC moves one-for-one with the index. Where should it open?"
        : "Futures moved overnight, nothing on HALC itself. Use its beta to the index and give me a fair open.",
    blocks: [
      {
        kind: "kv",
        items: [
          ["HALC close", money(S, 2)],
          ["Index futures overnight", `${f > 0 ? "+" : ""}${pct(f)}`],
          ["HALC beta to the index", num(beta, 1)],
        ],
      },
    ],
    q: { kind: "number", prompt: "Fair open", prefix: "$", answer: fair, tol: Math.max(0.05, fair * 0.0015) },
    why: [`Fair open = close × (1 + β × futures move) = ${num(S)} × (1 + ${num(beta, 1)} × ${pct(f)}) = ${money(fair, 2)}.`],
    outcome: out,
  };
}

/* 08:15 — flatten the delta */
function hedge(r: Rng, L: Level): Task {
  const S = r.range(80, 220, 0.01);
  const rows: string[][] = [];
  let net = 0;
  const n1 = r.range(10, 60, 10);
  const d1 = r.range(0.25, 0.75, 0.05);
  const side = L === "easy" ? r.sign() : 1;
  net += side * n1 * 100 * d1;
  rows.push([`${side > 0 ? "Long" : "Short"} ${n1} calls`, num(d1, 2), num(side * n1 * 100 * d1, 0)]);
  if (L !== "easy") {
    const n2 = r.range(10, 50, 10);
    const d2 = r.range(0.2, 0.6, 0.05);
    const shares = r.sign() * r.range(500, 3000, 100);
    net += -n2 * 100 * -d2 + shares;
    rows.push([`Short ${n2} puts`, `−${num(d2, 2)}`, num(n2 * 100 * d2, 0)], [`${shares > 0 ? "Long" : "Short"} ${num(Math.abs(shares), 0)} shares`, "1.00", num(shares, 0)]);
  }
  const gamma = L === "hard" ? r.range(300, 1500, 50) : 0;
  const move = L === "hard" ? (r.sign() * r.range(1, 3, 0.5)) / 100 : 0;
  const atOpen = net + gamma * S * move;
  const answer = -Math.round(atOpen);
  const later = (r.sign() * r.range(0.4, 1.6, 0.1)) / 100;
  const flatBonus = r.range(500, 1500, 100);
  return {
    time: "08:15",
    where: "Risk report",
    from: NORA,
    title: "Flatten your delta",
    message:
      L === "hard"
        ? `HALC is indicated ${move > 0 ? "up" : "down"} ${pct(Math.abs(move))} at the open. Your gamma will move your delta before you can trade. How many shares do you trade at the open to be flat?`
        : "You're carrying delta from yesterday. I want you flat before the open. How many shares do you trade?",
    blocks: [
      { kind: "table", head: ["Position", "Delta each", "Delta (shares)"], rows },
      {
        kind: "kv",
        items: [["HALC", money(S, 2)], ...(L === "hard" ? ([["Gamma", `${num(gamma, 0)} shares per $1`], ["Open indication", `${move > 0 ? "+" : ""}${pct(move)}`]] as [string, string][]) : [])],
      },
    ],
    q: { kind: "number", prompt: "Shares to trade (+ buy, − sell)", answer, tol: Math.max(50, Math.abs(answer) * 0.015) },
    why: [
      `Delta now = ${rows.map((x) => x[2]).join(" + ").replace(/\+ −/g, "− ")} = ${num(net, 0)} shares (one option = 100 shares).`,
      ...(L === "hard"
        ? [`At the open the stock moves ${money(S * move, 2)}, and gamma adds ${num(gamma, 0)} × ${num(S * move)} = ${num(gamma * S * move, 0)} shares: delta becomes ${num(atOpen, 0)}.`]
        : []),
      `To be flat you ${answer > 0 ? "buy" : "sell"} ${num(Math.abs(answer), 0)} shares.`,
    ],
    outcome: (a): Outcome => {
      const t = toNum(a);
      const residual = Number.isFinite(t) ? atOpen + t : atOpen;
      // Leftover delta gets hedged late, after the stock has moved: it costs, whichever way the move went.
      const cost = Math.round(Math.abs(residual) * S * Math.abs(later) * 0.5);
      return Math.abs(residual) < 100
        ? { delta: flatBonus, text: `By 10:00 HALC was ${later > 0 ? "up" : "down"} ${pct(Math.abs(later))}. You were flat, so you could make markets freely through the open.` }
        : {
            delta: -cost,
            text: `By 10:00 HALC was ${later > 0 ? "up" : "down"} ${pct(Math.abs(later))}. You still had ${num(residual, 0)} shares of delta and had to hedge them late at worse prices: ${money(cost)}.`,
          };
    },
  };
}

/* 09:30 — make a market */
function quote(r: Rng, L: Level): Task {
  const F = r.range(40, 180, 0.01);
  const inv = r.sign() * r.range(20, 60, 10) * 1000;
  const size = r.range(10, 50, 10) * 1000;
  const h = r.range(2, 5, 1) / 100;
  const skew = (inv / 10000) * 0.01;
  const mid = round(F - skew, 2);
  const half = L === "hard" ? round(h + (size / 10000) * 0.01, 2) : h;
  const q2 = (m: number, hs: number) => `${num(m - hs)} × ${num(m + hs)}`;
  const right = q2(mid, half);
  const rules = L === "hard" ? "Desk rules: skew 1¢ per 10k shares of inventory; base half-spread " + cents(h) + ", plus 1¢ per 10k shares the client wants." : `Desk rules: skew 1¢ per 10k shares of inventory; half-spread ${cents(h)}.`;
  const win = Math.round(size * h);
  const lose = Math.round(size * r.range(0.03, 0.08, 0.01));
  const out = stake(win, lose, `The client traded on your quote and you worked the position off at mid: about ${money(win)} of edge.`, `Your quote was off: the client took the cheap side and HALC kept going. You paid ${money(lose)} to get flat.`);
  const blocks = [
    { kind: "kv" as const, items: [["HALC fair value", money(F, 2)], ["Your inventory", `${inv > 0 ? "long" : "short"} ${num(Math.abs(inv), 0)} shares`], ["Client size", `${num(size, 0)} shares`]] as [string, string][] },
    { kind: "text" as const, text: rules },
  ];
  const why = [
    `You're ${inv > 0 ? "long" : "short"} ${num(Math.abs(inv), 0)}, so you want to ${inv > 0 ? "sell" : "buy"}: shade the quote ${inv > 0 ? "down" : "up"} by ${cents(Math.abs(skew))}. Mid = ${num(F)} ${inv > 0 ? "−" : "+"} ${num(Math.abs(skew))} = ${num(mid)}.`,
    ...(L === "hard" ? [`${num(size, 0)} shares adds ${cents((size / 10000) * 0.01)} to the half-spread: ${cents(h)} + ${cents((size / 10000) * 0.01)} = ${cents(half)}.`] : []),
    `Quote ${right}: the side you want filled is the attractive one.`,
  ];
  if (L === "medium")
    return {
      time: "09:30",
      where: "The open",
      from: FELIX,
      title: "Make a market",
      message: "Client wants a two-way in HALC, right now. Where do you centre your quote?",
      blocks,
      q: { kind: "number", prompt: "Mid of your quote", prefix: "$", answer: mid, tol: 0.005 },
      why,
      outcome: out,
    };
  const options = shuffle(r, [right, q2(F, half), q2(round(F + skew, 2), half), L === "hard" ? q2(mid, h) : q2(F, 3 * h)]);
  return {
    time: "09:30",
    where: "The open",
    from: FELIX,
    title: "Make a market",
    message: "Client wants a two-way in HALC, right now. What do you show?",
    blocks,
    q: { kind: "choice", prompt: "Your quote (bid × ask)", options, answer: right },
    why,
    outcome: out,
  };
}

/* 11:00 — price a client request */
function rfq(r: Rng, L: Level): Task {
  const S = r.range(50, 250, 0.5);
  const days = r.pick([30, 61, 91]);
  const T = days / 365;
  if (L === "easy") {
    const vol = r.range(18, 45, 1) / 100;
    const qty = r.range(50, 300, 50);
    const price = round(0.4 * vol * S * Math.sqrt(T), 2);
    return {
      time: "11:00",
      where: "Client request",
      from: FELIX,
      title: "Price some calls",
      message: `Client wants to buy ${qty} at-the-money HALC calls, ${days} days out. Rough value is fine, I need it in ten seconds.`,
      blocks: [{ kind: "kv", items: [["HALC", money(S, 2)], ["Implied vol", pct(vol, 0)], ["Expiry", `${days} days`], ["Rates", "0%"]] }],
      q: { kind: "number", prompt: "Value of one call", prefix: "$", answer: price, tol: price * 0.04 },
      why: [`ATM call ≈ 0.4 × σ × S × √T = 0.4 × ${num(vol, 2)} × ${num(S)} × √(${days}/365) = ${money(price, 2)}.`, "You'd show a little above that as your offer."],
      outcome: (a): Outcome => {
        const u = toNum(a);
        if (!Number.isFinite(u) || u > price * 1.08) return { delta: 0, text: "Your price was miles above the market; the client traded elsewhere." };
        if (u < price * 0.5) {
          // Too far off to be a real quote: Felix catches it before it goes out.
          const lost = Math.round(price * 0.02 * qty * 100);
          return { delta: -lost, text: `Felix caught your ${money(u, 2)} before it went out (fair was ${money(price, 2)}). The client got bored and traded elsewhere: ${money(lost)} of edge lost.` };
        }
        if (u < price * 0.92) {
          const loss = Math.round((price - u) * qty * 100);
          return { delta: -loss, text: `You sold them cheap: the calls were worth ${money(price, 2)}. That cost ${money(loss)}.` };
        }
        const edge = Math.round(price * 0.02 * qty * 100);
        return { delta: edge, text: `You offered a touch above fair and the client paid: ${money(edge)} of edge.` };
      },
    };
  }
  if (L === "medium") {
    const vol = r.range(20, 40, 1) / 100;
    const K1 = Math.round(S / 5) * 5;
    const strikes = [K1 - 10, K1, K1 + 10];
    const calls = strikes.map((K) => round(bsCall(S, K, vol, days), 2));
    if (r.next() < 0.5) {
      const value = round(calls[1] - calls[2], 2);
      return {
        time: "11:00",
        where: "Client request",
        from: FELIX,
        title: "Price a call spread",
        message: `Client wants to buy the ${K1}/${K1 + 10} call spread, ${days} days. What's mid?`,
        blocks: [{ kind: "table", head: ["Strike", "Call mid"], rows: strikes.map((K, i) => [String(K), money(calls[i], 2)]) }, { kind: "kv", items: [["HALC", money(S, 2)]] }],
        q: { kind: "number", prompt: "Call spread mid", prefix: "$", answer: value, tol: 0.05 },
        why: [`Long the ${K1} call, short the ${K1 + 10} call: ${money(calls[1], 2)} − ${money(calls[2], 2)} = ${money(value, 2)}.`, `It can never be worth more than the ${money(10)} between the strikes.`],
        outcome: stake(r.range(2000, 5000, 100), r.range(2000, 6000, 100), "You priced it in line and the client traded.", "Your price was off; the client hit you on the wrong side."),
      };
    }
    const put = round(calls[1] - S + K1, 2);
    return {
      time: "11:00",
      where: "Client request",
      from: FELIX,
      title: "Price a put from the call",
      message: `Our put screen is down. Client wants the ${K1} put, ${days} days. Rates are zero. What's it worth?`,
      blocks: [{ kind: "kv", items: [["HALC", money(S, 2)], [`${K1} call`, money(calls[1], 2)], ["Rates", "0%"]] }],
      q: { kind: "number", prompt: `${K1} put`, prefix: "$", answer: put, tol: 0.03 },
      why: [`Put-call parity: C − P = S − K, so P = C − S + K = ${num(calls[1])} − ${num(S)} + ${K1} = ${money(put, 2)}.`],
      outcome: stake(r.range(2000, 5000, 100), r.range(2000, 6000, 100), "Priced off parity, traded clean.", "Off parity: the client took your mispricing."),
    };
  }
  const forecast = r.range(18, 40, 1) / 100;
  const offered = round(forecast + (r.sign() * r.range(3, 8, 1)) / 100, 2);
  const fair = round(0.8 * forecast * S * Math.sqrt(30 / 365), 2);
  const price = round(0.8 * offered * S * Math.sqrt(30 / 365), 2);
  const buy = "Buy it: cheap against my forecast";
  const pass = "Pass: expensive against my forecast";
  return {
    time: "11:00",
    where: "Client request",
    from: FELIX,
    title: "A vol trade",
    message: `Client wants to sell us the 1-month ATM straddle at ${pct(offered, 0)} vol. Do we buy it?`,
    blocks: [{ kind: "kv", items: [["HALC", money(S, 2)], ["Client's price", `${money(price, 2)} (${pct(offered, 0)} vol)`], ["Your realised-vol forecast", pct(forecast, 0)]] }],
    q: { kind: "choice", prompt: "Your call", options: [buy, pass], answer: price < fair ? buy : pass },
    why: [
      `At your ${pct(forecast, 0)} forecast the straddle is worth ≈ 0.8 × σ × S × √T = ${money(fair, 2)}; the client wants ${money(price, 2)}.`,
      price < fair ? "You're buying vol below where you expect it to realise: buy and delta-hedge." : "You'd pay more than the move you expect: pass.",
    ],
    outcome: stake(r.range(4000, 9000, 100), r.range(4000, 9000, 100), "Realised vol came in close to your forecast: good call.", "Realised vol came in close to your forecast, against your trade."),
  };
}

/* 13:30 — an event */
function event(r: Rng, L: Level): Task {
  const S = r.range(60, 200, 0.5);
  const out = stake(r.range(3000, 8000, 100), r.range(3000, 8000, 100), "The stock moved about as you expected after the print.", "The print went against your view of the move.");
  if (L === "easy") {
    const move = r.range(3, 10, 0.5) / 100;
    const straddle = round(S * move, 2);
    return {
      time: "13:30",
      where: "Earnings tonight",
      from: HUGO,
      title: "What move is priced?",
      message: "HALC reports after the close. Before we touch anything: what move is the options market pricing?",
      blocks: [{ kind: "kv", items: [["HALC", money(S, 2)], ["ATM straddle, expiring tomorrow", money(straddle, 2)]] }],
      q: { kind: "number", prompt: "Implied move", unit: "%", answer: round((straddle / S) * 100, 1), tol: 0.3 },
      why: [`A straddle pays the size of the move, so its price ≈ the expected move: ${money(straddle, 2)} ÷ ${money(S, 2)} = ${pct(straddle / S)}.`],
      outcome: out,
    };
  }
  if (L === "medium") {
    const implied = r.range(4, 9, 0.5) / 100;
    const hist = implied + (r.sign() * r.range(1.2, 2.5, 0.1)) / 100;
    const moves = Array.from({ length: 8 }, () => Math.max(0.5, round(hist * 100 + r.range(-2, 2, 0.1), 1)));
    const avg = moves.reduce((a, b) => a + b, 0) / moves.length / 100;
    const sell = "Sell the straddle: the move is overpriced";
    const buy = "Buy the straddle: the move is underpriced";
    return {
      time: "13:30",
      where: "Earnings tonight",
      from: HUGO,
      title: "Rich or cheap?",
      message: `HALC reports tonight and the straddle prices a ${pct(implied)} move. Here are the last eight. Buy or sell?`,
      blocks: [{ kind: "table", head: ["Quarter", ...moves.map((_, i) => `Q-${8 - i}`)], rows: [["Move", ...moves.map((m) => `±${num(m, 1)}%`)]] }],
      q: { kind: "choice", prompt: "Your trade", options: [sell, buy], answer: implied > avg ? sell : buy },
      why: [`The average past move is ${pct(avg)} against ${pct(implied)} priced in.`, implied > avg ? "Options price more than the stock usually moves: sell the straddle and hedge." : "The stock usually moves more than is priced: buy the straddle."],
      outcome: out,
    };
  }
  const iv = r.range(45, 90, 1) / 100;
  const normal = r.range(20, 35, 1) / 100;
  const eventMove = Math.sqrt((iv * iv * 5) / 252 - (normal * normal * 4) / 252);
  return {
    time: "13:30",
    where: "Earnings week",
    from: HUGO,
    title: "Strip out the event",
    message: "The 1-week options include tomorrow's earnings day. Back out the move the market expects on the day itself.",
    blocks: [{ kind: "kv", items: [["1-week implied vol (5 trading days)", pct(iv, 0)], ["Normal-day vol", pct(normal, 0)], ["Days in a year", "252"]] }],
    q: { kind: "number", prompt: "Earnings-day move (1 s.d.)", unit: "%", answer: round(eventMove * 100, 2), tol: 0.4 },
    why: [
      `Variances add: total = ${num(iv, 2)}² × 5/252 = ${num((iv * iv * 5) / 252, 5)}.`,
      `Four normal days use ${num(normal, 2)}² × 4/252 = ${num((normal * normal * 4) / 252, 5)}.`,
      `The event day gets the rest: √(${num((iv * iv * 5) / 252 - (normal * normal * 4) / 252, 5)}) = ${pct(eventMove, 2)}.`,
    ],
    outcome: out,
  };
}

/* 15:00 — risk limits */
function limits(r: Rng, L: Level): Task {
  const out = stake(r.range(1500, 4000, 100), r.range(2000, 5000, 100), "Nora signs off. Clean afternoon.", "Nora escalates to Hugo; you spend the afternoon explaining.");
  if (L === "easy") {
    const V = r.range(30, 90, 5) * 1000;
    const lim = r.range(15, V / 1000 - 10, 5) * 1000;
    const per = r.range(0.1, 0.3, 0.01) * 100;
    const n = Math.ceil((V - lim) / per);
    return {
      time: "15:00",
      where: "Risk",
      from: NORA,
      title: "Over your vega limit",
      message: "You're over your vega limit. How many at-the-money options do you sell to get back inside?",
      blocks: [{ kind: "kv", items: [["Your vega", `${money(V)} per vol point`], ["Limit", money(lim)], ["Vega of one ATM option", `${money(per, 2)} per vol point (100 shares)`]] }],
      q: { kind: "number", prompt: "Options to sell", answer: n, tol: Math.max(1, n * 0.02) },
      why: [`You need to shed ${money(V - lim)} of vega: ${money(V - lim)} ÷ ${money(per, 2)} = ${num((V - lim) / per, 1)}, so ${n} options.`],
      outcome: out,
    };
  }
  const gamma = r.range(500, 3000, 100);
  const theta = -r.range(1000, 5000, 100);
  if (L === "medium") {
    const dS = r.range(0.5, 3, 0.1);
    const pnl = round(0.5 * gamma * dS * dS + theta, 0);
    return {
      time: "15:00",
      where: "Risk",
      from: NORA,
      title: "Long gamma, paying theta",
      message: `You're long gamma and delta-hedged. HALC moved ${money(dS, 2)} today. Roughly what did the position make?`,
      blocks: [{ kind: "kv", items: [["Gamma", `${num(gamma, 0)} shares per $1`], ["Theta", `${money(theta)} per day`], ["Today's move", money(dS, 2)]] }],
      q: { kind: "number", prompt: "Day's P&L", prefix: "$", answer: pnl, tol: Math.max(50, Math.abs(pnl) * 0.02) },
      why: [`Hedged gamma P&L ≈ ½ × Γ × ΔS² = ½ × ${num(gamma, 0)} × ${num(dS)}² = ${money(0.5 * gamma * dS * dS)}.`, `Add theta ${money(theta)}: ${signedMoney(pnl)}.`],
      outcome: out,
    };
  }
  const S = r.range(80, 200, 1);
  const iv = r.range(20, 50, 1) / 100;
  const be = round(Math.sqrt((2 * -theta) / gamma), 2);
  const implied = (S * iv) / Math.sqrt(252);
  return {
    time: "15:00",
    where: "Risk",
    from: NORA,
    title: "Your breakeven move",
    message: "You're long gamma and bleeding theta. How big a daily move do you need just to break even?",
    blocks: [{ kind: "kv", items: [["Gamma", `${num(gamma, 0)} shares per $1`], ["Theta", `${money(theta)} per day`], ["HALC", money(S)], ["Implied vol", pct(iv, 0)]] }],
    q: { kind: "number", prompt: "Breakeven daily move", prefix: "$", answer: be, tol: be * 0.02 },
    why: [
      `Break even when ½ × Γ × ΔS² = |θ|, so ΔS = √(2 × ${num(-theta, 0)} ÷ ${num(gamma, 0)}) = ${money(be, 2)}.`,
      `Implied vol prices a daily move of S × σ ÷ √252 = ${money(implied, 2)}: you ${implied > be ? "should earn your theta if it realises" : "need more movement than the market expects"}.`,
    ],
    outcome: out,
  };
}

/* 16:30 — explain the P&L */
function explain(r: Rng, L: Level): Task {
  const delta = r.sign() * r.range(1000, 6000, 100);
  const dS = r.sign() * r.range(0.3, 2.5, 0.05);
  const theta = -r.range(300, 2000, 50);
  const gamma = L === "easy" ? 0 : r.sign() * r.range(200, 1500, 50);
  const vega = L === "hard" ? r.sign() * r.range(5000, 25000, 500) : 0;
  const dVol = L === "hard" ? r.sign() * r.range(0.3, 2, 0.1) : 0;
  const predicted = delta * dS + 0.5 * gamma * dS * dS + vega * dVol + theta;
  const unexplained = L === "hard" ? r.sign() * r.range(500, 6000, 100) : 0;
  const actual = Math.round(predicted + unexplained);
  const terms = [
    `Delta ${num(delta, 0)} × ${num(dS)} = ${signedMoney(delta * dS)}`,
    ...(gamma ? [`Gamma ½ × ${num(gamma, 0)} × ${num(dS)}² = ${signedMoney(0.5 * gamma * dS * dS)}`] : []),
    ...(vega ? [`Vega ${num(vega, 0)} × ${num(dVol, 1)} = ${signedMoney(vega * dVol)}`] : []),
    `Theta ${signedMoney(theta)}`,
  ];
  const items: [string, string][] = [
    ["Delta at the open", `${num(delta, 0)} shares`],
    ...(gamma ? ([["Gamma", `${num(gamma, 0)} shares per $1`]] as [string, string][]) : []),
    ...(vega ? ([["Vega", `${money(vega)} per vol point`]] as [string, string][]) : []),
    ["Theta", `${money(theta)} per day`],
    ["HALC move today", money(dS, 2)],
    ...(vega ? ([["Implied vol change", `${dVol > 0 ? "+" : ""}${num(dVol, 1)} pts`]] as [string, string][]) : []),
    ...(L === "hard" ? ([["P&L reported by the system", signedMoney(actual)]] as [string, string][]) : []),
  ];
  const ask = L === "hard" ? unexplained : round(predicted, 0);
  return {
    time: "16:30",
    where: "End of day",
    from: HUGO,
    title: L === "hard" ? "Find the unexplained" : "Explain your P&L",
    message: L === "hard" ? "Your P&L doesn't match the Greeks. How much is unexplained? Risk will want to know before you leave." : "Before you go: what should today's P&L be, from your Greeks?",
    blocks: [{ kind: "kv", items }],
    q: { kind: "number", prompt: L === "hard" ? "Unexplained P&L" : "Expected P&L", prefix: "$", answer: ask, tol: Math.max(50, Math.abs(ask) * 0.02) },
    why: [
      ...terms,
      `Predicted from Greeks: ${signedMoney(predicted)}.`,
      ...(L === "hard" ? [`Reported ${signedMoney(actual)} − predicted ${signedMoney(predicted)} = ${signedMoney(unexplained)} unexplained: check for a missed trade, a stale mark or a dividend.`] : []),
    ],
    outcome: stake(r.range(1000, 2500, 100), r.range(1000, 3000, 100), "Hugo signs off your P&L. Good day.", "Your explain doesn't tie out; you stay late reconciling."),
  };
}

const TITLES: Record<Level, string[]> = {
  easy: ["First day on the desk", "Futures gap", "Earnings week", "Busy client day", "Friday close"],
  medium: ["CPI morning", "Index rebalance", "Vol crush", "Expiry week", "Month-end"],
  hard: ["Risk-off open", "Earnings after the bell", "Limit breach", "Event week", "Year-end review"],
};

export function traderTasks(r: Rng, L: Level): Task[] {
  return [preOpen, hedge, quote, rfq, event, limits, explain].map((f) => f(r, L));
}
export const traderTitle = (L: Level, i: number) => TITLES[L][i % 5];
