import numpy as np
import pandas as pd

from data import factor_universe

TITLE = "Project lab: equity signal research"
SUMMARY = "Build a small signal library, score it like a research desk (IC, ICIR, decay, turnover), run quintile portfolios, and blend neutralized signals into one alpha."
KIND = "project"

LESSON = r"""
Before any ML model, quant equity desks evaluate **signals**: simple, interpretable predictors such as momentum, reversal and low volatility. This lab is that workflow end to end, the same analysis open-source tools like `alphalens` automate, built yourself with pandas.

## The pipeline

```text
prices
  ↓ Part 1  signal library: momentum, reversal, low volatility (z-scored)
  ↓ Part 2  scorecard: IC, t-stat, annualized ICIR, autocorrelation
  ↓ Part 3  quintile portfolios: do returns rise with the signal?
  ↓ Part 4  neutralize against betas, blend with trailing IC weights
  ↓ Part 5  one call that produces the research summary
```

## The data

`data.factor_universe(..., momentum=0.0012)` gives 40 stocks driven by market, size and value factors, plus slowly drifting stock-specific expected returns, so **momentum is the real effect** here, while reversal and low-vol are not. A good research process should discover that.

## What each part teaches

1. **Signal construction**: cross-sectional z-scores make signals comparable and robust to market-wide moves.
2. **Scorecard**: IC (does it predict?), t-stat (is that more than noise?), ICIR (how consistent?), and autocorrelation (how much would trading it cost? Low autocorrelation means high turnover).
3. **Quintile analysis**: the single most persuasive chart in a signal pitch: average forward return by signal bucket, and the top-minus-bottom spread.
4. **Neutralize and blend**: strip out factor exposure, then combine signals using only information available at the time.
5. **The report**: what you'd show a PM: the scorecard, the best spread's Sharpe ratio, the blend's IC.

## Interview angle

"Here's a new signal. How would you evaluate it?" Answer: IC and its t-stat, decay, turnover and capacity, quantile monotonicity, correlation with existing signals and factor exposures (neutralize), robustness across periods and universes, and costs, all out of sample.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "A signal's quintile returns are Q1 0.01%, Q2 0.03%, Q3 0.00%, Q4 0.04%, Q5 0.06% per day. What's the most important caveat before trusting it?",
     "choices": ["The pattern isn't monotonic, and you need its statistical significance and stability over time before believing the spread", "Nothing; the long-short spread is positive",
                 "Quintiles should always be replaced by deciles", "Daily returns can't be compared across quintiles"],
     "answer": 0, "explanation": "A real signal usually shows a roughly monotonic pattern. One noisy bucket isn't fatal, but significance (t-stats over time), stability across periods, and costs decide."},
    {"type": "number", "prompt": "A signal's daily IC has mean 0.02 and standard deviation 0.15 over 1,000 days. What is the t-statistic of the mean IC?",
     "answer": 0.02 / 0.15 * np.sqrt(1000), "display": "≈ 4.2", "explanation": "t = mean/std × √n = (0.02/0.15) × 31.6 ≈ 4.2."},
    {"type": "open", "prompt": "Your new signal has a decent IC but its day-to-day autocorrelation is only 0.3. What does that imply and what could you do?",
     "explanation": "Low autocorrelation means the ranking changes a lot every day, so a portfolio following it turns over heavily and costs may wipe out the IC. Options: smooth the signal (an EMA of the raw signal), rebalance less often, trade only large rank changes (buffers), blend it with slower signals, or restrict it to liquid names. Then check the net-of-cost performance rather than the gross IC."},
]


def _lab(seed=1, n_days=1260, n=40):
    u = factor_universe(n_days, n, momentum=0.0012, seed=seed)
    return u["prices"], u["betas"]


_LIB = '''def zscore(df: pd.DataFrame) -> pd.DataFrame:
    return df.sub(df.mean(axis=1), axis=0).div(df.std(axis=1), axis=0)


def signal_library(prices: pd.DataFrame) -> dict:
    r = prices.pct_change()
    raw = {"mom_12_1": prices.shift(21) / prices.shift(252) - 1,
           "mom_6_1": prices.shift(21) / prices.shift(126) - 1,
           "reversal_5": -(prices / prices.shift(5) - 1),
           "low_vol": -r.rolling(60).std()}
    return {k: zscore(v) for k, v in raw.items()}
'''

_SCORE = '''def signal_scorecard(signals: dict, prices: pd.DataFrame) -> pd.DataFrame:
    fwd = prices.pct_change().shift(-1)
    rows = {}
    for name, s in signals.items():
        ic = s.corrwith(fwd, axis=1, method="spearman").dropna()
        auto = s.corrwith(s.shift(1), axis=1, method="spearman").mean()
        rows[name] = {"ic_mean": ic.mean(), "ic_t": ic.mean() / ic.std() * np.sqrt(len(ic)),
                      "icir_ann": ic.mean() / ic.std() * np.sqrt(252), "autocorr": auto}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_QUINT = '''def quantile_portfolios(signal: pd.DataFrame, prices: pd.DataFrame, n_q: int = 5) -> dict:
    fwd = prices.pct_change().shift(-1)
    ranks = signal.rank(axis=1, pct=True)
    bucket = np.ceil(ranks * n_q).clip(1, n_q)
    valid = signal.notna() & fwd.notna()
    q = pd.DataFrame({k: fwd.where(valid & (bucket == k)).mean(axis=1) for k in range(1, n_q + 1)}).dropna()
    spread = q[n_q] - q[1]
    means = q.mean()
    return {"quantile_returns": q, "spread": spread, "monotonic": bool(means.is_monotonic_increasing)}
'''

_BLEND = '''def neutral_blend(signals: dict, betas: pd.DataFrame, prices: pd.DataFrame, window: int = 126) -> dict:
    fwd = prices.pct_change().shift(-1)
    X = np.column_stack([np.ones(len(betas)), betas.loc[prices.columns].to_numpy()])
    M = np.eye(len(X)) - X @ np.linalg.solve(X.T @ X, X.T)
    neutral = {}
    for k, s in signals.items():
        filled = s.fillna(0.0)
        neutral[k] = pd.DataFrame(filled.to_numpy() @ M.T, index=s.index, columns=s.columns).where(s.notna().all(axis=1), axis=0)
    z = {k: zscore(v) for k, v in neutral.items()}
    ic = pd.DataFrame({k: v.corrwith(fwd, axis=1, method="spearman") for k, v in z.items()})
    w = ic.shift(1).rolling(window).mean().clip(lower=0)
    total = w.sum(axis=1)
    w = w.div(total, axis=0).where(total > 0, 1 / len(z)).fillna(1 / len(z))
    combined = sum(z[k].mul(w[k], axis=0) for k in z)
    return {"combined": combined, "ic_mean": combined.corrwith(fwd, axis=1, method="spearman").mean()}
'''

_IMPORTS = "import numpy as np\nimport pandas as pd\n\n\n"


def _ns():
    ns = {}
    exec(_IMPORTS + _LIB + "\n\n" + _SCORE + "\n\n" + _QUINT + "\n\n" + _BLEND, ns)
    return ns


def _signals(seed=1):
    px, betas = _lab(seed)
    return _ns()["signal_library"](px), px, betas


PROBLEMS = [
    {
        "id": "r11_signal_library",
        "title": "Part 1 · Build a signal library",
        "difficulty": "Easy",
        "libs": ["pandas"],
        "fn": "signal_library",
        "description": r"""
