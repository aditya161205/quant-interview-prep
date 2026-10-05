import numpy as np
import pandas as pd

from data import bs_price, option_chain

TITLE = "Implied volatility, the smile and Greeks in practice"
SUMMARY = "Inverting Black–Scholes, reading the volatility smile and term structure, aggregating position Greeks, and the trader's rules of thumb."
KIND = "core"

LESSON = r"""
Option traders quote and think in **implied volatility**, not dollars. A price only means something relative to strike, expiry and rates; a vol is comparable across all of them. This step makes you fluent in that language.

## Implied volatility

The implied vol is the σ that makes the Black–Scholes price equal the market price. There's no closed form, so solve numerically:

- **Newton's method** using vega: $\sigma_{n+1} = \sigma_n - \frac{BS(\sigma_n) - P}{\text{vega}(\sigma_n)}$. It converges in a few iterations near the money, but vega vanishes for deep OTM or very short options, so add a **bisection** fallback on a bracket such as [0.0001, 5].
- A good starting guess for near-ATM options comes from the rule of thumb: $\sigma \approx \frac{P}{0.4\,S\sqrt T}$.
- A price outside the no-arbitrage bounds (below intrinsic value, above S for a call) has **no** implied vol. Return NaN rather than a garbage number.

## The smile and the skew

If Black–Scholes were right, implied vol would be flat across strikes. It isn't:

- **Equity index skew**: OTM puts trade at much higher vols than OTM calls. Causes: crash risk (returns are negatively skewed with fat left tails), structural demand for downside protection, and the leverage effect (volatility rises when prices fall).
- **FX** smiles are more symmetric; some **commodities** show call skew (supply shocks push prices up).
- Parameterize the smile in log-moneyness $k = \ln(K/F)$, e.g. $\sigma(k) \approx a + bk + ck^2$, where b is the skew (negative for equities) and c the convexity. Professional surfaces use parameterizations such as SVI.
- Standard market quotes: the **25-delta risk reversal** (25Δ call vol − 25Δ put vol) measures skew; the **25-delta butterfly** (average of the 25Δ wings − ATM vol) measures smile convexity.

**Term structure**: ATM vol by expiry. Usually upward sloping in calm markets; it inverts in stress, when near-term uncertainty dominates.

## Greeks in practice

- Position Greeks **add up** across options (times quantity × contract multiplier, often 100).
- **Delta** (in shares, or "cash delta" = Δ × S × multiplier) is what you hedge first.
- **Gamma–theta trade-off**: for a delta-hedged position, $\Theta \approx -\frac12\Gamma S^2\sigma^2$. Long gamma pays theta every day and profits when realized moves exceed what implied vol priced in.
- **Vega** is usually bucketed by expiry, since vols across tenors don't move together. Skew risk is a separate exposure.

## Rules of thumb every trader knows

- ATM option ≈ $0.4\,S\sigma\sqrt T$; ATM straddle ≈ $0.8\,S\sigma\sqrt T$.
- **Implied daily move** ≈ σ/16, because √252 ≈ 15.9. A 32-vol stock is pricing about 2% moves a day.
- ATM delta ≈ 0.5; ATM gamma and vega are the largest; short-dated ATM options have huge gamma and small vega, long-dated ones the opposite.
- Implied vol on indices tends to exceed subsequently realized vol: the **volatility risk premium**, paid by hedgers to vol sellers who bear crash risk.
"""

