import numpy as np
import pandas as pd

TITLE = "Execution and market microstructure"
SUMMARY = "What trading really costs: spread, market impact and the square-root law, VWAP/TWAP schedules, implementation shortfall, and Almgren–Chriss."
KIND = "core"

LESSON = r"""
A strategy's paper returns become real returns only after execution. Execution traders and quant traders are judged on how cheaply they turn decisions into positions, and costs decide which strategies survive at all.

## Where costs come from

- **Explicit**: commissions, exchange fees (or rebates), taxes.
- **Spread**: crossing from mid to bid or ask costs half the spread per trade.
- **Market impact**: your own buying pushes the price up. **Temporary** impact fades after you stop; **permanent** impact stays, because your trades reveal information.
- **Opportunity cost**: the part you didn't fill, if the price ran away.

## The square-root law

Across markets and decades, impact scales like the square root of size:

$$\text{impact} \approx Y\,\sigma_{\text{daily}}\sqrt{\frac{Q}{V}}$$

with Q your order size, V daily volume, σ daily volatility and Y of order 1. Trading 1% of daily volume in a stock with 2% daily vol costs about 20 bp. Doubling the size raises the cost per share by √2 and the total cost by 2√2.

## Execution algorithms

| Algo | Idea | Good when |
|---|---|---|
| TWAP | equal slices in time | no volume information, simple |
| VWAP | slices proportional to expected volume (U-shaped intraday: heavy at the open and close) | benchmarked against VWAP |
| POV | trade a fixed % of market volume | adapts to liquidity |
| Implementation shortfall | front-load to reduce drift risk, balanced against impact | urgent alpha |

## Benchmarks

- **Implementation shortfall** (arrival price): the cost relative to the price when you decided to trade, including the unfilled part. The honest measure.
- **VWAP slippage**: how your average price compares with the market's VWAP over the period. Easy to game, since trading passively when the price runs away "beats VWAP" while missing the trade.

## Almgren–Chriss: risk versus impact

Liquidating X shares over [0, T]: trade fast and you pay impact; trade slowly and you carry price risk. Minimizing expected cost + λ·variance with linear temporary impact η gives

$$x(t) = X\,\frac{\sinh\big(\kappa(T-t)\big)}{\sinh(\kappa T)}, \qquad \kappa = \sqrt{\frac{\lambda\sigma^2}{\eta}}$$

λ → 0 gives a straight line (TWAP); larger risk aversion or volatility front-loads the schedule.

## Microstructure facts worth knowing

- Volume is U-shaped through the day; spreads are widest at the open.
- **Queue position**: limit orders at the same price fill in time order, which is why HFT firms invest in latency.
- **Liquidity measures**: spread, depth, Amihud illiquidity (|return| / dollar volume).
- Alpha decays: the faster a signal's edge fades, the more urgently you must execute, and the more impact you accept.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Using the square-root law with Y = 1: a stock has 2% daily volatility and you trade 1% of its daily volume. What is the expected impact in basis points?",
     "answer": 20, "explanation": "2% × √0.01 = 2% × 0.1 = 0.2% = 20 bp."},
    {"type": "number", "prompt": "You decide to buy 10,000 shares at 100.00 (arrival price). You fill all of them at an average of 100.12 and pay $50 in fees. What is the implementation shortfall in basis points of notional?",
     "answer": 12.5, "explanation": "Cost = 10,000 × 0.12 + 50 = $1,250 on $1,000,000 of notional = 12.5 bp."},
    {"type": "number", "prompt": "Trades print 10 @ 100, 30 @ 101 and 10 @ 102. What is the VWAP?",
     "answer": 101, "explanation": "(1000 + 3030 + 1020)/50 = 101.0."},
    {"type": "choice", "prompt": "What's the difference between TWAP and VWAP execution?",
     "choices": ["TWAP slices evenly in time; VWAP follows the expected intraday volume profile", "TWAP trades at the close only", "VWAP guarantees the VWAP price", "There is no difference"],
     "answer": 0, "explanation": "VWAP puts more volume at the open and close, where the market trades more, to track the volume-weighted average price."},
    {"type": "choice", "prompt": "In Almgren–Chriss, what happens to the optimal schedule if you become more risk averse?",
     "choices": ["You trade faster at the start (front-load)", "You trade more slowly at the start", "You trade the same TWAP schedule", "You wait and trade at the end"],
     "answer": 0, "explanation": "Higher λ raises κ, and the sinh schedule decays faster: more is executed early to cut exposure to price risk, at the cost of more impact."},
    {"type": "number", "prompt": "You must buy 500,000 shares of a stock with an average daily volume of 5 million, and you won't exceed 10% participation. At minimum, how many trading days will the order take?",
     "answer": 1, "explanation": "10% of 5M = 500,000 per day, so one full day."},
    {"type": "open", "prompt": "Your algo beat VWAP by 5 bp on a large buy order, but the stock rallied 2% during the day. Was it a good execution?",
     "explanation": "Not necessarily. Beating VWAP can mean you traded passively and fell behind while the price ran away. If part of the order was left unfilled, or filled late at higher prices relative to the arrival price, the implementation shortfall (cost vs the decision price, including opportunity cost) may be large. Judge against arrival price, check how much was filled, and ask whether the urgency matched the alpha's decay."},
]


def _profile():
    t = np.linspace(0, 1, 13)
    return np.round(1 + 2.5 * (t - 0.5) ** 2 * 4, 3)


def _tape(n, seed):
    rng = np.random.default_rng(seed)
    t = np.sort(rng.uniform(0, 390, n))
    price = np.round(50 + np.cumsum(rng.normal(0, 0.02, n)), 2)
    size = (rng.integers(1, 20, n) * 100 * (1 + 2 * ((t - 195) / 195) ** 2)).astype(int)
    return pd.DataFrame({"minute": t, "price": price, "size": size})


def _fills(tape, frac, seed):
    rng = np.random.default_rng(seed)
    idx = np.sort(rng.choice(len(tape), int(frac * len(tape)), replace=False))
    sub = tape.iloc[idx]
    return pd.DataFrame({"price": sub["price"].to_numpy() + 0.01, "size": (sub["size"] * 0.1).astype(int).to_numpy()})


PROBLEMS = [
    {
        "id": "t10_vwap_schedule",
        "title": "VWAP schedule with exact share counts",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "vwap_schedule",
        "description": r"""
