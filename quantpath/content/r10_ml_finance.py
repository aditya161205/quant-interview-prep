import numpy as np
import pandas as pd

from data import dates, factor_universe

TITLE = "ML for finance and signal research"
SUMMARY = "How alpha research really works: neutralizing signals, IC and its decay, combining signals without look-ahead, purged cross-validation, and deflating Sharpe ratios."
KIND = "core"

LESSON = r"""
Generic ML assumes i.i.d. data and plenty of signal. Markets give you neither. This step covers the tools that make ML and signal research work on financial data. They're what separates a quant researcher from a data scientist in interviews.

## The research process

hypothesis → data → signal → evaluation (IC, decay, turnover) → portfolio → costs → out-of-sample check → only then a model or a deployment. Every variant you try is a trial that counts against you later.

## Cross-sectional signals

Most equity alpha is **cross-sectional**: rank stocks against each other on each date (who will outperform whom), rather than predicting the market's direction.

- **IC** (information coefficient): Spearman correlation between today's signal and the next period's returns, computed per date and then averaged. 0.02–0.05 is typical for a useful daily signal. **ICIR** = mean IC / std IC.
- **Fundamental law**: $IR \approx IC\sqrt{\text{breadth}}$. Weak signals applied to many independent bets can produce strong portfolios.
- **IC decay**: the IC against returns h days ahead. Fast decay means you must trade fast (high turnover, high costs); slow decay allows patient, cheap trading.

## Neutralization

Raw signals carry unintended exposures: a "quality" signal may simply be long low-beta stocks. **Neutralize** by regressing the signal across stocks on the exposures (market beta, sector dummies, size) each date and keeping the residual. The residual signal has zero exposure to those factors, so its returns are closer to pure alpha. With constant exposures B, the residuals are a single projection: $s^\perp = (I - X(X^\top X)^{-1}X^\top)s$ with $X = [\mathbf 1, B]$.

## Combining signals

Equal-weighting z-scored signals is a strong baseline. IC-weighting tilts toward signals that have worked, but **only using ICs known at the time**: the IC of date t needs the return from t to t+1, which is known only at t+1. Regression or ML combinations can learn interactions but overfit more easily. Correlated signals add less than their individual ICs suggest.

## Validation for financial ML

- Labels overlap in time (a 20-day forward return shares 19 days with the next one), so **purge** training samples whose label windows overlap the test period and **embargo** a buffer after it (López de Prado).
- Walk-forward or purged K-fold, never shuffled K-fold.
- **Deflated Sharpe ratio**: given N trials, the best Sharpe ratio is biased upward. Compare it against the expected maximum of N skill-less trials before believing it.

## Labels

Forward raw returns, forward **residual** returns (after removing factor exposures, often better for alpha models), cross-sectional ranks (robust to outliers), or triple-barrier labels. Choose the label to match how you'll trade.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Fundamental law of active management: a signal has IC 0.05 and you make 400 independent bets a year. What information ratio do you expect?",
     "answer": 1.0, "explanation": "IR ≈ IC × √breadth = 0.05 × 20 = 1.0."},
    {"type": "choice", "prompt": "Why would you neutralize a signal against market beta and sector?",
     "choices": ["So its returns come from stock selection rather than unintended bets on the market or sectors", "To increase its raw correlation with returns",
                 "Because ranks require it", "To reduce the number of stocks traded"],
     "answer": 0, "explanation": "Unneutralized signals often hide factor bets that can be had cheaply elsewhere and add risk you didn't intend."},
    {"type": "number", "prompt": "Approximately what is the expected maximum of 100 independent standard normal draws?",
     "answer": 2.51, "tol": 0.02, "display": "≈ 2.51",
     "explanation": "E[max] for n = 100 is about 2.51 (√(2 ln 100) ≈ 3.03 is the looser asymptotic bound). The best of 100 noise backtests has a Sharpe ratio about 2.5 standard errors above zero."},
    {"type": "choice", "prompt": "A signal's IC is 0.05 at a 1-day horizon but drops to 0.005 by 5 days. What does that imply for trading it?",
     "choices": ["You need to trade quickly and often, so transaction costs are critical", "You can rebalance monthly at no loss",
                 "The signal is useless", "It should be combined only with slower signals"],
     "answer": 0, "explanation": "Fast decay means the edge disappears within days, so the portfolio must turn over fast, and costs can eat the alpha."},
    {"type": "number", "prompt": "A signal with IC 0.03 is applied to 10 independent bets a day for 250 days a year. What IR does the fundamental law suggest?",
     "answer": 1.5, "explanation": "Breadth = 2,500, √2500 = 50, and 0.03 × 50 = 1.5."},
    {"type": "open", "prompt": "You have five signals, each with IC around 0.02–0.04, pairwise correlations around 0.6. How would you combine them?",
     "explanation": "Start with z-scored, neutralized versions and an equal-weight average (a strong baseline). Because they're highly correlated, the combination's IC will be only modestly higher than the best single one. Try weights based on trailing ICs (lagged, no look-ahead) or a regularized regression of forward returns on the signals, fitted walk-forward, and favour the signal that adds the most incremental information (orthogonalize against the others). Compare everything out of sample, net of the turnover each combination implies."},
]


def _universe(seed, n_days=900, n=40):
    u = factor_universe(n_days, n, momentum=0.0012, seed=seed)
    return u["prices"], u["betas"]


def _signals(seed):
    px, betas = _universe(seed)
    r = px.pct_change()
    rng = np.random.default_rng(seed)
    sig = {"mom": px.shift(21) / px.shift(126) - 1, "rev": -(px / px.shift(5) - 1),
           "lowvol": -r.rolling(20).std(), "noise": pd.DataFrame(rng.standard_normal(px.shape), index=px.index, columns=px.columns)}
    return sig, r.shift(-1)


def _events(n, horizon, seed):
    rng = np.random.default_rng(seed)
    idx = dates(n)
    ends = np.minimum(np.arange(n) + rng.integers(1, horizon + 1, n), n - 1)
    return pd.Series(idx[ends], index=idx, name="t1")


def _trials(n_trials, n, seed, edge=0.0):
    rng = np.random.default_rng(seed)
    R = rng.standard_t(5, (n, n_trials)) * 0.01 * np.sqrt(3 / 5)
    R[:, 0] += edge
    sr = R.mean(axis=0) / R.std(axis=0, ddof=1)
    return pd.Series(R[:, int(np.argmax(sr))], index=dates(n)), sr


_PSR = '''def probabilistic_sharpe(returns, sr_benchmark: float = 0.0) -> float:
    r = np.asarray(returns, dtype=float)
    sr = r.mean() / r.std(ddof=1)
    g3, g4 = stats.skew(r), stats.kurtosis(r, fisher=False)
    z = (sr - sr_benchmark) * np.sqrt(len(r) - 1) / np.sqrt(1 - g3 * sr + (g4 - 1) / 4 * sr**2)
    return float(stats.norm.cdf(z))
'''

PROBLEMS = [
    {
        "id": "r10_neutralize",
        "title": "Neutralize a signal against factor exposures",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "neutralize",
        "description": r"""
