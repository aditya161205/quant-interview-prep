import numpy as np
import pandas as pd

TITLE = "Stochastic calculus and Monte Carlo pricing"
SUMMARY = "Brownian motion, Itô's lemma, GBM, risk-neutral pricing, Monte Carlo with error bars, variance reduction, and Greeks by simulation."
KIND = "core"

LESSON = r"""
Researchers on derivatives-adjacent teams, and many generalist interviews, expect the core of continuous-time finance: what Brownian motion is, why Itô's lemma has an extra term, how Black–Scholes falls out of hedging, and how to price anything by simulation when no formula exists.

## Brownian motion

$W_t$ has independent, normally distributed increments, $W_t - W_s \sim N(0, t-s)$, and continuous paths that are nowhere differentiable. Facts worth knowing cold: $E[W_t] = 0$, $\text{Var}(W_t) = t$, $\text{Cov}(W_s, W_t) = \min(s, t)$, and **quadratic variation** $\sum (\Delta W)^2 \to t$. That last fact is behind the rule $(dW)^2 = dt$.

## Itô's lemma

For $dX = \mu\,dt + \sigma\,dW$ and a smooth $f(t, X)$:

$$df = \left(f_t + \mu f_x + \tfrac12\sigma^2 f_{xx}\right)dt + \sigma f_x\,dW$$

The extra $\frac12\sigma^2 f_{xx}$ term comes from $(dW)^2 = dt$. Examples: $d(W^2) = 2W\,dW + dt$, so $E[W_t^2] = t$. For GBM $dS = \mu S\,dt + \sigma S\,dW$, applying Itô to $\ln S$ gives

$$S_T = S_0\exp\left((\mu - \tfrac12\sigma^2)T + \sigma W_T\right), \qquad E[S_T] = S_0e^{\mu T}, \qquad \text{median}(S_T) = S_0e^{(\mu - \sigma^2/2)T}$$

The mean exceeds the median: volatility drag again.

## Risk-neutral pricing

Hedge an option with Δ = ∂V/∂S shares and the portfolio becomes riskless, so it must earn r. That gives the Black–Scholes PDE

$$V_t + rSV_S + \tfrac12\sigma^2S^2V_{SS} = rV$$

in which μ has disappeared. By Feynman–Kac its solution is a discounted expectation under the **risk-neutral measure**, where the stock drifts at r: $V_0 = e^{-rT}E^{\mathbb Q}[\text{payoff}]$. Any payoff can then be priced by simulating risk-neutral paths and averaging.

## Monte Carlo pricing

1. Simulate N risk-neutral paths (exact GBM steps: $S_{t+\Delta t} = S_t\exp((r - \frac12\sigma^2)\Delta t + \sigma\sqrt{\Delta t}\,Z)$).
2. Compute each path's payoff, average, and discount.
3. Report the standard error $s/\sqrt N$. Error falls like $1/\sqrt N$, independent of dimension, which is why MC wins for path-dependent and multi-asset products.

## Variance reduction

- **Antithetic variates**: pair every Z with −Z. For monotone payoffs the pair is negatively correlated, which cuts variance cheaply.
- **Control variates**: use a related quantity with a known expectation. Pricing an arithmetic-average Asian option with the geometric-average Asian (closed form) as the control can shrink the error by 10–100×: $\hat Y = \bar X + b(\mu_C - \bar C)$ with $b = \text{Cov}(X, C)/\text{Var}(C)$.
- Importance sampling (shift paths toward the payoff region) helps deep out-of-the-money options.

## Greeks by simulation

- **Bump and revalue**: $(V(S+h) - V(S-h))/2h$, using the **same random numbers** for both prices (common random numbers), otherwise the noise swamps the difference.
- **Pathwise**: differentiate the payoff along each path. For a call, $\Delta = e^{-rT}E[\mathbb 1_{S_T > K}\,S_T/S_0]$. Unbiased and low-variance for smooth payoffs.
"""