QUESTIONS = [
    {"type": "number", "prompt": "A delta-hedged option position has gamma 0.05 per $1, the stock is at 100 and implied vol is 20%. With r = 0, what is its approximate theta per year?",
     "answer": -10, "explanation": "Θ ≈ −½ Γ S² σ² = −½ × 0.05 × 10,000 × 0.04 = −10 per year, about −0.04 per trading day."},
    {"type": "choice", "prompt": "Roughly what is the delta of an at-the-money call with short maturity and low rates?",
     "choices": ["0.5", "0.25", "1.0", "0"], "answer": 0, "explanation": "N(d₁) with d₁ ≈ 0 near the money for short maturities, giving about 0.5."},
    {"type": "number", "prompt": "You hold 10 call contracts (delta 0.6, multiplier 100) and you're short 500 shares. What is your net delta in shares?",
     "answer": 100, "explanation": "10 × 0.6 × 100 = 600 shares of delta from the calls, minus 500 shares = +100 shares."},
    {"type": "number", "prompt": "An option has vega 0.20 per vol point. Implied vol rises by 3 points. Approximately how much does the option price change?",
     "answer": 0.6, "explanation": "0.20 × 3 = +0.60."},
    {"type": "choice", "prompt": "For a typical equity index, how do implied vols compare across strikes?",
     "choices": ["OTM puts have higher implied vol than OTM calls", "OTM calls have higher implied vol than OTM puts", "They are flat across strikes", "ATM has the highest implied vol"],
     "answer": 0, "explanation": "That's the equity skew: crash protection is in demand and returns have fat left tails."},
    {"type": "number", "prompt": "Estimate the price of a 1-month ATM straddle on a $100 stock with 25% implied vol (r ≈ 0).",
     "answer": 0.8 * 100 * 0.25 * np.sqrt(1 / 12), "tol": 0.02, "display": "≈ 5.77",
     "explanation": "0.8 × S × σ × √T = 0.8 × 100 × 0.25 × 0.2887 ≈ 5.77."},
    {"type": "number", "prompt": "A stock's options trade at 32% implied vol. Roughly what daily move (in %) is the market pricing?",
     "answer": 2, "tol": 0.02, "explanation": "σ/√252 ≈ 32%/16 = 2% per day."},
    {"type": "choice", "prompt": "What does buying a 25-delta risk reversal (long the 25Δ call, short the 25Δ put) express?",
     "choices": ["A view that upside vol is cheap relative to downside vol, plus a bullish delta", "A pure long-volatility view", "A bet that the smile will flatten symmetrically", "A short gamma position"],
     "answer": 0, "explanation": "It's long the call wing and short the put wing: you profit if the skew flattens or the stock rallies."},
    {"type": "open", "prompt": "Why does index implied volatility usually exceed the volatility that is subsequently realized?",
     "explanation": "That's the volatility risk premium. Hedgers (pension funds, structured products, long-only managers) structurally buy downside protection, and vol sellers demand compensation for bearing crash risk: short volatility loses large amounts exactly when everything else does, so it should earn a premium on average. The premium shows up as implied minus realized being positive most of the time, punctuated by big losses for sellers in crises."},
]


def _ivs(seed, n):
    """Random options with at least 5 cents of time value (deep ITM quotes barely identify a vol)."""
    rng = np.random.default_rng(seed)
    S, r, out = 100.0, 0.02, []
    while len(out) < n:
        k, t, s, kd = rng.uniform(70, 130), rng.uniform(0.05, 2.0), rng.uniform(0.1, 0.8), str(rng.choice(["call", "put"]))
        price = float(bs_price(S, k, r, s, t, kd))
        intrinsic = max(S - k * np.exp(-r * t), 0) if kd == "call" else max(k * np.exp(-r * t) - S, 0)
        if price - intrinsic > 0.05:
            out.append((price, S, k, r, t, kd))
    return out


_IV = '''def implied_vol(price: float, S: float, K: float, r: float, T: float, kind: str = "call") -> float:
    lower = max(S - K * np.exp(-r * T), 0.0) if kind == "call" else max(K * np.exp(-r * T) - S, 0.0)
    upper = S if kind == "call" else K * np.exp(-r * T)
    if not lower < price < upper:
        return float("nan")

    def bs(sig):
        d1 = (np.log(S / K) + (r + sig**2 / 2) * T) / (sig * np.sqrt(T))
        d2 = d1 - sig * np.sqrt(T)
        call = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
        return (call if kind == "call" else call - S + K * np.exp(-r * T)), S * norm.pdf(d1) * np.sqrt(T)

    sig = 0.2
    for _ in range(50):                      # Newton
        value, vega = bs(sig)
        if abs(value - price) < 1e-10:
            return sig
        if vega < 1e-8:
            break
        sig -= (value - price) / vega
        if not 1e-4 < sig < 5:
            break
    lo, hi = 1e-4, 5.0                       # bisection fallback
    for _ in range(200):
        mid = (lo + hi) / 2
        if bs(mid)[0] > price:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2
'''

_BSG = '''def bs_greeks(S, K, r, sigma, T, kind="call"):
    sq = sigma * np.sqrt(T)
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / sq
    d2 = d1 - sq
    disc = K * np.exp(-r * T)
    gamma = norm.pdf(d1) / (S * sq)
    vega = S * norm.pdf(d1) * np.sqrt(T)
    decay = -S * norm.pdf(d1) * sigma / (2 * np.sqrt(T))
    if kind == "call":
        return {"delta": norm.cdf(d1), "gamma": gamma, "vega": vega, "theta": decay - r * disc * norm.cdf(d2)}
    return {"delta": norm.cdf(d1) - 1, "gamma": gamma, "vega": vega, "theta": decay + r * disc * norm.cdf(-d2)}
'''

_IMPORTS = "import numpy as np\nimport pandas as pd\nfrom scipy.stats import norm\n\n\n"


