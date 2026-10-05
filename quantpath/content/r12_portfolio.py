import numpy as np
import pandas as pd

from data import factor_universe, gbm_panel

TITLE = "Portfolio construction and risk"
SUMMARY = "Risk parity, covariance shrinkage, market-neutral optimization with constraints, and factor-based risk decomposition: how alphas become portfolios."
KIND = "core"

LESSON = r"""
A signal isn't a strategy until it's a portfolio: positions sized for risk, exposures controlled, costs considered. This step covers the tools every buy-side researcher uses to make that conversion, and the estimation problems that make them harder than the textbook versions.

## Risk budgeting and risk parity

Risk contribution of asset i: $RC_i = w_i(\Sigma w)_i/\sigma_p$, with $\sum_i RC_i = \sigma_p$. A 60/40 stock/bond portfolio gets about 90% of its risk from stocks.

**Equal risk contribution (ERC)** sets every $RC_i$ equal. For uncorrelated assets that's inverse-volatility weighting; in general it needs an optimizer. A neat convex formulation (Spinu 2013): minimize $\frac12 y^\top\Sigma y - \frac1n\sum_i\ln y_i$ over y > 0, then normalize $w = y/\sum y$. Risk parity uses no expected returns at all, which is its robustness and its limitation; low-risk assets often need leverage to reach a useful volatility.

## Covariance estimation

The sample covariance matrix is noisy when the number of assets is large relative to the number of observations: small eigenvalues are underestimated, and optimizers pile into those "riskless" directions. Remedies:
- **Shrinkage** (Ledoit–Wolf): $\hat\Sigma = \delta F + (1-\delta)S$, pulling the sample matrix S toward a structured target F, with the optimal δ estimated from the data. `sklearn.covariance.LedoitWolf`.
- **Factor models**: $\Sigma = BFB^\top + D$ (exposures B, factor covariance F, diagonal specific variance D). Far fewer parameters; this is how commercial risk models work.
- Exponential weighting for responsiveness; longer or higher-frequency data.

## Optimization with real constraints

$\max_w\; w^\top\alpha - \frac{\lambda}{2}w^\top\Sigma w$ subject to constraints such as:
- dollar neutrality ($\mathbf 1^\top w = 0$) and **beta neutrality** ($\beta^\top w = 0$)
- position limits, sector and factor exposure limits
- turnover limits or transaction-cost penalties, and liquidity (position ≤ a fraction of daily volume)

It's a convex quadratic program; `scipy.optimize` handles small ones, and production systems use dedicated QP solvers (cvxpy, MOSEK).

## Risk decomposition with a factor model

With $x = B^\top w$ the portfolio's factor exposures: total variance = $x^\top Fx + w^\top Dw$. That splits risk into factor risk (with per-factor contributions $x_k(Fx)_k$) and specific (idiosyncratic) risk. A market-neutral stock-picking book should be mostly specific risk; if most of it is factor risk, it's really a factor bet.

## Tail risk

VaR, expected shortfall, stress tests (historical scenarios such as 2008, March 2020, 2022 rates), and drawdown limits complement volatility. Normal ES at 97.5% is 2.338σ, close to 99% VaR's 2.326σ, which is why regulators swapped one for the other.
"""

