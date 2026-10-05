import numpy as np
import pandas as pd

from data import factor_universe, fat_returns, gbm, gbm_panel

TITLE = "Trading strategies, backtesting and risk"
SUMMARY = "The main strategy families, an honest vectorized backtest, volatility targeting, VaR and expected shortfall, and how to pitch a trade."
KIND = "core"

LESSON = r"""
Traders are expected to understand what makes money in markets, how to test it without fooling themselves, and how to keep losses survivable. This step covers all three at interview depth.

## Strategy families

| Family | Idea | Risk |
|---|---|---|
| Time-series momentum / trend | assets that went up keep going up (over months) | sharp reversals, choppy markets |
| Cross-sectional momentum | buy past winners, sell past losers | "momentum crashes" after market rebounds |
| Mean reversion | overreactions revert over days | trends that don't revert; needs stop rules |
| Statistical arbitrage / pairs | related assets' spread reverts | breakdown of the relationship |
| Carry | earn the yield (FX rate differentials, futures roll) | crash risk when carry unwinds |
| Value | cheap assets outperform over years | long droughts |
| Market making / liquidity provision | earn the spread | adverse selection, inventory |
| Event-driven | earnings, index changes, M&A | event outcomes |

Each earns a premium for bearing some risk or providing a service (liquidity, insurance, patience), or exploits a behavioural bias. If you can't say which, be suspicious.

## Backtesting without fooling yourself

- **Timing**: a signal computed at the close of t trades at t+1. The P&L is `position.shift(1) * returns`.
- **Costs**: turnover × cost per unit traded. A strategy that trades its whole book every day needs a very large edge.
- **Biases**: look-ahead (using future data), survivorship (only today's surviving stocks), data snooping (trying many variants and reporting the best).
- **Out of sample**: tune on one period, test on another; walk forward.

## Volatility targeting

Scale positions by $\text{target vol} / \text{forecast vol}$, using only past data for the forecast. The result is more stable risk, smaller drawdowns in crises (vol rises, so positions shrink), and usually a better Sharpe ratio. Most systematic funds size this way.

## Risk measures

- **Value at Risk** at level α: the loss exceeded with probability α. Historical VaR uses the empirical quantile; normal VaR is $-(\mu + z_\alpha\sigma)$ (z₀.₀₁ ≈ −2.326).
- **Expected shortfall** (CVaR): the average loss *given* that you're beyond VaR. It captures tail severity, is coherent (rewards diversification), and is now the regulatory standard. Normal ES: $-\mu + \sigma\,\varphi(z_\alpha)/\alpha$.
- **Drawdown control**, position limits, and stop-losses (which help trend strategies but can cut mean-reversion strategies at the worst moment).
- Combining strategies: with correlation ρ between two equal-risk strategies, the combined Sharpe ratio is $\frac{2\,SR}{\sqrt{2 + 2\rho}}$, so uncorrelated strategies combine to √2 × SR.

## Pitching a trade

Interviewers often ask for a trade idea. Structure: **thesis** (what's mispriced and why), **catalyst/timeline**, **expression** (instrument and sizing: why options instead of stock, why a spread), **risks** (what makes you wrong and where you get out), **payoff** (expected gain vs loss). Read markets daily so you have a current, specific idea ready.
"""

