import numpy as np
import pandas as pd

from data import gbm_panel

TITLE = "Python for quants"
SUMMARY = "NumPy, pandas and Monte Carlo: the toolkit behind every task here and a fast way to sanity-check interview answers."
KIND = "foundation"

LESSON = r"""
Quant work is fast experimentation. You get an idea, test it on data or a simulation in minutes, and move on. In interviews the same skill shows up as "solve it analytically, then check it with a five-line simulation".

## NumPy: think in arrays

Python loops over a million numbers take about a second; the same operation on a NumPy array takes milliseconds. Learn to express computations on whole arrays:

```python
import numpy as np
rng = np.random.default_rng(42)          # always use a seeded Generator
x = rng.normal(0, 1, size=(10_000, 252)) # 10,000 paths x 252 days
paths = x.cumsum(axis=1)                 # random walks, one per row
hit = (paths >= 10).any(axis=1)          # boolean mask per path
first = (paths >= 10).argmax(axis=1)     # index of the first True (0 if never)
rng.integers(1, 7, size=5)               # dice: the high end is EXCLUSIVE
rng.choice([-1, 1], size=100)            # coin flips
rng.permutation(52)                      # a shuffled deck
```

- **Broadcasting**: operations between arrays of compatible shapes, e.g. `X - X.mean(axis=0)` demeans every column.
- **axis**: `axis=0` works down the rows (one result per column), `axis=1` across the columns (one result per row).
- **Path-dependent quantities** usually have a cumulative form: `cumsum` for random walks, `cumprod` for compounding, `np.maximum.accumulate` (or pandas `cummax`) for running peaks and drawdowns.

## Monte Carlo, properly

To estimate $\theta = E[f(X)]$, draw $n$ samples and average. The estimate is itself random:

$$\hat\theta = \frac1n\sum_i f(X_i), \qquad \text{SE}(\hat\theta) = \frac{s}{\sqrt n}, \qquad \text{95\% CI} \approx \hat\theta \pm 1.96\,\text{SE}$$

The error shrinks like $1/\sqrt n$: **each extra digit of precision costs 100× more samples.** Always report the standard error with a simulated number.

## pandas: labelled time series

```python
import pandas as pd
r = px.pct_change().dropna()        # simple returns, one column per asset
r.rolling(20).std() * np.sqrt(252)  # 20-day annualized volatility (window ends at t)
px.resample("ME").last()            # month-end prices
r.groupby(r.index.year).sum()       # one row per year
px / px.cummax() - 1                # drawdown from the running peak
```

Arithmetic **aligns on the index**: adding two Series matches dates, not positions. That prevents off-by-one errors and causes surprise NaNs when indexes differ.

## Annualization conventions

With 252 trading days a year: mean return × 252, volatility × $\sqrt{252}$, Sharpe ratio = mean / std × $\sqrt{252}$ (risk-free rate 0 here). The √ comes from variances adding over independent periods.

## How to use this platform

Each task gives you a function signature. **Run** checks the sample tests and shows your output next to the expected output; **Submit** runs every test. Your code is saved to `my_work/`, and solved tasks can be imported from later ones (for example `from f6_bs_greeks import bs_greeks`).
"""

QUESTIONS = [
    {"type": "choice",
     "prompt": "What does `np.random.default_rng(1).integers(1, 7, size=10)` return?",
     "choices": ["Ten integers from 1 to 6", "Ten integers from 1 to 7", "Ten floats in [1, 7)", "One integer from 1 to 6"],
     "answer": 0,
     "explanation": "`integers(low, high)` excludes `high`, so `(1, 7)` simulates a die."},
    {"type": "number",
     "prompt": "A Monte Carlo estimate from 10,000 samples has a standard error of 0.02. How many samples do you need for a standard error of 0.005?",
     "answer": 160000, "tol": 0, "display": "160,000",
     "explanation": "SE ∝ 1/√n. Cutting the error by 4× needs 4² = 16× more samples: 160,000."},
    {"type": "choice",
     "prompt": "At row t, `df['r'].rolling(20).mean()` averages which rows?",
     "choices": ["t−19 through t", "t through t+19", "t−10 through t+9", "every row up to t"],
     "answer": 0,
     "explanation": "Rolling windows are trailing and include the current row. A value at t only uses data up to t."},
    {"type": "number",
     "prompt": "A strategy's daily returns have mean 0.05% and standard deviation 1%. What is its annualized Sharpe ratio (risk-free 0, 252 days)?",
     "answer": 0.05 / 1 * np.sqrt(252), "display": "≈ 0.794",
     "explanation": "Daily Sharpe = 0.0005 / 0.01 = 0.05. Annualize by √252 ≈ 15.87: 0.05 × 15.87 ≈ 0.794."},
]