Split an order of `total_qty` shares across time buckets in proportion to `volume_profile` (expected volume per bucket). Shares must be whole numbers and add up **exactly** to `total_qty`. Use the largest-remainder method:

1. raw allocation = total_qty × profile / sum(profile); start from its floor
2. hand out the leftover shares one each to the buckets with the largest fractional parts (ties go to the earlier bucket)

Return a numpy integer array.

### Learn
Naive rounding can over- or under-fill by a few shares, and real orders must sum exactly. `np.argsort(-frac, kind="stable")` gives the buckets in descending order of remainder with ties kept in time order.

The intraday volume profile is U-shaped: heavy at the open and the close. A VWAP algo with this schedule tracks the day's VWAP, though in practice the profile is forecast from history and adjusted live as actual volume comes in.
""",
        "starter": '''import numpy as np


def vwap_schedule(volume_profile, total_qty: int) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def vwap_schedule(volume_profile, total_qty: int) -> np.ndarray:
    p = np.asarray(volume_profile, dtype=float)
    raw = total_qty * p / p.sum()
    alloc = np.floor(raw).astype(int)
    leftover = total_qty - alloc.sum()
    order = np.argsort(-(raw - alloc), kind="stable")
    alloc[order[:leftover]] += 1
    return alloc
''',
        "hints": ["The number of leftover shares is always smaller than the number of buckets."],
        "cases": lambda: [
            {"name": "U-shaped profile, 10,000 shares", "sample": True, "args": (_profile(), 10_000)},
            {"name": "equal profile with ties", "args": ([1, 1, 1], 10)},
            {"name": "odd sizes", "args": ([5, 3, 8, 2, 7], 1001)},
        ],
    },
    {
        "id": "t10_shortfall",
        "title": "Implementation shortfall",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "implementation_shortfall",
        "description": r"""
Measure an execution against the decision (arrival) price. `fills` is a list of `(price, qty)`; `side` is +1 for a buy and −1 for a sell. Return a dict:

- `filled`: total quantity filled
- `avg_price`: the volume-weighted fill price
- `execution_cost`: side × Σ(price − decision) × qty + fees (dollars)
- `opportunity_cost`: if `target_qty` and `close_price` are given, side × (close_price − decision) × (target_qty − filled); otherwise 0
- `total_bps`: (execution_cost + opportunity_cost) / (decision × target) × 10,000, where target = `target_qty` if given, else filled

### Learn
Positive numbers are costs. Including the unfilled part matters: an algo that "saved" money by not trading while the price ran away hasn't saved anything. The opportunity cost captures the trade you failed to do.

