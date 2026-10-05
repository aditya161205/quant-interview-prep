import numpy as np
import pandas as pd

from data import gbm

TITLE = "Delta hedging and volatility trading"
SUMMARY = "Replicating options by hedging, gamma scalping, the P&L of a hedged option, discrete-hedging error, and how traders bet on volatility."
KIND = "core"

LESSON = r"""
A delta-hedged option is a bet on volatility: the direction of the stock no longer matters, only how much it moves compared with what implied volatility priced in. This step derives that and lets you watch it happen in simulation.

## Hedging = replication

Sell an option at its Black–Scholes price, buy Δ shares, and rebalance as Δ changes. In the idealized BS world (continuous hedging, constant σ, no costs) the hedge exactly replicates the option, and you end with zero P&L. That's *why* the BS price is the price.

## The P&L of a hedged option

Over a short interval, a **long** option hedged with −Δ shares earns (Taylor expansion, r = 0):

$$\text{P\&L} \approx \tfrac12\Gamma\,(\Delta S)^2 + \Theta\,\Delta t = \tfrac12\Gamma S^2\left(\left(\tfrac{\Delta S}{S}\right)^2 - \sigma_{imp}^2\Delta t\right)$$

using $\Theta = -\frac12\Gamma S^2\sigma_{imp}^2$. Every day you pay theta for gamma; you win when the realized squared move beats the implied one. Summed over the option's life:

$$\text{total P\&L} \approx \sum_t \tfrac12\Gamma_t S_t^2\,(\sigma_{real}^2 - \sigma_{imp}^2)\,\Delta t$$

- **Long gamma / long vol**: buy options, delta-hedge, and profit if realized > implied ("gamma scalping": you buy low and sell high as you rebalance).
- **Short gamma / short vol**: sell options and collect theta. You profit most of the time, and lose badly in big moves.
- The P&L is path-dependent: it's weighted by gamma, so moves near the strike close to expiry matter most.

## Discrete hedging and costs

Real hedging happens at discrete times, which leaves a hedging error whose standard deviation shrinks roughly like $1/\sqrt{N}$ in the number of rebalances. But every rebalance costs spread and fees, so hedging more often isn't free. Practitioners hedge on bands (rebalance when delta drifts past a threshold) or on a schedule, trading off risk against cost.

## Other ways to trade volatility

- **Straddles and strangles**: long vol with an initial delta near zero, but the delta drifts as the stock moves.
- **Variance swaps**: pay $\sigma_{real}^2 - K_{var}$ directly, with no path dependence on gamma. They're replicated by a static strip of options across strikes.
- **Vega hedging**: offset vega with options of other maturities, or trade calendar spreads on term-structure views.
- **The volatility risk premium**: implied usually exceeds realized on indices, so systematic short vol earns a premium, along with crash risk.

## Pin risk

Near expiry, an ATM option's gamma explodes: a short position can swing between huge long and short deltas as the stock crosses the strike. Traders reduce short-dated ATM exposure into expiry.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "You're long an option and delta-hedge it at its implied vol. When does the position make money?",
     "choices": ["When realized volatility exceeds implied volatility", "When the stock goes up", "When the stock goes down", "When implied volatility falls"],
     "answer": 0, "explanation": "The hedged P&L ≈ ½ΓS²(σ_real² − σ_imp²)Δt, so direction doesn't matter, only realized versus implied variance."},
    {"type": "number", "prompt": "You're long a delta-hedged option with gamma 0.1. Theta costs you 0.032 today. The stock moves $1. What is your approximate P&L for the day?",
     "answer": 0.018, "explanation": "Gamma gain ½ × 0.1 × 1² = 0.05, minus theta 0.032, giving +0.018."},
    {"type": "number", "prompt": "Your long straddle has gamma 0.04 and costs 0.08 of theta per day. How large a daily stock move (in $) do you need to break even?",
     "answer": 2, "explanation": "½ × 0.04 × ΔS² = 0.08, so ΔS² = 4 and ΔS = 2."},
    {"type": "choice", "prompt": "You halve the time between delta rebalances (with no transaction costs). Roughly what happens to the standard deviation of your hedging error?",
     "choices": ["It falls by a factor of about √2", "It halves", "It doesn't change", "It falls to zero"],
     "answer": 0, "explanation": "The hedging error scales like 1/√N in the number of rebalances, so doubling N divides it by √2."},
    {"type": "choice", "prompt": "What does a long variance swap pay at maturity (per unit of variance notional)?",
     "choices": ["Realized variance minus the strike variance", "The return of the underlying", "Implied vol at expiry minus implied vol at inception", "A straddle payoff"],
     "answer": 0, "explanation": "A variance swap pays σ²_realized − K_var: a pure bet on realized volatility, without the gamma path-dependence of a hedged option."},
    {"type": "open", "prompt": "You're short a large amount of near-dated at-the-money options going into expiry. Which risks worry you, and what would you do?",
     "explanation": "Gamma and pin risk: as expiry approaches, ATM gamma explodes, so small moves swing your delta wildly, forcing expensive re-hedging, and around the strike you may not know whether you'll be assigned. Jump or gap risk (news, earnings) can cost far more than the theta collected. Actions: reduce or roll the short ATM exposure before expiry, buy some protection (wings), hedge more often near the strike, and size positions so a big move is survivable."},
]


_BS = '''def _bs(S, K, r, sigma, tau, kind):
    """Price, delta, gamma and theta (per year); at tau <= 0 return the payoff."""
    if tau <= 0:
        payoff = max(S - K, 0.0) if kind == "call" else max(K - S, 0.0)
        return payoff, 0.0, 0.0, 0.0
    sq = sigma * np.sqrt(tau)
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * tau) / sq
    d2 = d1 - sq
    disc = K * np.exp(-r * tau)
    call = S * norm.cdf(d1) - disc * norm.cdf(d2)
    gamma = norm.pdf(d1) / (S * sq)
    decay = -S * norm.pdf(d1) * sigma / (2 * np.sqrt(tau))
    if kind == "call":
        return call, norm.cdf(d1), gamma, decay - r * disc * norm.cdf(d2)
    return call - S + disc, norm.cdf(d1) - 1, gamma, decay + r * disc * norm.cdf(-d2)
'''

_HEDGE = '''def delta_hedge_pnl(S_path, K: float, r: float, sigma: float, T: float, kind: str = "call",
                    hedge_every: int = 1) -> float:
    S = np.asarray(S_path, dtype=float)
    n = len(S) - 1
    dt = T / n
    price, delta = _bs(S[0], K, r, sigma, T, kind)[:2]
    cash = price - delta * S[0]                 # sold the option, bought delta shares
    for i in range(1, n + 1):
        cash *= np.exp(r * dt)
        if i < n and i % hedge_every == 0:
            new_delta = _bs(S[i], K, r, sigma, T - i * dt, kind)[1]
            cash -= (new_delta - delta) * S[i]
            delta = new_delta
    payoff = max(S[n] - K, 0.0) if kind == "call" else max(K - S[n], 0.0)
    return float(cash + delta * S[n] - payoff)
'''

_IMPORTS = "import numpy as np\nimport pandas as pd\nfrom scipy.stats import norm\n\n\n"


def _path(n, sigma, seed, s0=100.0):
    return gbm(n + 1, mu=0.0, sigma=sigma, s0=s0, seed=seed).to_numpy()


PROBLEMS = [
    {
        "id": "t8_delta_hedge",
        "title": "Delta-hedge a short option along a path",
        "difficulty": "Medium",
        "libs": ["numpy", "scipy.stats"],
        "fn": "delta_hedge_pnl",
        "description": r"""