QUESTIONS = [
    {"type": "number", "prompt": "W is a standard Brownian motion. What is E[W₃²]?", "answer": 3,
     "explanation": "W₃ ~ N(0, 3), so E[W₃²] = Var(W₃) = 3. Equivalently d(W²) = 2W dW + dt."},
    {"type": "number", "prompt": "A stock follows GBM with μ = 5% and S₀ = 100. What is E[S_T] after 2 years?",
     "answer": 100 * np.exp(0.1), "display": "100e^0.1 ≈ 110.52", "explanation": "E[S_T] = S₀e^(μT), whatever the volatility."},
    {"type": "number", "prompt": "Same stock with σ = 20%: what is the median of S_T after 1 year?",
     "answer": 100 * np.exp(0.03), "display": "100e^0.03 ≈ 103.05", "explanation": "median = S₀ exp((μ − σ²/2)T) = 100 e^(0.05 − 0.02)."},
    {"type": "number", "prompt": "A Monte Carlo pricer's payoffs have standard deviation 20 and you use 10,000 paths. What is the standard error of the price (before discounting)?",
     "answer": 0.2, "explanation": "20/√10,000 = 0.2."},
    {"type": "number", "prompt": "What is Cov(W₁, W₃) for a standard Brownian motion?", "answer": 1,
     "explanation": "Cov(W_s, W_t) = min(s, t) = 1."},
    {"type": "choice", "prompt": "Under the risk-neutral measure used for pricing, what is the stock's expected return?",
     "choices": ["The risk-free rate r", "Its historical average return", "Zero", "r plus the equity risk premium"],
     "answer": 0, "explanation": "Hedging removes the dependence on μ. Pricing as if the stock earns r gives the right (replication) price."},
    {"type": "choice", "prompt": "Why should bump-and-revalue Monte Carlo Greeks use the same random numbers for the up and down prices?",
     "choices": ["Otherwise the two prices' independent noise dominates the tiny difference you're estimating", "It's required for convergence of the price itself",
                 "It makes the simulation faster", "It removes discretization bias"],
     "answer": 0, "explanation": "Var(V⁺ − V⁻) = Var(V⁺) + Var(V⁻) − 2Cov. Common random numbers make the covariance large, so the variance of the difference collapses."},
    {"type": "open", "prompt": "Derive why the expected return μ doesn't appear in the Black–Scholes PDE.",
     "explanation": "Form Π = V − ΔS. By Itô, dΠ = (V_t + μSV_S + ½σ²S²V_SS)dt + σSV_S dW − Δ(μS dt + σS dW). Choosing Δ = V_S cancels both the dW terms and the μ terms, leaving dΠ = (V_t + ½σ²S²V_SS)dt with no risk. No arbitrage forces dΠ = rΠ dt = r(V − SV_S)dt, which gives V_t + rSV_S + ½σ²S²V_SS = rV. μ cancelled when we hedged."},
]

_GBM = '''def simulate_gbm(S0: float, mu: float, sigma: float, T: float, n_steps: int, n_paths: int, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    dt = T / n_steps
    z = rng.standard_normal((n_paths, n_steps))
    logret = (mu - sigma**2 / 2) * dt + sigma * np.sqrt(dt) * z
    return S0 * np.exp(np.hstack([np.zeros((n_paths, 1)), logret.cumsum(axis=1)]))
'''