Perold (1988) introduced implementation shortfall as the gap between a paper portfolio traded at decision prices and the real one. It remains the standard way to evaluate execution.
""",
        "starter": '''import numpy as np


def implementation_shortfall(decision_price: float, fills: list, side: int, fees: float = 0.0,
                             target_qty=None, close_price=None) -> dict:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def implementation_shortfall(decision_price: float, fills: list, side: int, fees: float = 0.0,
                             target_qty=None, close_price=None) -> dict:
    prices = np.array([p for p, _ in fills], dtype=float)
    qtys = np.array([q for _, q in fills], dtype=float)
    filled = qtys.sum()
    execution = side * np.sum((prices - decision_price) * qtys) + fees
    opportunity = 0.0
    if target_qty is not None and close_price is not None:
        opportunity = side * (close_price - decision_price) * (target_qty - filled)
    target = target_qty if target_qty is not None else filled
    return {"filled": filled, "avg_price": np.sum(prices * qtys) / filled, "execution_cost": execution,
            "opportunity_cost": opportunity,
            "total_bps": (execution + opportunity) / (decision_price * target) * 1e4}
''',
        "hints": ["For a sell (side −1), filling below the decision price is a cost, so the sign flips."],
        "cases": lambda: [
            {"name": "the lesson's buy order", "sample": True, "args": (100.0, [(100.10, 4000), (100.13, 6000)], 1, 50.0)},
            {"name": "sell order", "args": (50.0, [(49.95, 1000), (49.90, 2000), (49.97, 500)], -1, 10.0)},
            {"name": "partially filled buy with opportunity cost", "args": (20.0, [(20.02, 3000), (20.05, 2000)], 1, 0.0, 10_000, 20.40)},
        ],
    },
    {
        "id": "t10_almgren_chriss",
        "title": "Almgren–Chriss optimal liquidation",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "ac_trajectory",
        "description": r"""
Return the Almgren–Chriss holdings schedule for liquidating `X` shares over `T` (days), evaluated at $t_j = jT/N$ for $j = 0, \dots, N$:

$$x_j = X\,\frac{\sinh\big(\kappa(T - t_j)\big)}{\sinh(\kappa T)}, \qquad \kappa = \sqrt{\frac{\lambda\sigma^2}{\eta}}$$

where σ is the daily volatility (in price units), η the temporary-impact coefficient and λ the risk aversion. If λ = 0, return the straight line $X(1 - t_j/T)$.

### Learn
Plot schedules for λ = 0, 1e-6 and 1e-5 in a notebook: the straight TWAP line bends into a front-loaded curve as risk aversion rises. The trader's real decision is choosing λ, which means deciding how much price risk is acceptable relative to impact cost; strong short-term alpha argues for urgency too.

This continuous-time formula is the textbook version; the discrete Almgren–Chriss solution replaces κ with a slightly different $\tilde\kappa$ but behaves the same.
""",
        "starter": '''import numpy as np


def ac_trajectory(X: float, T: float, N: int, sigma: float, eta: float, lam: float) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def ac_trajectory(X: float, T: float, N: int, sigma: float, eta: float, lam: float) -> np.ndarray:
    t = np.linspace(0, T, N + 1)
    if lam == 0:
        return X * (1 - t / T)
    kappa = np.sqrt(lam * sigma**2 / eta)
    return X * np.sinh(kappa * (T - t)) / np.sinh(kappa * T)
''',
        "hints": ["`np.linspace(0, T, N + 1)` gives the N + 1 time points."],
        "cases": lambda: [
            {"name": "risk neutral: TWAP line", "sample": True, "args": (1_000_000, 5, 10, 0.95, 2.5e-6, 0.0)},
            {"name": "moderately risk averse", "args": (1_000_000, 5, 10, 0.95, 2.5e-6, 1e-6)},
            {"name": "very risk averse, 50 steps", "args": (500_000, 1, 50, 1.2, 1e-6, 1e-5)},
        ],
    },
    {
        "id": "t10_vwap_slippage",
        "title": "Slippage against the market VWAP",
        "difficulty": "Easy",
        "libs": ["pandas", "numpy"],
        "fn": "vwap_slippage",
        "description": r"""
`tape` holds the market's trades (columns `price`, `size`) over the execution window and `fills` your own trades (same columns). For a `side` of +1 (buy) or −1 (sell), return a dict:

- `market_vwap`: Σ price × size / Σ size over the tape
- `our_vwap`: the same over your fills
- `slippage_bps`: side × (our_vwap − market_vwap) / market_vwap × 10,000 (positive = worse than VWAP)

### Learn
VWAP slippage is the most common execution report because it's easy to compute and understand. Its weakness is in the lesson: it ignores timing and unfilled quantity. Report it alongside implementation shortfall, never instead of it.
""",
        "starter": '''import numpy as np
import pandas as pd


def vwap_slippage(tape: pd.DataFrame, fills: pd.DataFrame, side: int) -> dict:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def vwap_slippage(tape: pd.DataFrame, fills: pd.DataFrame, side: int) -> dict:
    vwap = lambda df: (df["price"] * df["size"]).sum() / df["size"].sum()
    market, ours = vwap(tape), vwap(fills)
    return {"market_vwap": market, "our_vwap": ours, "slippage_bps": side * (ours - market) / market * 1e4}
''',
        "hints": ["Write a tiny VWAP helper and call it twice."],
        "cases": lambda: [
            {"name": "buy order", "sample": True, "args": (_tape(500, 1), _fills(_tape(500, 1), 0.2, 2), 1)},
            {"name": "sell order", "args": (_tape(2000, 3), _fills(_tape(2000, 3), 0.1, 4), -1)},
        ],
    },
]