You **sell** one European option at its Black–Scholes price (volatility `sigma`) at the start of `S_path`, and delta-hedge it with the BS delta at that same `sigma`. The path has n + 1 prices spanning `T` years, so Δt = T/n. Return your final P&L:

1. t = 0: receive the option price, buy Δ₀ shares; cash = price − Δ₀·S₀
2. at each step i = 1 … n: grow cash by $e^{r\Delta t}$; if i < n and i is a multiple of `hedge_every`, rebalance to the new delta (time to expiry T − iΔt), paying for the shares out of cash
3. at expiry: P&L = cash + Δ·S_n − option payoff

### Learn
When the path's realized volatility equals the hedging vol, the P&L is close to zero (just discrete-hedging noise). That's replication working. When realized vol is higher, the short-option seller loses, by roughly the formula in the lesson. The tests include both.

Write a helper that returns the BS price and delta for any time to expiry, and reuse it. A rebalance at step i uses the time left at that moment, T − iΔt.
""",
        "starter": '''import numpy as np
from scipy.stats import norm


def delta_hedge_pnl(S_path, K: float, r: float, sigma: float, T: float, kind: str = "call",
                    hedge_every: int = 1) -> float:
    # your code here
    pass
''',
        "solution": _IMPORTS + _BS + "\n\n" + _HEDGE,
        "hints": ["Cash accrues interest every step, whether or not you rebalance.",
                  "Never rebalance at the final step: the option expires there."],
        "cases": lambda: [
            {"name": "realized vol = implied vol (20%)", "sample": True, "args": (_path(252, 0.2, 1), 100, 0.02, 0.2, 1.0)},
            {"name": "realized 35% vs implied 20%", "args": (_path(252, 0.35, 2), 100, 0.02, 0.2, 1.0)},
            {"name": "put, weekly hedging", "args": (_path(126, 0.25, 3), 95, 0.01, 0.25, 0.5, "put", 5)},
            {"name": "realized 10% vs implied 30%", "args": (_path(63, 0.1, 4), 102, 0.0, 0.3, 0.25)},
        ],
    },
    {
        "id": "t8_pnl_explain",
        "title": "P&L explain: gamma versus theta",
        "difficulty": "Hard",
        "libs": ["numpy", "pandas", "scipy.stats"],
        "fn": "pnl_explain",
        "description": r"""
