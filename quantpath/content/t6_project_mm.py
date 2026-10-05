import numpy as np
import pandas as pd

from data import order_flow

TITLE = "Project: market-maker simulator"
SUMMARY = "Run a quoting strategy against informed and uninformed flow, split P&L into spread capture and inventory, measure adverse selection, and tune it."
KIND = "project"

LESSON = r"""
This project turns the market-making theory into the analysis a desk actually runs. You'll reuse your simulator from the previous step (`from t5_mm_sim import market_maker`) and answer three questions: **where does the P&L come from, who is hurting us, and which parameters work best?**

## The setup

`data.order_flow(n, alpha, ...)` generates a public mid that moves ±σ each step, and market orders that arrive with probability `arrival`. A fraction `alpha` of them are **informed**: they buy right before the price rises and sell right before it falls. The rest are noise traders. Each order also has a `limit`, the furthest from the mid it will trade: noise traders' limits are random (mean 0.04), while informed traders will pay up to σ, the move they know is coming. You quote around the mid with a half-spread h, an inventory skew k and an inventory limit Q, and an order trades with you only if your quote is within its limit.

## What you build

1. **P&L attribution**: split each step's P&L change into **spread capture** (the edge earned at the moment of a fill, relative to the mid) and **inventory P&L** (yesterday's position times the mid's move). They must add up to the total exactly; that identity is your test.
2. **Markouts**: for every fill, how far did the mid move in your favour h steps later? Average them separately for informed and uninformed fills. Negative markouts on informed flow are adverse selection made visible.
3. **Parameter sweep**: a grid of half-spreads × skews, scored by the risk-adjusted P&L. You'll see the trade-off: a wide spread earns more per fill but gets fewer fills; a strong skew reduces inventory risk but gives away edge.
4. **Avellaneda–Stoikov quotes**: the optimal reservation price and spread from the theory, so you can compare the model's suggestion with your grid search.
5. **The desk report**: one call that tunes the quotes, runs the simulator with the winners, attributes the P&L and measures adverse selection.

```text
order flow + your simulator
  ↓ Part 1  P&L attribution: spread capture versus inventory
  ↓ Part 2  markouts: adverse selection by flow type
  ↓ Part 3  sweep half-spread × skew for the best risk-adjusted P&L
  ↓ Part 4  Avellaneda–Stoikov quotes: what the theory suggests
  ↓ Part 5  desk report: tune, rerun, attribute, check adverse selection
```

## Questions to answer in a notebook

- How does total P&L change as `alpha` goes from 0 to 0.6, for a fixed spread? At what alpha does market making stop paying?
- Does skewing reduce the standard deviation of inventory? Of P&L?
- What's the average markout of informed vs uninformed fills? How does widening the spread change the balance?

## Interview angle

"How do you make money as a market maker, and what can go wrong?" Answer in exactly these terms: spread capture minus adverse selection minus inventory costs, managed with quotes that skew against your position and widen when flow looks informed or volatility rises.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "Your market-making P&L shows strong spread capture but large negative inventory P&L right after fills. What is the most likely cause?",
     "choices": ["Adverse selection: you're trading with informed flow", "Your spread is too wide", "Your inventory limit is too small", "Rounding in the P&L calculation"],
     "answer": 0, "explanation": "If the market systematically moves against your position right after you trade, the people trading with you know something. Widen spreads, skew faster, or avoid quoting when signals suggest informed flow."},
    {"type": "number", "prompt": "You buy at the bid 99.97 when the mid is 100.00. Five seconds later the mid is 99.95. What is the 5-second markout per share (positive means good for you)?",
     "answer": -0.02, "explanation": "Markout = (mid later − fill price) × direction = (99.95 − 99.97) × (+1) = −0.02. You earned 0.03 of spread at the fill, then the price fell 0.05."},
    {"type": "open", "prompt": "A market maker earns 0.02 per share in spread on average but loses 0.015 per share to adverse selection and pays 0.003 in fees. How would you improve the business?",
     "explanation": "Net edge is only 0.002 per share, which is fragile. Levers: reduce adverse selection (detect toxic flow from venue, size or timing and widen or step back; trade faster; use microprice instead of mid as fair value), improve fill quality (queue position, smarter skewing), negotiate fees or capture rebates, and keep inventory tight to avoid carrying losses. Always measure markouts by flow segment to see where the losses come from."},
]


_MM = '''def market_maker(mid, side, half_spread, skew, max_inv, limit=None):
    mid = np.asarray(mid, dtype=float)
    limit = np.full(len(mid), np.inf) if limit is None else np.asarray(limit, dtype=float)
    inv, cash, rows = 0, 0.0, []
    for m, s, lim in zip(mid, np.asarray(side), limit):
        bid, ask = m - half_spread - skew * inv, m + half_spread - skew * inv
        if s > 0 and inv > -max_inv and ask - m <= lim:
            inv, cash = inv - 1, cash + ask
        elif s < 0 and inv < max_inv and m - bid <= lim:
            inv, cash = inv + 1, cash - bid
        rows.append((bid, ask, inv, cash, cash + inv * m))
    return pd.DataFrame(rows, columns=["bid", "ask", "inventory", "cash", "pnl"])
'''


def _flow_sim(n, alpha, seed, h=0.03, k=0.005, q=20):
    flow = order_flow(n, alpha=alpha, seed=seed)
    ns = {"np": np, "pd": pd}
    exec(_MM, ns)
    return ns["market_maker"](flow["mid"], flow["side"], h, k, q, flow["limit"]), flow

def _hand_sim():
    ns = {"np": np, "pd": pd}
    exec(_MM, ns)
    return ns["market_maker"]([100.0, 100.0, 100.1, 100.2, 100.1], [1, 1, -1, 0, -1], 0.05, 0.01, 5)


PROBLEMS = [
    {
        "id": "t6_attribution",
        "title": "Part 1 · P&L attribution: spread versus inventory",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "pnl_attribution",
        "description": r"""