PROBLEMS = [
    {
        "id": "r5_gbm",
        "title": "Simulate GBM paths exactly",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "simulate_gbm",
        "description": r"""
Simulate `n_paths` geometric Brownian motion paths with the exact log scheme:

1. `rng = np.random.default_rng(seed)`, `dt = T / n_steps`, `z = rng.standard_normal((n_paths, n_steps))`
2. log-returns `(mu - sigma**2 / 2) * dt + sigma * np.sqrt(dt) * z`
3. paths = S0 × exp(cumulative sum along each row), with S0 as the first column

Return an array of shape `(n_paths, n_steps + 1)`.

### Learn
Simulating log-returns and exponentiating is exact for any step size, whereas an Euler step $S_{t+dt} = S_t(1 + \mu dt + \sigma\sqrt{dt}Z)$ has discretization bias and can even go negative.

Check the theory in a notebook: the mean of the terminal prices ≈ $S_0e^{\mu T}$, their median ≈ $S_0e^{(\mu - \sigma^2/2)T}$, and `np.var(np.log(paths[:, -1]))` ≈ σ²T.
""",
        "starter": '''import numpy as np


def simulate_gbm(S0: float, mu: float, sigma: float, T: float, n_steps: int, n_paths: int, seed: int = 0) -> np.ndarray:
    # your code here
    pass
''',
        "solution": "import numpy as np\n\n\n" + _GBM,
        "hints": ["`np.hstack` a column of zeros in front of the cumulative log-returns."],
        "cases": lambda: [
            {"name": "5 paths, 4 steps", "sample": True, "args": (100, 0.05, 0.2, 1.0, 4, 5)},
            {"name": "1,000 paths, daily for a year", "args": (50, 0.1, 0.35, 1.0, 252, 1000, 3)},
        ],
    },
    {
        "id": "r5_mc_european",
        "title": "Monte Carlo pricer with antithetic variates",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "mc_european",
        "description": r"""
Price a European call by Monte Carlo under the risk-neutral measure, sampling the terminal price directly: $S_T = S_0\exp((r - \frac12\sigma^2)T + \sigma\sqrt T\,Z)$. Return a dict with `price` and `se` (both discounted by $e^{-rT}$):

- plain (`antithetic=False`): `z = rng.standard_normal(n_paths)`; price = mean of discounted payoffs; se = their std (ddof=1)/√n
- antithetic: `z = rng.standard_normal(n_paths // 2)`; for each z average the payoffs at +z and −z into one value $Y_i$; price = discounted mean of the $Y_i$, se = discounted std(Y, ddof=1)/√(number of pairs)

(`rng = np.random.default_rng(seed)` in both cases.)

### Learn
For a European option you only need $S_T$, not the whole path, which makes MC fast. Compare with Black–Scholes (your foundation solution): the true price should lie within about 2 standard errors. Antithetic sampling reduces the error at the same cost because payoffs at +z and −z move in opposite directions. Compare the two `se` values.
""",
        "starter": '''import numpy as np


def mc_european(S0: float, K: float, r: float, sigma: float, T: float, n_paths: int, seed: int = 0,
                antithetic: bool = False) -> dict:
    # return {"price": ..., "se": ...}
    pass
''',
        "solution": '''import numpy as np


def mc_european(S0: float, K: float, r: float, sigma: float, T: float, n_paths: int, seed: int = 0,
                antithetic: bool = False) -> dict:
    rng = np.random.default_rng(seed)
    disc = np.exp(-r * T)
    payoff = lambda z: np.maximum(S0 * np.exp((r - sigma**2 / 2) * T + sigma * np.sqrt(T) * z) - K, 0)
    if antithetic:
        z = rng.standard_normal(n_paths // 2)
        y = (payoff(z) + payoff(-z)) / 2
    else:
        y = payoff(rng.standard_normal(n_paths))
    return {"price": disc * y.mean(), "se": disc * y.std(ddof=1) / np.sqrt(len(y))}
''',
        "hints": ["Write the payoff as a function of z so the antithetic branch is one extra line."],
        "cases": lambda: [
            {"name": "ATM call, plain", "sample": True, "args": (100, 100, 0.05, 0.2, 1.0, 100_000)},
            {"name": "ATM call, antithetic", "args": (100, 100, 0.05, 0.2, 1.0, 100_000, 0, True)},
            {"name": "OTM call", "args": (100, 130, 0.02, 0.3, 0.5, 50_000, 7)},
        ],
    },
    {
        "id": "r5_asian_cv",
        "title": "Asian option with a control variate",
        "difficulty": "Hard",
        "libs": ["numpy", "scipy.stats"],
        "fn": "asian_call_cv",
        "description": r"""
Price an **arithmetic-average** Asian call (payoff $\max(\bar S - K, 0)$, with $\bar S$ the average of the prices at the `n_steps` monitoring dates $t_i = iT/n$, i = 1 … n) and speed it up with the **geometric-average** Asian as a control variate.

1. Simulate paths: `rng = np.random.default_rng(seed)`, `z = rng.standard_normal((n_paths, n_steps))`, exact risk-neutral GBM steps; drop the initial price before averaging.
2. Discounted payoffs: X (arithmetic) and C (geometric, using $\exp(\text{mean}(\ln S_{t_i}))$).
3. Geometric Asian closed form: $\ln G \sim N(m, v)$ with $m = \ln S_0 + (r - \frac12\sigma^2)\frac{(n+1)\Delta t}{2}$ and $v = \sigma^2\Delta t\frac{(n+1)(2n+1)}{6n}$, so
$$\mu_C = e^{-rT}\left[e^{m + v/2}N(d_1) - KN(d_2)\right],\quad d_1 = \frac{m - \ln K + v}{\sqrt v},\ d_2 = d_1 - \sqrt v$$
4. Control-variate estimator $Y = X + b(\mu_C - C)$ with $b = \text{Cov}(X, C)/\text{Var}(C)$ estimated from the same sample (ddof=1 in both).

Return a dict: `plain_price`, `plain_se` (from X), `cv_price`, `cv_se` (from Y; se = std(ddof=1)/√n).

### Learn
The arithmetic and geometric averages are nearly perfectly correlated, and the geometric one has an exact price, so almost all of the simulation noise cancels. Expect `cv_se` to be 10–50× smaller than `plain_se`, the same accuracy as several hundred times more plain paths. This is a standard technique on exotics desks.
""",
        "starter": '''import numpy as np
from scipy.stats import norm


def asian_call_cv(S0: float, K: float, r: float, sigma: float, T: float, n_steps: int, n_paths: int, seed: int = 0) -> dict:
    # return {"plain_price": ..., "plain_se": ..., "cv_price": ..., "cv_se": ...}
    pass
''',
        "solution": '''import numpy as np
from scipy.stats import norm


def asian_call_cv(S0: float, K: float, r: float, sigma: float, T: float, n_steps: int, n_paths: int, seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    dt = T / n_steps
    z = rng.standard_normal((n_paths, n_steps))
    log_s = np.log(S0) + np.cumsum((r - sigma**2 / 2) * dt + sigma * np.sqrt(dt) * z, axis=1)
    disc = np.exp(-r * T)
    X = disc * np.maximum(np.exp(log_s).mean(axis=1) - K, 0)
    C = disc * np.maximum(np.exp(log_s.mean(axis=1)) - K, 0)
    n = n_steps
    m = np.log(S0) + (r - sigma**2 / 2) * (n + 1) * dt / 2
    v = sigma**2 * dt * (n + 1) * (2 * n + 1) / (6 * n)
    d1 = (m - np.log(K) + v) / np.sqrt(v)
    mu_c = disc * (np.exp(m + v / 2) * norm.cdf(d1) - K * norm.cdf(d1 - np.sqrt(v)))
    b = np.cov(X, C)[0, 1] / C.var(ddof=1)
    Y = X + b * (mu_c - C)
    se = lambda a: a.std(ddof=1) / np.sqrt(len(a))
    return {"plain_price": X.mean(), "plain_se": se(X), "cv_price": Y.mean(), "cv_se": se(Y)}
''',
        "hints": ["Work with log prices: the geometric average is exp(mean of log prices).",
                  "`np.cov(X, C)` returns the 2×2 covariance matrix (ddof=1); you need entry [0, 1]."],
        "cases": lambda: [
            {"name": "1-year ATM Asian, monthly fixings", "sample": True, "args": (100, 100, 0.05, 0.2, 1.0, 12, 50_000)},
            {"name": "daily fixings, OTM", "args": (100, 110, 0.03, 0.3, 0.5, 126, 20_000, 2)},
        ],
    },
    {
        "id": "r5_mc_delta",
        "title": "Monte Carlo delta: pathwise versus bump-and-revalue",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "mc_delta",
        "description": r"""
Estimate a European call's delta two ways from the **same** draws `z = np.random.default_rng(seed).standard_normal(n_paths)`, with $S_T(S_0) = S_0\exp((r - \frac12\sigma^2)T + \sigma\sqrt T z)$:

- `pathwise`: $e^{-rT}\,\text{mean}\big(\mathbb 1[S_T > K]\,S_T/S_0\big)$
- `bump`: $(V(S_0 + h) - V(S_0 - h))/(2h)$, where each V is the discounted mean payoff computed from the **same** z (common random numbers)

Return a dict with `pathwise` and `bump`.

### Learn
Both should be close to the Black–Scholes delta $N(d_1)$. Try the bump version with independent draws for the up and down prices in a notebook: the estimate becomes useless for small h, because two noisy prices are being subtracted. Common random numbers are a production habit on every risk system that computes Greeks by simulation.
""",
        "starter": '''import numpy as np


def mc_delta(S0: float, K: float, r: float, sigma: float, T: float, n_paths: int, seed: int = 0, h: float = 0.5) -> dict:
    # return {"pathwise": ..., "bump": ...}
    pass
''',
        "solution": '''import numpy as np


def mc_delta(S0: float, K: float, r: float, sigma: float, T: float, n_paths: int, seed: int = 0, h: float = 0.5) -> dict:
    z = np.random.default_rng(seed).standard_normal(n_paths)
    disc = np.exp(-r * T)
    growth = np.exp((r - sigma**2 / 2) * T + sigma * np.sqrt(T) * z)
    ST = S0 * growth
    price = lambda s: disc * np.maximum(s * growth - K, 0).mean()
    return {"pathwise": disc * np.mean((ST > K) * ST / S0), "bump": (price(S0 + h) - price(S0 - h)) / (2 * h)}
''',
        "hints": ["Compute the random growth factor once; every price is then S × growth."],
        "cases": lambda: [
            {"name": "ATM call", "sample": True, "args": (100, 100, 0.05, 0.2, 1.0, 200_000)},
            {"name": "ITM call, smaller bump", "args": (110, 100, 0.01, 0.3, 0.5, 100_000, 3, 0.1)},
        ],
    },
]
