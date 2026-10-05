import numpy as np
import pandas as pd

TITLE = "Researcher interview playbook"
SUMMARY = "How graduate quant researcher hiring works, how to handle each round, the take-home case study, presenting your capstone, and a final checklist."
KIND = "interview"

LESSON = r"""
Researcher interviews test three things: can you reason with probability and statistics, can you code with data quickly and correctly, and do you have research judgment (knowing when a result is real). This step is about showing all three under interview conditions.

## How graduate researcher hiring usually works

Formats differ by firm and year, so check each firm's current process. The common shape:

1. **Online assessments**: timed coding (algorithms plus pandas/numpy data manipulation), probability and statistics questions, sometimes numerical reasoning.
2. **Technical interviews**: probability puzzles, statistics (regression, hypothesis tests, multiple testing), linear algebra (eigenvalues, PCA, positive definiteness), machine learning theory (bias-variance, regularization, validation), live coding.
3. **Research case or take-home**: a dataset and an open question ("is there a signal here?"). You deliver code and a short write-up, sometimes a presentation.
4. **Final round**: a presentation of your own research (thesis or a project such as the capstone), deeper technical questions on it, more puzzles, and behavioral interviews.

Options and volatility research roles (market makers, volatility funds, derivatives desks) add their own layer: Black–Scholes and the Greeks under pressure, delta-hedged P&L, implied vol surfaces and their arbitrage constraints, variance swaps, realized vol forecasting and the variance risk premium.

## How to perform in each kind of question

**Probability and statistics**
- State assumptions, start from small cases, use symmetry, complements and conditioning. Give the answer as a fraction and a decimal and sanity-check it.
- For statistics, always ask what the data-generating process is, whether observations are independent, and how many things were tried.

**Machine learning theory**
- Connect every answer to finance's low signal-to-noise ratio: why simple, regularized models usually win; why validation must respect time; why leakage is the first suspect for good results.

**Live coding**
- Clarify inputs and edge cases, write the straightforward correct version first, test it on a tiny example, then optimize. Narrate your reasoning.
- For pandas questions, know `groupby` with named aggregation, `merge_asof`, `resample`, `rolling`, `shift`, `pivot`, and vectorized operations instead of loops.

## The take-home case study

What graders look for, in order:
1. **No leakage**: features use only past data, labels are aligned correctly, validation is walk-forward or purged.
2. **Honest evaluation**: out-of-sample numbers, costs, significance, and how many variants you tried.
3. **Clear structure**: hypothesis → data checks → features → model → validation → portfolio/backtest → risks and next steps.
4. **Clean, runnable code** with a short README.
5. **A write-up that leads with the conclusion**, including what didn't work and the limitations. A modest result reported honestly beats a spectacular one that doesn't survive questions.

## Presenting your capstone

The track ends with two capstones: the ML equity strategy and the options volatility strategy. Present the one that matches the role (equity or stat-arb research versus options or volatility research), and know the other well enough to discuss. A five-minute version:
1. the question and why it matters (one slide)
2. data and cleaning decisions
3. features and labels, and how you prevented look-ahead
4. models and validation (purged walk-forward), with a simple baseline
5. portfolio construction and costs
6. results: IC, long/short Sharpe, turnover, drawdown, deflated Sharpe
7. what didn't work, and what you'd do with more time

Expect follow-ups such as "How many models did you try?", "What happens with 2× costs?", "Is the result stable across sub-periods?", "Why should this effect exist?"

## Topics checklist

- Probability: conditioning, Bayes, expectation and variance tricks, order statistics, Markov chains, martingales
- Statistics: regression and its assumptions, HAC standard errors, hypothesis tests, multiple testing, bootstrap
- Linear algebra: eigen-decomposition, PCA, covariance estimation, positive definiteness
- Optimization: convexity, Lagrange multipliers, mean-variance
- Machine learning: regularization, trees and boosting, cross-validation, leakage, feature importance
- Time series: stationarity, autocorrelation, AR models, volatility clustering
- Finance: factor models, CAPM, Sharpe ratio, transaction costs
- Options and volatility: Black–Scholes and Greeks, gamma versus theta in a hedged book, implied vol surfaces (SVI) and no-arbitrage, risk-neutral densities, variance swaps and the VIX, realized vol estimators, HAR, the variance risk premium

## Reading list (for reference)

- Zhou, *A Practical Guide to Quantitative Finance Interviews*
- James, Witten, Hastie & Tibshirani, *An Introduction to Statistical Learning*, then Hastie, Tibshirani & Friedman, *The Elements of Statistical Learning*
- López de Prado, *Advances in Financial Machine Learning*
- Grinold & Kahn, *Active Portfolio Management*
- Pedersen, *Efficiently Inefficient*
- Gatheral, *The Volatility Surface*, and Sinclair, *Volatility Trading*

## Final checklist

1. Every step on this path at 100%, including all project labs and the capstone
2. Every question on this path answered correctly or marked "Got it"
3. Both capstones finished, and the one that fits your target role presented out loud in five minutes, plus answers to the follow-ups above
4. That capstone rerun on real data in a notebook, with an honest write-up of the result
5. Three behavioral stories rehearsed (a research dead end, a mistake you caught, teamwork)
6. A timed pandas exercise: the task below in under 20 minutes
"""

