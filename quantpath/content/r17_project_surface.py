import numpy as np
import pandas as pd

from data import svi_chain

TITLE = "Project lab: volatility surface research"
SUMMARY = "Turn a raw option chain into an arbitrage-checked SVI surface and read it like a researcher: term structure, skew, variance swap levels, implied crash odds."
KIND = "project"

LESSON = r"""
Every options desk and volatility fund runs this pipeline before anything else: quotes in, a clean and arbitrage-free surface out, and a few numbers that summarize what the market is pricing. Here you build it end to end with scipy, reusing your implied-vol solver and your SVI fit.

## The pipeline

```text
raw option chain
  ↓ Part 1  clean quotes, keep OTM options, solve implied vols (brentq)
  ↓ Part 2  fit SVI per expiry (least_squares)
  ↓ Part 3  arbitrage checks on the fitted surface: calendar and butterfly
  ↓ Part 4  what the surface implies: ATM vol, skew, variance swap vol, crash odds
  ↓ Part 5  one call that produces the surface report
```

## The data

`data.svi_chain(bad=…)` quotes calls and puts at four expiries from an arbitrage-free SSVI surface (ρ = −0.7, ATM vol rising with maturity), with bid/ask spreads, small pricing noise and a few corrupted quotes. Your pipeline doesn't know the true surface; it should recover something close to it and flag anything suspicious.

## What each part teaches

1. **Data hygiene**: an implied vol is only as good as the quote behind it.
2. **Calibration**: per-expiry least squares with sensible bounds; check the fit error.
3. **Validation**: an SVI slice can still have negative density in the wings or cross another expiry; Gatheral's g(k) and the total-variance ordering catch both.
4. **Interpretation**: the numbers a vol researcher tracks daily: the ATM term structure, the skew slope, the variance swap level (a model-free VIX at each maturity) and the risk-neutral probability of a 20% fall.
5. **The report**: one function, run every morning on new data.

## Interview angle

"Walk me through building a vol surface." Answer with this pipeline: quote filtering, forward estimation, OTM implied vols, a parameterization (SVI/SSVI, SABR), calibration, arbitrage checks, interpolation in total variance across maturities, and monitoring of fit errors over time.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "Why fit implied vols in total variance w = σ²T rather than in vol when interpolating across maturities?",
     "choices": ["No-calendar-arbitrage is a simple monotonicity condition in total variance, and linear interpolation in w preserves it", "Total variance is always smaller, so the fit is more accurate",
                 "Vol can't be negative but variance can", "It makes the smile symmetric"],
     "answer": 0, "explanation": "If w(k, T₁) ≤ w(k, T₂), interpolating linearly in T between them keeps w increasing, so the interpolated surface stays calendar-arbitrage-free."},
    {"type": "number", "prompt": "A fitted SVI slice for T = 0.25 has total variance w(0) = 0.0121 at the money. What is the ATM implied vol?",
     "answer": 0.22, "explanation": "σ = √(w/T) = √(0.0121/0.25) = √0.0484 = 0.22."},
    {"type": "open", "prompt": "Your fitted surface shows a butterfly violation deep in the left wing of the 1-month expiry. What could cause it and what would you do?",
     "explanation": "Usually sparse or stale deep-OTM put quotes push the fitted wing too steep, or the unconstrained SVI fit finds parameters with negative density far out of the data range. Remedies: filter or down-weight wide quotes, constrain the fit (or use SSVI, which is arbitrage-free by construction), check g(k) only where it matters for pricing, and refit. Never price or risk-manage off a surface with negative density."},
]

_IV = '''def implied_vol(price, S, K, r, T, kind):
    disc = K * np.exp(-r * T)
    lower = max(S - disc, 0.0) if kind == "call" else max(disc - S, 0.0)
    upper = S if kind == "call" else disc
    if not lower < price < upper:
        return float("nan")
    f = lambda s: bs_price(S, K, r, s, T, kind) - price
    if f(1e-4) > 0 or f(5.0) < 0:
        return float("nan")
    return brentq(f, 1e-4, 5.0, xtol=1e-12)


def bs_price(S, K, r, sigma, T, kind="call"):
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * np.sqrt(T))
    call = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d1 - sigma * np.sqrt(T))
    return call if kind == "call" else call - S + K * np.exp(-r * T)
'''

_POINTS = '''def surface_points(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    c = chain.copy()
    c["mid"] = (c["bid"] + c["ask"]) / 2
    disc = c["strike"] * np.exp(-r * c["T"])
    call = c["type"] == "call"
    intrinsic = np.where(call, np.maximum(S - disc, 0), np.maximum(disc - S, 0))
    cap = np.where(call, S, disc)
    F = S * np.exp(r * c["T"])
    keep = (c["bid"] <= c["ask"]) & (c["bid"] > 0) & (c["mid"] >= intrinsic) & (c["mid"] < cap)
    keep &= np.where(c["strike"] < F, c["type"] == "put", call)
    c = c[keep].copy()
    c["k"] = np.log(c["strike"] / (S * np.exp(r * c["T"])))
    c["iv"] = [implied_vol(m, S, K, r, T, kind) for m, K, T, kind in zip(c["mid"], c["strike"], c["T"], c["type"])]
    c = c.dropna(subset=["iv"])
    c["w"] = c["iv"] ** 2 * c["T"]
    return c.sort_values(["T", "strike"])[["T", "strike", "k", "iv", "w"]].reset_index(drop=True)
'''

_SVI = '''def svi(k, a, b, rho, m, sigma):
    return a + b * (rho * (k - m) + np.sqrt((k - m) ** 2 + sigma**2))


def svi_fit(k, w) -> dict:
    k, w = np.asarray(k, dtype=float), np.asarray(w, dtype=float)
    res = least_squares(lambda x: svi(k, *x) - w, [0.5 * w.min(), 0.1, -0.5, 0.0, 0.1],
                        bounds=([-1.0, 1e-4, -0.999, -1.0, 1e-4], [1.0, 5.0, 0.999, 1.0, 2.0]))
    fitted = svi(k, *res.x)
    return {"params": res.x, "fitted": fitted, "rmse": float(np.sqrt(np.mean((fitted - w) ** 2)))}


def fit_svi_surface(points: pd.DataFrame) -> pd.DataFrame:
    rows = {}
    for T, g in points.groupby("T"):
        fit = svi_fit(g["k"], g["w"])
        rows[T] = dict(zip(["a", "b", "rho", "m", "sigma"], fit["params"]), rmse=fit["rmse"])
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_CHECKS = '''def svi_derivs(k, a, b, rho, m, sigma):
    root = np.sqrt((k - m) ** 2 + sigma**2)
    return a + b * (rho * (k - m) + root), b * (rho + (k - m) / root), b * sigma**2 / root**3


def surface_checks(params: pd.DataFrame, k_grid=None) -> dict:
    k = np.linspace(-0.5, 0.5, 41) if k_grid is None else np.asarray(k_grid, dtype=float)
    P = params.sort_index()
    W, min_g, n_butterfly = [], {}, 0
    for T, p in P.iterrows():
        w, w1, w2 = svi_derivs(k, *p[["a", "b", "rho", "m", "sigma"]])
        g = (1 - k * w1 / (2 * w)) ** 2 - w1**2 / 4 * (1 / w + 0.25) + w2 / 2
        W.append(w)
        min_g[T] = g.min()
        n_butterfly += int((g < 0).sum())
    W = np.array(W)
    return {"calendar": int((np.diff(W, axis=0) < -1e-10).sum()), "butterfly": n_butterfly, "min_g": pd.Series(min_g)}
'''

_STATS = '''def implied_stats(params: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    rows = {}
    for T, p in params.sort_index().iterrows():
        x = p[["a", "b", "rho", "m", "sigma"]].to_numpy(dtype=float)
        F = S * np.exp(r * T)
        w0, w1, _ = svi_derivs(0.0, *x)
        # variance swap: integrate OTM prices over log-strike, dK / K^2 = dx / K
        xs = np.linspace(-3, 3, 2001)
        K = F * np.exp(xs)
        iv = np.sqrt(svi(xs, *x) / T)
        Q = np.where(K < F, bs_price(S, K, r, iv, T, "put"), bs_price(S, K, r, iv, T, "call"))
        var_swap = 2 * np.exp(r * T) / T * np.trapezoid(Q / K, xs)
        # risk-neutral density on a uniform strike grid (Breeden-Litzenberger)
        Ku = F * np.linspace(0.2, 3.0, 1401)
        C = bs_price(S, Ku, r, np.sqrt(svi(np.log(Ku / F), *x) / T), T, "call")
        dK = Ku[1] - Ku[0]
        q = np.exp(r * T) * (C[:-2] - 2 * C[1:-1] + C[2:]) / dK**2
        Ki = Ku[1:-1]
        total = q.sum() * dK
        mean = (Ki * q).sum() * dK / total
        var = ((Ki - mean) ** 2 * q).sum() * dK / total
        rows[T] = {"atm_vol": np.sqrt(w0 / T), "skew": w1 / (2 * np.sqrt(w0 * T)), "var_swap_vol": np.sqrt(var_swap),
                   "rn_skew": ((Ki - mean) ** 3 * q).sum() * dK / total / var**1.5,
                   "p_down_20": q[Ki < 0.8 * F].sum() * dK / total}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_IMPORTS = "import numpy as np\nimport pandas as pd\nfrom scipy.optimize import brentq, least_squares\nfrom scipy.stats import norm\n\n\n"


def _ns():
    ns = {}
    exec(_IMPORTS + "\n\n".join([_IV, _POINTS, _SVI, _CHECKS, _STATS]), ns)
    return ns


def _chain(seed, bad=8, **kw):
    return svi_chain(bad=bad, seed=seed, **kw), 100.0, 0.02


def _points(seed, **kw):
    return _ns()["surface_points"](*_chain(seed, **kw))


def _params(seed, **kw):
    return _ns()["fit_svi_surface"](_points(seed, **kw))


PROBLEMS = [
    {
        "id": "r17_points",
        "title": "Part 1 · Clean quotes into implied-vol points",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy", "scipy.optimize"],
        "fn": "surface_points",
        "description": r"""
