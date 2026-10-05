import numpy as np
import pandas as pd

from data import factor_universe

TITLE = "Project: stock analysis and strategy pipeline"
SUMMARY = "End-to-end equity pipeline: clean prices, per-stock analytics, a cross-sectional momentum strategy with costs, and a risk report."
KIND = "project"

LESSON = r"""
This project is the full loop you'd run on a desk or in a take-home assignment: **data → cleaning → analytics → signal → backtest with costs → risk report**. Each stage is graded on a synthetic universe with a planted momentum effect, so you know there is something real to find. Then you rerun the whole pipeline on real stocks in a notebook.

## The universe

`data.factor_universe(..., momentum=0.0012, missing=...)` gives prices for 30 stocks driven by market, size and value factors, plus slowly drifting stock-specific expected returns (so past winners tend to keep winning) and some missing data.

## What you build

1. **`prepare_returns`**: drop stocks with too much missing data, forward-fill short gaps, compute returns.
2. **`stock_report`**: per stock, annualized return, volatility, Sharpe ratio, market beta and correlation, maximum drawdown.
3. **`cross_sectional_momentum`**: monthly rebalancing, long the top-n past winners and short the bottom-n losers (skipping the most recent month), net of costs.
4. **`risk_summary`**: the numbers a risk manager asks for: Sharpe, drawdown, beta and alpha against the market (with a HAC t-stat from statsmodels), 99% VaR, worst month, and the fraction of positive months.
5. **`run_pipeline`**: one call from raw prices to a strategy-versus-benchmark verdict.

```text
raw prices
  ↓ Part 1  clean into returns
  ↓ Part 2  per-stock analytics report
  ↓ Part 3  cross-sectional momentum backtest with costs
  ↓ Part 4  risk summary with a HAC alpha t-stat
  ↓ Part 5  verdict: strategy versus an equal-weight benchmark
```

## Then do it for real (in a notebook)

```python
import yfinance as yf
tickers = ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "JPM", "XOM", "JNJ", "PG", "KO", "WMT"]
px = yf.download(tickers + ["SPY"], start="2015-01-01", auto_adjust=True, progress=False)["Close"]
```

Run your pipeline and write five honest sentences: did momentum work? After costs? Was it just market beta? Which months hurt? Note the survivorship bias: you picked today's big winners.

## What a reviewer looks for

Correct timing (no look-ahead), costs included, risk reported alongside return, a comparison with a simple benchmark (equal-weight long-only or the index), and an honest discussion of limitations.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "Why does the classic momentum signal skip the most recent month (e.g. 12-month return excluding the last month)?",
     "choices": ["Returns over the last month tend to reverse (short-term reversal), which would contaminate the trend signal", "To reduce data requirements",
                 "Because last month's prices are usually missing", "To make the backtest faster"],
     "answer": 0, "explanation": "Short-horizon reversal (driven by liquidity and microstructure) works against momentum at the 1-month horizon, so it's excluded."},
    {"type": "choice", "prompt": "You built a long/short momentum strategy on today's 12 largest US tech stocks over 2015–2024 and it looks great. What's the biggest problem with this test?",
     "choices": ["Survivorship and selection bias: the universe was chosen with hindsight", "Not enough leverage", "It ignores dividends", "Too many rebalances"],
     "answer": 0, "explanation": "Today's mega-caps are, by construction, the past decade's biggest winners. The test is contaminated by knowing who won."},
    {"type": "open", "prompt": "Your momentum backtest shows a Sharpe ratio of 0.9 before costs and 0.3 after costs. What would you investigate?",
     "explanation": "Turnover (how much of the book changes at each rebalance) and cost assumptions per name; whether trading less often or using buffers around the rank thresholds keeps most of the signal; whether costs are concentrated in illiquid names that could be dropped; whether the signal is robust to the lookback and rebalance date; and whether the remaining edge is really momentum or just a factor exposure (beta, size) that's cheaper to get elsewhere."},
]


def _messy(seed):
    u = factor_universe(800, 12, missing=0.04, momentum=0.0012, seed=seed)
    px = u["prices"].copy()
    px.loc[px.sample(frac=0.3, random_state=seed).index, "T05"] = np.nan  # one name too gappy to keep
    return px


def _clean_returns(seed):
    px = _messy(seed)
    keep = px.columns[px.isna().mean() <= 0.1]
    return px[keep].ffill(limit=2).pct_change().iloc[1:]


def _universe(seed, n_days=1260, n=30):
    u = factor_universe(n_days, n, momentum=0.0012, seed=seed)
    return u["prices"], u["market"]


_MOM = '''def cross_sectional_momentum(prices: pd.DataFrame, lookback: int = 126, skip: int = 21, n_long: int = 3,
                             cost_bps: float = 10.0) -> pd.Series:
    r = prices.pct_change()
    signal = prices.shift(skip) / prices.shift(lookback) - 1
    month_ends = prices.index.to_series().groupby(prices.index.to_period("M")).last()
    ranks = signal.loc[month_ends].rank(axis=1, method="first")
    n = ranks.notna().sum(axis=1)
    w = ranks.gt(n - n_long, axis=0).astype(float) / n_long - ranks.le(n_long).astype(float) / n_long
    w.loc[n < 2 * n_long] = 0.0
    weights = w.reindex(prices.index).ffill().fillna(0.0)
    held = weights.shift(1).fillna(0.0)
    turnover = held.diff().fillna(held).abs().sum(axis=1)
    return (held * r.fillna(0.0)).sum(axis=1) - turnover * cost_bps / 1e4
'''

def _strategy(seed):
    ns = {"np": np, "pd": pd}
    exec(_MOM, ns)
    return ns["cross_sectional_momentum"](_universe(seed)[0])


PROBLEMS = [
    {
        "id": "t12_prepare",
        "title": "Part 1 · Clean prices into returns",
        "difficulty": "Easy",
        "libs": ["pandas"],
        "fn": "prepare_returns",
        "description": r"""