QUESTIONS = [
    {"type": "number", "prompt": "A simple regression on 2,500 observations has R² = 0.04. What is the t-statistic of the slope, approximately?",
     "answer": 0.2 * np.sqrt(2498) / np.sqrt(0.96), "tol": 0.03, "display": "≈ 10.2",
     "explanation": "With one regressor, t = r√(n − 2)/√(1 − r²) and r = √0.04 = 0.2: t ≈ 0.2 × 50/0.98 ≈ 10.2. A tiny R² can be overwhelmingly significant, and in return prediction an R² of 1% can be economically large."},
    {"type": "number", "prompt": "You test 100 independent strategies that have no edge, each at the 5% significance level. What's the probability that at least one looks significant?",
     "answer": 1 - 0.95**100, "display": "≈ 0.994", "explanation": "1 − 0.95¹⁰⁰ ≈ 0.994. Finding a 'significant' backtest after many trials is nearly guaranteed, which is why you control the false discovery rate or deflate the Sharpe ratio."},
    {"type": "number", "prompt": "X₁, X₂, X₃ are independent and uniform on [0, 1]. What is E[max(X₁, X₂, X₃)]?",
     "answer": 0.75, "explanation": "P(max ≤ x) = x³, so the density is 3x² and the mean is ∫3x³ dx = 3/4. In general, the max of n uniforms has mean n/(n + 1)."},
    {"type": "number", "prompt": "corr(X, Y) = 0.5 and corr(Y, Z) = 0.5. What is the smallest possible value of corr(X, Z)?",
     "answer": -0.5, "explanation": "The correlation matrix must be positive semi-definite, which gives ρ_XZ ≥ ρ_XY ρ_YZ − √((1 − ρ_XY²)(1 − ρ_YZ²)) = 0.25 − 0.75 = −0.5."},
    {"type": "number", "prompt": "A stick is broken at two independent uniformly random points. What's the probability the three pieces form a triangle?",
     "answer": 0.25, "explanation": "The pieces form a triangle when every piece is shorter than ½. In the unit square of break points, that region has area ¼."},
    {"type": "number", "prompt": "A strategy shows an annualized Sharpe ratio of 1.0 over 4 years of daily data. Ignoring the small SR²/2 correction, what's the standard error of that Sharpe estimate?",
     "answer": 0.5, "explanation": "The standard error of an annualized Sharpe estimate is about 1/√(years) = 1/√4 = 0.5, so a measured 1.0 has a 95% interval of roughly 0 to 2. Four years can't distinguish a good strategy from a mediocre one."},
    {"type": "choice", "prompt": "You predict 20-day forward returns with features from overlapping 20-day windows, validate with shuffled 5-fold CV, and get excellent scores that vanish in live trading. What is the most likely cause?",
     "choices": ["Leakage: overlapping labels and shuffling put near-duplicate information in train and test folds", "The model is underfitting",
                 "Five folds are too few", "Live markets are always different from backtests"],
     "answer": 0, "explanation": "Overlapping labels are highly autocorrelated, and shuffled folds let the model see nearly the same samples in training. Use walk-forward or purged K-fold with an embargo."},
    {"type": "number", "prompt": "A delta-hedged options book has gamma of 500 shares per $1 move and theta of −$300 per day. The stock moves $1.20 today. What's the approximate P&L in dollars?",
     "answer": 60, "explanation": "Gamma P&L ≈ ½ × 500 × 1.2² = $360, minus $300 of theta: about +$60. The break-even move is √(2 × 300/500) ≈ $1.10, which is the daily move the option's implied vol prices in."},
    {"type": "number", "prompt": "Earnings are announced in 5 trading days. The front-month option (expiring right after) has 60% implied vol; the stock's normal vol is 30%. What daily move does the market imply for earnings day, in %?",
     "answer": 100 * np.sqrt(0.36 * 5 / 252 - 0.09 * 4 / 252), "tol": 0.02, "display": "≈ 7.6%",
     "explanation": "Total variance to expiry = 0.6² × 5/252 = 0.00714. Four normal days contribute 0.3² × 4/252 = 0.00143. The earnings day carries the remaining 0.00571, a standard deviation of √0.00571 ≈ 7.6%."},
    {"type": "open", "prompt": "How would you research which options are overpriced?",
     "explanation": "Define overpriced as implied variance above a good forecast of realized variance (HAR on realized measures, plus events like earnings), measured out of sample. Study the premium's drivers: recent realized vol, the level and slope of the term structure, skew, demand pressure, market stress. Build the signal from forecasts that don't use the implied vol you're judging, sort the cross-section, and test with delta-hedged options, real bid–ask costs, and tail metrics (skew, worst month, CVaR), since short-vol returns are negatively skewed. The options capstone does exactly this."},
    {"type": "open", "prompt": "Walk me through how you would research a new alpha idea, from hypothesis to production.",
     "explanation": "Hypothesis with an economic reason → data sourcing and point-in-time checks → signal construction → IC and its t-stat, decay across horizons, quantile monotonicity → correlation with existing signals and neutralization against known factors → portfolio construction with a risk model → costs, turnover and capacity → out-of-sample and sub-period robustness, number of trials (deflated Sharpe) → paper trading → small live allocation with monitoring and kill criteria."},
    {"type": "open", "prompt": "How would you tell whether a backtest is overfit?",
     "explanation": "Count the trials (and deflate the Sharpe ratio accordingly); hold out a final untouched test period; check parameter stability (do neighbouring parameters work too?); look for an economic rationale; test across sub-periods, universes and markets; examine sensitivity to costs and execution assumptions; use combinatorial purged CV or the probability of backtest overfitting; and be suspicious of very high Sharpe ratios with few trades."},
    {"type": "open", "prompt": "Explain the bias-variance trade-off and why it matters more in finance than in, say, image recognition.",
     "explanation": "Expected error = bias² + variance + noise. Flexible models reduce bias but add variance. Financial returns have a tiny signal-to-noise ratio and non-stationary relationships, with limited independent data, so variance dominates: complex models fit noise. Hence shrinkage, regularization, simple features, ensembles, and strict out-of-sample validation. Images have stable patterns and huge labelled datasets, so low-bias models pay off."},
    {"type": "open", "prompt": "Why do you want to be a quantitative researcher rather than a software engineer or a trader?",
     "explanation": "Strong answers show you enjoy open-ended problems where the answer is unknown and the data is noisy, care about rigor (careful validation, honest results), and like that market feedback is objective. Give evidence: research projects, the capstone, competitions, a thesis. Contrast thoughtfully: engineers build systems toward a spec; traders make real-time decisions; researchers find and validate the edge. Tie it to the firm's research style."},
]