`sim` is the output of your market-maker simulation (columns `bid`, `ask`, `inventory`, `cash`, `pnl`) and `mid` the public price at each step. Return a DataFrame with the same index and columns:

- `spread`: at a step where you bought (inventory rose), `mid − bid`; where you sold (inventory fell), `ask − mid`; otherwise 0
- `inventory`: the previous step's inventory × (mid[t] − mid[t−1]), and 0 at the first step
- `total`: spread + inventory

Exact check: `total.cumsum()` equals `sim["pnl"]`.

### Learn
Derive it once: $\text{pnl}_t = \text{cash}_t + q_t m_t$, and a buy at the bid changes cash by $-b_t$ and inventory by +1, so $\Delta\text{pnl}_t = (m_t - b_t) + q_{t-1}(m_t - m_{t-1})$. Sells are symmetric.

On flow with lots of informed traders, spread P&L is steadily positive while inventory P&L is persistently negative: you earn the spread and give it back to people who know where the price is going.
""",
        "starter": '''import numpy as np
import pandas as pd


def pnl_attribution(sim: pd.DataFrame, mid) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def pnl_attribution(sim: pd.DataFrame, mid) -> pd.DataFrame:
    m = pd.Series(np.asarray(mid, dtype=float), index=sim.index)
    dq = sim["inventory"].diff().fillna(sim["inventory"])
    spread = np.where(dq > 0, m - sim["bid"], np.where(dq < 0, sim["ask"] - m, 0.0))
    inventory = (sim["inventory"].shift(1, fill_value=0) * m.diff().fillna(0.0)).to_numpy()
    return pd.DataFrame({"spread": spread, "inventory": inventory, "total": spread + inventory}, index=sim.index)
''',
        "hints": ["A change in inventory tells you whether (and which way) you traded at step t.",
                  "`shift(1, fill_value=0)` gives yesterday's inventory with 0 before the start."],
        "cases": lambda: [
            {"name": "short hand-made run", "sample": True, "args": (_hand_sim(), [100.0, 100.0, 100.1, 100.2, 100.1])},
            {"name": "informed flow", "args": (_flow_sim(3000, 0.4, 1)[0], _flow_sim(3000, 0.4, 1)[1]["mid"])},
        ],
    },
    {
        "id": "t6_markouts",
        "title": "Part 2 · Markouts: measuring adverse selection",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "markouts",
        "description": r"""
For every fill in `sim` (a step where inventory changed), compute the markout over `horizon` steps:

$$\text{markout} = (m_{t+h} - \text{fill price}) \times d$$

where d = +1 if you bought (fill price = bid) and −1 if you sold (fill price = ask). Only use fills with $t + h$ inside the data. `informed` is a boolean array saying whether the order at each step came from an informed trader. Return a dict with the average markout over `all` fills, `informed` fills and `uninformed` fills.