QUESTIONS = [
    {"type": "number", "prompt": "A strategy wins 40% of its trades with an average win of $3 and an average loss of $1.50. What is its expected profit per trade?",
     "answer": 0.3, "explanation": "0.4 × 3 − 0.6 × 1.5 = 1.2 − 0.9 = $0.30. A low hit rate can still be very profitable."},
    {"type": "number", "prompt": "You combine two uncorrelated strategies with equal risk, each with Sharpe ratio 1. What is the Sharpe ratio of the combination?",
     "answer": float(np.sqrt(2)), "display": "√2 ≈ 1.414", "explanation": "Returns add (2μ) while volatility grows by √2 when uncorrelated: (2μ)/(√2σ) = √2 × SR."},
    {"type": "number", "prompt": "A $1,000,000 position has 2% daily volatility. What is its 1-day 99% normal VaR (zero mean, in dollars)?",
     "answer": 2.326 * 0.02 * 1e6, "tol": 0.003, "display": "≈ $46,500", "explanation": "2.326 × 2% × $1,000,000 ≈ $46,500."},
    {"type": "number", "prompt": "A strategy turns over its portfolio 20 times a year and each unit traded costs 10 bp. What is the annual cost drag, in %?",
     "answer": 2, "explanation": "20 × 10 bp = 200 bp = 2% per year, which has to come out of the gross return."},
    {"type": "choice", "prompt": "Why can a tight stop-loss hurt a mean-reversion strategy?",
     "choices": ["It exits exactly when the deviation is largest, so right before the expected reversion, locking in losses", "Stop-losses always increase returns",
                 "Mean-reversion strategies never lose money", "Stops only matter for options"],
     "answer": 0, "explanation": "Mean reversion bets that a move will reverse; the bigger the move, the better the bet, but a stop sells at that point. Stops fit trend-following, where losses tend to keep growing."},
    {"type": "choice", "prompt": "When do cross-sectional momentum strategies (long past winners, short past losers) typically crash?",
     "choices": ["In sharp market rebounds after a bear market, when beaten-down losers rally hardest", "During calm bull markets", "When interest rates are stable", "At the end of every month"],
     "answer": 0, "explanation": "After a crash the losers are high-beta stocks. When the market rebounds they surge, and a short-losers book gets squeezed (2009 is the textbook example)."},
    {"type": "open", "prompt": "Pitch me a trade idea in under two minutes.",
     "explanation": "Structure: (1) Thesis: what's mispriced and why the market is wrong or slow, with evidence. (2) Catalyst and horizon: what will make the price converge, and when. (3) Expression: the instrument and why (stock vs options vs a pair or spread to hedge out unwanted risk), plus position size. (4) Risks: what would prove you wrong, and where you'd cut. (5) Payoff: rough upside vs downside. Pick something current that you've followed for weeks. Interviewers probe depth and honesty about the risks, not whether the idea is brilliant."},
]


_BACKTEST = '''def backtest(signal: pd.DataFrame, returns: pd.DataFrame, cost_bps: float = 0.0) -> pd.DataFrame:
    pos = signal.shift(1).fillna(0.0)
    turnover = pos.diff().fillna(pos).abs().sum(axis=1)
    gross = (pos * returns.fillna(0.0)).sum(axis=1)
    cost = turnover * cost_bps / 1e4
    net = gross - cost
    return pd.DataFrame({"exposure": pos.abs().sum(axis=1), "turnover": turnover, "gross": gross,
                         "cost": cost, "net": net, "equity": (1 + net).cumprod()})
'''


def _signals(seed, n_assets, n=600):
    px = gbm_panel(n, n_assets, seed=seed)
    return np.sign(px.pct_change(20)).fillna(0.0) / n_assets, px.pct_change()