def _trades(seed=0, n_days=8, symbols=("AAA", "BBB", "CCC", "DDD")):
    rng = np.random.default_rng(seed)
    rows = []
    for d in pd.bdate_range("2024-03-04", periods=n_days):
        for sym, base in zip(symbols, (50, 120, 15, 300)):
            n = int(rng.integers(20, 60))
            secs = np.sort(rng.integers(9 * 3600 + 1800, 16 * 3600, n))
            rows.append(pd.DataFrame({"time": d + pd.to_timedelta(secs, unit="s"), "symbol": sym,
                                      "price": np.round(base * np.exp(0.002 * rng.standard_normal(n).cumsum() + 0.01 * rng.standard_normal()), 2),
                                      "size": rng.integers(1, 20, n) * 100}))
    return pd.concat(rows).sample(frac=1, random_state=seed).reset_index(drop=True)


PROBLEMS = [
    {
        "id": "r14_pandas_screen",
        "title": "The pandas screen: daily stats from raw trades",
        "difficulty": "Medium",
        "libs": ["pandas"],
        "fn": "daily_trade_stats",
        "description": r"""
A typical timed data-manipulation question. `trades` has columns `time` (Timestamp), `symbol`, `price`, `size`, in **no particular order**. Return a DataFrame indexed by `(date, symbol)` (a MultiIndex with those names, sorted), with columns:

- `vwap`: Σ price × size / Σ size for that symbol on that day
- `volume`: total size
- `n_trades`: number of trades
- `close`: the price of the **last trade of the day** (by time)
- `ret`: the day-over-day change in `close` for the same symbol (`pct_change`, NaN on each symbol's first day)

`date` is the calendar day of `time`, as a normalized Timestamp (`time.dt.normalize()`).

### Learn
The things this tests: grouping by two keys, named aggregation (`.agg(volume=("size", "sum"), ...)`), getting "last by time" right when rows are shuffled (sort first), and computing a per-symbol return without leaking across symbols (`groupby(level="symbol")["close"].pct_change()`). Aim to solve it in under 20 minutes without looking anything up.
""",
        "starter": '''import numpy as np
import pandas as pd


def daily_trade_stats(trades: pd.DataFrame) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def daily_trade_stats(trades: pd.DataFrame) -> pd.DataFrame:
    t = trades.sort_values("time").assign(date=lambda x: x["time"].dt.normalize(), notional=lambda x: x["price"] * x["size"])
    out = t.groupby(["date", "symbol"]).agg(notional=("notional", "sum"), volume=("size", "sum"),
                                            n_trades=("price", "size"), close=("price", "last"))
    out["vwap"] = out.pop("notional") / out["volume"]
    out["ret"] = out.groupby(level="symbol")["close"].pct_change()
    return out[["vwap", "volume", "n_trades", "close", "ret"]]
''',
        "hints": ["Sort by time first so that `('price', 'last')` really is the last trade of the day.",
                  "`groupby(level='symbol')` keeps each symbol's returns separate."],
        "cases": lambda: [
            {"name": "4 symbols, 8 days, shuffled", "sample": True, "args": (_trades(0),)},
            {"name": "different data", "args": (_trades(7, 12),)},
        ],
    },
]