QUESTIONS = [
    {"type": "number", "prompt": "A portfolio is 50/50 in two uncorrelated assets with volatilities 10% and 30%. What fraction of portfolio variance comes from the second asset?",
     "answer": 0.9, "explanation": "Variance = 0.25×0.01 + 0.25×0.09 = 0.025. The second asset contributes 0.0225/0.025 = 90%."},
    {"type": "number", "prompt": "Two uncorrelated assets have volatilities 10% and 20%. In the equal-risk-contribution portfolio, what weight does the first asset get?",
     "answer": 2 / 3, "display": "2/3 ≈ 0.667", "explanation": "For uncorrelated assets ERC is inverse-volatility: (1/0.1)/((1/0.1) + (1/0.2)) = 10/15."},
    {"type": "choice", "prompt": "What does Ledoit–Wolf shrinkage do?",
     "choices": ["Blends the noisy sample covariance with a structured target, with the blend weight estimated to minimize expected error", "Removes outliers from returns",
                 "Forces all correlations to zero", "Increases all variances by a fixed amount"],
     "answer": 0, "explanation": "It trades a little bias for a big reduction in estimation error, which especially helps when there are many assets relative to observations."},
    {"type": "number", "prompt": "For normally distributed returns, the 97.5% expected shortfall is how many standard deviations?",
     "answer": 2.338, "tol": 0.003, "explanation": "ES = φ(z)/α with z = 1.96 and α = 0.025: 0.0584/0.025 ≈ 2.338σ, nearly the same as the 99% VaR of 2.326σ."},
    {"type": "number", "prompt": "Two uncorrelated assets each have a Sharpe ratio of 0.5. What is the highest Sharpe ratio a portfolio of them can reach?",
     "answer": float(np.sqrt(0.5)), "display": "√0.5 ≈ 0.707", "explanation": "For uncorrelated assets the maximum Sharpe is √(SR₁² + SR₂²) = √0.5."},
    {"type": "number", "prompt": "A portfolio has beta 1.2 to the market (market vol 16%) and 10% specific volatility uncorrelated with the market. What is its total volatility, in %?",
     "answer": 100 * np.sqrt(1.2**2 * 0.16**2 + 0.10**2), "display": "≈ 21.6%",
     "explanation": "σ² = β²σ_m² + σ_s² = 1.44 × 0.0256 + 0.01 = 0.0469, so σ ≈ 21.6%."},
    {"type": "open", "prompt": "Why does a risk-parity portfolio of stocks and bonds typically need leverage, and what are the risks of that?",
     "explanation": "Equalizing risk puts a large capital weight on low-volatility bonds, so the unlevered portfolio has low expected return and volatility. Reaching an equity-like return target means leveraging it. Risks: financing costs, margin calls and forced deleveraging in stress, and correlation breakdowns, e.g. stocks and bonds falling together as in 2022, when leveraged bonds were exactly the wrong thing to hold."},
]


def _cov(seed, n):
    r = gbm_panel(1000, n, corr=0.4, seed=seed).pct_change().iloc[1:]
    return r.cov().to_numpy() * 252


def _panel(seed, n_days=1000, n=40):
    return factor_universe(n_days, n, seed=seed)["prices"].pct_change().iloc[1:]


def _mvo_inputs(seed, n=12):
    u = factor_universe(800, n, seed=seed)
    r = u["prices"].pct_change().iloc[1:]
    alpha = np.random.default_rng(seed).normal(0, 0.05, n)
    return alpha, r.cov().to_numpy() * 252, u["betas"]["MKT"].to_numpy()


def _factor_inputs(seed, n=30):
    u = factor_universe(1000, n, seed=seed)
    r = u["prices"].pct_change().iloc[1:]
    F = u["factors"].iloc[1:].cov().to_numpy() * 252
    B = u["betas"].to_numpy()
    resid = r.to_numpy() - u["factors"].iloc[1:].to_numpy() @ B.T
    D = resid.var(axis=0, ddof=1) * 252
    w = np.random.default_rng(seed).normal(0, 1, n)
    return w / np.abs(w).sum(), B, F, D


