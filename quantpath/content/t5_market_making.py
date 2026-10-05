import numpy as np
import pandas as pd

from data import book_snapshots, order_flow

TITLE = "Market making and the order book"
SUMMARY = "Order books and matching, the bid–ask spread, adverse selection, inventory skew, microprice, and making markets in interviews."
KIND = "core"

LESSON = r"""
Market makers quote a bid and an ask all day and earn the spread, if they survive the two risks that come with it: trading against people who know more (**adverse selection**) and holding inventory while prices move (**inventory risk**). Graduate trader interviews test this directly with "make me a market" games.

## The limit order book

Resting limit orders sit at price levels; the best bid and best ask form the **top of book**. Matching uses **price–time priority**: better prices first, then earlier orders at the same price. An incoming order that crosses the spread trades at the **resting** order's price, taking liquidity, and any remainder of a limit order rests and provides liquidity. Queue position matters: being first at a price level gets you filled before others.

Useful top-of-book quantities:
- mid $= (b + a)/2$, spread $= a - b$
- order-book **imbalance** $I = \frac{q_b - q_a}{q_b + q_a}$
- **microprice** $= \frac{a\,q_b + b\,q_a}{q_b + q_a}$: leans toward the side with less depth, because heavy bid depth suggests the next move is up. A better short-term fair value than the mid.

## Why the spread exists: adverse selection (Glosten–Milgrom)

The asset is worth $V_H$ or $V_L$. A fraction α of traders know which; the rest trade randomly. A market maker who breaks even must set

$$\text{ask} = E[V \mid \text{a buy order arrives}], \qquad \text{bid} = E[V \mid \text{a sell order arrives}]$$

Buy orders are more likely when V is high, so the ask sits above the prior mean and the bid below. The spread widens with the share of informed traders, and every trade moves the market maker's belief: prices discover information through order flow.

## Inventory risk and skewing quotes

A market maker who gets long wants to sell, so they **shift both quotes down** (skew). That makes selling to them less attractive and buying from them more attractive. The Avellaneda–Stoikov model formalizes this with a **reservation price**

$$r = s - q\,\gamma\,\sigma^2 (T - t)$$

where q is inventory, γ risk aversion and σ volatility. Quotes centre on r, not on the mid. A larger position, higher volatility or a longer horizon means a bigger skew.

## P&L of a market maker

Two pieces: **spread capture** (selling above and buying below the mid) and **inventory P&L** (the mark-to-market of the position as the mid moves). Adverse selection shows up as negative inventory P&L right after fills: the market tends to move against you after you trade with informed flow. Measuring "markouts" (the mid change some time after each fill) is how real desks quantify it.

## Making a market in an interview

"Make me a market on the number of countries in Africa."
1. Form a central estimate and an honest uncertainty (≈ 50–55).
2. Quote a two-sided market around it, with a width that reflects that uncertainty: "48 at 58" means you buy at 48 and sell at 58.
3. When the interviewer trades, **update**: if they buy at 58, the true value is probably higher, so move your quotes up (adverse selection in real time).
4. Manage your position: if you get long, skew lower to encourage selling to you less and buying from you more.

Don't quote absurdly wide to avoid all risk; it signals you can't price. Tight and slightly wrong, then updated quickly, beats wide and useless.
"""