From a price panel (dates × stocks), compute four classic signals and z-score each **across stocks on every date** (subtract the row mean, divide by the row std with ddof=1). Return a dict:

| key | raw signal |
|---|---|
| `mom_12_1` | `prices.shift(21) / prices.shift(252) - 1` |
| `mom_6_1` | `prices.shift(21) / prices.shift(126) - 1` |
| `reversal_5` | `-(prices / prices.shift(5) - 1)` |
| `low_vol` | `-(60-day rolling std of daily returns)` |

### Learn
Signs are chosen so that **higher = more attractive**: past winners for momentum, past losers for reversal, calm stocks for low-vol. Cross-sectional z-scores remove the market-wide component (on a crash day every stock's momentum falls, but their ranking barely changes), which is what a long/short portfolio trades.

A look-ahead test checks every signal uses only past prices.
""",
        "starter": '''import numpy as np
import pandas as pd


def signal_library(prices: pd.DataFrame) -> dict:
    # return {"mom_12_1": ..., "mom_6_1": ..., "reversal_5": ..., "low_vol": ...}
    pass
''',
        "solution": _IMPORTS + _LIB,
        "hints": ["Write a small `zscore(df)` helper using `df.sub(df.mean(axis=1), axis=0).div(df.std(axis=1), axis=0)`."],
        "cases": lambda: [
            {"name": "40 stocks, 5 years", "sample": True, "args": (_lab(1)[0],)},
            {"name": "no look-ahead", "lookahead": 900, "args": (_lab(2)[0],)},
        ],
    },
    {
        "id": "r11_scorecard",
        "title": "Part 2 · The signal scorecard",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "signal_scorecard",
        "description": r"""
Score each signal in the dict from Part 1 against the **next day's** returns (`prices.pct_change().shift(-1)`). Return a DataFrame indexed by signal name with:

- `ic_mean`: mean of the per-date Spearman IC (`signal.corrwith(fwd, axis=1, method="spearman")`, dropping NaN dates)
- `ic_t`: ic_mean / std(IC) × √(number of IC dates)
- `icir_ann`: ic_mean / std(IC) × √252
- `autocorr`: mean per-date Spearman correlation between the signal and its own value the previous day (`signal.corrwith(signal.shift(1), axis=1, method="spearman")`)

### Learn
This table is the first slide of every signal review. In this universe momentum should show the strongest IC, with a t-stat well above 2 and high autocorrelation (cheap to trade). The others are weaker, and reversal often comes out *negative*: when last week's winners keep winning, a bet on reversal loses. Reversal's lower autocorrelation also means it would be expensive to trade, even if it worked.
""",
        "starter": '''import numpy as np
import pandas as pd


def signal_scorecard(signals: dict, prices: pd.DataFrame) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _SCORE,
        "hints": ["Compute the IC series once per signal and derive the three IC statistics from it."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "the four signals", "sample": True, "args": _signals(1)[:2]},
            {"name": "another universe", "args": _signals(3)[:2]},
        ],
    },
    {
        "id": "r11_quantiles",
        "title": "Part 3 · Quintile portfolios",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "quantile_portfolios",
        "description": r"""
For one signal, sort stocks into `n_q` buckets on each date and track each bucket's next-day equal-weighted return:

1. percentile ranks across stocks: `signal.rank(axis=1, pct=True)`; bucket = `ceil(rank × n_q)`, clipped to [1, n_q]
2. for each bucket k, the mean next-day return (`prices.pct_change().shift(-1)`) over the stocks in it that have both a signal and a forward return
3. keep dates where every bucket has a value

Return a dict: `quantile_returns` (DataFrame, dates × buckets 1 … n_q), `spread` (bucket n_q minus bucket 1) and `monotonic` (True if the buckets' mean returns increase from 1 to n_q).

### Learn
`df.where(mask)` keeps values where the mask is True and sets the rest to NaN, so `fwd.where(bucket == k).mean(axis=1)` is bucket k's equal-weighted return. Plot `quantile_returns.mean()` as a bar chart and `spread.cumsum()` as a line: those two charts are how signals get pitched. With 40 stocks each quintile holds 8 names, so expect noise; with 3,000 stocks the picture is far cleaner.
""",
        "starter": '''import numpy as np
import pandas as pd


def quantile_portfolios(signal: pd.DataFrame, prices: pd.DataFrame, n_q: int = 5) -> dict:
    # return {"quantile_returns": ..., "spread": ..., "monotonic": ...}
    pass
''',
        "solution": _IMPORTS + _QUINT,
        "hints": ["`np.ceil(ranks * n_q).clip(1, n_q)` maps percentile ranks to bucket numbers."],
        "cases": lambda: [
            {"name": "momentum 6-1, quintiles", "sample": True, "args": (_signals(1)[0]["mom_6_1"], _signals(1)[1])},
            {"name": "low-vol, terciles", "args": (_signals(1)[0]["low_vol"], _signals(1)[1], 3)},
        ],
    },
    {
        "id": "r11_blend",
        "title": "Part 4 · Neutralize and blend",
        "difficulty": "Hard",
        "libs": ["numpy", "pandas"],
        "fn": "neutral_blend",
        "description": r"""
Turn the signal library into one alpha:

1. **neutralize** each signal against the stocks' factor `betas` (stocks × factors) with the projection from the previous step, $s^\perp = s(I - X(X^\top X)^{-1}X^\top)^\top$ with $X = [\mathbf 1, B]$ (rows of `betas` ordered like the price columns). Apply it to the signal with NaN filled by 0, then set to NaN the dates where the original signal had any NaN
2. re-z-score each neutralized signal per date
3. **blend** with trailing IC weights exactly as in the previous step: daily Spearman IC against next-day returns, weights = `ic.shift(1).rolling(window).mean()` floored at 0 and normalized, equal weights when unavailable
4. return a dict: `combined` (DataFrame) and `ic_mean` (the combined signal's mean daily IC)

### Learn
Neutralizing first means the blend can't sneak in factor bets: whatever it earns comes from stock selection. The `shift(1)` keeps the weights causal. Reuse your earlier work (`from r10_neutralize import neutralize`, `from r10_combine import combine_signals`), adapting them to the NaN handling above.
""",
        "starter": '''import numpy as np
import pandas as pd


def neutral_blend(signals: dict, betas: pd.DataFrame, prices: pd.DataFrame, window: int = 126) -> dict:
    # return {"combined": ..., "ic_mean": ...}
    pass
''',
        "solution": _IMPORTS + _LIB + "\n\n" + _BLEND,
        "hints": ["`df.where(row_mask, axis=0)` blanks whole rows where the mask is False."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "four signals, 3 betas", "sample": True, "args": (_signals(1)[0], _signals(1)[2], _signals(1)[1])},
            {"name": "window 252", "args": (_signals(4)[0], _signals(4)[2], _signals(4)[1], 252)},
        ],
    },
    {
        "id": "r11_report",
        "title": "Part 5 · Run the signal research pipeline",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "signal_research_report",
        "description": r"""
Chain Parts 1–4 into one call. From `prices` and `betas`:

1. `signals = signal_library(prices)`
2. `scorecard = signal_scorecard(signals, prices)`
3. `best` = the signal with the highest `ic_t`; run `quantile_portfolios` on it and compute its spread's annualized Sharpe ratio (mean/std × √252)
4. `blend = neutral_blend(signals, betas, prices)`
5. return `{"scorecard": scorecard, "best": best, "best_spread_sharpe": ..., "best_monotonic": ..., "blend_ic": blend["ic_mean"]}`

### Learn
On this universe the pipeline should name `mom_6_1` or `mom_12_1` as the best signal with a positive long-short Sharpe ratio. Then run it on real data in a notebook: about 30 large US stocks from yfinance with betas from your factor lab, and see whether momentum shows up there.
""",
        "starter": '''import numpy as np
import pandas as pd


def signal_research_report(prices: pd.DataFrame, betas: pd.DataFrame) -> dict:
    # return {"scorecard": ..., "best": ..., "best_spread_sharpe": ..., "best_monotonic": ..., "blend_ic": ...}
    pass
''',
        "solution": _IMPORTS + _LIB + "\n\n" + _SCORE + "\n\n" + _QUINT + "\n\n" + _BLEND + '''

def signal_research_report(prices: pd.DataFrame, betas: pd.DataFrame) -> dict:
    signals = signal_library(prices)
    scorecard = signal_scorecard(signals, prices)
    best = scorecard["ic_t"].idxmax()
    q = quantile_portfolios(signals[best], prices)
    spread = q["spread"]
    return {"scorecard": scorecard, "best": best, "best_spread_sharpe": spread.mean() / spread.std() * np.sqrt(252),
            "best_monotonic": q["monotonic"], "blend_ic": neutral_blend(signals, betas, prices)["ic_mean"]}
''',
        "hints": ["`scorecard['ic_t'].idxmax()` names the best signal."],
        "rtol": 1e-6,
        "timeout": 300,
        "cases": lambda: [
            {"name": "40-stock universe", "sample": True, "args": _lab(1)},
            {"name": "another universe", "args": _lab(5)},
        ],
    },
]
