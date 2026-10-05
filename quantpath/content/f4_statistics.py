import numpy as np
import pandas as pd

from data import fat_returns, normal_returns

TITLE = "Statistics and inference"
SUMMARY = "Estimators, the CLT, confidence intervals, hypothesis tests, multiple testing, MLE and resampling."
KIND = "foundation"

LESSON = r"""
Statistics decides whether a pattern is real or noise. Researchers live here. Traders need it too: every strategy and every "edge" is a hypothesis test, usually run under worse conditions than a textbook assumes.

## Estimators

An estimator $\hat\theta$ is a function of the data. Judge it by **bias** $E[\hat\theta] - \theta$, **variance**, and **MSE** = bias² + variance. The sample variance divides by $n-1$ to be unbiased (`ddof=1`). Consistency means $\hat\theta \to \theta$ as $n \to \infty$.

## The central limit theorem

For i.i.d. data with finite variance, $\bar X \approx N(\mu, \sigma^2/n)$ for large n. Hence the **standard error** $\text{SE} = s/\sqrt n$, and the 95% confidence interval $\bar x \pm 1.96\,\text{SE}$ (use t quantiles for small n). Halving the interval width takes **4×** the data.

## Hypothesis tests

- **Null hypothesis** $H_0$ (no effect) vs alternative $H_1$.
- **p-value**: the probability, assuming $H_0$ is true, of a result at least as extreme as the observed one. It is **not** the probability that $H_0$ is true.
- **Type I error** (false positive, rate α) vs **type II error** (false negative, rate β); **power** = 1 − β grows with the effect size and with n.
- **One-sample t-test**: $t = \frac{\bar x - \mu_0}{s/\sqrt n}$, compared with a t distribution with n − 1 degrees of freedom.
- Coin example: 60 heads in 100 flips gives $z = \frac{60 - 50}{\sqrt{100 \cdot 0.25}} = 2$ and a two-sided p ≈ 0.046.

## Multiple testing: the quant's main enemy

Run 20 independent tests at α = 0.05 on pure noise and you'll find at least one "significant" result 64% of the time. Fixes:
- **Bonferroni**: test each at α/m. Controls the chance of any false positive; conservative.
- **Benjamini–Hochberg**: controls the false discovery rate (the expected fraction of discoveries that are false). Sort the p-values, find the largest k with $p_{(k)} \le \frac{k}{m}q$, and reject the k smallest.

In strategy research, every parameter you tried counts as a test, including the ones you forgot about.

## Maximum likelihood

Choose the parameters that maximize $\log L(\theta) = \sum_i \log f(x_i;\theta)$. Results worth memorizing: the normal gives $\hat\mu = \bar x$ and $\hat\sigma^2 = \frac1n\sum(x_i-\bar x)^2$ (biased, divides by n); the exponential gives $\hat\lambda = 1/\bar x$; Bernoulli $\hat p$ and Poisson $\hat\lambda$ are the sample mean. MLEs are asymptotically normal and efficient.

## Resampling

- **Bootstrap**: resample the data with replacement many times and recompute the statistic. The spread of those values estimates its sampling distribution, even for awkward statistics like medians or Sharpe ratios. For time series, resample **blocks** to keep the dependence.
- **Permutation test**: under $H_0$ "the labels don't matter", shuffle the labels and recompute. The p-value is the fraction of shuffles at least as extreme as the real data. Exact, assumption-light, and easy to explain in an interview.

## Correlation and its traps

Pearson correlation measures linear association and is sensitive to outliers; Spearman (rank) correlation is robust. Correlation ≠ causation, ratios of trending series correlate spuriously, and **regression to the mean** makes last year's best fund look worse this year even with no change in skill.

## Finance-specific

- The annualized Sharpe ratio has a standard error of roughly $\sqrt{(1 + SR^2/2)/T}$ with T in years. With SR = 1 you need about 4 years of data just to be 2 standard errors from zero.
- Returns are fat-tailed and autocorrelated in volatility, so normal-theory p-values are optimistic. Prefer robust or resampling methods.
"""

