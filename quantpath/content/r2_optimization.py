import numpy as np
import pandas as pd

from data import gbm_panel

TITLE = "Calculus and optimization"
SUMMARY = "Gradients, convexity, gradient descent, Lagrange multipliers, closed-form portfolios, and constrained optimization with scipy."
KIND = "core"

LESSON = r"""
Fitting a model and building a portfolio are both optimization problems. Interviewers check that you can derive the simple cases by hand (a Lagrangian on a whiteboard) and solve the realistic ones numerically.

## Unconstrained optimization

- At a minimum of a smooth function, $\nabla f = 0$; it's a minimum if the Hessian is positive definite there.
- **Convex** functions (positive semi-definite Hessian everywhere) have no spurious local minima. Least squares, ridge, logistic regression and mean-variance portfolios are convex; neural networks are not.
- **Gradient descent**: $w \leftarrow w - \eta\nabla f(w)$. Too large a step size η diverges, too small crawls. Features on very different scales make it zig-zag, which is why you standardize.
- **Newton's method**: $w \leftarrow w - H^{-1}\nabla f$. It converges quadratically near the optimum but needs second derivatives. For one variable: $x \leftarrow x - f'(x)/f''(x)$; for root finding, $x \leftarrow x - g(x)/g'(x)$, which is how implied vols are solved.

## Constrained optimization: Lagrange multipliers

Minimize $f(w)$ subject to $g(w) = 0$: set $\nabla f = \lambda\nabla g$, or equivalently make the Lagrangian $\mathcal L = f - \lambda g$ stationary. The multiplier λ is the **shadow price**: how much the optimum improves per unit of relaxing the constraint. Inequality constraints add the KKT conditions (complementary slackness).

## Portfolio optimization in closed form

Minimum variance with fully invested weights, $\min_w w^\top\Sigma w$ subject to $\mathbf 1^\top w = 1$:

$$w_{mv} = \frac{\Sigma^{-1}\mathbf 1}{\mathbf 1^\top\Sigma^{-1}\mathbf 1}$$

Maximum Sharpe ratio (the **tangency** portfolio), with excess returns $\mu - r_f$:

$$w_{tan} = \frac{\Sigma^{-1}(\mu - r_f)}{\mathbf 1^\top\Sigma^{-1}(\mu - r_f)}$$

Two uncorrelated assets: $w_1 = \frac{\sigma_2^2}{\sigma_1^2 + \sigma_2^2}$ for minimum variance. The **efficient frontier** is the set of minimum-variance portfolios for each target return; with a risk-free asset every investor holds the tangency portfolio scaled up or down (two-fund separation).

## Numerical optimization with scipy

Real portfolios have constraints closed forms can't handle: no shorting, position caps, sector limits, turnover limits.

```python
from scipy.optimize import minimize
res = minimize(objective, x0, method="SLSQP", bounds=[(0, 0.3)] * n,
               constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1}],
               options={"ftol": 1e-12, "maxiter": 500})
res.x, res.fun, res.success
```

Always check `res.success`, start from a sensible x0 (equal weights), and prefer convex formulations (minimize variance subject to constraints rather than maximizing a non-convex ratio when you can).

## The big practical warning

Mean-variance optimization is an **error maximizer**: it overweights assets whose expected returns you overestimated. Expected returns are very hard to estimate (a 10-year sample barely pins down a stock's mean), so practitioners shrink μ, use constraints, or ignore μ entirely (minimum variance, risk parity).
"""

