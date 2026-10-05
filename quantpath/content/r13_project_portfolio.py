import numpy as np
import pandas as pd

from data import factor_universe

TITLE = "Project lab: portfolio construction backtest"
SUMMARY = "Rolling Ledoit–Wolf risk models, four allocation rules (equal, inverse-vol, min-variance, risk parity), a drift-aware backtest with costs, and a comparison table."
KIND = "project"

LESSON = r"""
Allocation research asks one question: given the same universe, which weighting rule gives the best risk-adjusted result **out of sample, after costs**? This lab builds the standard comparison, the same workflow libraries like PyPortfolioOpt and Riskfolio automate, with scikit-learn for the risk model and scipy for the optimizers.

## The pipeline

```text
prices
  ↓ Part 1  month-end Ledoit–Wolf covariance from a trailing window
  ↓ Part 2  weights: equal, inverse-vol, min-variance, risk parity
  ↓ Part 3  backtest: weight drift, monthly rebalances, costs
  ↓ Part 4  performance table: return, vol, Sharpe, drawdown, turnover
  ↓ Part 5  run every strategy and name the winners
```

## The data

`data.factor_universe(1512, 25)`: six years of 25 stocks driven by market, size and value factors, with betas between 0.6 and 1.5 and different idiosyncratic volatilities, so the weighting rules genuinely disagree.

## What each part teaches

1. **Risk model**: estimate with only past data (the window ends on the rebalance date), shrink the noisy sample matrix.
2. **Allocation rules**: from no estimation at all (equal weight) to full optimization (min-variance), with risk parity in between. Each step uses more of the covariance matrix and is more exposed to its errors.
3. **Backtest mechanics**: between rebalances weights drift with prices; rebalancing trades the gap between drifted and target weights, and that turnover is what costs money.
4. **Evaluation**: volatility is the metric these rules target; Sharpe and drawdown show what it cost.
5. **The comparison**: the table you'd put in an allocation memo.

## Interview angle

"Why might equal weight beat mean-variance out of sample?" Estimation error: expected returns are nearly impossible to estimate, and optimizers maximize those errors (DeMiguel, Garlappi and Uppal 2009 found naive 1/N hard to beat). Rules that use only the covariance matrix, which is far easier to estimate, are more robust.
"""

QUESTIONS = [
    {"type": "number", "prompt": "A portfolio's annual turnover is 4.0 (one-way, summed across rebalances) and trading costs 5 bps per unit of turnover. What is the annual cost drag, in bps?",
     "answer": 20, "explanation": "Cost = turnover × cost per unit = 4.0 × 5 bps = 20 bps per year."},
    {"type": "choice", "prompt": "Your min-variance backtest has the lowest volatility but four times the turnover of equal weight. What's the most sensible next step?",
     "choices": ["Add a turnover penalty or no-trade bands and recheck net-of-cost results", "Rebalance daily so the weights are always optimal",
                 "Drop the covariance shrinkage", "Ignore turnover since costs are already included"],
     "answer": 0, "explanation": "Much of min-variance turnover chases estimation noise. Penalizing trades (or only trading when weights drift past a band) usually keeps most of the risk reduction at a fraction of the cost."},
    {"type": "open", "prompt": "Why does a long-only minimum-variance portfolio end up concentrated in a few names, and how do practitioners control that?",
     "explanation": "The optimizer piles into the lowest-volatility, least-correlated names, and estimation error exaggerates how attractive they look. Controls: covariance shrinkage or factor risk models, maximum weight caps and minimum holdings, an L2 penalty on weights (equivalent to shrinking toward the identity matrix), turnover penalties, and sector constraints."},
]


def _returns(seed=1, n_days=1512, n=25):
    return factor_universe(n_days, n, seed=seed)["prices"].pct_change().iloc[1:]


def _prices(seed=1):
    return factor_universe(1512, 25, seed=seed)["prices"]


_COV = '''def month_end_covariances(returns: pd.DataFrame, window: int = 126) -> dict:
    idx = returns.index
    ends = returns.groupby(idx.to_period("M")).tail(1).index
    out = {}
    for d in ends:
        i = idx.get_loc(d)
        if i + 1 < window:
            continue
        X = returns.iloc[i + 1 - window:i + 1].to_numpy()
        out[d] = pd.DataFrame(LedoitWolf().fit(X).covariance_ * 252, index=returns.columns, columns=returns.columns)
    return out
'''