Turn a messy price panel into a returns panel:

1. drop every stock whose fraction of missing prices exceeds `max_missing`
2. forward-fill the remaining gaps, at most `ffill_limit` days in a row
3. compute simple returns (`pct_change()`) and drop the first row

Return the returns DataFrame (NaN may remain where a gap was longer than the limit).

### Learn
Order matters: dropping bad stocks first keeps a gappy name's filled-in prices from polluting your statistics. Forward-filling more than a couple of days invents a flat price, so later returns pile up on the day trading resumes. In pandas 3, `pct_change()` no longer fills gaps for you, which is the safer default.
""",
        "starter": '''import pandas as pd


def prepare_returns(prices: pd.DataFrame, max_missing: float = 0.1, ffill_limit: int = 2) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import pandas as pd


def prepare_returns(prices: pd.DataFrame, max_missing: float = 0.1, ffill_limit: int = 2) -> pd.DataFrame:
    keep = prices.columns[prices.isna().mean() <= max_missing]
    return prices[keep].ffill(limit=ffill_limit).pct_change().iloc[1:]
''',
        "hints": ["`prices.isna().mean()` gives the fraction missing per column."],
        "cases": lambda: [
            {"name": "12 stocks, one too gappy", "sample": True, "args": (_messy(1),)},
            {"name": "stricter settings", "args": (_messy(2), 0.03, 1)},
        ],
    },
    {
        "id": "t12_report",
        "title": "Part 2 · Per-stock analytics report",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "stock_report",
        "description": r"""
Given daily returns (one column per stock, possibly with a few NaNs) and the market's daily returns, return a DataFrame indexed by stock with columns:

- `ann_return`: mean daily return × 252
- `ann_vol`: daily std × √252
- `sharpe`: ann_return / ann_vol
- `beta`: Cov(stock, market) / Var(market), each on the dates where both exist (pandas `cov`/`var` skip NaN pairs when the two Series are aligned)
- `corr`: correlation with the market
- `max_drawdown`: min of equity / running peak − 1, where equity = cumprod(1 + returns) with NaN returns treated as 0

### Learn
The table answers "what are these stocks?": high-beta cyclicals versus defensives, which names are just leveraged market bets, which carry big idiosyncratic drawdowns. On real data, sort it by beta and by Sharpe ratio and see how different the two rankings are.

To compute beta per column, loop over columns with `returns[c].cov(market) / market.loc[returns[c].dropna().index].var()`, or align first and use vectorized algebra.
""",
        "starter": '''import numpy as np
import pandas as pd


def stock_report(returns: pd.DataFrame, market: pd.Series) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def stock_report(returns: pd.DataFrame, market: pd.Series) -> pd.DataFrame:
    rows = {}
    for c in returns.columns:
        r = returns[c]
        m = market.loc[r.dropna().index]
        equity = (1 + r.fillna(0.0)).cumprod()
        rows[c] = {"ann_return": r.mean() * 252, "ann_vol": r.std() * np.sqrt(252),
                   "sharpe": r.mean() / r.std() * np.sqrt(252), "beta": r.cov(market) / m.var(),
                   "corr": r.corr(market), "max_drawdown": (equity / equity.cummax() - 1).min()}
    return pd.DataFrame.from_dict(rows, orient="index")
''',
        "hints": ["Compute the market variance on the same dates as the stock's non-missing returns."],
        "cases": lambda: [
            {"name": "cleaned 11-stock panel", "sample": True, "args": (_clean_returns(1), factor_universe(800, 12, missing=0.04, momentum=0.0012, seed=1)["market"])},
            {"name": "30 stocks, no gaps", "args": (_universe(3)[0].pct_change().iloc[1:], _universe(3)[1])},
        ],
    },
    {
        "id": "t12_momentum",
        "title": "Part 3 · Cross-sectional momentum with monthly rebalancing",
        "difficulty": "Hard",
        "libs": ["pandas", "numpy"],
        "fn": "cross_sectional_momentum",
        "description": r"""
