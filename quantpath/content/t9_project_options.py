import numpy as np
import pandas as pd

from data import option_chain

TITLE = "Project: options desk"
SUMMARY = "Clean a messy option chain, build the implied-volatility surface, read skew and term structure, and risk a book with full-revaluation scenarios."
KIND = "project"

LESSON = r"""
This is an options desk's morning, compressed: take raw quotes, throw out the garbage, turn prices into a volatility surface, read what the market is saying, mark your book to that surface, and work out what it loses if things move. Implied vols come from `scipy.optimize.brentq`, the bracketing root-finder production pricing code relies on (your own solver from the volatility step works too).

```text
raw option chain
  ↓ Part 1  flag bad quotes
  ↓ Part 2  implied-vol surface (brentq)
  ↓ Part 3  ATM vol, skew and convexity per expiry
  ↓ Part 4  full-revaluation scenario grid for a book
  ↓ Part 5  morning report: mark the book, find the worst scenario
```

## 1. Clean the chain

Raw feeds contain crossed markets (bid > ask), empty bids, and prices that violate no-arbitrage bounds (often stale quotes). Flag every quote with the first rule it breaks, so you keep a record of what you dropped and why.

## 2. Build the surface

For each strike and expiry, compute the implied vol of the mid using the **out-of-the-money** option: puts below the forward, calls at or above it. OTM options are the liquid ones, and parity makes the choice consistent. Pivot into a strike × expiry grid.

## 3. Read the surface

Per expiry: ATM vol (interpolated at the forward), the 90–110 skew (iv at 0.9F minus iv at 1.1F: positive means downside protection is expensive) and convexity (the wings' average minus ATM). Across expiries: the term structure of ATM vol. These few numbers summarize what traders discuss all day: "front-month vol is up two points, the skew steepened."

## 4. Risk the book

Greeks are local. Big moves need **full revaluation**: reprice every option under shocked spot and vol, and report the P&L grid (spot −10% … +10% by vol −5 … +5 points). A short-gamma book looks fine in the Greeks and terrible in the −10% corner; the grid shows it.

## 5. The desk report

One call runs the morning: data-quality summary, the skew table, the book marked to today's surface, the scenario grid, and the worst scenario.

## Interview angle

"How would you risk-manage an options book?" Mention Greeks by expiry bucket (delta, gamma, vega, theta), skew exposure, scenario grids with full revaluation, stress tests (historical crash moves), limits on each, and the data hygiene that makes all of it trustworthy.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "A 90% strike put and a 90% strike call (same expiry) have different implied vols in your feed. What does put–call parity imply?",
     "choices": ["They should have the same implied vol; a difference signals bad data, dividends or borrow costs not accounted for, or an American-exercise effect",
                 "Puts always have higher implied vol than calls at the same strike", "Calls always have higher implied vol", "Nothing: they are different products"],
     "answer": 0, "explanation": "Parity ties the call and put at the same strike and expiry together, so they must share one implied vol if everything (forward, rates, dividends) is consistent."},
    {"type": "number", "prompt": "Your book's 1-month ATM vega is +50,000 per vol point and front-month vol drops 3 points. What is the approximate P&L in dollars?",
     "answer": -150000, "display": "−$150,000", "explanation": "50,000 × (−3) = −150,000."},
    {"type": "open", "prompt": "Your Greeks say the book is small: delta 0, gamma slightly negative, vega small. Why might it still lose a lot in a crash, and how would you see that?",
     "explanation": "Greeks are local derivatives. A short-wing position (short OTM puts financed by long ATM options, say) can be flat at the current spot but lose heavily after a large move, as gamma turns sharply negative and skew and vol jump together. A full-revaluation scenario grid (spot −10/−20%, vol +10–20 points, steeper skew) and historical stress tests reveal it; Greeks alone don't."},
]


_IV = '''def implied_vol(price, S, K, r, T, kind="call"):
    disc = K * np.exp(-r * T)
    lower = max(S - disc, 0.0) if kind == "call" else max(disc - S, 0.0)
    upper = S if kind == "call" else disc
    if not lower < price < upper:
        return float("nan")

    def bs(sig):
        d1 = (np.log(S / K) + (r + sig**2 / 2) * T) / (sig * np.sqrt(T))
        call = S * norm.cdf(d1) - disc * norm.cdf(d1 - sig * np.sqrt(T))
        return call if kind == "call" else call - S + disc

    f = lambda sig: bs(sig) - price
    if f(1e-4) > 0 or f(5.0) < 0:
        return float("nan")
    return brentq(f, 1e-4, 5.0, xtol=1e-12)
'''

_CLEAN = '''def clean_chain(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    out = chain.copy()
    mid = (out["bid"] + out["ask"]) / 2
    disc_k = out["strike"] * np.exp(-r * out["T"])
    is_call = out["type"] == "call"
    intrinsic = np.where(is_call, np.maximum(S - disc_k, 0), np.maximum(disc_k - S, 0))
    cap = np.where(is_call, S, disc_k)
    reason = np.select([out["bid"] > out["ask"], out["bid"] <= 0, mid < intrinsic, mid >= cap],
                       ["crossed", "no bid", "below intrinsic", "above max"], default="ok")
    out["reason"] = reason
    out["valid"] = reason == "ok"
    return out
'''

_SURFACE = '''def iv_surface(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    c = clean_chain(chain, S, r)
    c = c[c["valid"]]
    F = S * np.exp(r * c["T"])
    c = c[np.where(c["strike"] < F, c["type"] == "put", c["type"] == "call")]
    mid = (c["bid"] + c["ask"]) / 2
    iv = [implied_vol(m, S, k, r, t, kind) for m, k, t, kind in zip(mid, c["strike"], c["T"], c["type"])]
    return c.assign(iv=iv).pivot(index="strike", columns="T", values="iv")
'''

_SKEW = '''def skew_table(surface: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    rows = {}
    for T in sorted(surface.columns):
        col = surface[T].dropna()
        F = S * np.exp(r * T)
        iv = lambda K: float(np.interp(K, col.index.to_numpy(dtype=float), col.to_numpy()))
        atm, lo, hi = iv(F), iv(0.9 * F), iv(1.1 * F)
        rows[T] = {"atm": atm, "skew_90_110": lo - hi, "convexity": (lo + hi) / 2 - atm}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_SCEN = '''def bs(S, K, r, sigma, T, kind):
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    call = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    return call if kind == "call" else call - S + K * np.exp(-r * T)


def scenario_grid(positions: pd.DataFrame, S: float, r: float, spot_moves, vol_moves) -> pd.DataFrame:
    base = sum(p.qty * bs(S, p.strike, r, p.iv, p.T, p.type) for p in positions.itertuples())
    grid = {v: [sum(p.qty * bs(S * (1 + m), p.strike, r, p.iv + v, p.T, p.type) for p in positions.itertuples()) - base
                for m in spot_moves] for v in vol_moves}
    return pd.DataFrame(grid, index=list(spot_moves))
'''

_IMPORTS = "import numpy as np\nimport pandas as pd\nfrom scipy.optimize import brentq\nfrom scipy.stats import norm\n\n\n"


def _surface(seed):
    ns = {}
    exec(_IMPORTS + _IV + "\n\n" + _CLEAN + "\n\n" + _SURFACE, ns)
    return ns["iv_surface"](option_chain(bad=6, seed=seed), 100.0, 0.02), 100.0, 0.02


def _book(seed):
    rng = np.random.default_rng(seed)
    n = 8
    return pd.DataFrame({"type": rng.choice(["call", "put"], n), "strike": rng.choice(np.arange(85.0, 120.0, 5.0), n),
                         "T": rng.choice([1 / 12, 0.25, 0.5], n), "iv": rng.uniform(0.16, 0.3, n),
                         "qty": rng.choice([-50, -20, -10, 10, 20, 40], n)})


PROBLEMS = [
    {
        "id": "t9_clean",
        "title": "Part 1 · Flag bad quotes",
        "difficulty": "Easy",
        "libs": ["numpy", "pandas"],
        "fn": "clean_chain",
        "description": r"""