QUESTIONS = [
    {"type": "number", "prompt": "You flip a coin 100 times and get 60 heads. What is the z-score under the hypothesis that the coin is fair?",
     "answer": 2, "explanation": "Mean 50, standard deviation √(100 × 0.5 × 0.5) = 5, so z = (60 − 50)/5 = 2."},
    {"type": "number", "prompt": "What is the two-sided p-value for z = 2 under a standard normal?",
     "answer": 0.0455, "tol": 0.01, "display": "≈ 0.0455", "explanation": "2 × (1 − Φ(2)) = 2 × 0.02275 ≈ 0.0455."},
    {"type": "number", "prompt": "By what factor must you multiply the sample size to halve the width of a confidence interval for a mean?",
     "answer": 4, "explanation": "Width ∝ 1/√n, so halving the width requires 4× the observations."},
    {"type": "number", "prompt": "You test 20 independent useless signals, each at the 5% level. What is the probability that at least one looks significant?",
     "answer": 1 - 0.95**20, "display": "1 − 0.95²⁰ ≈ 0.642", "explanation": "P(no false positive) = 0.95²⁰ ≈ 0.358."},
    {"type": "number", "prompt": "Waiting times are modelled as Exponential(λ). The sample mean of your data is 2.5 seconds. What is the maximum-likelihood estimate of λ?",
     "answer": 0.4, "explanation": "log L = n log λ − λΣx. Setting the derivative to 0 gives λ̂ = n/Σx = 1/x̄ = 0.4."},
    {"type": "number", "prompt": "A strategy's daily Sharpe ratio is 0.1. What is its annualized Sharpe ratio (252 trading days)?",
     "answer": 0.1 * np.sqrt(252), "display": "0.1 × √252 ≈ 1.587", "explanation": "The mean scales with 252 and the standard deviation with √252, so the Sharpe ratio scales with √252."},
    {"type": "number", "prompt": "With a Bonferroni correction, what per-test significance level keeps the family-wise error rate at 5% across 50 tests?",
     "answer": 0.001, "explanation": "0.05 / 50 = 0.001."},
    {"type": "choice", "prompt": "A backtest of a new signal has p-value 0.03. Which statement is correct?",
     "choices": ["If the signal had no effect, results at least this strong would occur about 3% of the time",
                 "There is a 3% probability the signal is useless",
                 "There is a 97% probability the signal works",
                 "The signal will be profitable 97% of the time"],
     "answer": 0, "explanation": "A p-value is computed assuming the null hypothesis is true. It says nothing directly about the probability that the null or the alternative is true; that would need a prior (Bayes)."},
    {"type": "number", "prompt": "A strategy has a true annualized Sharpe ratio of 1. The standard error of the estimated annual Sharpe ratio is about 1/√T with T in years. How many years of data do you need before its Sharpe ratio is expected to sit 2 standard errors above zero?",
     "answer": 4, "explanation": "SR/SE = 1 × √T = 2 gives T = 4 years. Track records are short relative to the noise."},
    {"type": "number", "prompt": "A sample of 25 observations has sample standard deviation 10. What is the standard error of the sample mean?",
     "answer": 2, "explanation": "10/√25 = 2."},
    {"type": "choice", "prompt": "The best-performing of 500 funds last year is most likely to do what this year?",
     "choices": ["Perform closer to the average", "Repeat its top performance", "Perform worse than average", "Be impossible to say anything about"],
     "answer": 0, "explanation": "Regression to the mean: extreme results are partly luck, and luck doesn't persist. Expect a result between its past performance and the average."},
    {"type": "open", "prompt": "Explain type I and type II errors and how the trade-off shows up when deciding which trading signals to deploy.",
     "explanation": "A type I error deploys a signal that's really noise (false positive); a type II error rejects one that works (false negative). Testing many candidates inflates type I errors, so you raise the bar (multiple-testing corrections, out-of-sample tests). A higher bar lowers power, so weak but real signals get discarded. The cost asymmetry matters: deploying noise loses money and capacity, while missing a weak signal is an opportunity cost."},
]


def _sharpe(x):
    return np.mean(x) / np.std(x, ddof=1) * np.sqrt(252)


def _pvalues(m, n_real, seed):
    rng = np.random.default_rng(seed)
    from scipy.stats import norm
    z = rng.standard_normal(m)
    z[:n_real] += 3.0
    return 2 * norm.sf(np.abs(z))