PROBLEMS = [
    {
        "id": "r12_risk_parity",
        "title": "Equal risk contribution weights",
        "difficulty": "Medium",
        "libs": ["scipy.optimize", "numpy"],
        "fn": "risk_parity_weights",
        "description": r"""
Compute equal-risk-contribution (ERC) weights for a covariance matrix with the convex formulation:

1. minimize $f(y) = \frac12 y^\top\Sigma y - \frac1n\sum_i \ln y_i$ over $y > 0$ with `scipy.optimize.minimize(f, x0=np.full(n, 1/n), jac=gradient, method="L-BFGS-B", bounds=[(1e-10, None)] * n)`, where the gradient is $\Sigma y - \frac{1}{n\,y}$
2. return the weights $w = y/\sum_i y_i$

### Learn
At the optimum $y_i(\Sigma y)_i = 1/n$ for every i, so every asset contributes the same risk. Verify: compute $w_i(\Sigma w)_i/\sigma_p$ with your foundation-step `portfolio_risk` and check all contributions are equal. The objective is strictly convex, so any accurate solver finds the same unique answer, which makes this formulation popular in production.

Compare with inverse-volatility weights: equal for uncorrelated assets, different when correlations vary.
""",
        "starter": '''import numpy as np
from scipy.optimize import minimize


def risk_parity_weights(cov) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np
from scipy.optimize import minimize


def risk_parity_weights(cov) -> np.ndarray:
    S = np.asarray(cov, dtype=float)
    n = len(S)
    f = lambda y: 0.5 * y @ S @ y - np.log(y).sum() / n
    grad = lambda y: S @ y - 1 / (n * y)
    res = minimize(f, np.full(n, 1 / n), jac=grad, method="L-BFGS-B", bounds=[(1e-10, None)] * n)
    return res.x / res.x.sum()
''',
        "hints": ["Passing the analytic gradient (`jac=`) makes L-BFGS-B fast and precise."],
        "rtol": 1e-4,
        "atol": 1e-6,
        "cases": lambda: [
            {"name": "two uncorrelated assets", "sample": True, "args": ([[0.01, 0.0], [0.0, 0.04]],)},
            {"name": "6 correlated assets", "args": (_cov(1, 6),)},
            {"name": "10 assets", "args": (_cov(2, 10),)},
        ],
    },
    {
        "id": "r12_shrinkage",
        "title": "Sample versus Ledoit–Wolf covariance, out of sample",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "numpy", "pandas"],
        "fn": "shrinkage_backtest",
        "description": r"""
Does shrinkage produce better portfolios? Run a minimum-variance backtest twice, with two covariance estimators. Every `rebalance` days starting at index `window`:

1. estimate the covariance of the trailing `window` daily returns: the sample estimate `np.cov(X, rowvar=False)` and `LedoitWolf().fit(X).covariance_`
2. compute fully invested minimum-variance weights $w = \Sigma^{-1}\mathbf 1/(\mathbf 1^\top\Sigma^{-1}\mathbf 1)$ for each
3. hold those weights for the next `rebalance` days (or until the data ends) and record the portfolio's daily returns

Return a dict: `sample_vol` and `lw_vol` (annualized std of each strategy's out-of-sample daily returns) and `avg_shrinkage` (mean of `LedoitWolf().shrinkage_` across rebalances).

### Learn
With 40 stocks and only 60 days per estimate, the sample covariance is nearly singular, and its "minimum-variance" portfolio is far riskier out of sample than it looked in sample. Ledoit–Wolf's realized volatility should come out clearly lower. Try `window = 250` in a notebook: with more data the gap shrinks, as theory predicts.
""",
        "starter": '''import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf


def shrinkage_backtest(returns: pd.DataFrame, window: int = 60, rebalance: int = 21) -> dict:
    # return {"sample_vol": ..., "lw_vol": ..., "avg_shrinkage": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf


def shrinkage_backtest(returns: pd.DataFrame, window: int = 60, rebalance: int = 21) -> dict:
    R = returns.to_numpy()
    ones = np.ones(R.shape[1])
    out = {"sample": [], "lw": []}
    shrink = []
    for start in range(window, len(R), rebalance):
        X = R[start - window:start]
        lw = LedoitWolf().fit(X)
        shrink.append(lw.shrinkage_)
        hold = R[start:start + rebalance]
        for key, S in (("sample", np.cov(X, rowvar=False)), ("lw", lw.covariance_)):
            a = np.linalg.solve(S, ones)
            out[key].append(hold @ (a / a.sum()))
    vol = lambda key: np.concatenate(out[key]).std(ddof=1) * np.sqrt(252)
    return {"sample_vol": vol("sample"), "lw_vol": vol("lw"), "avg_shrinkage": float(np.mean(shrink))}
''',
        "hints": ["Collect each holding period's daily portfolio returns in a list and concatenate at the end."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "40 stocks, 60-day window", "sample": True, "args": (_panel(1),)},
            {"name": "longer window", "args": (_panel(2), 250, 21)},
        ],
    },
    {
        "id": "r12_neutral_mvo",
        "title": "Market-neutral mean-variance optimization",
        "difficulty": "Hard",
        "libs": ["scipy.optimize", "numpy"],
        "fn": "neutral_portfolio",
        "description": r"""
Build a long/short portfolio from alpha forecasts with the constraints a market-neutral fund uses. Maximize

$$w^\top\alpha - \frac{\lambda}{2}w^\top\Sigma w$$

subject to dollar neutrality ($\mathbf 1^\top w = 0$), beta neutrality ($\beta^\top w = 0$), and position limits $-m \le w_i \le m$. Use `scipy.optimize.minimize` on the negative objective with its gradient ($-\alpha + \lambda\Sigma w$), `x0 = np.zeros(n)`, `method="SLSQP"`, the two equality constraints, `bounds=[(-m, m)] * n`, `options={"ftol": 1e-12, "maxiter": 1000}`. Return the weights. Results are checked to about 1e-4.

### Learn
This is a convex quadratic program, so the solution is unique. Inspect it: positive-alpha names are held long, negative-alpha names short, and the beta constraint forces some compromises (a high-beta long has to be offset by more short beta elsewhere). Production systems add sector neutrality, turnover penalties and liquidity limits, usually with cvxpy and a dedicated QP solver, but the structure is exactly this.
""",
        "starter": '''import numpy as np
from scipy.optimize import minimize


def neutral_portfolio(alpha, cov, betas, risk_aversion: float = 10.0, max_weight: float = 0.1) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np
from scipy.optimize import minimize


def neutral_portfolio(alpha, cov, betas, risk_aversion: float = 10.0, max_weight: float = 0.1) -> np.ndarray:
    a, S, b = np.asarray(alpha, dtype=float), np.asarray(cov, dtype=float), np.asarray(betas, dtype=float)
    n = len(a)
    obj = lambda w: -(w @ a - risk_aversion / 2 * w @ S @ w)
    grad = lambda w: -(a - risk_aversion * S @ w)
    cons = [{"type": "eq", "fun": lambda w: w.sum()}, {"type": "eq", "fun": lambda w: w @ b}]
    res = minimize(obj, np.zeros(n), jac=grad, method="SLSQP", bounds=[(-max_weight, max_weight)] * n,
                   constraints=cons, options={"ftol": 1e-12, "maxiter": 1000})
    return res.x
''',
        "hints": ["Two equality constraints as dicts; the bounds handle position limits."],
        "atol": 1e-4,
        "rtol": 1e-3,
        "cases": lambda: [
            {"name": "12 stocks", "sample": True, "args": _mvo_inputs(1)},
            {"name": "20 stocks, tighter limits, lower risk aversion", "args": (*_mvo_inputs(2, 20), 5.0, 0.08)},
        ],
    },
    {
        "id": "r12_factor_risk",
        "title": "Decompose portfolio risk with a factor model",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "factor_risk",
        "description": r"""
Given weights w (n), exposures B (n × k), the annualized factor covariance F (k × k) and annualized specific variances D (length n), decompose the portfolio's risk:

- exposures $x = B^\top w$
- `factor_var` = $x^\top F x$; `specific_var` = $\sum_i w_i^2 D_i$
- `total_vol` = $\sqrt{\text{factor\_var} + \text{specific\_var}}$
- `factor_share` = factor_var / (factor_var + specific_var)
- `factor_contrib`: an array with each factor's variance contribution $x_k (Fx)_k$ (they sum to factor_var)
- `exposures`: x

Return a dict with those six entries.

### Learn
This is how commercial risk models (Barra, Axioma) report risk: "your book is 60% specific, 25% market, 15% value". The test portfolios are random long/short books, and most of their risk is specific. Now try an equal-weighted long-only book in a notebook: over 90% of its risk is market risk, because stock-specific risk diversifies away across 30 names while factor risk doesn't. Hedging means driving the unwanted entries of x to zero (the previous task's beta constraint does exactly that for the market).
""",
        "starter": '''import numpy as np


def factor_risk(w, B, F, D) -> dict:
    # return {"total_vol": ..., "factor_var": ..., "specific_var": ..., "factor_share": ..., "factor_contrib": ..., "exposures": ...}
    pass
''',
        "solution": '''import numpy as np


def factor_risk(w, B, F, D) -> dict:
    w, B, F, D = (np.asarray(a, dtype=float) for a in (w, B, F, D))
    x = B.T @ w
    contrib = x * (F @ x)
    fv, sv = contrib.sum(), np.sum(w**2 * D)
    return {"total_vol": np.sqrt(fv + sv), "factor_var": fv, "specific_var": sv,
            "factor_share": fv / (fv + sv), "factor_contrib": contrib, "exposures": x}
''',
        "hints": ["Everything follows from x = Bᵀw and Fx."],
        "cases": lambda: [
            {"name": "random long/short book", "sample": True, "args": _factor_inputs(1)},
            {"name": "another book", "args": _factor_inputs(2, 40)},
        ],
    },
]