Decompose the daily P&L of a **long** option, delta-hedged at implied vol `sigma` with r = 0. The path has n + 1 prices over `T` years (Δt = T/n, time to expiry $\tau_i = T - i\Delta t$; at $\tau = 0$ the option is worth its payoff). For each step i = 1 … n, using Greeks computed at the start of the step (price $S_{i-1}$, time $\tau_{i-1}$):

- `gamma` = $\tfrac12\Gamma_{i-1}(S_i - S_{i-1})^2$
- `theta` = $\Theta_{i-1}\,\Delta t$ (Θ per year, so this is negative)
- `actual` = $V(S_i, \tau_i) - V(S_{i-1}, \tau_{i-1}) - \Delta_{i-1}(S_i - S_{i-1})$, the true P&L of the hedged position

Return a DataFrame with columns `gamma`, `theta`, `actual` and index 1 … n.

### Learn
This is the "P&L explain" every options desk produces daily: actual P&L versus what the Greeks predict. The gamma + theta columns should track `actual` closely, with residuals from higher-order terms (big moves, the last days before expiry). Plot `actual.cumsum()` against `(gamma + theta).cumsum()`.

When the path's realized vol is above `sigma`, the gamma column dominates: that's gamma scalping paying off.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.stats import norm


def pnl_explain(S_path, K: float, sigma: float, T: float, kind: str = "call") -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _BS + '''

def pnl_explain(S_path, K: float, sigma: float, T: float, kind: str = "call") -> pd.DataFrame:
    S = np.asarray(S_path, dtype=float)
    n = len(S) - 1
    dt = T / n
    rows = []
    for i in range(1, n + 1):
        v0, delta, gamma, theta = _bs(S[i - 1], K, 0.0, sigma, T - (i - 1) * dt, kind)
        v1 = _bs(S[i], K, 0.0, sigma, T - i * dt, kind)[0]
        dS = S[i] - S[i - 1]
        rows.append((0.5 * gamma * dS**2, theta * dt, v1 - v0 - delta * dS))
    return pd.DataFrame(rows, columns=["gamma", "theta", "actual"], index=pd.RangeIndex(1, n + 1))
''',
        "hints": ["Make your Black–Scholes helper return the payoff when the time to expiry is 0."],
        "cases": lambda: [
            {"name": "realized ≈ implied", "sample": True, "args": (_path(63, 0.2, 5), 100, 0.2, 0.25)},
            {"name": "realized 40% vs implied 20%", "args": (_path(126, 0.4, 6), 100, 0.2, 0.5)},
            {"name": "OTM put", "args": (_path(63, 0.25, 7), 90, 0.25, 0.25, "put")},
        ],
    },
    {
        "id": "t8_hedge_frequency",
        "title": "Hedging error versus rebalancing frequency",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "hedging_error",
        "description": r"""
How does the risk of a delta-hedged short call depend on how often you hedge? Simulate `n_paths` GBM paths with the **same** volatility as the hedge (so the expected P&L is about zero) and measure the spread of outcomes:

1. `rng = np.random.default_rng(seed)`, `dt = T / n_steps`, `z = rng.standard_normal((n_paths, n_steps))`
2. log-returns `(r - sigma**2 / 2) * dt + sigma * np.sqrt(dt) * z`; each path starts at S0 (so n_steps + 1 prices)
3. for each value h in `freqs`: hedge every path with `hedge_every=h` (your delta-hedge function) and record the standard deviation (ddof=1) of the final P&Ls

Return a Series indexed by the values in `freqs`.

### Learn
Expect the standard deviation to grow roughly like $\sqrt{h}$: hedging 4× less often doubles the risk. In practice you weigh this against transaction costs, which grow with the number of rebalances. Finding the optimum is a classic quant-trading problem (Leland 1985, Whalley–Wilmott bands).

Import your hedger: `from t8_delta_hedge import delta_hedge_pnl`.
""",
        "starter": '''import numpy as np
import pandas as pd


def hedging_error(S0: float, K: float, r: float, sigma: float, T: float, n_steps: int,
                  n_paths: int, freqs, seed: int = 0) -> pd.Series:
    # your code here
    pass
''',
        "solution": _IMPORTS + _BS + "\n\n" + _HEDGE + '''

def hedging_error(S0: float, K: float, r: float, sigma: float, T: float, n_steps: int,
                  n_paths: int, freqs, seed: int = 0) -> pd.Series:
    rng = np.random.default_rng(seed)
    dt = T / n_steps
    z = rng.standard_normal((n_paths, n_steps))
    logret = (r - sigma**2 / 2) * dt + sigma * np.sqrt(dt) * z
    paths = S0 * np.exp(np.hstack([np.zeros((n_paths, 1)), logret.cumsum(axis=1)]))
    return pd.Series({h: np.std([delta_hedge_pnl(p, K, r, sigma, T, "call", h) for p in paths], ddof=1)
                      for h in freqs})
''',
        "hints": ["Build all paths at once with numpy, then loop over paths (and frequencies) calling your hedger."],
        "timeout": 300,
        "cases": lambda: [
            {"name": "daily vs weekly vs monthly", "sample": True, "args": (100, 100, 0.02, 0.2, 0.5, 126, 80, [1, 5, 21])},
            {"name": "short-dated, finer grid", "args": (100, 105, 0.0, 0.3, 0.25, 64, 60, [1, 2, 4, 8, 16], 3)},
        ],
    },
]