`signal` is a DataFrame (dates × stocks) and `exposures` a DataFrame (stocks × factors) of constant exposures, e.g. market, size and value betas. Return the neutralized signal: for every date, the residual of the cross-sectional regression of the signal on an intercept plus the exposures.

Because the exposures don't change over time, every date uses the same projection:

$$s^\perp_t = (I - X(X^\top X)^{-1}X^\top)\,s_t, \qquad X = [\mathbf 1, B]$$

so the whole panel is one matrix product. Return a DataFrame with the same index and columns as `signal`.

### Learn
After neutralization the signal has exactly zero correlation, across stocks on each date, with every exposure and with the intercept (it's demeaned too). Check `np.abs(result.to_numpy() @ X).max()` ≈ 0. With time-varying exposures (rolling betas, sector changes) you'd run one regression per date instead: same idea, a loop with `np.linalg.lstsq`.
""",
        "starter": '''import numpy as np
import pandas as pd


def neutralize(signal: pd.DataFrame, exposures: pd.DataFrame) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def neutralize(signal: pd.DataFrame, exposures: pd.DataFrame) -> pd.DataFrame:
    X = np.column_stack([np.ones(len(exposures)), exposures.loc[signal.columns].to_numpy()])
    M = np.eye(len(X)) - X @ np.linalg.solve(X.T @ X, X.T)
    return pd.DataFrame(signal.to_numpy() @ M.T, index=signal.index, columns=signal.columns)
''',
        "hints": ["Order the exposures' rows to match the signal's columns before building X.",
                  "M is symmetric, so `S @ M.T` and `S @ M` are the same."],
        "cases": lambda: [
            {"name": "momentum signal vs 3 betas", "sample": True,
             "args": ((lambda s, b: (s.iloc[130:200], b))(_universe(1)[0].pct_change(126), _universe(1)[1]))},
            {"name": "random signal vs market beta only", "args": (pd.DataFrame(np.random.default_rng(2).standard_normal((50, 40)), columns=_universe(2)[1].index), _universe(2)[1][["MKT"]])},
        ],
    },
    {
        "id": "r10_ic_decay",
        "title": "IC decay across horizons",
        "difficulty": "Easy",
        "libs": ["pandas"],
        "fn": "ic_decay",
        "description": r"""
Measure how quickly a cross-sectional signal's predictive power fades. For each h in `horizons`, compute the forward return `prices.shift(-h) / prices - 1`, the per-date Spearman correlation between the signal and that forward return (`signal.corrwith(fwd, axis=1, method="spearman")`), and its mean over dates (skipping NaN). Return a Series indexed by horizon.

### Learn
The decay profile drives portfolio design: a signal whose IC holds up for weeks can be traded slowly and cheaply. Note that h-day ICs of a daily signal overlap heavily, so their standard errors need the same overlap care as the regression step.

The planted effect in this universe is momentum, which decays slowly. The 5-day reversal signal (second test) behaves very differently.
""",
        "starter": '''import numpy as np
import pandas as pd


def ic_decay(signal: pd.DataFrame, prices: pd.DataFrame, horizons) -> pd.Series:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def ic_decay(signal: pd.DataFrame, prices: pd.DataFrame, horizons) -> pd.Series:
    return pd.Series({h: signal.corrwith(prices.shift(-h) / prices - 1, axis=1, method="spearman").mean()
                      for h in horizons})
''',
        "hints": ["One line per horizon: forward return, corrwith across columns, mean."],
        "cases": lambda: [
            {"name": "momentum signal", "sample": True, "args": (_signals(1)[0]["mom"], _universe(1)[0], [1, 5, 10, 21, 63])},
            {"name": "5-day reversal signal", "args": (_signals(1)[0]["rev"], _universe(1)[0], [1, 2, 5, 10])},
        ],
    },
    {
        "id": "r10_combine",
        "title": "Combine signals with trailing IC weights",
        "difficulty": "Hard",
        "libs": ["pandas", "numpy"],
        "fn": "combine_signals",
        "description": r"""
Combine several signals (a dict name → DataFrame, dates × stocks) into one, weighting each by its recent track record, **without look-ahead**:

1. z-score each signal across stocks on each date: subtract the row mean, divide by the row std (ddof=1)
2. the daily IC of each signal: Spearman correlation per date between its z-score and `fwd_returns` (the return after each date)
3. weight of signal k on date t: its mean IC over the previous `window` dates, **excluding date t** (`ic.shift(1).rolling(window).mean()`), floored at 0; normalize the weights to sum to 1 on each date, falling back to equal weights when they're all 0 or not yet available
4. combined signal = Σ weight × z-score

Return the combined DataFrame (dates × stocks).

### Learn
Why `shift(1)`? The IC of date t uses the return from t to t+1, which isn't known until t+1. Using it at t is look-ahead, and a look-ahead test checks exactly that. Flooring at zero stops the combination from betting on signals that recently failed.

Compare the combined signal's 1-day IC with each component's in a notebook (`ic_decay` with h = 1). In the sample the noise signal gets almost no weight (about 0.5% on average), and the combination beats a naive equal-weight average by a wide margin. Yet momentum alone still has a higher IC: reversal and low-vol carry no real edge in this universe, but noisy trailing ICs hand them about 30% of the weight. That's typical, and it's why researchers require a minimum IC t-stat before a signal joins the blend.
""",
        "starter": '''import numpy as np
import pandas as pd


def combine_signals(signals: dict, fwd_returns: pd.DataFrame, window: int = 126) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def combine_signals(signals: dict, fwd_returns: pd.DataFrame, window: int = 126) -> pd.DataFrame:
    z = {k: s.sub(s.mean(axis=1), axis=0).div(s.std(axis=1), axis=0) for k, s in signals.items()}
    ic = pd.DataFrame({k: v.corrwith(fwd_returns, axis=1, method="spearman") for k, v in z.items()})
    w = ic.shift(1).rolling(window).mean().clip(lower=0)
    total = w.sum(axis=1)
    w = w.div(total, axis=0).where(total > 0, 1 / len(signals)).fillna(1 / len(signals))
    return sum(z[k].mul(w[k], axis=0) for k in signals)
''',
        "hints": ["Build a DataFrame of daily ICs (dates × signals) first; weights are a rolling mean of its lagged values.",
                  "`df.where(cond, other)` keeps values where cond is True and substitutes `other` elsewhere."],
        "cases": lambda: [
            {"name": "momentum, reversal, low-vol, noise", "sample": True, "args": _signals(1)},
            {"name": "shorter window", "args": (*_signals(2), 63)},
            {"name": "no look-ahead", "lookahead": 600, "args": _signals(3)},
        ],
    },
    {
        "id": "r10_purged_kfold",
        "title": "Purged K-fold with embargo",
        "difficulty": "Hard",
        "libs": ["numpy", "pandas"],
        "fn": "purged_kfold",
        "description": r"""
`t1` is a Series indexed by each sample's start time (sorted) whose values are the times its label ends (e.g. the end of a 10-day forward return). Produce K-fold splits that don't leak across overlapping labels:

1. split positions 0 … n−1 into `n_splits` contiguous test folds (`np.array_split`)
2. for each fold: `start` = the first test sample's start time, `stop` = the latest label end within the fold
3. **purge**: keep a training sample only if its label window doesn't overlap the test period: t1 < start, or its start time > stop
4. **embargo**: also drop the ⌈`embargo_pct` × n⌉ positions right after the fold
5. test samples are never in training

Return a list of `(train_positions, test_positions)` numpy arrays (train sorted).

### Learn
Training on samples whose labels overlap the test period lets the model memorize test outcomes; the embargo also blocks features that look back into the test period. Purged K-fold (López de Prado, *Advances in Financial Machine Learning*, ch. 7) lets you use all the data for validation, unlike walk-forward. Use it for model selection and walk-forward for the final backtest.
""",
        "starter": '''import numpy as np
import pandas as pd


def purged_kfold(t1: pd.Series, n_splits: int = 5, embargo_pct: float = 0.01) -> list:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def purged_kfold(t1: pd.Series, n_splits: int = 5, embargo_pct: float = 0.01) -> list:
    t0, end = t1.index.to_numpy(), t1.to_numpy()
    n = len(t1)
    m = int(np.ceil(embargo_pct * n))
    splits = []
    for test in np.array_split(np.arange(n), n_splits):
        start, stop = t0[test[0]], end[test].max()
        keep = (end < start) | (t0 > stop)
        keep[test] = False
        keep[test[-1] + 1: test[-1] + 1 + m] = False
        splits.append((np.flatnonzero(keep), test))
    return splits
''',
        "hints": ["Build a boolean keep-mask over all samples, then switch off the test fold and the embargo slice."],
        "cases": lambda: [
            {"name": "60 samples, labels up to 5 days", "sample": True, "args": (_events(60, 5, 1), 3, 0.05)},
            {"name": "1,000 samples, 10-day labels", "args": (_events(1000, 10, 2),)},
        ],
    },
    {
        "id": "r10_dsr",
        "title": "Deflated Sharpe ratio",
        "difficulty": "Medium",
        "libs": ["scipy.stats", "numpy"],
        "fn": "deflated_sharpe",
        "description": r"""
You tried N strategy variants and kept the best. Deflate its Sharpe ratio (Bailey & López de Prado):

1. per-period Sharpe ratios of all N trials are given in `trial_sharpes`; V = their sample variance (ddof=1), γ = 0.5772156649015329 (Euler–Mascheroni)
2. expected maximum Sharpe of N skill-less trials: $SR_0 = \sqrt V\left[(1-\gamma)\Phi^{-1}(1 - 1/N) + \gamma\,\Phi^{-1}(1 - 1/(Ne))\right]$
3. return the **probabilistic Sharpe ratio** of the chosen `returns` against benchmark $SR_0$:
$$\Phi\left(\frac{(\widehat{SR} - SR_0)\sqrt{n-1}}{\sqrt{1 - \gamma_3\widehat{SR} + \frac{\gamma_4 - 1}{4}\widehat{SR}^2}}\right)$$
with $\widehat{SR}$ the per-period Sharpe ratio (ddof=1), $\gamma_3$ = `stats.skew(r)`, $\gamma_4$ = `stats.kurtosis(r, fisher=False)`.

### Learn
A DSR above about 0.95 means the best result is unlikely to be luck *given how many things you tried*. In the tests, the best of 100 pure-noise strategies looks impressive by its raw Sharpe ratio and still fails deflation, while one genuinely skilled strategy among 50 passes. Keep an honest log of every variant: that's your N.
""",
        "starter": '''import numpy as np
from scipy import stats


def deflated_sharpe(returns, trial_sharpes) -> float:
    # your code here
    pass
''',
        "solution": "import numpy as np\nfrom scipy import stats\n\n\n" + _PSR + '''

def deflated_sharpe(returns, trial_sharpes) -> float:
    sr = np.asarray(trial_sharpes, dtype=float)
    n, gamma = len(sr), 0.5772156649015329
    sr0 = np.sqrt(sr.var(ddof=1)) * ((1 - gamma) * stats.norm.ppf(1 - 1 / n) + gamma * stats.norm.ppf(1 - 1 / (n * np.e)))
    return probabilistic_sharpe(returns, sr0)
''',
        "hints": ["Write the probabilistic Sharpe ratio as a helper, then the DSR is a single call with SR₀ as the benchmark."],
        "cases": lambda: [
            {"name": "best of 100 noise strategies", "sample": True, "args": _trials(100, 1000, 2)},
            {"name": "one genuine edge among 50", "args": _trials(50, 1500, 3, edge=0.0015)},
        ],
    },
]