QUESTIONS = [
    {"type": "number", "prompt": "What value of x minimizes f(x) = x² − 4x + 1?", "answer": 2, "explanation": "f′(x) = 2x − 4 = 0, so x = 2; f″ = 2 > 0 confirms a minimum."},
    {"type": "number", "prompt": "Two uncorrelated assets have volatilities 10% and 20%. In the fully invested minimum-variance portfolio, what weight goes to the first asset?",
     "answer": 0.8, "explanation": "w₁ = σ₂²/(σ₁² + σ₂²) = 0.04/0.05 = 0.8."},
    {"type": "number", "prompt": "Gradient descent on f(x) = x² with step size 0.25, starting at x₀ = 4. What is x₁?",
     "answer": 2, "explanation": "x₁ = 4 − 0.25 × f′(4) = 4 − 0.25 × 8 = 2."},
    {"type": "number", "prompt": "Maximize xy subject to x + y = 10. What is the maximum value?",
     "answer": 25, "explanation": "Lagrange: y = λ and x = λ, so x = y = 5 and xy = 25."},
    {"type": "number", "prompt": "Newton's method for √2 (solve x² − 2 = 0) starting at x₀ = 1. What is x₁?",
     "answer": 1.5, "explanation": "x₁ = x₀ − (x₀² − 2)/(2x₀) = 1 − (−1)/2 = 1.5."},
    {"type": "number", "prompt": "Two uncorrelated assets have expected excess returns 8% and 12% and variances 0.04 and 0.09. What weight does the tangency portfolio put on the first asset?",
     "answer": 0.6, "explanation": "Σ⁻¹μ = (0.08/0.04, 0.12/0.09) = (2, 1.333). Normalizing: 2/3.333 = 0.6."},
    {"type": "choice", "prompt": "In a constrained optimization, what does the Lagrange multiplier on a constraint tell you?",
     "choices": ["How much the optimal objective changes per unit relaxation of the constraint (its shadow price)", "Whether the problem is convex",
                 "The number of iterations needed", "Nothing; it is just an algebraic trick"],
     "answer": 0, "explanation": "λ = ∂f*/∂c: e.g., in mean-variance, the multiplier on the return target is how much extra variance each extra unit of required return costs."},
    {"type": "open", "prompt": "Why are unconstrained mean-variance portfolios built from historical returns often terrible out of sample?",
     "explanation": "Expected returns are estimated with huge error, and the optimizer exploits those errors: it overweights assets with overestimated means and underweights or shorts those with underestimated ones, producing extreme, unstable weights. Small changes in inputs flip the portfolio. Remedies: constrain weights, shrink means toward a common value or an equilibrium (Black–Litterman), regularize, use robust covariance estimates (shrinkage), or skip means entirely (minimum variance, risk parity)."},
]


def _assets(seed, n=5, days=1260):
    r = gbm_panel(days, n, corr=0.3, seed=seed).pct_change().iloc[1:]
    return (r.mean() * 252).to_numpy(), (r.cov() * 252).to_numpy()


def _ls_data(seed, n=200, p=3):
    rng = np.random.default_rng(seed)
    X = rng.standard_normal((n, p))
    return X, X @ rng.uniform(-2, 2, p) + 0.5 * rng.standard_normal(n)