Backtest a long/short momentum strategy and return its **net daily returns** (a Series on the prices' index):

1. signal = `prices.shift(skip) / prices.shift(lookback) - 1` (the past return, skipping the last `skip` days)
2. rebalance on the **last trading day of each month** in the index
3. on each rebalance date, rank the stocks with valid signals (`rank(axis=1, method="first")`): the top `n_long` get weight +1/n_long and the bottom `n_long` get −1/n_long, all others 0; if fewer than 2 × n_long signals are valid, all weights are 0
4. hold those weights until the next rebalance (forward-fill daily; 0 before the first rebalance)
5. daily net return = Σ (weights shifted by one day) × returns − turnover × cost_bps/10,000, where turnover = Σ|change in the shifted weights| (the first position counts as a trade from flat)

### Learn
Month-end dates: `prices.index.to_series().groupby(prices.index.to_period("M")).last()`. The rest reuses ideas from earlier steps: cross-sectional ranks, forward-filled weights, and the backtest timing convention.

Dollar-neutral (long $1, short $1) removes most market exposure, so the strategy should make money from the planted momentum effect, not from beta. The risk report checks that.
""",
        "starter": '''import numpy as np
import pandas as pd


def cross_sectional_momentum(prices: pd.DataFrame, lookback: int = 126, skip: int = 21, n_long: int = 3,
                             cost_bps: float = 10.0) -> pd.Series:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _MOM,
        "hints": ["Build weights only on rebalance dates, then `reindex(prices.index).ffill().fillna(0)`.",
                  "Top n means rank > (number valid − n); bottom n means rank ≤ n."],
        "cases": lambda: [
            {"name": "30 stocks, 5 years", "sample": True, "args": (_universe(3)[0],)},
            {"name": "12-1 momentum, top/bottom 5, 20 bp", "args": (_universe(4)[0], 252, 21, 5, 20.0)},
            {"name": "no look-ahead", "lookahead": 900, "args": (_universe(5)[0],)},
        ],
    },
    {
        "id": "t12_risk",
        "title": "Part 4 · Risk summary for a strategy",
        "difficulty": "Easy",
        "libs": ["pandas", "numpy", "statsmodels"],
        "fn": "risk_summary",
        "description": r"""
Summarize a daily strategy return series for a risk committee. Return a dict:

- `ann_return`: mean × 252; `sharpe`: mean/std × √252
- `max_drawdown`: from equity = cumprod(1 + r), with the running peak floored at 1
- `beta`: Cov(strategy, market)/Var(market)
- `alpha_ann` and `alpha_t`: the intercept × 252 of a regression of strategy returns on market returns, and its t-stat with Newey–West (HAC) errors: `sm.OLS(strategy, sm.add_constant(market.reindex(strategy.index)), missing="drop").fit(cov_type="HAC", cov_kwds={"maxlags": 5})`, then `params.iloc[0]` and `tvalues.iloc[0]`
- `var_99`: −(1% quantile of daily returns) with `np.quantile`
- `worst_month`: the lowest compounded calendar-month return, $\prod(1+r) - 1$ within each month
- `positive_months`: the fraction of months with a positive compounded return

### Learn
Monthly compounding: `(1 + r).groupby(r.index.to_period("M")).prod() - 1`.

A market-neutral strategy should show a beta near 0. If the momentum strategy's beta is far from zero, it's partly a disguised market bet. Alpha is the return left after paying for market exposure, and its HAC t-stat says whether that's distinguishable from luck, with standard errors that allow for autocorrelated returns (as in the regression step). Positive months and worst month say more about how it *feels* to run than the Sharpe ratio does.
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def risk_summary(strategy: pd.Series, market: pd.Series) -> dict:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def risk_summary(strategy: pd.Series, market: pd.Series) -> dict:
    equity = (1 + strategy).cumprod()
    monthly = (1 + strategy).groupby(strategy.index.to_period("M")).prod() - 1
    fit = sm.OLS(strategy, sm.add_constant(market.reindex(strategy.index)), missing="drop").fit(
        cov_type="HAC", cov_kwds={"maxlags": 5})
    return {"ann_return": strategy.mean() * 252, "sharpe": strategy.mean() / strategy.std() * np.sqrt(252),
            "max_drawdown": (equity / equity.cummax().clip(lower=1.0) - 1).min(),
            "beta": strategy.cov(market) / market.var(), "alpha_ann": fit.params.iloc[0] * 252,
            "alpha_t": fit.tvalues.iloc[0], "var_99": -np.quantile(strategy, 0.01),
            "worst_month": monthly.min(), "positive_months": (monthly > 0).mean()}
''',
        "hints": ["Group by `index.to_period('M')` for calendar months."],
        "cases": lambda: [
            {"name": "momentum strategy returns", "sample": True,
             "args": (_strategy(3), _universe(3)[1])},
            {"name": "long-only market-like returns", "args": (_universe(6)[0].pct_change().iloc[1:].mean(axis=1), _universe(6)[1].iloc[1:])},
        ],
    },
]


def _pipeline_data(seed):
    u = factor_universe(1260, 30, missing=0.03, momentum=0.0012, seed=seed)
    px = u["prices"].copy()
    px.loc[px.sample(frac=0.25, random_state=seed).index, "T07"] = np.nan  # too gappy to keep
    return px, u["market"]


PROBLEMS.append({
    "id": "t12_pipeline",
    "title": "Part 5 · Run the pipeline: strategy versus benchmark",
    "difficulty": "Medium",
    "libs": ["pandas", "numpy", "statsmodels"],
    "fn": "run_pipeline",
    "description": r"""
Chain Parts 1–4 into one call from raw prices:

1. `returns = prepare_returns(prices)` (default settings)
2. `report = stock_report(returns, market)`
3. run `cross_sectional_momentum` on the kept names' prices forward-filled at most 2 days (`prices[returns.columns].ffill(limit=2)`), passing `lookback`, `skip`, `n_long`, `cost_bps`
4. `live` = the strategy's returns from its first nonzero day on (`strategy.loc[strategy.ne(0).idxmax():]`), so the idle warm-up period doesn't dilute the statistics
5. benchmark = equal-weight long-only: `returns.mean(axis=1)` on the same dates as `live`
6. return `{"report": report, "strategy": risk_summary(live, market), "benchmark": risk_summary(benchmark, market), "alpha_significant": ...}` where `alpha_significant` is True when the strategy's `alpha_t` exceeds 2

### Learn
On this universe momentum should show a beta near zero, a HAC alpha t-stat comfortably above 2, and a better Sharpe ratio than the benchmark, whose return is almost entirely beta (its alpha isn't significant). That comparison, strategy against the cheap alternative, is the core of any strategy pitch.

Then do it for real in a notebook with the yfinance snippet from the lesson, and write the five honest sentences.

Import your earlier parts: `from t12_prepare import prepare_returns`, and likewise `t12_report`, `t12_momentum`, `t12_risk`.
""",
    "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def run_pipeline(prices: pd.DataFrame, market: pd.Series, lookback: int = 126, skip: int = 21, n_long: int = 3,
                 cost_bps: float = 10.0) -> dict:
    # return {"report": ..., "strategy": ..., "benchmark": ..., "alpha_significant": ...}
    pass
''',
    "solution": "\n\n".join(p["solution"] for p in PROBLEMS[:4]) + '''

def run_pipeline(prices: pd.DataFrame, market: pd.Series, lookback: int = 126, skip: int = 21, n_long: int = 3,
                 cost_bps: float = 10.0) -> dict:
    returns = prepare_returns(prices)
    report = stock_report(returns, market)
    strategy = cross_sectional_momentum(prices[returns.columns].ffill(limit=2), lookback, skip, n_long, cost_bps)
    live = strategy.loc[strategy.ne(0).idxmax():]
    risk = risk_summary(live, market)
    return {"report": report, "strategy": risk, "benchmark": risk_summary(returns.mean(axis=1).reindex(live.index), market),
            "alpha_significant": bool(risk["alpha_t"] > 2)}
''',
    "hints": ["`strategy.ne(0).idxmax()` is the first date with a nonzero return."],
    "rtol": 1e-6,
    "cases": lambda: [
        {"name": "30 stocks with gaps, 6-1 momentum", "sample": True, "args": _pipeline_data(1)},
        {"name": "12-1 momentum, top/bottom 5, 20 bp", "args": (*_pipeline_data(4), 252, 21, 5, 20.0)},
    ],
})