def _positions(seed):
    rng = np.random.default_rng(seed)
    n = 6
    return pd.DataFrame({"type": rng.choice(["call", "put"], n), "strike": rng.choice([90.0, 95.0, 100.0, 105.0, 110.0], n),
                         "T": rng.choice([0.08, 0.25, 0.5], n), "iv": rng.uniform(0.15, 0.35, n),
                         "qty": rng.choice([-20, -10, 5, 10, 25], n)})


def _chain_with_iv(seed):
    ns = {}
    exec(_IMPORTS + _IV, ns)
    chain = option_chain(seed=seed)
    mid = (chain["bid"] + chain["ask"]) / 2
    chain = chain.assign(mid=mid, iv=[ns["implied_vol"](m, 100.0, k, 0.02, t, kd) for m, k, t, kd
                                      in zip(mid, chain["strike"], chain["T"], chain["type"])])
    return chain, 100.0, 0.02


PROBLEMS = [
    {
        "id": "t7_implied_vol",
        "title": "Implied volatility solver",
        "difficulty": "Medium",
        "libs": ["numpy", "scipy.stats"],
        "fn": "implied_vol",
        "description": r"""
Return the Black–Scholes implied volatility of a European option price (no dividends), or `nan` when the price is outside the no-arbitrage bounds:

- call: $\max(S - Ke^{-rT}, 0) < P < S$
- put: $\max(Ke^{-rT} - S, 0) < P < Ke^{-rT}$

Solve with Newton's method on vega starting from σ = 0.2, and fall back to bisection on [0.0001, 5] whenever Newton stalls (tiny vega) or steps outside that range. Results are checked to 6 significant digits, so solve tightly (price error below 1e-10, or bisect to machine precision).

### Learn
Inside the bounds the BS price is strictly increasing in σ, so the solution is unique, and a robust solver must find it for deep OTM and very short options too, where vega is tiny and naive Newton diverges. Bisection is slow but can't fail.

The tests include random strikes, maturities and vols from 10% to 80%, plus an impossible price. They avoid deep in-the-money quotes with almost no time value: there the price barely depends on σ, so many vols reproduce it equally well and the implied vol is not meaningful. A good habit: write the inverse, then check that `bs(implied_vol(p)) == p`.
""",
        "starter": '''import numpy as np
from scipy.stats import norm


def implied_vol(price: float, S: float, K: float, r: float, T: float, kind: str = "call") -> float:
    # your code here
    pass
''',
        "solution": "import numpy as np\nfrom scipy.stats import norm\n\n\n" + _IV,
        "hints": ["Check the no-arbitrage bounds first and return `float('nan')` outside them.",
                  "Write one helper that returns both the BS price and vega for a given σ."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "ATM call priced at 20% vol", "sample": True, "args": (float(bs_price(100, 100, 0.02, 0.2, 0.5, "call")), 100, 100, 0.02, 0.5, "call")},
            {"name": "deep OTM put, short maturity", "args": (float(bs_price(100, 70, 0.02, 0.45, 0.05, "put")), 100, 70, 0.02, 0.05, "put")},
            {"name": "high-vol long-dated call", "args": (float(bs_price(100, 120, 0.02, 0.8, 2.0, "call")), 100, 120, 0.02, 2.0, "call")},
            {"name": "price below intrinsic: no solution", "args": (5.0, 100, 90, 0.02, 0.5, "call")},
            *[{"name": f"random option {i + 1}", "args": a} for i, a in enumerate(_ivs(1, 6))],
        ],
    },
    {
        "id": "t7_chain_iv",
        "title": "Implied vols for a whole option chain",
        "difficulty": "Easy",
        "libs": ["pandas"],
        "fn": "chain_ivs",
        "description": r"""
Given a chain DataFrame with columns `T`, `strike`, `type`, `bid`, `ask`, return a copy with two new columns:

- `mid` = (bid + ask)/2
- `iv` = the implied vol of the mid (your solver), `nan` where none exists

### Learn
Real chains are messy: crossed quotes, stale prices, zero bids. Computing IV from the mid and letting impossible prices come out as NaN is the first cleaning step; the options-desk project goes further.

Apply your scalar solver row by row (a list comprehension over `zip(...)` of the columns is clean and fast enough). Import it with `from t7_implied_vol import implied_vol`.
""",
        "starter": '''import numpy as np
import pandas as pd


def chain_ivs(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _IV + '''

def chain_ivs(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    out = chain.copy()
    out["mid"] = (out["bid"] + out["ask"]) / 2
    out["iv"] = [implied_vol(m, S, k, r, t, kind) for m, k, t, kind
                 in zip(out["mid"], out["strike"], out["T"], out["type"])]
    return out
''',
        "hints": ["Don't modify the input; work on `chain.copy()`."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "clean chain", "sample": True, "args": (option_chain(expiries=(0.25,), seed=1), 100.0, 0.02)},
            {"name": "full chain with bad quotes", "args": (option_chain(bad=6, seed=2), 100.0, 0.02)},
        ],
    },
    {
        "id": "t7_portfolio_greeks",
        "title": "Aggregate position Greeks",
        "difficulty": "Easy",
        "libs": ["numpy", "pandas", "scipy.stats"],
        "fn": "portfolio_greeks",
        "description": r"""
`positions` is a DataFrame with columns `type`, `strike`, `T`, `iv` (each option's implied vol) and `qty` (number of options, negative = short). Return a dict with the portfolio's total `delta`, `gamma`, `vega` and `theta`: the sum over positions of qty × the Black–Scholes Greek (same conventions as the foundation step: vega per 1.00 of vol, theta per year).

### Learn
Greeks are linear in position size, so risk aggregates by summing. That's why a book of hundreds of options reduces to a handful of numbers a trader can manage. In practice you'd also multiply by the contract multiplier and convert to "cash" Greeks: cash delta = Δ·S, dollar gamma = ½Γ·S²·(1%)², and so on.

Reuse your Greeks: `from f6_bs_greeks import bs_greeks`.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.stats import norm


def portfolio_greeks(positions: pd.DataFrame, S: float, r: float) -> dict:
    # return {"delta": ..., "gamma": ..., "vega": ..., "theta": ...}
    pass
''',
        "solution": _IMPORTS + _BSG + '''

def portfolio_greeks(positions: pd.DataFrame, S: float, r: float) -> dict:
    total = {"delta": 0.0, "gamma": 0.0, "vega": 0.0, "theta": 0.0}
    for row in positions.itertuples():
        g = bs_greeks(S, row.strike, r, row.iv, row.T, row.type)
        for key in total:
            total[key] += row.qty * g[key]
    return total
''',
        "hints": ["`positions.itertuples()` gives named rows: `row.strike`, `row.qty`, …"],
        "cases": lambda: [
            {"name": "long straddle", "sample": True,
             "args": (pd.DataFrame({"type": ["call", "put"], "strike": [100.0, 100.0], "T": [0.25, 0.25], "iv": [0.2, 0.2], "qty": [10, 10]}), 100.0, 0.01)},
            {"name": "mixed book", "args": (_positions(1), 100.0, 0.02)},
            {"name": "another book", "args": (_positions(2), 103.0, 0.03)},
        ],
    },
    {
        "id": "t7_smile_fit",
        "title": "Fit the smile per expiry",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "fit_smile",
        "description": r"""
Given a chain that already has an `iv` column (from the previous task), fit a quadratic smile for each expiry. Use only **out-of-the-money** quotes with a real bid: puts with strike < forward, calls with strike ≥ forward, `bid > 0`, and a non-NaN `iv`. With forward $F = Se^{rT}$ and $k = \ln(K/F)$, fit

$$\sigma(k) = a + b\,k + c\,k^2$$

by least squares (`np.polyfit(k, iv, 2)` returns `[c, b, a]`). Return a DataFrame indexed by `T` (sorted) with columns `atm_vol` (a), `skew` (b) and `curvature` (c).

### Learn
Why OTM only? OTM options are the liquid ones, and ITM options' prices are dominated by intrinsic value, so their implied vols are noisy. Put–call parity makes the two sides equivalent anyway.

The synthetic smile has true skew −0.15 and curvature 0.4: see how close your fit gets per expiry. On real data, plot the fitted curves on top of the points for each expiry in a notebook.
""",
        "starter": '''import numpy as np
import pandas as pd


def fit_smile(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def fit_smile(chain: pd.DataFrame, S: float, r: float) -> pd.DataFrame:
    rows = {}
    for T, g in chain.groupby("T"):
        F = S * np.exp(r * T)
        otm = ((g["type"] == "put") & (g["strike"] < F)) | ((g["type"] == "call") & (g["strike"] >= F))
        g = g[otm & (g["bid"] > 0) & g["iv"].notna()]
        c, b, a = np.polyfit(np.log(g["strike"] / F), g["iv"], 2)
        rows[T] = {"atm_vol": a, "skew": b, "curvature": c}
    return pd.DataFrame.from_dict(rows, orient="index").sort_index()
''',
        "hints": ["`chain.groupby('T')` gives one sub-frame per expiry."],
        "rtol": 1e-5,
        "cases": lambda: [
            {"name": "4 expiries", "sample": True, "args": _chain_with_iv(1)},
            {"name": "another chain", "args": _chain_with_iv(3)},
        ],
    },
]
