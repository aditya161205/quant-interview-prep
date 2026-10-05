import numpy as np
import pandas as pd

from data import bs_price, ssvi_slice, svi_chain, svi_w

TITLE = "Volatility surfaces and models"
SUMMARY = "SVI smiles fitted with scipy, static no-arbitrage checks, risk-neutral densities from prices, the variance swap (VIX) formula, and where skew comes from in the Heston model."
KIND = "core"

LESSON = r"""
Options research starts from the implied volatility surface: one number per strike and expiry that the whole market agrees on at a moment in time. Researchers turn raw quotes into a smooth, arbitrage-free surface, read the risk-neutral distribution off it, and ask which models reproduce it. This step builds those tools; the next one chains them into a project.

## Coordinates that make surfaces comparable

- **Log-moneyness** $k = \ln(K/F)$ with forward $F = Se^{rT}$, so smiles at different expiries line up at the forward.
- **Total implied variance** $w(k, T) = \sigma^2(k, T)\,T$. Arbitrage conditions are simplest in w.

## Static no-arbitrage

A surface admits riskless profits unless:
- **Monotonicity**: call prices fall as the strike rises.
- **Butterfly**: call prices are convex in strike. A butterfly ($C_{K-h} - 2C_K + C_{K+h}$) is a non-negative payoff, so its price can't be negative. Equivalently, the risk-neutral density is non-negative.
- **Calendar**: at fixed log-moneyness, total variance can't fall with maturity. With zero rates and dividends, that means a later-expiry call can't be cheaper than an earlier one at the same strike.

Raw quotes violate these all the time (stale prices, wide markets), which is why desks fit a parameterized surface.

## SVI: the industry-standard smile

Raw SVI (Gatheral, 2004) models one expiry's total variance with five parameters:

$$w(k) = a + b\left(\rho(k-m) + \sqrt{(k-m)^2 + \sigma^2}\right)$$

a sets the level, b the overall slope of the wings, ρ the asymmetry (negative for equity skew), m shifts the smile, σ rounds its bottom. The wings become linear in k, consistent with Lee's moment formula, and **SSVI** ties slices together so the whole surface is arbitrage-free. You fit SVI per expiry by non-linear least squares (`scipy.optimize.least_squares` with bounds). Rates and FX desks use **SABR** in the same role.

## The risk-neutral density

**Breeden–Litzenberger**: the second derivative of the call price in strike is the discounted risk-neutral density, $q(K) = e^{rT}\,\partial^2 C/\partial K^2$. Its moments are option-implied forecasts: equity densities have a fat left tail (negative skewness), the crash risk that the skew prices. Differentiating noisy quotes twice amplifies noise, so in practice you differentiate a fitted surface.

## Variance swaps and the VIX

A variance swap pays realized variance minus a strike fixed today. Its fair strike can be replicated **model-free** with a strip of out-of-the-money options weighted by $1/K^2$:

$$K_{var} = \frac{2e^{rT}}{T}\int_0^\infty \frac{Q(K)}{K^2}\,dK$$

(Q = the OTM put below the forward, the OTM call above). The CBOE VIX is exactly this, computed from S&P 500 options at a 30-day horizon. Because puts carry high implied vols and get large weights, $K_{var}$ sits above ATM implied variance whenever there is skew.

## Models: why the smile exists

- **Local volatility** (Dupire): the unique diffusion $dS = \mu S\,dt + \sigma(S, t)S\,dW$ matching today's surface exactly. Great for pricing consistency; poor dynamics (the smile moves the wrong way as spot moves).
- **Stochastic volatility** (Heston): $dv = \kappa(\theta - v)dt + \xi\sqrt v\,dW_2$ with $\text{corr}(dW_1, dW_2) = \rho$. Negative ρ (vol rises when spot falls, the leverage effect) creates the equity skew; vol-of-vol ξ creates smile curvature; κ and θ shape the term structure. Prices have a semi-closed form through the characteristic function; simulation works for anything.

## Surface dynamics, briefly

As spot moves, does a strike keep its vol (**sticky strike**) or does the smile move with spot (**sticky moneyness**)? The answer changes your effective delta. Sensitivities to the spot–vol interaction (**vanna**) and to vol-of-vol (**volga**) are how traders think about skew and convexity risk, and the 25-delta risk reversal and butterfly are how they quote them.
"""