PROBLEMS = [
    {
        "id": "f4_t_test",
        "title": "One-sample t-test from scratch",
        "difficulty": "Easy",
        "libs": ["numpy", "scipy.stats"],
        "fn": "t_test_one_sample",
        "description": r"""
Test whether the mean of `x` differs from `mu0`. Return a dict with:

- `t`: $\dfrac{\bar x - \mu_0}{s/\sqrt n}$ with the sample standard deviation $s$ (ddof=1)
- `p_value`: two-sided, from a t distribution with $n-1$ degrees of freedom

### Learn
`scipy.stats.t.sf(abs(t), df)` is the upper-tail probability; double it for a two-sided test. Afterwards compare with `scipy.stats.ttest_1samp(x, mu0)`.

Applied to daily strategy returns with $\mu_0 = 0$, the t-statistic is approximately the annualized Sharpe ratio × √years. A t-stat of 2 isn't impressive for a strategy chosen from many candidates; Harvey, Liu & Zhu (2016) argue for about 3 in factor research.
""",
        "starter": '''import numpy as np
from scipy import stats


def t_test_one_sample(x, mu0: float = 0.0) -> dict:
    # return {"t": ..., "p_value": ...}
    pass
''',
        "solution": '''import numpy as np
from scipy import stats


def t_test_one_sample(x, mu0: float = 0.0) -> dict:
    x = np.asarray(x, dtype=float)
    n = len(x)
    t = (x.mean() - mu0) / (x.std(ddof=1) / np.sqrt(n))
    return {"t": t, "p_value": 2 * stats.t.sf(abs(t), n - 1)}
''',
        "hints": ["Remember the factor 2 for the two-sided p-value."],
        "cases": lambda: [
            {"name": "daily returns, 1 year", "sample": True, "args": (normal_returns(252, mu=8e-4, seed=1),)},
            {"name": "small sample against mu0 = 5", "args": (np.random.default_rng(2).normal(5.5, 2, 15), 5.0)},
            {"name": "fat-tailed returns", "args": (fat_returns(1000, seed=3),)},
        ],
    },
    {
        "id": "f4_bootstrap",
        "title": "Bootstrap confidence interval",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "bootstrap_ci",
        "description": r"""
Build a percentile bootstrap confidence interval for any statistic. `stat` is a function that maps a 1-D array to a number (the mean, the median, a Sharpe ratio…). Follow this recipe exactly so that results are reproducible:

1. `x = np.asarray(x, dtype=float)`, `rng = np.random.default_rng(seed)`
2. `idx = rng.integers(0, n, size=(n_boot, n))`: each row is one resample's indices
3. compute `stat(x[row])` for every row
4. return `(low, high)` = `np.percentile(values, [100 * alpha / 2, 100 * (1 - alpha / 2)])` as floats

### Learn
The bootstrap treats your sample as the population and asks how much the statistic would wobble if you could redraw it. It works for statistics without a textbook standard error (medians, Sharpe ratios, drawdowns).

One caveat for markets: returns aren't independent (volatility clusters), so the i.i.d. bootstrap understates uncertainty. Use a **block** bootstrap for time series.
""",
        "starter": '''import numpy as np


def bootstrap_ci(x, stat, n_boot: int = 2000, alpha: float = 0.05, seed: int = 0) -> tuple:
    # return low, high
    pass
''',
        "solution": '''import numpy as np


def bootstrap_ci(x, stat, n_boot: int = 2000, alpha: float = 0.05, seed: int = 0) -> tuple:
    x = np.asarray(x, dtype=float)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(x), size=(n_boot, len(x)))
    values = [stat(x[row]) for row in idx]
    low, high = np.percentile(values, [100 * alpha / 2, 100 * (1 - alpha / 2)])
    return float(low), float(high)
''',
        "hints": ["Fancy indexing `x[row]` with an array of indices gives one resample."],
        "cases": lambda: [
            {"name": "mean of normal data", "sample": True, "args": (np.random.default_rng(1).normal(0, 1, 200), np.mean)},
            {"name": "median, 90% interval", "args": (np.random.default_rng(2).exponential(2, 300), np.median, 1000, 0.10, 3)},
            {"name": "Sharpe ratio of daily returns", "args": (fat_returns(500, mu=6e-4, seed=4).to_numpy(), _sharpe, 1000)},
        ],
    },
    {
        "id": "f4_bh",
        "title": "Benjamini–Hochberg false discovery control",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "benjamini_hochberg",
        "description": r"""
You tested `m` signals and got `pvalues`. Return a boolean numpy array (in the original order) marking which hypotheses Benjamini–Hochberg rejects at false discovery rate `q`:

1. sort the p-values ascending: $p_{(1)} \le \dots \le p_{(m)}$
2. find the largest k with $p_{(k)} \le \frac{k}{m}\,q$
3. reject the hypotheses with the k smallest p-values (none if no such k exists)

### Learn
Bonferroni asks "how likely is even one false discovery?", which is very strict when m is large. BH asks "what fraction of my discoveries are false?", the right question when you're screening many candidate signals and will validate the survivors anyway.

`np.argsort` gives the sorting order; build the mask on sorted positions, then map it back with `mask[order] = ...`. In the tests, 10 of 200 signals are real (z-scores shifted by 3); see how many BH recovers versus a naive p < 0.05 rule.
""",
        "starter": '''import numpy as np


def benjamini_hochberg(pvalues, q: float = 0.05) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def benjamini_hochberg(pvalues, q: float = 0.05) -> np.ndarray:
    p = np.asarray(pvalues, dtype=float)
    m = len(p)
    order = np.argsort(p)
    passed = p[order] <= q * np.arange(1, m + 1) / m
    reject = np.zeros(m, dtype=bool)
    if passed.any():
        k = np.flatnonzero(passed).max()
        reject[order[: k + 1]] = True
    return reject
''',
        "hints": ["The k you need is the largest passing rank, even if some smaller ranks failed."],
        "cases": lambda: [
            {"name": "small example", "sample": True, "args": ([0.01, 0.04, 0.03, 0.005, 0.2, 0.6],)},
            {"name": "200 signals, 10 real", "args": (_pvalues(200, 10, seed=1),)},
            {"name": "nothing significant", "args": ([0.3, 0.5, 0.8, 0.07],)},
            {"name": "q = 0.10", "args": (_pvalues(100, 20, seed=2), 0.10)},
        ],
    },
    {
        "id": "f4_permutation",
        "title": "Permutation test for a difference in means",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "permutation_test",
        "description": r"""
Are returns after event A really different from returns after event B? Return the two-sided permutation p-value for the difference in means. Follow this recipe exactly:

1. `observed = mean(a) - mean(b)`; `pooled = np.concatenate([a, b])`; `rng = np.random.default_rng(seed)`
2. repeat `n_perm` times: `perm = rng.permutation(pooled)`, then `diff = mean(perm[:len(a)]) - mean(perm[len(a):])`
3. p-value = `(count of |diff| >= |observed| + 1) / (n_perm + 1)`

### Learn
If the labels A/B don't matter (the null), every reshuffling of them is equally likely. The p-value is then the rank of the real difference among the shuffled ones. The "+1" counts the observed arrangement itself, so the p-value is never exactly 0.

No normality assumption is needed, which matters for fat-tailed returns. The same idea powers "is my signal better than a random signal with the same turnover?" checks.
""",
        "starter": '''import numpy as np


def permutation_test(a, b, n_perm: int = 5000, seed: int = 0) -> float:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def permutation_test(a, b, n_perm: int = 5000, seed: int = 0) -> float:
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    observed = a.mean() - b.mean()
    pooled = np.concatenate([a, b])
    rng = np.random.default_rng(seed)
    count = 0
    for _ in range(n_perm):
        perm = rng.permutation(pooled)
        if abs(perm[: len(a)].mean() - perm[len(a):].mean()) >= abs(observed):
            count += 1
    return (count + 1) / (n_perm + 1)
''',
        "hints": ["Call `rng.permutation(pooled)` once per repetition, in a loop, to match the reference's random stream."],
        "cases": lambda: [
            {"name": "real difference", "sample": True, "args": (np.random.default_rng(1).normal(0.5, 1, 40), np.random.default_rng(2).normal(0, 1, 50))},
            {"name": "no difference", "args": (np.random.default_rng(3).normal(0, 1, 30), np.random.default_rng(4).normal(0, 1, 30), 2000, 7)},
        ],
    },
]