_W = '''def target_weights(cov: pd.DataFrame, method: str) -> pd.Series:
    S = cov.to_numpy()
    n = len(S)
    if method == "equal":
        w = np.full(n, 1 / n)
    elif method == "inverse_vol":
        w = 1 / np.sqrt(np.diag(S))
        w = w / w.sum()
    elif method == "min_var":
        w = minimize(lambda w: w @ S @ w, np.full(n, 1 / n), jac=lambda w: 2 * S @ w, method="SLSQP",
                     bounds=[(0, 1)] * n, constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1}],
                     options={"ftol": 1e-12, "maxiter": 1000}).x
    elif method == "erc":
        f = lambda y: 0.5 * y @ S @ y - np.log(y).sum() / n
        grad = lambda y: S @ y - 1 / (n * y)
        y = minimize(f, np.full(n, 1 / n), jac=grad, method="L-BFGS-B", bounds=[(1e-10, None)] * n).x
        w = y / y.sum()
    else:
        raise ValueError(f"unknown method {method!r}")
    return pd.Series(w, index=cov.columns)
'''

_BT = '''def backtest(returns: pd.DataFrame, weights: pd.DataFrame, cost_bps: float = 5.0) -> dict:
    R = returns.loc[weights.index[0]:]
    W = weights.reindex(columns=returns.columns)
    h = W.iloc[0].to_numpy()
    rets, turnover = [], {}
    for d, r in zip(R.index[1:], R.to_numpy()[1:]):
        gross = h @ r
        drifted = h * (1 + r) / (1 + gross)
        cost = 0.0
        if d in W.index:
            target = W.loc[d].to_numpy()
            turnover[d] = np.abs(target - drifted).sum()
            cost = turnover[d] * cost_bps / 1e4
            h = target
        else:
            h = drifted
        rets.append(gross - cost)
    return {"returns": pd.Series(rets, index=R.index[1:]), "turnover": pd.Series(turnover, dtype=float)}
'''

_PERF = '''def performance_table(results: dict) -> pd.DataFrame:
    rows = {}
    for name, res in results.items():
        r = res["returns"]
        wealth = (1 + r).cumprod()
        rows[name] = {"ann_return": r.mean() * 252, "ann_vol": r.std() * np.sqrt(252),
                      "sharpe": r.mean() / r.std() * np.sqrt(252),
                      "max_drawdown": (wealth / wealth.cummax() - 1).min(),
                      "annual_turnover": res["turnover"].sum() / (len(r) / 252)}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_IMPORTS = "import numpy as np\nimport pandas as pd\nfrom scipy.optimize import minimize\nfrom sklearn.covariance import LedoitWolf\n\n\n"

METHODS = ["equal", "inverse_vol", "min_var", "erc"]


def _ns():
    ns = {}
    exec(_IMPORTS + _COV + "\n\n" + _W + "\n\n" + _BT + "\n\n" + _PERF, ns)
    return ns


def _covs(seed=1):
    return _ns()["month_end_covariances"](_returns(seed))


def _weights(seed, method):
    ns = _ns()
    return pd.DataFrame({d: ns["target_weights"](c, method) for d, c in _covs(seed).items()}).T


def _results(seed):
    ns, R = _ns(), _returns(seed)
    return {m: ns["backtest"](R, _weights(seed, m)) for m in METHODS}


def _causal(fn):
    R = _returns(2)
    cut = R.index[700]
    base = fn(R.copy())
    bumped = R.copy()
    bumped.loc[bumped.index > cut] *= 3
    after = fn(bumped)
    for d, cov in base.items():
        if d <= cut:
            assert d in after and np.allclose(np.asarray(after[d]), np.asarray(cov)), (
                f"The covariance for {d:%Y-%m-%d} changed when only returns after {cut:%Y-%m-%d} were modified. "
                "Each estimate may use returns up to and including its own date, nothing later.")


PROBLEMS = [
    {
        "id": "r13_covariances",
        "title": "Part 1 · Month-end Ledoit–Wolf risk model",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "pandas"],
        "fn": "month_end_covariances",
        "description": r"""
Build the risk model a monthly rebalancer would have had at each decision date.

1. rebalance dates = the **last trading day of each month** in `returns.index` (`returns.groupby(returns.index.to_period("M")).tail(1).index`)
2. skip dates with fewer than `window` rows of returns up to and including that day
3. for each remaining date d, fit `LedoitWolf()` on the `window` rows ending at d (inclusive) and annualize (×252)

Return a dict mapping each date (Timestamp) to a covariance DataFrame (tickers × tickers).

### Learn
Positions are set at the close of day d, so returns through day d are known and fair to use; the backtest in Part 3 holds the new weights from day d+1. A check perturbs returns after a cutoff and confirms earlier estimates don't move.

Why shrink? With 25 stocks and 126 days, the sample matrix has 325 distinct entries estimated from relatively little data, and the min-variance optimizer in Part 2 would lean on its errors. You saw this in the previous step's shrinkage experiment.
""",
        "starter": '''import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf


def month_end_covariances(returns: pd.DataFrame, window: int = 126) -> dict:
    # return {date: covariance DataFrame}
    pass
''',
        "solution": _IMPORTS + _COV,
        "hints": ["`returns.index.get_loc(d)` gives the row number of date d, so the window is `returns.iloc[i + 1 - window:i + 1]`."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "25 stocks, 6 years", "sample": True, "args": (_returns(1),)},
            {"name": "63-day window", "args": (_returns(3), 63)},
            {"name": "no look-ahead", "check": _causal},
        ],
    },
    {
        "id": "r13_weights",
        "title": "Part 2 · Four allocation rules",
        "difficulty": "Medium",
        "libs": ["scipy.optimize", "numpy", "pandas"],
        "fn": "target_weights",
        "description": r"""
Given one covariance DataFrame from Part 1, return target weights as a Series indexed by ticker, for `method`:

| method | rule |
|---|---|
| `"equal"` | $1/n$ each |
| `"inverse_vol"` | $w_i \propto 1/\sigma_i$, normalized to sum to 1 |
| `"min_var"` | long-only minimum variance: `minimize(lambda w: w @ S @ w, np.full(n, 1/n), jac=lambda w: 2 * S @ w, method="SLSQP", bounds=[(0, 1)] * n, constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1}], options={"ftol": 1e-12, "maxiter": 1000})` |
| `"erc"` | equal risk contribution, exactly as in the previous step's `risk_parity_weights` |

Raise `ValueError` for anything else. Results are checked to about 1e-4.

### Learn
The rules form a ladder of estimation risk: equal weight ignores the covariance entirely; inverse-vol uses only the diagonal; ERC uses the whole matrix but stays diversified by construction; min-variance uses the whole matrix and concentrates wherever it looks safest. Inspect the min-var weights: many sit at exactly zero, which is how long-only constraints act as implicit regularization (Jagannathan and Ma 2003).
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import minimize


def target_weights(cov: pd.DataFrame, method: str) -> pd.Series:
    # your code here
    pass
''',
        "solution": _IMPORTS + _W,
        "hints": ["Reuse your earlier work: `from r12_risk_parity import risk_parity_weights`."],
        "atol": 1e-4,
        "rtol": 1e-3,
        "cases": lambda: [
            {"name": "long-only min-variance", "sample": True, "args": (list(_covs(1).values())[-1], "min_var")},
            {"name": "equal risk contribution", "args": (list(_covs(1).values())[20], "erc")},
            {"name": "inverse volatility", "args": (list(_covs(2).values())[5], "inverse_vol")},
            {"name": "equal weight", "args": (list(_covs(2).values())[5], "equal")},
        ],
    },
    {
        "id": "r13_backtest",
        "title": "Part 3 · Drift-aware backtest with costs",
        "difficulty": "Hard",
        "libs": ["pandas", "numpy"],
        "fn": "backtest",
        "description": r"""
Simulate holding a portfolio that rebalances to the target weights in `weights` (rebalance dates × tickers) at the close of each rebalance date.

- Start holding the first row's weights at the close of the first rebalance date (ignore the cost of that initial build).
- For each later day t, with $h$ the weights held at the previous close:
  - gross return $g_t = h\cdot r_t$
  - drifted weights $d_t = h \odot (1 + r_t)/(1 + g_t)$
  - if t is a rebalance date: turnover $= \sum_i |\text{target}_i - d_{t,i}|$, cost = turnover × `cost_bps` / 10,000, and the new $h$ is the target; otherwise $h = d_t$ and there is no cost
  - net return = $g_t$ − cost

Return a dict: `returns` (net daily returns, a Series over the days after the first rebalance date) and `turnover` (a Series indexed by the later rebalance dates).

### Learn
Equal weight still trades: winners grow overweight and must be trimmed back every month, so its turnover comes purely from drift. Optimized portfolios also trade because the targets themselves move as the covariance estimate updates. A vectorized backtest (`(weights.shift(1) * returns).sum(axis=1)`) is fine for research, but this loop is how the bookkeeping really works, and it's the version that gets turnover right.
""",
        "starter": '''import numpy as np
import pandas as pd


def backtest(returns: pd.DataFrame, weights: pd.DataFrame, cost_bps: float = 5.0) -> dict:
    # return {"returns": ..., "turnover": ...}
    pass
''',
        "solution": _IMPORTS + _BT,
        "hints": ["Loop over `zip(R.index[1:], R.to_numpy()[1:])` where `R = returns.loc[weights.index[0]:]`."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "min-variance weights, 5 bps", "sample": True, "args": (_returns(1), _weights(1, "min_var"))},
            {"name": "equal weight, 20 bps", "args": (_returns(2), _weights(2, "equal"), 20.0)},
        ],
    },
    {
        "id": "r13_performance",
        "title": "Part 4 · The comparison table",
        "difficulty": "Easy",
        "libs": ["pandas", "numpy"],
        "fn": "performance_table",
        "description": r"""
`results` maps a strategy name to a Part 3 output. Return a DataFrame indexed by strategy name with:

- `ann_return`: mean daily return × 252
- `ann_vol`: daily std × √252
- `sharpe`: ann_return / ann_vol
- `max_drawdown`: with `wealth = (1 + r).cumprod()`, the minimum of `wealth / wealth.cummax() - 1`
- `annual_turnover`: total turnover divided by the number of years (days / 252)

### Learn
Read the table across, not just down the Sharpe column: a strategy that wins on Sharpe by 0.05 but trades four times as much is fragile to cost assumptions. Over six years, Sharpe differences of a few tenths between these rules are within noise (the standard error of a Sharpe estimate over 6 years is about $1/\sqrt 6 \approx 0.4$); volatility differences are far more reliable, because volatility is much easier to measure.
""",
        "starter": '''import numpy as np
import pandas as pd


def performance_table(results: dict) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _PERF,
        "hints": ["Build a dict of row dicts and use `pd.DataFrame.from_dict(rows, orient='index')`."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "four strategies", "sample": True, "args": (_results(1),)},
            {"name": "another universe", "args": (_results(4),)},
        ],
    },
    {
        "id": "r13_report",
        "title": "Part 5 · Run the allocation study",
        "difficulty": "Medium",
        "libs": ["pandas", "scikit-learn", "scipy.optimize"],
        "fn": "portfolio_lab_report",
        "description": r"""
Chain Parts 1–4 into one call. From a price panel:

1. `returns = prices.pct_change().iloc[1:]`
2. `covs = month_end_covariances(returns, window)`
3. for each method in `["equal", "inverse_vol", "min_var", "erc"]`: a weights DataFrame with one row per date in `covs` (`pd.DataFrame({d: target_weights(c, method) for d, c in covs.items()}).T`), then `backtest(returns, weights, cost_bps)`
4. `table = performance_table(results)` with rows in that method order
5. return `{"table": table, "lowest_vol": ..., "best_sharpe": ...}` naming the strategies with the lowest `ann_vol` and the highest `sharpe`

Import your earlier parts: `from r13_covariances import month_end_covariances`, and likewise `r13_weights`, `r13_backtest`, `r13_performance`.

### Learn
Expect min-variance to deliver the lowest realized volatility, out of sample, with the highest turnover. Its Sharpe ratio is another matter: this synthetic universe is a CAPM world where expected return is proportional to beta, so de-risking gives up return and min-var's Sharpe often trails. In real equity markets the low-volatility anomaly (low-beta stocks earning more than CAPM predicts) has historically made min-variance competitive. Notice also how close equal, inverse-vol and ERC are: when one market factor drives everything, the weighting rule matters less than you'd think.

Then try it on real data in a notebook (a few years of daily prices for 20–30 stocks or ETFs from yfinance), and add a cost sensitivity: rerun with `cost_bps = 20`.
""",
        "starter": '''import numpy as np
import pandas as pd


def portfolio_lab_report(prices: pd.DataFrame, window: int = 126, cost_bps: float = 5.0) -> dict:
    # return {"table": ..., "lowest_vol": ..., "best_sharpe": ...}
    pass
''',
        "solution": _IMPORTS + _COV + "\n\n" + _W + "\n\n" + _BT + "\n\n" + _PERF + '''

def portfolio_lab_report(prices: pd.DataFrame, window: int = 126, cost_bps: float = 5.0) -> dict:
    returns = prices.pct_change().iloc[1:]
    covs = month_end_covariances(returns, window)
    results = {}
    for method in ["equal", "inverse_vol", "min_var", "erc"]:
        weights = pd.DataFrame({d: target_weights(c, method) for d, c in covs.items()}).T
        results[method] = backtest(returns, weights, cost_bps)
    table = performance_table(results)
    return {"table": table, "lowest_vol": table["ann_vol"].idxmin(), "best_sharpe": table["sharpe"].idxmax()}
''',
        "hints": ["`table['ann_vol'].idxmin()` names the lowest-volatility strategy."],
        "rtol": 1e-6,
        "atol": 1e-6,
        "timeout": 300,
        "cases": lambda: [
            {"name": "25 stocks, 6 years", "sample": True, "args": (_prices(3),)},
            {"name": "longer window, higher costs", "args": (_prices(4), 252, 20.0)},
        ],
    },
]