From a raw chain (`T`, `strike`, `type`, `bid`, `ask`) build the points a surface is fitted to:

1. mid = (bid + ask)/2; keep quotes with bid ≤ ask, bid > 0, and intrinsic ≤ mid < cap, where intrinsic is $\max(S - Ke^{-rT}, 0)$ for calls and $\max(Ke^{-rT} - S, 0)$ for puts, and cap is S for calls and $Ke^{-rT}$ for puts
2. keep the OTM side: puts with strike < $F = Se^{rT}$, calls with strike ≥ F
3. implied vol of each mid with `scipy.optimize.brentq` on [1e-4, 5] (`xtol=1e-12`); NaN when the price is outside the bounds or the bracket holds no root; drop NaN rows
4. add `k` = ln(K/F) and `w` = iv² × T

Return a DataFrame with columns `T`, `strike`, `k`, `iv`, `w`, sorted by T then strike, with a fresh 0…n−1 index.

### Learn
These are the same rules as the options-desk project, now feeding a fit rather than a pivot table. Reuse your solver: `from t7_implied_vol import implied_vol` gives the same numbers as `brentq`.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.stats import norm


def surface_points(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    # return a DataFrame with columns T, strike, k, iv, w
    pass
''',
        "solution": _IMPORTS + _IV + "\n\n" + _POINTS,
        "hints": ["Build one boolean mask for the validity rules and the OTM rule, then compute vols only for the rows you keep."],
        "rtol": 1e-7,
        "cases": lambda: [
            {"name": "4 expiries, 8 bad quotes", "sample": True, "args": _chain(1)},
            {"name": "another chain, flatter skew", "args": _chain(2, bad=12, rho=-0.4)},
        ],
    },
    {
        "id": "r17_fit",
        "title": "Part 2 · Fit SVI to every expiry",
        "difficulty": "Medium",
        "libs": ["scipy.optimize", "pandas"],
        "fn": "fit_svi_surface",
        "description": r"""
For each expiry in the Part 1 points (in ascending order), fit raw SVI to (`k`, `w`) exactly as in the volatility-surface step: `least_squares` with `x0 = [0.5 * min(w), 0.1, -0.5, 0.0, 0.1]`, `lower = [-1.0, 1e-4, -0.999, -1.0, 1e-4]`, `upper = [1.0, 5.0, 0.999, 1.0, 2.0]`.

Return a DataFrame indexed by T with columns `a`, `b`, `rho`, `m`, `sigma`, `rmse`.

### Learn
For the longer expiries the fitted ρ lands near the true −0.7 and the rmse is tiny: SSVI slices are SVI slices, so the parameterization is exactly right. Now look hard at the 1-month slice. Only strikes within about ±15% of spot have bids, so the wings are barely pinned down and the fit can wander; in the sample it even flips ρ positive while still matching the quotes. Part 3 catches the consequences. On real data the rmse is your first quality monitor, but as this shows, a small rmse doesn't guarantee sensible wings.

Import your earlier work: `from r16_svi_fit import svi_fit`.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import least_squares


def fit_svi_surface(points: pd.DataFrame) -> pd.DataFrame:
    # return a DataFrame indexed by T with columns a, b, rho, m, sigma, rmse
    pass
''',
        "solution": _IMPORTS + _SVI,
        "hints": ["`points.groupby('T')` visits expiries in ascending order."],
        "rtol": 1e-5,
        "atol": 1e-7,
        "cases": lambda: [
            {"name": "points from Part 1", "sample": True, "args": (_points(1),)},
            {"name": "flatter skew", "args": (_points(2, bad=12, rho=-0.4),)},
        ],
    },
    {
        "id": "r17_checks",
        "title": "Part 3 · Arbitrage checks on the fitted surface",
        "difficulty": "Hard",
        "libs": ["numpy", "pandas"],
        "fn": "surface_checks",
        "description": r"""
Check the fitted surface on a log-moneyness grid (default `np.linspace(-0.5, 0.5, 41)`):

1. for each expiry (ascending), compute w, w′ and w″ of the SVI slice analytically: with $R = \sqrt{(k-m)^2 + \sigma^2}$, $w' = b\left(\rho + \frac{k-m}{R}\right)$ and $w'' = \frac{b\sigma^2}{R^3}$
2. **butterfly**: Gatheral's density function $g(k) = \left(1 - \frac{k w'}{2w}\right)^2 - \frac{w'^2}{4}\left(\frac1w + \frac14\right) + \frac{w''}{2}$ must be ≥ 0; count grid points with g < 0 across all expiries, and record each expiry's minimum g
3. **calendar**: count (grid point, consecutive expiry pair) combinations where w falls with maturity by more than 1e-10

Return a dict: `calendar` (int), `butterfly` (int) and `min_g` (Series indexed by T).

### Learn
g(k) is the risk-neutral density written in total-variance terms, up to a positive factor, so g ≥ 0 is the butterfly condition for a smooth slice. Unlike the price-grid check in the previous step, these tests work on the parameterization itself, anywhere on the grid, without repricing. The second test surface passes both. The sample fails both, and the culprit is the 1-month slice from Part 2: its loosely identified wings dip into negative density and cross the 3-month slice outside the quoted strikes. That's the classic short-dated failure, and the reason desks constrain those fits or use SSVI, which is arbitrage-free by construction.
""",
        "starter": '''import numpy as np
import pandas as pd


def surface_checks(params: pd.DataFrame, k_grid=None) -> dict:
    # return {"calendar": ..., "butterfly": ..., "min_g": ...}
    pass
''',
        "solution": _IMPORTS + _CHECKS,
        "hints": ["Stack each expiry's w on the grid into a 2-D array; `np.diff(W, axis=0)` compares consecutive expiries."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "fitted surface", "sample": True, "args": (_params(1),)},
            {"name": "a wider grid", "args": (_params(2, bad=12, rho=-0.4), np.linspace(-1.0, 0.8, 61))},
            {"name": "a surface with a crossing", "args": (_params(1).assign(a=lambda p: p["a"] - np.where(p.index == 1.0, 0.012, 0.0)),)},
        ],
    },
    {
        "id": "r17_stats",
        "title": "Part 4 · What the surface implies",
        "difficulty": "Hard",
        "libs": ["numpy", "scipy.stats", "pandas"],
        "fn": "implied_stats",
        "description": r"""
For each fitted expiry (ascending), with $F = Se^{rT}$ and the SVI slice as the smile:

- `atm_vol` = $\sqrt{w(0)/T}$ and `skew` = $\frac{d\sigma}{dk}\big|_{k=0} = \frac{w'(0)}{2\sqrt{w(0)T}}$
- `var_swap_vol`: on the log-strike grid `xs = np.linspace(-3, 3, 2001)`, `K = F * exp(xs)`, price OTM options with Black–Scholes at the SVI vol (puts below F, calls at or above), and integrate $\sigma^2_{var} = \frac{2e^{rT}}{T}\int \frac{Q(K)}{K}\,dx$ with `np.trapezoid` (the change of variables $dK/K^2 = dx/K$); report the square root
- `rn_skew` and `p_down_20`: on the strike grid `F * np.linspace(0.2, 3.0, 1401)`, price calls at the SVI vols, apply Breeden–Litzenberger as in the volatility-surface step, and report the risk-neutral skewness and the probability of finishing below 0.8F (density mass below 0.8F divided by the total)

Return a DataFrame indexed by T with those five columns.

### Learn
These are the dashboard numbers. The ATM term structure rises with maturity here; the skew is negative and flattens with maturity (roughly like $1/\sqrt T$); the variance swap vol sits a few points above ATM because of the skew; and the risk-neutral odds of a 20% fall grow with maturity. Real-market comparisons: the 1-month variance swap vol on SPX is the VIX, and the crash odds feed tail-risk indicators like the CBOE SKEW index.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.stats import norm


def implied_stats(params: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    # return a DataFrame indexed by T with columns atm_vol, skew, var_swap_vol, rn_skew, p_down_20
    pass
''',
        "solution": _IMPORTS + "\n\n".join([_IV, _SVI, _CHECKS, _STATS]),
        "hints": ["Write small helpers for SVI (with its derivatives) and for Black–Scholes; everything else is array arithmetic on two grids."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "fitted surface", "sample": True, "args": (_params(1), 100.0, 0.02)},
            {"name": "flatter skew", "args": (_params(2, bad=12, rho=-0.4), 100.0, 0.02)},
        ],
    },
    {
        "id": "r17_report",
        "title": "Part 5 · The surface report",
        "difficulty": "Medium",
        "libs": ["pandas", "scipy.optimize"],
        "fn": "surface_report",
        "description": r"""
Chain Parts 1–4 from a raw chain:

1. `points = surface_points(chain, S, r)`
2. `params = fit_svi_surface(points)`
3. `checks = surface_checks(params)`
4. `stats = implied_stats(params, S, r)`

Return `{"n_points": len(points), "params": params, "checks": checks, "stats": stats}`.

Import your earlier parts: `from r17_points import surface_points`, and likewise `r17_fit`, `r17_checks`, `r17_stats`.

### Learn
Run it on a real chain in a notebook: `yf.Ticker("SPY")` gives `options` (expiries) and `option_chain(expiry)` (calls and puts with bid/ask); build the same five columns, use the spot price and a short-term rate, and compare your 1-month `var_swap_vol` with the VIX that day. Expect noisier fits, real arbitrage flags in the wings, and a steeper skew than the synthetic surface.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import brentq, least_squares
from scipy.stats import norm


def surface_report(chain: pd.DataFrame, S: float, r: float) -> dict:
    # return {"n_points": ..., "params": ..., "checks": ..., "stats": ...}
    pass
''',
        "solution": _IMPORTS + "\n\n".join([_IV, _POINTS, _SVI, _CHECKS, _STATS]) + '''

def surface_report(chain: pd.DataFrame, S: float, r: float) -> dict:
    points = surface_points(chain, S, r)
    params = fit_svi_surface(points)
    return {"n_points": len(points), "params": params, "checks": surface_checks(params), "stats": implied_stats(params, S, r)}
''',
        "hints": ["Each part is one line here; the work is in the parts."],
        "rtol": 1e-5,
        "atol": 1e-7,
        "cases": lambda: [
            {"name": "raw chain", "sample": True, "args": _chain(1)},
            {"name": "flatter skew, more bad quotes", "args": (svi_chain(bad=12, seed=2, rho=-0.4), 100.0, 0.02)},
        ],
    },
]