QUESTIONS = [
    {"type": "number", "prompt": "A 3-month option has an implied vol of 20%. What is its total implied variance w = σ²T?",
     "answer": 0.01, "explanation": "w = 0.2² × 0.25 = 0.01."},
    {"type": "choice", "prompt": "Which condition rules out calendar arbitrage on an implied volatility surface?",
     "choices": ["Total implied variance is non-decreasing in maturity at fixed log-moneyness", "Implied vol is non-decreasing in maturity at every strike",
                 "Call prices are convex in strike", "The ATM vol term structure slopes upward"],
     "answer": 0, "explanation": "Implied vol itself can fall with maturity (an inverted term structure is common in stress); total variance σ²T can't, at fixed k."},
    {"type": "number", "prompt": "Undiscounted call prices are C(95) = 7.0, C(100) = 4.0 and C(105) = 2.0, with r = 0. Estimate the risk-neutral density at K = 100.",
     "answer": 0.04, "explanation": "q(100) ≈ (C(95) − 2C(100) + C(105))/ΔK² = (7 − 8 + 2)/25 = 0.04 per unit of strike."},
    {"type": "number", "prompt": "You're long a variance swap with vega notional $10,000 struck at 20 vol (variance notional = vega notional / (2 × strike) per variance point). Realized vol is 25. What's your payoff in dollars?",
     "answer": 56250, "display": "$56,250", "explanation": "Variance notional = 10,000/(2 × 20) = 250 per variance point. Payoff = 250 × (25² − 20²) = 250 × 225 = $56,250. Note the convexity: a 5-point move up pays more than a 5-point move down would cost (250 × 175 = $43,750)."},
    {"type": "choice", "prompt": "Why does an equity variance swap usually strike above the ATM implied volatility?",
     "choices": ["The replication weights OTM options by 1/K², and the expensive downside puts get large weights", "Variance swaps include a dealer fee",
                 "Realized volatility is always higher than implied", "ATM options are less liquid"],
     "answer": 0, "explanation": "The strike is a weighted average of implied variance across strikes, tilted to low strikes. With a negative skew, that average exceeds ATM variance."},
    {"type": "choice", "prompt": "In the Heston model, what produces the downward-sloping equity skew?",
     "choices": ["A negative correlation ρ between spot and variance shocks", "A high mean-reversion speed κ", "A long-run variance θ above v₀", "A positive interest rate"],
     "answer": 0, "explanation": "With ρ < 0, falling prices come with rising vol, fattening the left tail of returns, which makes downside options dearer. Vol-of-vol ξ adds curvature to both wings."},
    {"type": "open", "prompt": "How would you check an implied volatility surface for static arbitrage, and what would you do about violations?",
     "explanation": "Check call prices are decreasing and convex in strike at each expiry (no negative butterflies) and that total variance is non-decreasing in maturity at fixed log-moneyness (no calendar arbitrage). With a fitted SVI slice, Gatheral's g(k) ≥ 0 is the density condition. Violations in raw quotes usually mean stale or wide quotes: filter by quality, then fit a parameterization that is arbitrage-free by construction (SSVI, or SVI with constraints) and check the fitted surface again before using it for pricing or risk."},
]


def _smile(T, seed, noise=0.01, n=21):
    theta = (0.18 + 0.03 * np.sqrt(T)) ** 2 * T
    k = np.linspace(-0.6, 0.4, n)
    w = svi_w(k, *ssvi_slice(theta)) * (1 + noise * np.random.default_rng(seed).standard_normal(n))
    return k, w


def _ssvi_calls(strikes, expiries, S=100.0, r=0.0):
    cols = {}
    for T in expiries:
        F = S * np.exp(r * T)
        iv = np.sqrt(svi_w(np.log(strikes / F), *ssvi_slice((0.18 + 0.03 * np.sqrt(T)) ** 2 * T)) / T)
        cols[T] = bs_price(S, strikes, r, iv, T)
    return pd.DataFrame(cols, index=pd.Index(strikes, name="strike"))