def _paths_case(seed):
    return gbm_panel(600, 4, seed=seed)


PROBLEMS = [
    {
        "id": "f1_mc_estimate",
        "title": "A Monte Carlo estimate with error bars",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "mc_estimate",
        "description": r"""
Given an array of Monte Carlo samples, report the estimate and its uncertainty. Return a dict:

- `mean`: the sample mean
- `se`: standard error, sample standard deviation (ddof=1) / $\sqrt n$
- `ci_low`, `ci_high`: the 95% confidence interval `mean ∓ 1.96 * se`

### Learn
This is the habit that separates a quant from someone who "ran a simulation": every simulated number comes with its error. If two strategies' simulated Sharpe ratios differ by less than a couple of standard errors, you haven't shown that one is better.

`np.asarray(samples, dtype=float)` lets the function accept lists, arrays and Series. `x.std(ddof=1)` is the sample standard deviation; numpy's default `ddof=0` divides by n instead of n − 1.
""",
        "starter": '''import numpy as np


def mc_estimate(samples) -> dict:
    # return {"mean": ..., "se": ..., "ci_low": ..., "ci_high": ...}
    pass
''',
        "solution": '''import numpy as np


def mc_estimate(samples) -> dict:
    x = np.asarray(samples, dtype=float)
    mean = x.mean()
    se = x.std(ddof=1) / np.sqrt(len(x))
    return {"mean": mean, "se": se, "ci_low": mean - 1.96 * se, "ci_high": mean + 1.96 * se}
''',
        "hints": ["Four short lines. The only trap is `ddof`."],
        "cases": lambda: [
            {"name": "1,000 normal draws", "sample": True, "args": (np.random.default_rng(1).normal(2, 3, 1000),)},
            {"name": "coin flips as a list", "args": (list(np.random.default_rng(2).integers(0, 2, 500)),)},
            {"name": "heavy-tailed payoffs", "args": (np.random.default_rng(3).standard_t(3, 5000),)},
        ],
    },
    {
        "id": "f1_dice_sim",
        "title": "Simulate the distribution of a dice sum",
        "difficulty": "Easy",
        "libs": ["numpy", "pandas"],
        "fn": "dice_sum_distribution",
        "description": r"""
Estimate the distribution of the sum of `n_dice` fair dice by simulation, fully vectorized:

1. `rng = np.random.default_rng(seed)`
2. `rolls = rng.integers(1, 7, size=(n_sims, n_dice))`, then sum across each row
3. Return a Series indexed by **every** possible sum from `n_dice` to `6 * n_dice` (sorted), holding the fraction of simulations with that sum (0 for sums that never came up)

### Learn
Using the generator exactly as specified makes your result reproducible: same seed, same numbers, same answer as the reference.

`pd.Series(sums).value_counts(normalize=True)` gives frequencies; `.reindex(range(lo, hi + 1), fill_value=0.0)` fills in the sums that didn't occur and sorts them.

Compare with the exact answer for two dice: P(7) = 6/36 ≈ 0.1667. With 100,000 simulations the standard error is about $\sqrt{p(1-p)/n} \approx 0.0012$, so expect agreement to about 2–3 decimals. You'll compute the exact distribution in the next step.
""",
        "starter": '''import numpy as np
import pandas as pd


def dice_sum_distribution(n_dice: int, n_sims: int, seed: int = 0) -> pd.Series:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def dice_sum_distribution(n_dice: int, n_sims: int, seed: int = 0) -> pd.Series:
    rng = np.random.default_rng(seed)
    sums = rng.integers(1, 7, size=(n_sims, n_dice)).sum(axis=1)
    freq = pd.Series(sums).value_counts(normalize=True)
    return freq.reindex(range(n_dice, 6 * n_dice + 1), fill_value=0.0)
''',
        "hints": ["`size=(n_sims, n_dice)` gives one row per simulation; `.sum(axis=1)` adds across each row."],
        "cases": lambda: [
            {"name": "2 dice, 100k sims", "sample": True, "args": (2, 100_000, 1)},
            {"name": "3 dice", "args": (3, 50_000, 2)},
            {"name": "10 dice, few sims (some sums never appear)", "args": (10, 2_000, 3)},
        ],
    },
    {
        "id": "f1_asset_stats",
        "title": "Vectorized performance table",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "asset_stats",
        "description": r"""
Given a DataFrame of daily prices (one column per asset), return a DataFrame indexed by asset with columns:

- `cagr`: $(P_{\text{last}}/P_{\text{first}})^{252/n} - 1$, where $n$ is the number of daily returns
- `ann_vol`: standard deviation of daily simple returns × $\sqrt{252}$
- `sharpe`: mean / std of daily returns × $\sqrt{252}$
- `max_drawdown`: the most negative value of $P_t / \max_{s \le t} P_s - 1$

Compute every column for all assets at once, with no Python loop over assets.

### Learn
pandas methods work column-wise by default: `px.pct_change()`, `.mean()`, `.std()`, `.cummax()`, `.min()` each return one value per column. Combine the resulting Series with `pd.DataFrame({...})`.

Max drawdown is the loss a holder would have suffered buying at the worst possible peak. Investors feel it far more than volatility: a strategy with a 50% drawdown needs a 100% gain to recover.
""",
        "starter": '''import numpy as np
import pandas as pd


def asset_stats(prices: pd.DataFrame) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def asset_stats(prices: pd.DataFrame) -> pd.DataFrame:
    r = prices.pct_change().dropna()
    n = len(r)
    return pd.DataFrame({
        "cagr": (prices.iloc[-1] / prices.iloc[0]) ** (252 / n) - 1,
        "ann_vol": r.std() * np.sqrt(252),
        "sharpe": r.mean() / r.std() * np.sqrt(252),
        "max_drawdown": (prices / prices.cummax() - 1).min(),
    })
''',
        "hints": ["Every column is one vectorized expression returning a Series indexed by asset."],
        "cases": lambda: [
            {"name": "4 assets, 600 days", "sample": True, "args": (_paths_case(1),)},
            {"name": "8 assets, 4 years", "args": (gbm_panel(1008, 8, seed=2),)},
        ],
    },
    {
        "id": "f1_first_passage",
        "title": "Vectorized first-passage times",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "first_passage",
        "description": r"""
Simulate `n_paths` symmetric random walks of `n_steps` steps each, starting at 0, and measure when they first reach `barrier` (a positive integer):

1. `rng = np.random.default_rng(seed)`; steps `rng.choice([-1, 1], size=(n_paths, n_steps))`; positions are the cumulative sums along each path
2. A path **hits** if its position is ≥ `barrier` at some step. Its hitting time is the number of steps taken when it first gets there (1 for the first step).
3. Return a dict: `p_hit` (fraction of paths that hit) and `mean_time` (average hitting time over the paths that hit)

### Learn
The vectorized first-hit trick: build a boolean array `reached = positions >= barrier`; then `reached.any(axis=1)` says whether each path hit, and `reached.argmax(axis=1)` gives the index of the first True. Add 1 to turn an index into a step count, and use only rows that hit (argmax returns 0 for rows with no True).

This kind of question is common in trader interviews ("what's the probability a stock that moves ±1 a day reaches +10 within 100 days?"). The reflection principle gives $P(\max_{k\le n} S_k \ge a) = 2P(S_n \ge a) - P(S_n = a)$; check your simulation against it.
""",
        "starter": '''import numpy as np


def first_passage(n_paths: int, n_steps: int, barrier: int, seed: int = 0) -> dict:
    # return {"p_hit": ..., "mean_time": ...}
    pass
''',
        "solution": '''import numpy as np


def first_passage(n_paths: int, n_steps: int, barrier: int, seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    positions = rng.choice([-1, 1], size=(n_paths, n_steps)).cumsum(axis=1)
    reached = positions >= barrier
    hit = reached.any(axis=1)
    times = reached.argmax(axis=1) + 1
    return {"p_hit": hit.mean(), "mean_time": times[hit].mean()}
''',
        "hints": ["`argmax` on a boolean array returns the first index of the maximum, i.e. the first True."],
        "cases": lambda: [
            {"name": "barrier 5, 100 steps", "sample": True, "args": (20_000, 100, 5, 1)},
            {"name": "barrier 10, 252 steps", "args": (10_000, 252, 10, 2)},
            {"name": "barrier 1", "args": (5_000, 50, 1, 3)},
        ],
    },
]