QUESTIONS = [
    {"type": "number", "prompt": "The best bid is 99 for 300 lots and the best ask is 101 for 100 lots. What is the microprice?",
     "answer": 100.5, "explanation": "(ask × bid_size + bid × ask_size)/(bid_size + ask_size) = (101 × 300 + 99 × 100)/400 = 100.5. It leans toward the ask, the thin side, because buying pressure is stronger."},
    {"type": "number", "prompt": "An asset is worth 100 or 110 with equal probability. 20% of traders know the value (they buy if it's 110 and sell if it's 100); the rest buy or sell at random. Where should a break-even market maker set the ask?",
     "answer": 106, "explanation": "P(buy | 110) = 0.2 + 0.8 × 0.5 = 0.6 and P(buy | 100) = 0.4, so P(110 | buy) = 0.6. Ask = E[V | buy] = 100 + 0.6 × 10 = 106 (and the bid is 104 by symmetry)."},
    {"type": "number", "prompt": "Avellaneda–Stoikov: mid 100, inventory +5, risk aversion γ = 0.1, variance σ² = 4 per unit time, time remaining 0.5. What is the reservation price?",
     "answer": 99, "explanation": "r = s − qγσ²(T − t) = 100 − 5 × 0.1 × 4 × 0.5 = 99. Being long lowers the price at which you're happy to trade."},
    {"type": "choice", "prompt": "You're making a market and have built up a large long position. How should you adjust your quotes?",
     "choices": ["Lower both bid and ask", "Raise both bid and ask", "Widen the spread symmetrically", "Stop quoting the bid only"],
     "answer": 0, "explanation": "Skew down: a lower ask attracts buyers (reducing your long), and a lower bid makes it less likely you buy more."},
    {"type": "number", "prompt": "You buy 100 shares at 99.98 and later sell 100 shares at 100.02, with the mid unchanged at 100.00. What is your profit in dollars?",
     "answer": 4, "explanation": "You earn 0.04 per share round trip: 100 × 0.04 = $4. That's pure spread capture."},
    {"type": "choice", "prompt": "What is adverse selection, for a market maker?",
     "choices": ["Being more likely to trade with counterparties who know the price is about to move against you",
                 "Choosing the wrong stocks to quote", "Getting filled at worse prices because of latency", "Holding inventory overnight"],
     "answer": 0, "explanation": "Informed traders hit your bid before the price falls and lift your ask before it rises. The spread must compensate for those losses."},
    {"type": "choice", "prompt": "In Glosten–Milgrom, what happens to the equilibrium spread if the fraction of informed traders rises?",
     "choices": ["It widens", "It narrows", "It doesn't change", "It becomes negative"],
     "answer": 0, "explanation": "Each trade then carries more information about V, so the conditional expectations E[V|buy] and E[V|sell] move further apart."},
    {"type": "open", "prompt": "Make me a market on the number of countries in Africa. Then I buy at your offer. What do you do next?",
     "explanation": "Centre around my estimate (~54) with a width reflecting my uncertainty: say 48 at 58. When you buy at 58, that's information: you think it's higher. I move up, e.g. 55 at 62, and note that I'm now short one unit, so I lean higher still to attract sellers rather than buyers. The interviewer is checking that I give a usable market, update on trades, and manage risk, not that I know the number (54)."},
]


def _events_small():
    return [
        {"type": "limit", "id": 1, "side": "sell", "price": 101.0, "qty": 5},
        {"type": "limit", "id": 2, "side": "sell", "price": 102.0, "qty": 5},
        {"type": "limit", "id": 3, "side": "buy", "price": 99.0, "qty": 4},
        {"type": "limit", "id": 4, "side": "sell", "price": 101.0, "qty": 3},
        {"type": "limit", "id": 5, "side": "buy", "price": 101.5, "qty": 7},   # takes 5 from id 1, 2 from id 4
        {"type": "cancel", "id": 3},
        {"type": "market", "id": 6, "side": "sell", "qty": 2},                  # no bids left: nothing happens
        {"type": "limit", "id": 7, "side": "buy", "price": 100.0, "qty": 6},
        {"type": "market", "id": 8, "side": "buy", "qty": 4},                   # takes 1 from id 4, 3 from id 2
    ]


def _events_random(n, seed):
    rng = np.random.default_rng(seed)
    events, live = [], []
    for i in range(n):
        u = rng.random()
        if u < 0.15 and live:
            events.append({"type": "cancel", "id": int(rng.choice(live))})
        elif u < 0.3:
            events.append({"type": "market", "id": 10_000 + i, "side": str(rng.choice(["buy", "sell"])), "qty": int(rng.integers(1, 10))})
        else:
            side = str(rng.choice(["buy", "sell"]))
            price = round(100 + (-1 if side == "buy" else 1) * 0.01 * int(rng.integers(-2, 8)), 2)
            events.append({"type": "limit", "id": i, "side": side, "price": price, "qty": int(rng.integers(1, 20))})
            live.append(i)
    return events