def _bad_calls(seed):
    rng = np.random.default_rng(seed)
    calls = _ssvi_calls(np.arange(60.0, 145.0, 5.0), [0.1, 0.25, 0.5, 1.0])
    K, T = calls.index.to_numpy(), list(calls.columns)
    i = rng.integers(3, len(K) - 3)
    calls.loc[K[i], T[1]] += 0.6                                       # a rich quote: negative butterfly
    j = rng.integers(2, len(K) - 2)
    calls.loc[K[j], T[3]] = calls.loc[K[j], T[2]] - 0.3                # cheaper than the shorter expiry
    m = rng.integers(len(K) // 2, len(K) - 1)
    calls.loc[K[m + 1], T[0]] = calls.loc[K[m], T[0]] + 0.05           # price rises with strike
    return calls


def _chain_slice(T, seed):
    c = svi_chain(expiries=(T,), seed=seed)
    return c.drop(columns="T"), 100.0, 0.02, T


PROBLEMS = [
    {
        "id": "r16_svi_fit",
        "title": "Fit an SVI smile with scipy.optimize.least_squares",
        "difficulty": "Medium",
        "libs": ["scipy.optimize", "numpy"],
        "fn": "svi_fit",
        "description": r"""
Fit raw SVI to one expiry's total implied variance. Inputs: log-moneyness `k` and total variance `w` (arrays).

1. model: $w(k) = a + b\left(\rho(k-m) + \sqrt{(k-m)^2 + \sigma^2}\right)$ with parameters x = (a, b, ρ, m, σ)
2. `scipy.optimize.least_squares(residuals, x0, bounds=(lower, upper))` on the residuals model − w, with `x0 = [0.5 * min(w), 0.1, -0.5, 0.0, 0.1]`, `lower = [-1.0, 1e-4, -0.999, -1.0, 1e-4]`, `upper = [1.0, 5.0, 0.999, 1.0, 2.0]`
3. return a dict: `params` (the 5 fitted values, as an array), `fitted` (model values at k) and `rmse` (root mean squared residual)

### Learn
`least_squares` is scipy's workhorse for calibration: it takes a vector of residuals rather than a scalar loss, handles bounds, and uses a trust-region method that copes with the mild non-linearity here. Bounds encode what's sensible: b > 0, |ρ| < 1, σ > 0.

The test smiles come from an SSVI surface with ρ = −0.7, plus 1% noise. Check how close the fitted ρ gets, and plot `fitted` against the data in a notebook. Convert back to implied vol with $\sigma_{impl} = \sqrt{w/T}$.
""",
        "starter": '''import numpy as np
from scipy.optimize import least_squares


def svi_fit(k, w) -> dict:
    # return {"params": ..., "fitted": ..., "rmse": ...}
    pass
''',
        "solution": '''import numpy as np
from scipy.optimize import least_squares


def svi(k, a, b, rho, m, sigma):
    return a + b * (rho * (k - m) + np.sqrt((k - m) ** 2 + sigma**2))


def svi_fit(k, w) -> dict:
    k, w = np.asarray(k, dtype=float), np.asarray(w, dtype=float)
    res = least_squares(lambda x: svi(k, *x) - w, [0.5 * w.min(), 0.1, -0.5, 0.0, 0.1],
                        bounds=([-1.0, 1e-4, -0.999, -1.0, 1e-4], [1.0, 5.0, 0.999, 1.0, 2.0]))
    fitted = svi(k, *res.x)
    return {"params": res.x, "fitted": fitted, "rmse": float(np.sqrt(np.mean((fitted - w) ** 2)))}
''',
        "hints": ["Write the SVI formula as its own function and reuse it for the residuals and the fitted values."],
        "rtol": 1e-5,
        "atol": 1e-7,
        "cases": lambda: [
            {"name": "3-month smile", "sample": True, "args": _smile(0.25, 1)},
            {"name": "1-year smile", "args": _smile(1.0, 2)},
            {"name": "1-month smile, noisier", "args": _smile(1 / 12, 3, 0.02)},
        ],
    },
    {
        "id": "r16_arbitrage",
        "title": "Detect static arbitrage in a grid of call prices",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "static_arbitrage",
        "description": r"""
`calls` holds undiscounted call prices with zero rates and dividends: index = strikes (ascending), columns = expiries (ascending). Find every violation, with tolerance `tol`:

- **monotonicity**: at each expiry, a price above the previous strike's price by more than `tol` → record `(T, K)` for the higher strike
- **butterfly**: at each interior strike $K_i$ of each expiry, the slope to the right $\frac{C_{i+1}-C_i}{K_{i+1}-K_i}$ is below the slope to the left $\frac{C_i-C_{i-1}}{K_i-K_{i-1}}$ by more than `tol` → record `(T, K_i)`
- **calendar**: for each expiry after the first, a price below the previous expiry's price at the same strike by more than `tol` → record `(T, K)` for the later expiry

Return a dict with keys `"monotonicity"`, `"butterfly"`, `"calendar"`, each a list of `(T, K)` tuples ordered by expiry, then strike.

### Learn
Each rule is a trade: buy the cheaper call and sell the dearer one (monotonicity), buy a butterfly for less than nothing (convexity), or sell the short-dated call and buy the long-dated one at the same strike (calendar). The tests take an arbitrage-free SSVI grid and plant one bad quote of each kind. Notice that a single bad price can trip several checks at neighbouring strikes, which is why the report lists them all.
""",
        "starter": '''import numpy as np
import pandas as pd


def static_arbitrage(calls: pd.DataFrame, tol: float = 1e-8) -> dict:
    # return {"monotonicity": [...], "butterfly": [...], "calendar": [...]}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def static_arbitrage(calls: pd.DataFrame, tol: float = 1e-8) -> dict:
    K = calls.index.to_numpy(dtype=float)
    out = {"monotonicity": [], "butterfly": [], "calendar": []}
    for j, T in enumerate(calls.columns):
        C = calls[T].to_numpy(dtype=float)
        out["monotonicity"] += [(T, K[i]) for i in range(1, len(K)) if C[i] > C[i - 1] + tol]
        slope = np.diff(C) / np.diff(K)
        out["butterfly"] += [(T, K[i]) for i in range(1, len(K) - 1) if slope[i] < slope[i - 1] - tol]
        if j:
            prev = calls[calls.columns[j - 1]].to_numpy(dtype=float)
            out["calendar"] += [(T, K[i]) for i in range(len(K)) if C[i] < prev[i] - tol]
    return out
''',
        "hints": ["`np.diff(C) / np.diff(K)` gives the slope between neighbouring strikes; compare consecutive slopes."],
        "cases": lambda: [
            {"name": "SSVI grid with three planted errors", "sample": True, "args": (_bad_calls(1),)},
            {"name": "another grid", "args": (_bad_calls(4),)},
            {"name": "a clean grid has no violations", "args": (_ssvi_calls(np.arange(60.0, 145.0, 5.0), [0.1, 0.25, 0.5, 1.0]),)},
        ],
    },
    {
        "id": "r16_rn_density",
        "title": "The risk-neutral density from call prices",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "rn_density",
        "description": r"""
Apply Breeden–Litzenberger to call prices on an **equally spaced** strike grid (spacing ΔK):

1. density at each interior strike: $q_i = e^{rT}\,\frac{C_{i-1} - 2C_i + C_{i+1}}{\Delta K^2}$
2. `total` = Σ q ΔK (the probability captured by the grid)
3. `mean` = Σ K q ΔK / total, variance = Σ (K − mean)² q ΔK / total, and `skew` = Σ (K − mean)³ q ΔK / total / variance^1.5

Return a dict: `strikes` (the interior strikes), `density`, `total`, `mean`, `skew`.

### Learn
Two checks tell you it worked: `total` is close to 1, and `mean` is close to the forward $Se^{rT}$ (the risk-neutral expected price). The skewness comes out clearly negative: this is the crash risk the equity skew prices, in distribution form. Try the same on raw market quotes in a notebook and watch the density turn jagged and even negative, the reason researchers differentiate a fitted surface instead.
""",
        "starter": '''import numpy as np


def rn_density(strikes, calls, r: float, T: float) -> dict:
    # return {"strikes": ..., "density": ..., "total": ..., "mean": ..., "skew": ...}
    pass
''',
        "solution": '''import numpy as np


def rn_density(strikes, calls, r: float, T: float) -> dict:
    K, C = np.asarray(strikes, dtype=float), np.asarray(calls, dtype=float)
    dK = K[1] - K[0]
    q = np.exp(r * T) * (C[:-2] - 2 * C[1:-1] + C[2:]) / dK**2
    Ki = K[1:-1]
    total = q.sum() * dK
    mean = (Ki * q).sum() * dK / total
    var = ((Ki - mean) ** 2 * q).sum() * dK / total
    skew = ((Ki - mean) ** 3 * q).sum() * dK / total / var**1.5
    return {"strikes": Ki, "density": q, "total": total, "mean": mean, "skew": skew}
''',
        "hints": ["Vectorize the second difference with slices: `C[:-2] - 2 * C[1:-1] + C[2:]`."],
        "cases": lambda: [
            {"name": "6-month SSVI smile, fine grid", "sample": True,
             "args": (np.arange(20.0, 250.5, 0.5), _ssvi_calls(np.arange(20.0, 250.5, 0.5), [0.5], r=0.02)[0.5].to_numpy(), 0.02, 0.5)},
            {"name": "1-month, coarser grid", "args": (np.arange(50.0, 160.0, 1.0), _ssvi_calls(np.arange(50.0, 160.0, 1.0), [1 / 12])[1 / 12].to_numpy(), 0.0, 1 / 12)},
        ],
    },
    {
        "id": "r16_var_swap",
        "title": "Variance swap strike from option prices (the VIX formula)",
        "difficulty": "Hard",
        "libs": ["pandas", "numpy"],
        "fn": "var_swap_strike",
        "description": r"""
Compute the model-free variance swap strike from one expiry's quotes (`strike`, `type`, `bid`, `ask`), following the CBOE VIX method:

1. mid prices; for each strike with both a call and a put, find the strike K* where |call mid − put mid| is smallest; forward $F = K^* + e^{rT}(C - P)$ at K*
2. $K_0$ = the largest strike ≤ F
3. Q(K) = the put mid for K < K₀, the call mid for K > K₀, and the average of the two at K₀; keep only strikes whose chosen option(s) have bid > 0
4. over the kept strikes (ascending), ΔKᵢ = (Kᵢ₊₁ − Kᵢ₋₁)/2, using the distance to the single neighbour at either end
5. $\sigma^2 = \frac{2}{T}\sum_i \frac{\Delta K_i}{K_i^2}e^{rT}Q(K_i) - \frac{1}{T}\left(\frac{F}{K_0}-1\right)^2$

Return a dict: `forward`, `k0`, `var_strike` (σ²) and `vol_strike` (√σ²).

### Learn
The last term corrects for using $K_0$ instead of the exact forward as the put/call dividing line. On a skewed surface `vol_strike` lands above the ATM implied vol (compare with your solver from the volatility step), and the gap is the price of skew. Run it at a 30-day horizon on real SPX options and you've rebuilt the VIX. Variance swap traders compare this strike with their forecast of realized volatility, which is the next step's subject.
""",
        "starter": '''import numpy as np
import pandas as pd


def var_swap_strike(chain: pd.DataFrame, S: float, r: float, T: float) -> dict:
    # return {"forward": ..., "k0": ..., "var_strike": ..., "vol_strike": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def var_swap_strike(chain: pd.DataFrame, S: float, r: float, T: float) -> dict:
    q = chain.assign(mid=(chain["bid"] + chain["ask"]) / 2)
    mid = q.pivot(index="strike", columns="type", values="mid").dropna()
    bid = q.pivot(index="strike", columns="type", values="bid").loc[mid.index]
    ks = (mid["call"] - mid["put"]).abs().idxmin()
    F = ks + np.exp(r * T) * (mid.loc[ks, "call"] - mid.loc[ks, "put"])
    K = mid.index.to_numpy(dtype=float)
    k0 = K[K <= F].max()
    Q = np.where(K < k0, mid["put"], np.where(K > k0, mid["call"], (mid["call"] + mid["put"]) / 2))
    ok = np.where(K < k0, bid["put"] > 0, np.where(K > k0, bid["call"] > 0, (bid["call"] > 0) & (bid["put"] > 0)))
    K, Q = K[ok], Q[ok]
    dK = np.gradient(K) if len(K) > 1 else np.ones(1)
    var = 2 / T * np.sum(dK / K**2 * np.exp(r * T) * Q) - (F / k0 - 1) ** 2 / T
    return {"forward": F, "k0": k0, "var_strike": var, "vol_strike": np.sqrt(var)}
''',
        "hints": ["`pivot(index='strike', columns='type', values='mid')` puts calls and puts side by side.",
                  "`np.gradient(K)` gives exactly the ΔK rule: half the neighbour distance inside, one-sided at the ends."],
        "rtol": 1e-8,
        "cases": lambda: [
            {"name": "3-month SSVI chain", "sample": True, "args": _chain_slice(0.25, 1)},
            {"name": "1-month chain (the VIX horizon)", "args": _chain_slice(1 / 12, 2)},
            {"name": "1-year chain", "args": _chain_slice(1.0, 3)},
        ],
    },
    {
        "id": "r16_heston",
        "title": "Heston Monte Carlo: where the skew comes from",
        "difficulty": "Hard",
        "libs": ["numpy", "scipy.optimize", "pandas"],
        "fn": "heston_smile",
        "description": r"""
Simulate the Heston model and read off the smile it implies. With Δt = T/`n_steps`, start every path at log S₀ and v₀; at each step draw, in this order, `z1 = rng.standard_normal(n_paths)` and `z = rng.standard_normal(n_paths)` (with `rng = np.random.default_rng(seed)`), set $z_2 = \rho z_1 + \sqrt{1-\rho^2}\,z$ and $v^+ = \max(v, 0)$, then (full-truncation Euler):

$$\ln S \mathrel{+}= (r - \tfrac12 v^+)\Delta t + \sqrt{v^+\Delta t}\,z_1, \qquad v \mathrel{+}= \kappa(\theta - v^+)\Delta t + \xi\sqrt{v^+\Delta t}\,z_2$$

For each strike, the call price is $e^{-rT}\,\text{mean}(\max(S_T - K, 0))$ and its implied vol solves BS(σ) = price with `scipy.optimize.brentq` on [1e-4, 5]. Return a DataFrame indexed by strike with columns `price` and `iv`.

### Learn
Run it with ρ = −0.7 and then ρ = +0.3: the skew flips sign. Raise ξ and both wings lift (more curvature); κ and θ control how the smile flattens with maturity. Full truncation (using v⁺ in the drift and diffusion) keeps the scheme stable when the variance touches zero, a classic Heston pitfall. Production calibration uses the characteristic-function formula instead, which is fast enough to fit five parameters to a whole surface with `least_squares`.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.stats import norm


def heston_smile(S0: float, r: float, T: float, v0: float, kappa: float, theta: float, xi: float, rho: float,
                 strikes, n_paths: int = 50_000, n_steps: int = 50, seed: int = 0) -> pd.DataFrame:
    # return a DataFrame indexed by strike with columns price and iv
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from scipy.optimize import brentq
from scipy.stats import norm


def bs_call(S, K, r, sigma, T):
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * np.sqrt(T))
    return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d1 - sigma * np.sqrt(T))


def heston_smile(S0: float, r: float, T: float, v0: float, kappa: float, theta: float, xi: float, rho: float,
                 strikes, n_paths: int = 50_000, n_steps: int = 50, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dt = T / n_steps
    x, v = np.full(n_paths, np.log(S0)), np.full(n_paths, v0)
    for _ in range(n_steps):
        z1 = rng.standard_normal(n_paths)
        z2 = rho * z1 + np.sqrt(1 - rho**2) * rng.standard_normal(n_paths)
        vp = np.maximum(v, 0.0)
        x += (r - 0.5 * vp) * dt + np.sqrt(vp * dt) * z1
        v += kappa * (theta - vp) * dt + xi * np.sqrt(vp * dt) * z2
    ST = np.exp(x)
    rows = {}
    for K in strikes:
        price = np.exp(-r * T) * np.maximum(ST - K, 0.0).mean()
        rows[K] = {"price": price, "iv": brentq(lambda s: bs_call(S0, K, r, s, T) - price, 1e-4, 5.0)}
    return pd.DataFrame.from_dict(rows, orient="index")
''',
        "hints": ["Keep log S and v as arrays over paths and loop only over time steps.",
                  "Draw z1 and the independent normal in that order each step, or your numbers won't match."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "ρ = −0.7: equity skew", "sample": True,
             "args": (100.0, 0.02, 0.5, 0.04, 2.0, 0.04, 0.6, -0.7, [80.0, 90.0, 100.0, 110.0, 120.0])},
            {"name": "ρ = +0.3: the skew flips", "args": (100.0, 0.02, 0.5, 0.04, 2.0, 0.04, 0.6, 0.3, [80.0, 90.0, 100.0, 110.0, 120.0], 40_000, 50, 1)},
            {"name": "high vol-of-vol, 1 year", "args": (100.0, 0.0, 1.0, 0.06, 1.5, 0.05, 1.0, -0.5, [70.0, 85.0, 100.0, 115.0, 130.0], 40_000, 60, 2)},
        ],
    },
]