PROBLEMS = [
    {
        "id": "t11_backtest",
        "title": "A vectorized backtester with costs",
        "difficulty": "Medium",
        "libs": ["pandas"],
        "fn": "backtest",
        "description": r"""
`signal` holds target weights decided at each close and `returns` the assets' simple returns (same index and columns; NaN returns count as 0). Return a DataFrame with the same index and columns:

- `exposure`: Σ|w| where w = `signal.shift(1)` with NaN → 0 (the weights actually held during each day)
- `turnover`: Σ|w_t − w_{t−1}| with w before the start = 0
- `gross`: Σ w × returns
- `cost`: turnover × `cost_bps` / 10,000
- `net`: gross − cost
- `equity`: cumulative product of (1 + net)

### Learn
`signal.shift(1)` is the most important line in quant finance: it enforces that today's decision earns tomorrow's return. `pos.diff().fillna(pos)` counts the initial position as a trade from flat. Once it's solved, later tasks can import it (`from t11_backtest import backtest`); the stock-analysis project uses it.
""",
        "starter": '''import pandas as pd


def backtest(signal: pd.DataFrame, returns: pd.DataFrame, cost_bps: float = 0.0) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import pandas as pd\n\n\n" + _BACKTEST,
        "hints": ["Sum across assets with `.sum(axis=1)` to get one number per day."],
        "cases": lambda: [
            {"name": "3 assets, momentum weights, 10 bp", "sample": True, "args": (*_signals(1, 3), 10.0)},
            {"name": "6 assets, no costs", "args": _signals(2, 6, 1000)},
            {"name": "no look-ahead", "lookahead": 400, "args": (*_signals(3, 4), 5.0)},
        ],
    },
    {
        "id": "t11_tsmom",
        "title": "Volatility-targeted time-series momentum",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "tsmom",
        "description": r"""
Build a classic trend-following strategy on a panel of prices (one column per asset):

1. daily returns `r = prices.pct_change()`
2. signal = sign of the past `lookback`-day return: `np.sign(prices / prices.shift(lookback) - 1)`
3. forecast vol = `r.rolling(vol_window).std() * sqrt(252)`
4. position = signal × target_vol / forecast vol, clipped to ±`max_leverage`
5. asset strategy returns = `position.shift(1) * r`; the portfolio return is their average across assets each day (skipping NaN), with days that have no positions set to 0

Return a dict: `positions` (DataFrame) and `returns` (portfolio Series).

### Learn
This is the core of the managed-futures industry (Moskowitz, Ooi & Pedersen 2012). Each asset contributes roughly equal risk thanks to vol scaling, and the position shrinks automatically when markets get turbulent. A look-ahead test confirms that today's position only uses data up to today.
""",
        "starter": '''import numpy as np
import pandas as pd


def tsmom(prices: pd.DataFrame, lookback: int = 252, vol_window: int = 63, target_vol: float = 0.10,
          max_leverage: float = 3.0) -> dict:
    # return {"positions": ..., "returns": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def tsmom(prices: pd.DataFrame, lookback: int = 252, vol_window: int = 63, target_vol: float = 0.10,
          max_leverage: float = 3.0) -> dict:
    r = prices.pct_change()
    signal = np.sign(prices / prices.shift(lookback) - 1)
    vol = r.rolling(vol_window).std() * np.sqrt(252)
    positions = (signal * target_vol / vol).clip(-max_leverage, max_leverage)
    returns = (positions.shift(1) * r).mean(axis=1).fillna(0.0)
    return {"positions": positions, "returns": returns}
''',
        "hints": ["`DataFrame.clip(lower, upper)` caps the leverage in one call."],
        "cases": lambda: [
            {"name": "5 assets", "sample": True, "args": (gbm_panel(800, 5, seed=1),)},
            {"name": "faster settings", "args": (gbm_panel(600, 3, seed=2), 63, 21, 0.15, 2.0)},
            {"name": "no look-ahead", "lookahead": 500, "args": (gbm_panel(700, 4, seed=3),)},
        ],
    },
    {
        "id": "t11_var_es",
        "title": "VaR and expected shortfall",
        "difficulty": "Easy",
        "libs": ["numpy", "scipy.stats"],
        "fn": "var_es",
        "description": r"""
For a return series and tail probability `alpha` (e.g. 0.01), return a dict of **positive** loss numbers:

- `hist_var`: −(the α-quantile of returns), using `np.quantile` (linear interpolation)
- `hist_es`: −(mean of the returns at or below that quantile)
- `normal_var`: $-(\mu + z_\alpha\sigma)$ with the sample mean μ, sample std σ (ddof=1) and $z_\alpha$ = `norm.ppf(alpha)`
- `normal_es`: $-\mu + \sigma\,\varphi(z_\alpha)/\alpha$, where φ is the standard normal density

### Learn
Compare the historical and normal numbers on fat-tailed returns: the normal model can get VaR roughly right while badly underestimating ES (in the first test, about 3% versus 5% historically). VaR only tells you where the tail starts; ES tells you how bad it gets, which is exactly where the money is lost. That's why risk managers prefer historical or fat-tailed models and why regulators moved from VaR to ES.
""",
        "starter": '''import numpy as np
from scipy.stats import norm


def var_es(returns, alpha: float = 0.01) -> dict:
    # return {"hist_var": ..., "hist_es": ..., "normal_var": ..., "normal_es": ...}
    pass
''',
        "solution": '''import numpy as np
from scipy.stats import norm


def var_es(returns, alpha: float = 0.01) -> dict:
    r = np.asarray(returns, dtype=float)
    q = np.quantile(r, alpha)
    mu, sd = r.mean(), r.std(ddof=1)
    z = norm.ppf(alpha)
    return {"hist_var": -q, "hist_es": -r[r <= q].mean(), "normal_var": -(mu + z * sd),
            "normal_es": -mu + sd * norm.pdf(z) / alpha}
''',
        "hints": ["Boolean indexing `r[r <= q]` selects the tail."],
        "cases": lambda: [
            {"name": "fat-tailed daily returns, 1%", "sample": True, "args": (fat_returns(2000, nu=3.5, seed=1),)},
            {"name": "5% level", "args": (fat_returns(1000, seed=2), 0.05)},
            {"name": "normal returns", "args": (np.random.default_rng(3).normal(0.0005, 0.01, 5000),)},
        ],
    },
    {
        "id": "t11_mean_reversion",
        "title": "Bollinger-band mean reversion",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "bollinger_positions",
        "description": r"""
Turn a price series into mean-reversion positions in {−1, 0, +1}. With $z_t = (P_t - \text{SMA}_t)/\text{std}_t$ over the last `window` prices (sample std, ddof=1), walk through time starting flat:

```
if z is NaN: stay flat (only possible during warm-up)
else:
    if long  and z >= -exit: go flat
    if short and z <=  exit: go flat
    if flat:
        if z < -entry: go long     (price stretched below its average)
        elif z > entry: go short
```

Return a float Series of positions, same index as `prices`.

### Learn
Same state-machine pattern as the pairs strategy in the TS lab: different entry and exit thresholds make positions depend on history. Backtest it with your `backtest` function (positions as a one-column signal) on `data.gbm` prices: on a random walk it shouldn't make money after costs. Mean reversion needs a real reverting component, which is why you test for one (Hurst exponent, variance ratio, ADF on spreads) before trading it.
""",
        "starter": '''import numpy as np
import pandas as pd


def bollinger_positions(prices: pd.Series, window: int = 20, entry: float = 2.0, exit: float = 0.5) -> pd.Series:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def bollinger_positions(prices: pd.Series, window: int = 20, entry: float = 2.0, exit: float = 0.5) -> pd.Series:
    z = (prices - prices.rolling(window).mean()) / prices.rolling(window).std()
    pos, out = 0, []
    for v in z.to_numpy():
        if np.isnan(v):
            pos = 0
        else:
            if (pos == 1 and v >= -exit) or (pos == -1 and v <= exit):
                pos = 0
            if pos == 0:
                pos = 1 if v < -entry else -1 if v > entry else 0
        out.append(pos)
    return pd.Series(out, index=prices.index, dtype=float)
''',
        "hints": ["Check the exit conditions before the entry ones, so a position can flip in one step."],
        "cases": lambda: [
            {"name": "1 year of prices", "sample": True, "args": (gbm(252, seed=1),)},
            {"name": "wider bands", "args": (gbm(1000, sigma=0.3, seed=2), 50, 2.5, 0.0)},
            {"name": "no look-ahead", "lookahead": 300, "args": (gbm(500, seed=3),)},
        ],
    },
]