### Learn
A markout is "how good was this trade, judged a little later". At horizon 0 it's just the spread you captured; as the horizon grows, informed fills turn negative because the price moves the way the informed trader expected. Desks compute markouts by venue, client, order size and time of day to find toxic flow.
""",
        "starter": '''import numpy as np
import pandas as pd


def markouts(sim: pd.DataFrame, mid, informed, horizon: int = 5) -> dict:
    # return {"all": ..., "informed": ..., "uninformed": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def markouts(sim: pd.DataFrame, mid, informed, horizon: int = 5) -> dict:
    m = np.asarray(mid, dtype=float)
    inf = np.asarray(informed, dtype=bool)
    q = sim["inventory"].to_numpy()
    dq = np.diff(q, prepend=0)
    t = np.flatnonzero((dq != 0) & (np.arange(len(q)) + horizon < len(q)))
    d = np.sign(dq[t])
    price = np.where(d > 0, sim["bid"].to_numpy()[t], sim["ask"].to_numpy()[t])
    mk = (m[t + horizon] - price) * d
    return {"all": mk.mean(), "informed": mk[inf[t]].mean(), "uninformed": mk[~inf[t]].mean()}
''',
        "hints": ["`np.diff(q, prepend=0)` gives the inventory change at each step, including the first."],
        "cases": lambda: [
            {"name": "alpha = 0.4, horizon 5", "sample": True,
             "args": (_flow_sim(3000, 0.4, 1)[0], _flow_sim(3000, 0.4, 1)[1]["mid"], _flow_sim(3000, 0.4, 1)[1]["informed"])},
            {"name": "alpha = 0.2, horizon 1", "args": (_flow_sim(4000, 0.2, 2)[0], _flow_sim(4000, 0.2, 2)[1]["mid"], _flow_sim(4000, 0.2, 2)[1]["informed"], 1)},
        ],
    },
    {
        "id": "t6_sweep",
        "title": "Part 3 · Tune spread and skew",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "parameter_sweep",
        "description": r"""
