import { money, normCdf, num, pct, round, signedMoney, stake, type Answer, type Level, type Outcome, type Person, type Rng, type Task } from "./core";

/** An options market-making desk, making markets in the options of one stock: Halcyon Systems (HALC). */

const HUGO: Person = { name: "Hugo", role: "Head of desk" };
const NORA: Person = { name: "Nora", role: "Risk manager" };
const FELIX: Person = { name: "Felix", role: "Sales trader" };

const toNum = (a: Answer) => (typeof a === "number" ? a : typeof a === "string" ? parseFloat(a.replace(/[,$%\s]/g, "").replace(/[−–]/g, "-")) : NaN);
/** Vega per share per vol point. */
function vegaOf(S: number, K: number, vol: number, days: number) {
  const T = days / 365;
  const d1 = (Math.log(S / K) + 0.5 * vol * vol * T) / (vol * Math.sqrt(T));
  return (S * Math.exp((-d1 * d1) / 2) * Math.sqrt(T)) / Math.sqrt(2 * Math.PI) / 100;
}
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

/* 07:30 — mark the vol */
function preOpen(r: Rng, L: Level, S: number, gap: number): Task {
  const out = stake(r.range(1500, 3500, 100), r.range(1500, 4000, 100), "Your marks were in line: the first trades went through at your levels.", "Your marks were off: the first clients traded against you at the open.");
  if (L === "easy") {
    const days = r.pick([30, 61, 91]);
    const vol = r.range(18, 45, 1) / 100;
    const straddle = round(0.8 * vol * S * Math.sqrt(days / 365), 2);
    const implied = round((straddle / (0.8 * S * Math.sqrt(days / 365))) * 100, 1);
    return {
      time: "07:30",
      where: "Pre-market",
      from: HUGO,
      title: "Mark the ATM vol",
      message: `Before the open I want your ATM vol mark. The ${days}-day at-the-money straddle is trading at ${money(straddle, 2)}.`,
      blocks: [{ kind: "kv", items: [["HALC", money(S, 2)], ["ATM straddle", money(straddle, 2)], ["Expiry", `${days} days`]] }],
      q: { kind: "number", prompt: "ATM implied vol", unit: "%", answer: implied, tol: 0.5 },
      why: [
        "An at-the-money straddle is worth about 0.8 × σ × S × √T.",
        `So σ = straddle ÷ (0.8 × S × √T) = ${num(straddle)} ÷ (0.8 × ${num(S)} × √(${days}/365)) = ${num(implied, 1)}%.`,
      ],
      outcome: out,
    };
  }
  const atm = r.range(18, 40, 0.5);
  if (L === "medium") {
    const put = round(atm + r.range(1.5, 6, 0.5), 1);
    const call = round(atm + r.range(-2, 1, 0.5), 1);
    const askRR = r.next() < 0.5;
    const rr = round(call - put, 2);
    const bf = round((call + put) / 2 - atm, 2);
    return {
      time: "07:30",
      where: "Pre-market",
      from: HUGO,
      title: askRR ? "Read the skew" : "Read the wings",
      message: askRR
        ? "Here are this morning's 1-month marks. Give me the 25-delta risk reversal: that's how we quote skew."
        : "Here are this morning's 1-month marks. Give me the 25-delta butterfly: that's how we quote the wings.",
      blocks: [{ kind: "table", head: ["", "25Δ put", "ATM", "25Δ call"], rows: [["Implied vol", `${num(put, 1)}%`, `${num(atm, 1)}%`, `${num(call, 1)}%`]] }],
      q: { kind: "number", prompt: askRR ? "25Δ risk reversal" : "25Δ butterfly", unit: " vol pts", answer: askRR ? rr : bf, tol: 0.05 },
      why: askRR
        ? [`Risk reversal = call vol − put vol = ${num(call, 1)} − ${num(put, 1)} = ${num(rr, 1)}.`, "Negative is normal for stocks: downside puts are bid for protection."]
        : [`Butterfly = average of the wings − ATM = (${num(call, 1)} + ${num(put, 1)}) ÷ 2 − ${num(atm, 1)} = ${num(bf, 2)}.`, "It measures how much richer the wings are than the middle: the market's fear of big moves."],
      outcome: out,
    };
  }
  const S0 = Math.round(S);
  const S1 = round(S * (1 + gap), 2);
  const move = S1 / S0 - 1;
  const k = r.range(0.3, 0.8, 0.05);
  const sticky = round(atm - k * (S0 / S1 - 1) * 100, 2);
  return {
    time: "07:30",
    where: "Pre-market",
    from: HUGO,
    title: "Sticky strike or sticky delta?",
    message: `HALC is indicated ${move > 0 ? "up" : "down"} ${pct(Math.abs(move))}. If the surface moves sticky-delta, where should yesterday's ATM strike (${S0}) be marked?`,
    blocks: [
      {
        kind: "kv",
        items: [
          ["Yesterday's spot = strike", money(S0)],
          ["Spot indicated", money(S1, 2)],
          ["Yesterday's ATM vol", `${num(atm, 1)}%`],
          ["Skew", `vol falls ${num(k, 2)} pts per 1% the strike is above spot`],
        ],
      },
    ],
    q: { kind: "number", prompt: `${S0} strike vol, sticky-delta`, unit: "%", answer: sticky, tol: 0.1 },
    why: [
      `Sticky-strike would leave the ${S0} strike at ${num(atm, 1)}%. Sticky-delta keeps vol fixed by moneyness instead.`,
      `The ${S0} strike is now ${pct(S0 / S1 - 1, 2)} ${S0 > S1 ? "above" : "below"} spot, so its vol = ${num(atm, 1)} − ${num(k, 2)} × ${num((S0 / S1 - 1) * 100, 2)} = ${num(sticky, 2)}%.`,
      "Real equity surfaces usually land somewhere between the two: knowing both brackets your marks.",
    ],
    outcome: out,
  };
}