_GM = '''def gm_quotes(trades, v_low: float, v_high: float, p0: float, alpha: float) -> pd.DataFrame:
    p, rows = p0, []
    buy_h, buy_l = alpha + (1 - alpha) / 2, (1 - alpha) / 2      # P(buy | V high), P(buy | V low)
    for side in trades:
        p_h_buy = p * buy_h / (p * buy_h + (1 - p) * buy_l)
        p_h_sell = p * (1 - buy_h) / (p * (1 - buy_h) + (1 - p) * (1 - buy_l))
        rows.append((p, v_low + (v_high - v_low) * p_h_sell, v_low + (v_high - v_low) * p_h_buy))
        p = p_h_buy if side > 0 else p_h_sell
    return pd.DataFrame(rows, columns=["p_high", "bid", "ask"])
'''

PROBLEMS = [
    {
        "id": "t5_order_book",
        "title": "A price–time priority matching engine",
        "difficulty": "Hard",
        "libs": ["collections"],
        "fn": "match_orders",
        "description": r"""
Process a list of events through a limit order book and return what happened. Events are dicts:

- `{"type": "limit", "id", "side": "buy"/"sell", "price", "qty"}`: match against the opposite side while prices cross (a buy matches asks priced ≤ its limit), then rest any remainder on the book
- `{"type": "market", "id", "side", "qty"}`: match against the opposite side at any price; discard any remainder
- `{"type": "cancel", "id"}`: remove that resting order if it's still on the book (otherwise ignore)

Matching follows **price–time priority**: best price first (lowest ask, highest bid), and within a price the earliest resting order first. Every fill trades at the **resting** order's price.

Return a dict:
- `trades`: list of `(taker_id, maker_id, price, qty)` tuples, in the order they happen
- `bids`: list of `(price, total_qty)` for the remaining bids, best (highest) first
- `asks`: list of `(price, total_qty)` for the remaining asks, best (lowest) first

### Learn
A dict mapping price → `deque` of `[order_id, qty]` per side keeps FIFO order within a level; recompute the best price with `min`/`max` over the keys (fine at this size; production engines use sorted structures or heaps). Keep an `id → (side, price)` map to find orders to cancel.

Walk through the first test by hand before coding: it covers a partial fill across two price levels, a cancel, a market order with no liquidity, and a market buy that sweeps two levels.
""",
        "starter": '''from collections import deque


def match_orders(events: list) -> dict:
    # return {"trades": [...], "bids": [...], "asks": [...]}
    pass
''',
        "solution": '''from collections import deque


def match_orders(events: list) -> dict:
    book = {"buy": {}, "sell": {}}        # side -> price -> deque of [id, qty]
    where, trades = {}, []
    for ev in events:
        if ev["type"] == "cancel":
            if ev["id"] in where:
                side, price = where.pop(ev["id"])
                level = book[side][price]
                for k, (oid, _) in enumerate(level):
                    if oid == ev["id"]:
                        del level[k]
                        break
                if not level:
                    del book[side][price]
            continue
        side, qty = ev["side"], ev["qty"]
        other = "sell" if side == "buy" else "buy"
        while qty > 0 and book[other]:
            best = min(book[other]) if side == "buy" else max(book[other])
            if ev["type"] == "limit" and (best > ev["price"] if side == "buy" else best < ev["price"]):
                break
            level = book[other][best]
            maker = level[0]
            fill = min(qty, maker[1])
            trades.append((ev["id"], maker[0], best, fill))
            qty -= fill
            maker[1] -= fill
            if maker[1] == 0:
                level.popleft()
                where.pop(maker[0], None)
                if not level:
                    del book[other][best]
        if ev["type"] == "limit" and qty > 0:
            book[side].setdefault(ev["price"], deque()).append([ev["id"], qty])
            where[ev["id"]] = (side, ev["price"])
    level_sizes = lambda side: {p: sum(q for _, q in lvl) for p, lvl in book[side].items()}
    return {"trades": trades,
            "bids": sorted(level_sizes("buy").items(), reverse=True),
            "asks": sorted(level_sizes("sell").items())}
''',
        "hints": ["Handle the three event types separately; limit and market orders share the matching loop.",
                  "A limit buy stops matching as soon as the best ask is above its price."],
        "cases": lambda: [
            {"name": "hand-made scenario", "sample": True, "args": (_events_small(),)},
            {"name": "300 random events", "args": (_events_random(300, 1),)},
            {"name": "1,000 random events", "args": (_events_random(1000, 2),)},
        ],
    },
    {
        "id": "t5_book_features",
        "title": "Mid, spread, imbalance and microprice",
        "difficulty": "Easy",
        "libs": ["pandas"],
        "fn": "book_features",
        "description": r"""
Given top-of-book snapshots (a DataFrame with columns `bid`, `ask`, `bid_size`, `ask_size`), return a DataFrame with the same index and columns:

- `mid` = (bid + ask)/2
- `spread` = ask − bid
- `imbalance` = (bid_size − ask_size)/(bid_size + ask_size)
- `microprice` = (ask × bid_size + bid × ask_size)/(bid_size + ask_size)

### Learn
All four are one-line vectorized expressions. In research, imbalance is one of the most reliable very-short-horizon predictors of the next mid move. Test that in a notebook: correlate today's imbalance with the next snapshot's mid change on `data.book_snapshots()` data (this synthetic data has no such effect, so you'll see ~0; on real data it's clearly positive).
""",
        "starter": '''import pandas as pd


def book_features(book: pd.DataFrame) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import pandas as pd


def book_features(book: pd.DataFrame) -> pd.DataFrame:
    b, a, qb, qa = book["bid"], book["ask"], book["bid_size"], book["ask_size"]
    return pd.DataFrame({"mid": (b + a) / 2, "spread": a - b, "imbalance": (qb - qa) / (qb + qa),
                         "microprice": (a * qb + b * qa) / (qb + qa)})
''',
        "hints": ["Pull the four columns into variables first; the formulas then read like the definitions."],
        "cases": lambda: [
            {"name": "3 snapshots", "sample": True, "args": (book_snapshots(3, seed=1),)},
            {"name": "500 snapshots", "args": (book_snapshots(500, seed=2),)},
        ],
    },
    {
        "id": "t5_gm",
        "title": "Glosten–Milgrom: quotes that learn from order flow",
        "difficulty": "Medium",
        "libs": ["pandas"],
        "fn": "gm_quotes",
        "description": r"""
The asset is worth `v_high` or `v_low`; the market maker's current belief is P(high) = `p0`. A fraction `alpha` of traders are informed (they buy when the value is high and sell when it's low); the rest buy or sell with probability ½. Process the observed `trades` (+1 = buy order, −1 = sell order) one at a time. For each trade:

1. Quote, **before** seeing it: `ask` = E[V | buy] and `bid` = E[V | sell] under the current belief (Bayes)
2. Record `(p_high, bid, ask)`
3. Update the belief to P(high | the observed trade)

Return a DataFrame with columns `p_high`, `bid`, `ask`, one row per trade.

### Learn
$P(\text{buy} \mid H) = \alpha + \frac{1-\alpha}{2}$ and $P(\text{buy} \mid L) = \frac{1-\alpha}{2}$. Then $P(H \mid \text{buy}) = \frac{p\,P(\text{buy}|H)}{p\,P(\text{buy}|H) + (1-p)\,P(\text{buy}|L)}$, and similarly for sells.

Run it on a long sequence where most trades are buys: the quotes climb toward `v_high` and the spread **narrows** as the market maker becomes confident. Prices absorb information through trading; that's the essence of price discovery.
""",
        "starter": '''import pandas as pd


def gm_quotes(trades, v_low: float, v_high: float, p0: float, alpha: float) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import pandas as pd\n\n\n" + _GM,
        "hints": ["Write P(H|buy) and P(H|sell) as two lines of Bayes, then the quotes are v_low + (v_high − v_low) × probability."],
        "cases": lambda: [
            {"name": "the lesson's example, 3 trades", "sample": True, "args": ([1, 1, -1], 100, 110, 0.5, 0.2)},
            {"name": "mostly buys", "args": (list(np.where(np.random.default_rng(1).random(40) < 0.75, 1, -1)), 50, 60, 0.5, 0.3)},
            {"name": "skeptical prior, few informed", "args": ([1, -1, 1, 1, -1, 1, 1, 1], 0, 1, 0.2, 0.1)},
        ],
    },
    {
        "id": "t5_mm_sim",
        "title": "Simulate a market maker with inventory skew",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "market_maker",
        "description": r"""
Simulate a market maker who quotes around the public mid. Inputs: `mid` (array of public prices), `side` (array: +1 = a buyer arrives, −1 = a seller arrives, 0 = nothing), `half_spread` h, `skew` k, `max_inv` Q, and optionally `limit` (array: how far from the mid each arriving order is willing to trade). Starting flat with zero cash, at each step t:

1. quote `bid = mid[t] − h − k·inv` and `ask = mid[t] + h − k·inv`
2. if side is +1, inv > −Q and (no `limit` given or `ask − mid[t] ≤ limit[t]`): sell 1 at the ask (inv −= 1, cash += ask); if side is −1, inv < Q and (no `limit` or `mid[t] − bid ≤ limit[t]`): buy 1 at the bid (inv += 1, cash −= bid)
3. mark to market: `pnl = cash + inv · mid[t]`

Return a DataFrame (RangeIndex) with columns `bid`, `ask` (the quotes at t), `inventory`, `cash` and `pnl` (after any trade at t).

### Learn
The skew term moves both quotes against your inventory: long means lower quotes, so your ask sits closer to the mid and gets lifted more often, while your bid gets hit less. Q is a hard risk limit (stop quoting the side that would breach it). The `limit` column of `data.order_flow` is what makes the spread a real trade-off: a wider quote earns more per trade but fewer orders are willing to pay it.

Try `data.order_flow(alpha=0.0)` (pure noise traders) against `alpha=0.5`. With no informed flow the P&L grinds up with the spread; with lots of informed flow it bleeds, and the project's next step measures why.
""",
        "starter": '''import numpy as np
import pandas as pd


def market_maker(mid, side, half_spread: float, skew: float, max_inv: int, limit=None) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def market_maker(mid, side, half_spread: float, skew: float, max_inv: int, limit=None) -> pd.DataFrame:
    mid = np.asarray(mid, dtype=float)
    limit = np.full(len(mid), np.inf) if limit is None else np.asarray(limit, dtype=float)
    inv, cash, rows = 0, 0.0, []
    for m, s, lim in zip(mid, np.asarray(side), limit):
        bid = m - half_spread - skew * inv
        ask = m + half_spread - skew * inv
        if s > 0 and inv > -max_inv and ask - m <= lim:
            inv -= 1
            cash += ask
        elif s < 0 and inv < max_inv and m - bid <= lim:
            inv += 1
            cash -= bid
        rows.append((bid, ask, inv, cash, cash + inv * m))
    return pd.DataFrame(rows, columns=["bid", "ask", "inventory", "cash", "pnl"])
''',
        "hints": ["Compute both quotes from the inventory *before* the trade at step t."],
        "cases": lambda: [
            {"name": "hand-made flow", "sample": True, "args": ([100, 100, 100.1, 100.2, 100.1], [1, 1, -1, 0, -1], 0.05, 0.01, 5)},
            {"name": "noise traders only", "args": (order_flow(2000, alpha=0.0, seed=1)["mid"], order_flow(2000, alpha=0.0, seed=1)["side"], 0.03, 0.005, 20)},
            {"name": "heavy informed flow", "args": (order_flow(2000, alpha=0.5, seed=2)["mid"], order_flow(2000, alpha=0.5, seed=2)["side"], 0.03, 0.005, 20)},
            {"name": "orders with limits", "args": (order_flow(2000, alpha=0.3, seed=3)["mid"], order_flow(2000, alpha=0.3, seed=3)["side"], 0.04, 0.005, 20,
                                                    order_flow(2000, alpha=0.3, seed=3)["limit"])},
        ],
    },
]