Given a raw chain (columns `T`, `strike`, `type`, `bid`, `ask`), return a copy with two new columns. `reason` is the **first** rule a quote breaks, checked in this order (mid = (bid + ask)/2):

1. `"crossed"`: bid > ask
2. `"no bid"`: bid ≤ 0
3. `"below intrinsic"`: mid < intrinsic value, i.e. $\max(S - Ke^{-rT}, 0)$ for calls and $\max(Ke^{-rT} - S, 0)$ for puts
4. `"above max"`: mid ≥ S for calls, or ≥ $Ke^{-rT}$ for puts
5. otherwise `"ok"`

`valid` is True exactly when `reason == "ok"`.

### Learn
`np.select(conditions, choices, default=...)` evaluates a list of vectorized conditions in order and picks the first match, which is exactly "first rule broken". Keeping the reason, not only a boolean, is how real data pipelines stay auditable.
""",
        "starter": '''import numpy as np
import pandas as pd


def clean_chain(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _CLEAN,
        "hints": ["Compute mid, the discounted strike, intrinsic value and the upper bound as arrays first."],
        "cases": lambda: [
            {"name": "chain with 6 bad quotes", "sample": True, "args": (option_chain(bad=6, seed=1), 100.0, 0.02)},
            {"name": "another chain", "args": (option_chain(bad=10, seed=2, expiries=(0.1, 0.4)), 100.0, 0.02)},
        ],
    },
    {
        "id": "t9_surface",
        "title": "Part 2 · Build the implied-volatility surface",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas", "scipy.stats"],
        "fn": "iv_surface",
        "description": r"""