For every combination of `half_spreads` (rows) and `skews` (columns), run your market maker on `flow` (columns `mid`, `side`, `limit`; pass the orders' limits) with inventory limit `max_inv`, and score it by the risk-adjusted P&L

$$\text{score} = \frac{\text{mean}(\Delta\text{pnl})}{\text{std}(\Delta\text{pnl})}\sqrt{n}$$

where Δpnl is the step-by-step change in `pnl` (the first step's change is its pnl itself; std with ddof=1) and n the number of steps. Return a DataFrame of scores indexed by half-spread with the skews as columns.

### Learn
This is the shape of most strategy research: a parameter grid, a risk-adjusted objective, and a heat map. The trade-offs are real here: a tight spread trades often but gives informed traders a cheap option (they'll pay up to σ), a wide one shuts them out but loses most noise traders too, and skew controls inventory by making the side that reduces it more likely to fill. Look for a broad region of good scores rather than a single best cell; a lone spike is usually noise. (On real data you'd also tune on one period and check on another.)

Import your simulator: `from t5_mm_sim import market_maker`.
""",
        "starter": '''import numpy as np
import pandas as pd


def parameter_sweep(flow: pd.DataFrame, half_spreads, skews, max_inv: int = 20) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _MM + '''

def parameter_sweep(flow: pd.DataFrame, half_spreads, skews, max_inv: int = 20) -> pd.DataFrame:
    grid = {}
    for k in skews:
        col = []
        for h in half_spreads:
            pnl = market_maker(flow["mid"], flow["side"], h, k, max_inv, flow["limit"])["pnl"]
            d = pnl.diff().fillna(pnl)
            col.append(d.mean() / d.std() * np.sqrt(len(d)))
        grid[k] = col
    return pd.DataFrame(grid, index=list(half_spreads))
''',
        "hints": ["Build a dict of columns keyed by skew, then `pd.DataFrame(grid, index=half_spreads)`."],
        "timeout": 300,
        "cases": lambda: [
            {"name": "3 × 3 grid, alpha = 0.3", "sample": True, "args": (order_flow(3000, alpha=0.3, seed=1), [0.02, 0.04, 0.06], [0.0, 0.005, 0.01])},
            {"name": "noise flow, tighter limit", "args": (order_flow(3000, alpha=0.0, seed=2), [0.01, 0.03], [0.0, 0.002, 0.005], 5)},
        ],
    },
    {
        "id": "t6_as_quotes",
        "title": "Part 4 · Avellaneda–Stoikov optimal quotes",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "as_quotes",
        "description": r"""
Compute Avellaneda–Stoikov quotes (vectorized: inputs may be arrays). With mid s, inventory q, risk aversion γ, volatility σ (per unit time), time left τ = T − t and order-arrival decay κ:

$$r = s - q\gamma\sigma^2\tau, \qquad \delta = \gamma\sigma^2\tau + \frac{2}{\gamma}\ln\left(1 + \frac{\gamma}{\kappa}\right)$$

Return a dict: `reservation` = r, `spread` = δ (the full bid–ask width), `bid` = r − δ/2, `ask` = r + δ/2.

### Learn
The reservation price moves against your inventory (long → lower) by an amount that grows with risk aversion, volatility and time left. The spread has an inventory-risk part ($\gamma\sigma^2\tau$) and a competition part that shrinks when order flow is dense (large κ). Compare these quotes with the best cell of your sweep: the theory says your skew per unit of inventory should be about $\gamma\sigma^2\tau$.
""",
        "starter": '''import numpy as np


def as_quotes(mid, inventory, gamma: float, sigma: float, tau, kappa: float) -> dict:
    # return {"reservation": ..., "spread": ..., "bid": ..., "ask": ...}
    pass
''',
        "solution": '''import numpy as np


def as_quotes(mid, inventory, gamma: float, sigma: float, tau, kappa: float) -> dict:
    s, q, tau = np.asarray(mid, dtype=float), np.asarray(inventory, dtype=float), np.asarray(tau, dtype=float)
    r = s - q * gamma * sigma**2 * tau
    delta = gamma * sigma**2 * tau + 2 / gamma * np.log(1 + gamma / kappa)
    return {"reservation": r, "spread": delta, "bid": r - delta / 2, "ask": r + delta / 2}
''',
        "hints": ["Convert inputs with `np.asarray` so scalars and arrays both work."],
        "cases": lambda: [
            {"name": "flat and long", "sample": True, "args": (np.array([100.0, 100.0]), np.array([0, 5]), 0.1, 2.0, 0.5, 1.5)},
            {"name": "through time to the close", "args": (np.full(5, 50.0), np.full(5, -3), 0.05, 1.0, np.linspace(1, 0, 5), 2.0)},
        ],
    },
]


PROBLEMS.append({
    "id": "t6_desk",
    "title": "Part 5 · The market-making desk report",
    "difficulty": "Medium",
    "libs": ["pandas", "numpy"],
    "fn": "mm_desk",
    "description": r"""
Chain the project into one call, the way you'd brief a desk head on a new quoting setup:

1. `grid = parameter_sweep(flow, half_spreads, skews, max_inv)` and pick the best cell: `h, k = grid.stack().idxmax()`
2. run `market_maker(flow["mid"], flow["side"], h, k, max_inv, flow["limit"])`
3. `pnl_attribution` on the run, and `markouts` over `horizon` steps with `flow["informed"]`

Return a dict:

- `best_half_spread`, `best_skew`, `score` (the best grid score)
- `spread_pnl`, `inventory_pnl`: totals from the attribution; `total_pnl`: the final `pnl`
- `fills`: the number of steps where inventory changed; `inventory_std`: std of inventory (ddof=1)
- `markout_informed`, `markout_uninformed`: from `markouts`

### Learn
Read the report as a story. With informed flow present, the winning half-spread sits just above σ: informed traders will pay at most σ, so a quote that wide mostly shuts them out while noise traders still trade. Some spread capture is still given back as inventory losses, and informed markouts stay far below uninformed ones: that gap is adverse selection, measured. Rerun with `alpha = 0.0` in a notebook: with nobody informed, the best spread is tighter and the desk trades far more often.

Import your earlier parts: `from t5_mm_sim import market_maker`, `from t6_attribution import pnl_attribution`, `from t6_markouts import markouts`, `from t6_sweep import parameter_sweep`.
""",
    "starter": '''import numpy as np
import pandas as pd


def mm_desk(flow: pd.DataFrame, half_spreads, skews, max_inv: int = 20, horizon: int = 5) -> dict:
    # your code here
    pass
''',
    "solution": "\n\n".join(p["solution"] for p in PROBLEMS[:3]) + '''

def mm_desk(flow: pd.DataFrame, half_spreads, skews, max_inv: int = 20, horizon: int = 5) -> dict:
    grid = parameter_sweep(flow, half_spreads, skews, max_inv)
    h, k = grid.stack().idxmax()
    sim = market_maker(flow["mid"], flow["side"], h, k, max_inv, flow["limit"])
    attr = pnl_attribution(sim, flow["mid"])
    mk = markouts(sim, flow["mid"], flow["informed"], horizon)
    traded = sim["inventory"].diff().fillna(sim["inventory"]) != 0
    return {"best_half_spread": h, "best_skew": k, "score": grid.loc[h, k],
            "spread_pnl": attr["spread"].sum(), "inventory_pnl": attr["inventory"].sum(), "total_pnl": sim["pnl"].iloc[-1],
            "fills": int(traded.sum()), "inventory_std": sim["inventory"].std(),
            "markout_informed": mk["informed"], "markout_uninformed": mk["uninformed"]}
''',
    "hints": ["`grid.stack().idxmax()` returns the (half-spread, skew) pair of the best cell."],
    "timeout": 300,
    "cases": lambda: [
        {"name": "alpha = 0.3, 6 × 4 grid", "sample": True,
         "args": (order_flow(5000, alpha=0.3, seed=1), [0.02, 0.03, 0.04, 0.05, 0.06, 0.08], [0.0, 0.002, 0.005, 0.01])},
        {"name": "alpha = 0.1, tighter limit, 1-step markouts",
         "args": (order_flow(5000, alpha=0.1, seed=3), [0.02, 0.04, 0.06], [0.0, 0.005, 0.01], 10, 1)},
    ],
})