PROBLEMS = [
    {
        "id": "r2_gradient_descent",
        "title": "Gradient descent for least squares",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "gd_least_squares",
        "description": r"""
Fit linear regression weights by gradient descent on the mean squared error $L(w) = \frac1n\|Xw - y\|^2$. Start from $w = 0$ and take `n_iter` steps

$$w \leftarrow w - \eta\,\nabla L(w), \qquad \nabla L(w) = \frac{2}{n}X^\top(Xw - y)$$

with step size η = `lr`. Return the final weights (numpy array).

### Learn
Compare with the exact answer `np.linalg.lstsq(X, y, rcond=None)[0]`: with a reasonable step size the two agree after a few hundred steps. Then try a step size that's too big and watch the loss explode. That's the intuition behind learning-rate tuning in every ML model, and why logistic regression and neural nets (which have no closed form) are trained this way.
""",
        "starter": '''import numpy as np


def gd_least_squares(X, y, lr: float = 0.1, n_iter: int = 500) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def gd_least_squares(X, y, lr: float = 0.1, n_iter: int = 500) -> np.ndarray:
    X, y = np.asarray(X, dtype=float), np.asarray(y, dtype=float)
    w = np.zeros(X.shape[1])
    for _ in range(n_iter):
        w -= lr * 2 / len(y) * X.T @ (X @ w - y)
    return w
''',
        "hints": ["One line inside the loop: the update."],
        "cases": lambda: [
            {"name": "3 features, 500 steps", "sample": True, "args": _ls_data(1)},
            {"name": "only 20 steps (not converged)", "args": (*_ls_data(2), 0.05, 20)},
            {"name": "5 features", "args": (*_ls_data(3, 400, 5), 0.2, 300)},
        ],
    },
    {
        "id": "r2_closed_form",
        "title": "Minimum-variance and tangency portfolios",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "mv_portfolios",
        "description": r"""
Given annual expected returns `mu`, an annual covariance matrix `cov` and a risk-free rate `rf`, return a dict:

- `w_minvar`: $\Sigma^{-1}\mathbf 1 / (\mathbf 1^\top\Sigma^{-1}\mathbf 1)$
- `w_tangency`: $\Sigma^{-1}(\mu - r_f) / (\mathbf 1^\top\Sigma^{-1}(\mu - r_f))$
- `minvar_vol`, `tangency_vol`: the two portfolios' volatilities $\sqrt{w^\top\Sigma w}$
- `tangency_sharpe`: $(w^\top\mu - r_f)/\sqrt{w^\top\Sigma w}$ for the tangency portfolio

### Learn
Use `np.linalg.solve(cov, b)` instead of forming the inverse: it's faster and numerically safer. Derive the minimum-variance formula once with a Lagrangian: $\mathcal L = w^\top\Sigma w - \lambda(\mathbf 1^\top w - 1)$ gives $2\Sigma w = \lambda\mathbf 1$.

Look at the tangency weights: they're often extreme (large shorts), which is the error-maximization problem from the lesson. The next task adds constraints.
""",
        "starter": '''import numpy as np


def mv_portfolios(mu, cov, rf: float = 0.0) -> dict:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def mv_portfolios(mu, cov, rf: float = 0.0) -> dict:
    mu, cov = np.asarray(mu, dtype=float), np.asarray(cov, dtype=float)
    a = np.linalg.solve(cov, np.ones(len(mu)))
    b = np.linalg.solve(cov, mu - rf)
    w_mv, w_tan = a / a.sum(), b / b.sum()
    vol = lambda w: np.sqrt(w @ cov @ w)
    return {"w_minvar": w_mv, "w_tangency": w_tan, "minvar_vol": vol(w_mv), "tangency_vol": vol(w_tan),
            "tangency_sharpe": (w_tan @ mu - rf) / vol(w_tan)}
''',
        "hints": ["Solve Σa = 1 and Σb = μ − r_f once, then normalize each by its sum."],
        "cases": lambda: [
            {"name": "two uncorrelated assets", "sample": True, "args": ([0.08, 0.12], [[0.04, 0.0], [0.0, 0.09]])},
            {"name": "5 assets from data", "args": _assets(1)},
            {"name": "with a 3% risk-free rate", "args": (*_assets(2), 0.03)},
        ],
    },
    {
        "id": "r2_long_only_sharpe",
        "title": "Long-only maximum Sharpe with scipy",
        "difficulty": "Medium",
        "libs": ["scipy.optimize", "numpy"],
        "fn": "max_sharpe_long_only",
        "description": r"""
Find the maximum-Sharpe portfolio with no short positions and a cap on each weight, using `scipy.optimize.minimize`:

- objective: the negative Sharpe ratio $-(w^\top\mu - r_f)/\sqrt{w^\top\Sigma w}$
- constraint: weights sum to 1 (`{"type": "eq", "fun": lambda w: w.sum() - 1}`)
- bounds: each weight in [0, `max_weight`]
- start from equal weights; `method="SLSQP"`, `options={"ftol": 1e-12, "maxiter": 500}`

Return the optimal weights (numpy array). Results are checked to about 1e-4.

### Learn
This is how most real portfolio construction looks: a numerical optimizer with constraints the closed forms can't express. Compare with the unconstrained tangency portfolio from the previous task: the long-only answer is much more diversified and far less sensitive to small changes in μ.

Check `res.success` in your own code. A silently failed optimization is a classic production bug.
""",
        "starter": '''import numpy as np
from scipy.optimize import minimize


def max_sharpe_long_only(mu, cov, rf: float = 0.0, max_weight: float = 1.0) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np
from scipy.optimize import minimize


def max_sharpe_long_only(mu, cov, rf: float = 0.0, max_weight: float = 1.0) -> np.ndarray:
    mu, cov = np.asarray(mu, dtype=float), np.asarray(cov, dtype=float)
    n = len(mu)
    neg_sharpe = lambda w: -(w @ mu - rf) / np.sqrt(w @ cov @ w)
    res = minimize(neg_sharpe, np.full(n, 1 / n), method="SLSQP", bounds=[(0, max_weight)] * n,
                   constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1}],
                   options={"ftol": 1e-12, "maxiter": 500})
    return res.x
''',
        "hints": ["`bounds=[(0, max_weight)] * n` sets the same bounds for every asset."],
        "atol": 1e-4,
        "rtol": 1e-3,
        "cases": lambda: [
            {"name": "5 assets, no cap", "sample": True, "args": _assets(1)},
            {"name": "40% cap per asset", "args": (*_assets(3), 0.0, 0.4)},
            {"name": "8 assets, 25% cap, rf 2%", "args": (*_assets(4, 8), 0.02, 0.25)},
        ],
    },
    {
        "id": "r2_frontier",
        "title": "A constrained efficient frontier",
        "difficulty": "Medium",
        "libs": ["scipy.optimize", "pandas"],
        "fn": "efficient_frontier",
        "description": r"""
For each target return in `targets`, find the minimum-volatility **long-only** portfolio that achieves it:

- minimize $w^\top\Sigma w$ subject to $\mathbf 1^\top w = 1$, $w^\top\mu = \text{target}$, $0 \le w \le 1$
- `minimize(..., method="SLSQP", x0=equal weights, options={"ftol": 1e-12, "maxiter": 500})`

Return a DataFrame indexed by target with a `vol` column ($\sqrt{w^\top\Sigma w}$) followed by one column per asset (`w0`, `w1`, …) holding the weights.

### Learn
Minimizing variance is a convex problem (a quadratic objective with linear constraints), so the solver reliably finds the global optimum, unlike maximizing a Sharpe ratio directly. Plot `vol` against the target returns in a notebook: that's the efficient frontier. The weights columns show assets entering and leaving the portfolio as the target rises (a "corner portfolio" picture).

Keep the targets between the lowest and highest expected return; outside that range no long-only portfolio exists.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.optimize import minimize


def efficient_frontier(mu, cov, targets) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from scipy.optimize import minimize


def efficient_frontier(mu, cov, targets) -> pd.DataFrame:
    mu, cov = np.asarray(mu, dtype=float), np.asarray(cov, dtype=float)
    n = len(mu)
    rows = {}
    for t in targets:
        cons = [{"type": "eq", "fun": lambda w: w.sum() - 1}, {"type": "eq", "fun": lambda w, t=t: w @ mu - t}]
        res = minimize(lambda w: w @ cov @ w, np.full(n, 1 / n), method="SLSQP", bounds=[(0, 1)] * n,
                       constraints=cons, options={"ftol": 1e-12, "maxiter": 500})
        rows[t] = {"vol": np.sqrt(res.x @ cov @ res.x), **{f"w{i}": v for i, v in enumerate(res.x)}}
    return pd.DataFrame.from_dict(rows, orient="index")
''',
        "hints": ["Bind the loop variable in the lambda (`lambda w, t=t: ...`) or every constraint will use the last target."],
        "atol": 1e-4,
        "rtol": 1e-3,
        "cases": lambda: [
            {"name": "5 targets", "sample": True, "args": (*_assets(1), np.linspace(_assets(1)[0].min() + 0.005, _assets(1)[0].max() - 0.005, 5))},
            {"name": "another universe", "args": (*_assets(5, 6), np.linspace(_assets(5, 6)[0].min() + 0.01, _assets(5, 6)[0].max() - 0.01, 4))},
        ],
    },
]