/* 08:15 — flatten the delta */
function hedge(r: Rng, L: Level, S: number, gap: number): Task {
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
  const move = L === "hard" ? gap : 0;
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

/* 09:30 — make a market in an option */
function quote(r: Rng, L: Level, S: number): Task {
  const K = Math.round(S / 5) * 5;
  const days = r.pick([30, 45, 61]);
  const vol = r.range(20, 45, 1) / 100;
  const theo = round(bsCall(S, K, vol, days), 2);
  const vega = vegaOf(S, K, vol, days);
  const hw = Math.max(0.05, round(theo * 0.02, 2));
  const inv = r.range(2, 6, 1) * 1000 * r.sign();
  const shadeVol = 0.3 * (inv / 1000);
  const mid = round(theo - shadeVol * vega, 2);
  const size = r.range(100, 500, 100);
  const hwSize = round(hw + theo * 0.01 * (size / 100), 2);
  const q2 = (m: number, h: number) => `${num(m - h)} × ${num(m + h)}`;
  const win = Math.round(size * 100 * hw * 0.5);
  const lose = Math.round(size * 100 * Math.max(0.05, theo * 0.03));
  const out = stake(win, lose, `The client traded on your quote and you hedged the Greeks: about ${money(win)} of edge.`, `Your quote was off: the client hit the cheap side. It cost ${money(lose)} to hedge out.`);
  const blocks = [
    {
      kind: "kv" as const,
      items: [
        ["Option", `HALC ${K} call, ${days} days`],
        ["Theoretical value", money(theo, 2)],
        ["Vega", `${num(vega, 3)} per vol pt`],
        ...(L !== "easy" ? ([["Your vega inventory", `${inv > 0 ? "long" : "short"} ${num(Math.abs(inv), 0)} vega`]] as [string, string][]) : []),
        ...(L === "hard" ? ([["Client size", `${size} contracts`]] as [string, string][]) : []),
      ] as [string, string][],
    },
    {
      kind: "text" as const,
      text:
        L === "easy"
          ? "Desk rule: half-width = 2% of theo, at least 5¢, centred on theo."
          : L === "medium"
            ? "Desk rules: half-width 2% of theo (min 5¢); shade 0.3 vol pts per 1,000 vega of inventory."
            : "Desk rules: half-width 2% of theo (min 5¢), plus 1% of theo per 100 contracts of size; shade 0.3 vol pts per 1,000 vega of inventory.",
    },
  ];
  const shadeWhy = `You're ${inv > 0 ? "long" : "short"} ${num(Math.abs(inv), 0)} vega, so shade ${inv > 0 ? "down" : "up"} ${num(Math.abs(shadeVol), 1)} vol pts × ${num(vega, 3)} vega = ${num(Math.abs(shadeVol * vega), 3)}: mid = ${num(theo)} ${inv > 0 ? "−" : "+"} ${num(Math.abs(shadeVol * vega), 2)} = ${num(mid)}.`;
  if (L === "easy") {
    const right = q2(theo, hw);
    return {
      time: "09:30",
      where: "The open",
      from: FELIX,
      title: "Quote an option",
      message: `Client wants a two-way in the HALC ${K} calls. What do you show?`,
      blocks,
      q: { kind: "choice", prompt: "Your quote (bid × ask)", options: shuffle(r, [right, q2(theo + hw, hw), q2(theo, 0.01), q2(theo, round(4 * hw, 2))]), answer: right },
      why: [`Half-width = max(5¢, 2% × ${num(theo)}) = ${num(hw)}.`, `Centred on theo: ${right}. Too tight and you're picked off; too wide and the client goes elsewhere.`],
      outcome: out,
    };
  }
  if (L === "medium")
    return {
      time: "09:30",
      where: "The open",
      from: FELIX,
      title: "Quote with inventory",
      message: `Client wants a two-way in the HALC ${K} calls. You already carry vega. Where do you centre the quote?`,
      blocks,
      q: { kind: "number", prompt: "Mid of your quote", prefix: "$", answer: mid, tol: 0.01 },
      why: [shadeWhy, inv > 0 ? "Shading down makes your offer attractive: you'd rather sell vega you're long." : "Shading up makes your bid attractive: you'd rather buy back vega you're short."],
      outcome: out,
    };
  const right = q2(mid, hwSize);
  return {
    time: "09:30",
    where: "The open",
    from: FELIX,
    title: "Quote size, with inventory",
    message: `Client wants a two-way in ${size} HALC ${K} calls. You carry vega. What do you show?`,
    blocks,
    q: {
      kind: "choice",
      prompt: "Your quote (bid × ask)",
      options: shuffle(r, [right, q2(mid, hw), q2(round(theo + shadeVol * vega, 2), hwSize), q2(theo, hwSize)]),
      answer: right,
    },
    why: [shadeWhy, `Size widens the half-width: ${num(hw)} + 1% × ${num(theo)} × ${size / 100} = ${num(hwSize)}.`, `Quote ${right}.`],
    outcome: out,
  };
}

/* 11:00 — price a client request */
function rfq(r: Rng, L: Level, S: number): Task {
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
function event(r: Rng, L: Level, S: number): Task {
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
function limits(r: Rng, L: Level, S: number): Task {
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
  const iv = r.range(20, 50, 1) / 100;
  const be = round(Math.sqrt((2 * -theta) / gamma), 2);
  const implied = (S * iv) / Math.sqrt(252);
  return {
    time: "15:00",
    where: "Risk",
    from: NORA,
    title: "Your breakeven move",
    message: "You're long gamma and bleeding theta. How big a daily move do you need just to break even?",
    blocks: [{ kind: "kv", items: [["Gamma", `${num(gamma, 0)} shares per $1`], ["Theta", `${money(theta)} per day`], ["HALC", money(S, 2)], ["Implied vol", pct(iv, 0)]] }],
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
  easy: ["First day on the options desk", "Marking the surface", "Earnings week", "Busy client day", "Friday expiry"],
  medium: ["Skew Monday", "Vol crush", "Expiry week", "Vega heavy", "Month-end marks"],
  hard: ["Sticky strike or sticky delta?", "Earnings after the bell", "Limit breach", "Event week", "Year-end vol review"],
};

export function traderTasks(r: Rng, L: Level): Task[] {
  // One stock price for the whole day: yesterday's close, an indicated gap, and the price after the open.
  const close = r.range(60, 240, 0.5);
  const gap = (r.sign() * r.range(1, 4, 0.5)) / 100;
  const spot = round(close * (1 + gap), 2);
  return [
    preOpen(r, L, close, gap),
    hedge(r, L, close, gap),
    quote(r, L, spot),
    rfq(r, L, spot),
    event(r, L, spot),
    limits(r, L, spot),
    explain(r, L),
  ];
}
export const traderTitle = (L: Level, i: number) => TITLES[L][i % 5];