From a raw chain, build a strike × expiry grid of implied vols:

1. keep only valid quotes (your `clean_chain`)
2. keep the **OTM** option at each strike: puts with strike < forward $F = Se^{rT}$, calls with strike ≥ F
3. compute the implied vol of each mid by root-finding with `scipy.optimize.brentq(lambda s: bs(s) - price, 1e-4, 5.0, xtol=1e-12)`, returning `nan` when the price is outside the no-arbitrage bounds of the previous task or the bracket holds no root (your Newton solver from the volatility step gives the same numbers)
4. return `df.pivot(index="strike", columns="T", values="iv")`: strikes as rows, expiries as columns, NaN where there's no quote

### Learn
Plot the result in a notebook: one line per expiry across strikes (the smile), and the ATM row across expiries (the term structure). On a real chain from yfinance (`yf.Ticker("SPY").option_chain(expiry)`), the equity skew is unmistakable.

`brentq` needs a bracket [a, b] where the function changes sign, and then it's guaranteed to converge, unlike Newton's method, which can shoot off when vega is tiny (deep in- or out-of-the-money). That robustness is why libraries use bracketing methods for implied vol.

Import your earlier work: `from t9_clean import clean_chain`.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.stats import norm


def iv_surface(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _IV + "\n\n" + _CLEAN + "\n\n" + _SURFACE,
        "hints": ["`np.where(strike < F, type == 'put', type == 'call')` gives the OTM mask in one line."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "4 expiries with bad quotes", "sample": True, "args": (option_chain(bad=6, seed=1), 100.0, 0.02)},
            {"name": "different smile", "args": (option_chain(bad=4, seed=3, skew=-0.25, smile=0.6), 100.0, 0.03)},
        ],
    },
    {
        "id": "t9_skew",
        "title": "Part 3 · Read the surface: ATM, skew and convexity",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "skew_table",
        "description": r"""
Given the surface from the previous task (index = strike, columns = expiry T), compute for each expiry, with forward $F = Se^{rT}$:

- `atm`: implied vol at strike F
- `skew_90_110`: iv(0.9F) − iv(1.1F)
- `convexity`: (iv(0.9F) + iv(1.1F))/2 − atm

Interpolate linearly in strike with `np.interp` over that expiry's non-NaN points. Return a DataFrame indexed by T (sorted) with those three columns.

### Learn
These are the numbers desks track and talk about. Equity skew is positive here: downside vol is higher. Watch how skew and convexity respond when you regenerate the chain with different `skew` and `smile` parameters, and compute the same table on a real chain.
""",
        "starter": '''import numpy as np
import pandas as pd


def skew_table(surface: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _SKEW,
        "hints": ["`np.interp(x, xp, fp)` needs `xp` increasing; the surface's strike index already is."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "surface from the previous task", "sample": True, "args": _surface(1)},
            {"name": "another surface", "args": _surface(4)},
        ],
    },
    {
        "id": "t9_scenarios",
        "title": "Part 4 · Full-revaluation scenario grid",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas", "scipy.stats"],
        "fn": "scenario_grid",
        "description": r"""
`positions` has columns `type`, `strike`, `T`, `iv`, `qty`. For every spot move m in `spot_moves` (e.g. −0.1 = −10%) and vol move v in `vol_moves` (absolute, e.g. 0.05 = +5 points), reprice every option with Black–Scholes at spot $S(1+m)$ and vol $iv + v$ (same T and r) and compute the book's P&L:

$$\text{P\&L}(m, v) = \sum_i q_i\,\big[BS_i(S(1+m), iv_i + v) - BS_i(S, iv_i)\big]$$

Return a DataFrame with `spot_moves` as the index and `vol_moves` as the columns.

### Learn
Compare the grid's centre (small moves) with the Greeks' prediction (Δ·dS + ½Γ·dS² + vega·dv): they agree near zero and diverge in the corners. That divergence is why risk managers insist on scenarios. Typical stress scenarios couple spot down with vol up (the corner a short-put book fears most).
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.stats import norm


def scenario_grid(positions: pd.DataFrame, S: float, r: float, spot_moves, vol_moves) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _SCEN,
        "hints": ["Write a small Black–Scholes price function, value the book once at base, then once per scenario."],
        "cases": lambda: [
            {"name": "short puts, long calls", "sample": True,
             "args": (pd.DataFrame({"type": ["put", "call"], "strike": [90.0, 110.0], "T": [0.25, 0.25], "iv": [0.25, 0.18], "qty": [-100, 50]}),
                      100.0, 0.02, [-0.1, -0.05, 0.0, 0.05, 0.1], [-0.05, 0.0, 0.05])},
            {"name": "random book", "args": (_book(1), 100.0, 0.02, [-0.2, -0.1, 0.0, 0.1], [-0.05, 0.0, 0.1])},
        ],
    },
]


def _desk_book():
    return pd.DataFrame({"type": ["put", "put", "put", "call", "call"], "strike": [90.0, 95.0, 80.0, 110.0, 100.0],
                         "T": [0.25, 1 / 12, 0.25, 0.5, 0.5], "qty": [-200, -100, 100, -50, 30]})


PROBLEMS.append({
    "id": "t9_desk",
    "title": "Part 5 · The options desk morning report",
    "difficulty": "Medium",
    "libs": ["numpy", "pandas", "scipy.optimize"],
    "fn": "desk_report",
    "description": r"""
Run the desk's morning in one call. `positions` has columns `type`, `strike`, `T`, `qty` (no vols: you mark them).

1. data quality: `bad_quotes` = the counts of each non-`"ok"` reason from `clean_chain` (`value_counts().sort_index()`)
2. `surface = iv_surface(chain, S, r)` and `skew = skew_table(surface, S, r)`
3. **mark the book**: each position's `iv` = the surface at its expiry, interpolated linearly in strike with `np.interp` over that expiry's non-NaN points; `marked` = positions with that `iv` column added
4. `grid = scenario_grid(marked, S, r, spot_moves, vol_moves)`
5. the worst cell: `worst_scenario` = its (spot move, vol move) pair (`grid.stack().idxmin()`), `worst_pnl` = its P&L

Return a dict with `bad_quotes`, `skew`, `marked`, `grid`, `worst_scenario`, `worst_pnl`.

### Learn
Marking to the surface is what connects market data to risk: the same book marked at a flat 20% vol would show different P&L in every scenario, because skew makes the downside puts dearer. The test book is short puts with a small tail hedge, a typical short-volatility book: it earns a little in quiet markets, and its worst scenario is the spot-down, vol-up corner, the classic way short-put books blow up.

Import your earlier parts: `from t9_clean import clean_chain`, `from t9_surface import iv_surface`, `from t9_skew import skew_table`, `from t9_scenarios import scenario_grid`.
""",
    "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.stats import norm


def desk_report(chain: pd.DataFrame, S: float, r: float, positions: pd.DataFrame, spot_moves, vol_moves) -> dict:
    # return {"bad_quotes": ..., "skew": ..., "marked": ..., "grid": ..., "worst_scenario": ..., "worst_pnl": ...}
    pass
''',
    "solution": _IMPORTS + "\n\n".join([_IV, _CLEAN, _SURFACE, _SKEW, _SCEN]) + '''

def desk_report(chain: pd.DataFrame, S: float, r: float, positions: pd.DataFrame, spot_moves, vol_moves) -> dict:
    clean = clean_chain(chain, S, r)
    bad = clean.loc[~clean["valid"], "reason"].value_counts().sort_index()
    surface = iv_surface(chain, S, r)
    skew = skew_table(surface, S, r)
    iv = []
    for K, T in zip(positions["strike"], positions["T"]):
        col = surface[T].dropna()
        iv.append(float(np.interp(K, col.index.to_numpy(dtype=float), col.to_numpy())))
    marked = positions.assign(iv=iv)
    grid = scenario_grid(marked, S, r, spot_moves, vol_moves)
    cells = grid.stack()
    return {"bad_quotes": bad, "skew": skew, "marked": marked, "grid": grid,
            "worst_scenario": cells.idxmin(), "worst_pnl": cells.min()}
''',
    "hints": ["`surface[T].dropna()` gives one expiry's smile, indexed by strike."],
    "rtol": 1e-6,
    "cases": lambda: [
        {"name": "short-put book, 6 bad quotes", "sample": True,
         "args": (option_chain(bad=6, seed=1), 100.0, 0.02, _desk_book(), [-0.15, -0.1, -0.05, 0.0, 0.05, 0.1], [-0.05, 0.0, 0.05, 0.1])},
        {"name": "steeper skew, different moves",
         "args": (option_chain(bad=8, seed=5, skew=-0.3), 100.0, 0.02, _desk_book(), [-0.2, -0.1, 0.0, 0.1], [0.0, 0.1, 0.2])},
    ],
})
