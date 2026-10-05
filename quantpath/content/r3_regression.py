import numpy as np
import pandas as pd

from data import factor_universe, normal_returns

TITLE = "Regression and econometrics"
SUMMARY = "OLS from first principles, robust and Newey–West standard errors, overlapping returns, regularization with time-series CV, and Fama–MacBeth."
KIND = "core"

LESSON = r"""
Regression is the researcher's workhorse: factor exposures, predictive signals, risk models and many ML baselines are regressions. The skill interviewers probe isn't running one, it's knowing **when its standard errors lie**.

## OLS

$$\hat\beta = (X^\top X)^{-1}X^\top y, \qquad \widehat{\text{Var}}(\hat\beta) = s^2 (X^\top X)^{-1}, \quad s^2 = \frac{\text{RSS}}{n - k}$$

with k the number of columns of X (including the intercept). The t-statistic is $\hat\beta_j / \text{se}_j$. $R^2 = 1 - \text{RSS}/\text{TSS}$, and adjusted $R^2 = 1 - (1 - R^2)\frac{n-1}{n-k}$ penalizes extra regressors. In a simple regression, slope = Cov(x, y)/Var(x) and $R^2 = \rho^2$.

**Gauss–Markov**: with exogenous regressors and homoskedastic, uncorrelated errors, OLS is the best linear unbiased estimator. Financial data breaks the last two assumptions all the time.

## When standard errors lie

- **Heteroskedasticity** (volatility clustering): coefficients stay unbiased, the usual SEs are wrong. Use White (HC) robust SEs.
- **Autocorrelated residuals**: use **Newey–West (HAC)** SEs.
- **Overlapping returns**: regressing h-day forward returns sampled daily makes consecutive observations share h − 1 days. Naive t-stats are inflated by roughly $\sqrt{h}$. Use HAC with at least h lags, or non-overlapping data.
- **Multicollinearity**: correlated regressors inflate variances. $\text{VIF}_j = 1/(1 - R_j^2)$, where $R_j^2$ comes from regressing $x_j$ on the other regressors.
- **Omitted variable bias**: leaving out a variable correlated with both x and y biases the slope (bias = β_omitted × slope of the omitted variable on x). A "momentum" effect can be a disguised beta effect.

## Regularization

- **Ridge**: minimize RSS + λ‖β‖². Closed form $(X^\top X + \lambda I)^{-1}X^\top y$; shrinks coefficients and handles collinearity.
- **Lasso**: RSS + λ‖β‖₁. Sets some coefficients exactly to zero (variable selection).
- Standardize features first (the penalty is scale-dependent) and **don't penalize the intercept**.
- Choose λ by cross-validation, and for time series use **time-ordered** splits (`TimeSeriesSplit`), never shuffled K-fold.

## Factor regressions and Fama–MacBeth

- **Time-series regression** (one per stock): $r_{i,t} = \alpha_i + \beta_i^\top f_t + \varepsilon_{i,t}$. The betas are exposures; α is the unexplained return.
- **Fama–MacBeth** (cross-sectional): each period t, regress returns across stocks on characteristics, $r_{i,t+1} = \lambda_{0,t} + \lambda_t^\top z_{i,t} + e_{i,t}$. Then average the $\lambda_t$ over time and use their time-series standard error: $t = \bar\lambda / (s_\lambda/\sqrt T)$. That's the standard way to test whether a characteristic is priced, and it handles cross-sectional correlation of residuals.

## statsmodels cheat sheet

```python
import statsmodels.api as sm
X = sm.add_constant(x)                                       # adds the intercept column
res = sm.OLS(y, X).fit()                                     # classic SEs
res = sm.OLS(y, X).fit(cov_type="HC1")                       # White robust
res = sm.OLS(y, X).fit(cov_type="HAC", cov_kwds={"maxlags": 5})  # Newey-West
res.params, res.bse, res.tvalues, res.pvalues, res.rsquared, res.resid, res.summary()
```
"""

QUESTIONS = [
    {"type": "number", "prompt": "In a simple regression of y on x, Cov(x, y) = 2 and Var(x) = 4. What is the slope?",
     "answer": 0.5, "explanation": "β = Cov(x, y)/Var(x) = 0.5."},
    {"type": "number", "prompt": "x and y have correlation 0.6. What is the R² of the simple regression of y on x?",
     "answer": 0.36, "explanation": "In a simple regression R² = ρ² = 0.36."},
    {"type": "number", "prompt": "You multiply every x value by 2 and rerun the regression of y on x. By what factor does the slope change?",
     "answer": 0.5, "explanation": "Cov(2x, y)/Var(2x) = 2Cov/4Var = half the original slope."},
    {"type": "choice", "prompt": "Residuals are heteroskedastic. What is the main consequence for OLS?",
     "choices": ["Coefficients stay unbiased but the usual standard errors and t-stats are wrong", "Coefficients become biased",
                 "R² becomes negative", "OLS can no longer be computed"],
     "answer": 0, "explanation": "Unbiasedness only needs exogeneity. Inference needs robust (White/HAC) standard errors."},
    {"type": "number", "prompt": "Regressing one regressor on all the others gives R² = 0.8. What is its variance inflation factor?",
     "answer": 5, "explanation": "VIF = 1/(1 − R²) = 1/0.2 = 5: its coefficient's variance is 5× what it would be without collinearity."},
    {"type": "choice", "prompt": "Momentum returns load positively on market beta in your sample, and you regress returns on momentum without controlling for beta. What happens?",
     "choices": ["The momentum coefficient partly picks up the beta effect (omitted variable bias)", "Nothing; momentum is unaffected",
                 "The coefficient becomes exactly zero", "Only the intercept changes"],
     "answer": 0, "explanation": "An omitted variable correlated with both the regressor and the outcome biases the slope. Always control for known factors."},
    {"type": "number", "prompt": "A regression has n = 100 observations, an intercept plus 3 regressors, and residual sum of squares 192. What is the estimated residual variance s²?",
     "answer": 2, "explanation": "s² = RSS/(n − k) = 192/(100 − 4) = 2."},
    {"type": "open", "prompt": "You regress 1-month forward returns on a signal using daily data (overlapping windows) and get a t-statistic of 4. Do you believe it?",
     "explanation": "Not yet. Consecutive observations share about 20 of 21 days, so residuals are strongly autocorrelated and the OLS t-stat is inflated by roughly √21 ≈ 4.6. A true t of about 1 can show up as 4. Recompute with Newey–West (maxlags ≥ 21) or use non-overlapping monthly data. Then ask about data mining: how many signals were tried before this one?"},
]


def _ols_data(seed, n=300, k=3):
    rng = np.random.default_rng(seed)
    X = rng.standard_normal((n, k))
    if k > 1:
        X[:, 1] += 0.6 * X[:, 0]                   # some collinearity
    return X, 0.5 + X @ rng.uniform(-1, 1, k) + rng.standard_normal(n)


def _predictive(seed, n=1500, beta=0.0):
    """A persistent AR(1) signal (phi = 0.95); returns depend on it only if beta != 0."""
    rng = np.random.default_rng(seed)
    s = np.zeros(n)
    for t in range(1, n):
        s[t] = 0.95 * s[t - 1] + rng.standard_normal()
    idx = normal_returns(n, seed=seed).index
    signal = pd.Series(s / s.std(), index=idx, name="signal")
    r = normal_returns(n, mu=0.0, sigma=0.01, seed=seed + 100) + beta * 0.01 * signal.shift(1).fillna(0)
    return r, signal


def _ridge_data(seed, n=600, p=10):
    rng = np.random.default_rng(seed)
    base = rng.standard_normal((n, 3))
    X = np.hstack([base, base @ rng.standard_normal((3, p - 3)) + 0.3 * rng.standard_normal((n, p - 3))])
    y = X[:, 0] * 0.5 - X[:, 1] * 0.3 + rng.standard_normal(n) * 2
    cols = [f"x{i}" for i in range(p)]
    return pd.DataFrame(X, columns=cols), pd.Series(y, name="y")


def _fm_panel(seed):
    px = factor_universe(800, 25, momentum=0.0012, seed=seed)["prices"]
    r = px.pct_change()
    z = lambda df: df.sub(df.mean(axis=1), axis=0).div(df.std(axis=1), axis=0)
    chars = {"mom": z(px.shift(21) / px.shift(126) - 1), "rev": z(px / px.shift(5) - 1)}
    return r.shift(-1), chars


PROBLEMS = [
    {
        "id": "r3_ols",
        "title": "OLS with standard errors, from scratch",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "ols",
        "description": r"""
Implement ordinary least squares with an **intercept added for you** (prepend a column of ones to X). With n observations and k = (number of columns of X) + 1 parameters, return a dict:

- `beta`: $(X^\top X)^{-1}X^\top y$, intercept first
- `se`: classic standard errors $\sqrt{\text{diag}(s^2(X^\top X)^{-1})}$ with $s^2 = \text{RSS}/(n-k)$
- `t`: beta / se
- `r2`: $1 - \text{RSS}/\text{TSS}$; `adj_r2`: $1 - (1-R^2)\frac{n-1}{n-k}$

### Learn
Solve with `np.linalg.solve(X.T @ X, X.T @ y)` or `lstsq` rather than an explicit inverse (you still need the inverse's diagonal for the SEs). Then confirm everything against statsmodels:

```python
import statsmodels.api as sm
res = sm.OLS(y, sm.add_constant(X)).fit()
res.params, res.bse, res.tvalues, res.rsquared, res.rsquared_adj
```

Knowing where every number in `res.summary()` comes from is exactly what researcher interviews test.
""",
        "starter": '''import numpy as np


def ols(X, y) -> dict:
    # return {"beta": ..., "se": ..., "t": ..., "r2": ..., "adj_r2": ...}
    pass
''',
        "solution": '''import numpy as np


def ols(X, y) -> dict:
    y = np.asarray(y, dtype=float)
    X = np.column_stack([np.ones(len(y)), np.asarray(X, dtype=float)])
    n, k = X.shape
    XtX_inv = np.linalg.inv(X.T @ X)
    beta = XtX_inv @ X.T @ y
    resid = y - X @ beta
    rss, tss = resid @ resid, np.sum((y - y.mean()) ** 2)
    se = np.sqrt(np.diag(rss / (n - k) * XtX_inv))
    r2 = 1 - rss / tss
    return {"beta": beta, "se": se, "t": beta / se, "r2": r2, "adj_r2": 1 - (1 - r2) * (n - 1) / (n - k)}
''',
        "hints": ["`np.column_stack([np.ones(n), X])` adds the intercept column."],
        "cases": lambda: [
            {"name": "3 regressors, some collinearity", "sample": True, "args": _ols_data(1)},
            {"name": "one regressor, small sample", "args": _ols_data(2, 30, 1)},
            {"name": "6 regressors", "args": _ols_data(3, 1000, 6)},
        ],
    },
    {
        "id": "r3_hac",
        "title": "Overlapping returns and Newey–West t-stats",
        "difficulty": "Medium",
        "libs": ["statsmodels", "pandas"],
        "fn": "predictive_regression",
        "description": r"""
Test whether a signal predicts **h-day forward returns**, the way it's done in research notebooks, with statsmodels:

1. $y_t = r_{t+1} + \dots + r_{t+h}$ = `returns.rolling(h).sum().shift(-h)`; $x_t$ = `signal` at t
2. drop dates where either is missing
3. fit `sm.OLS(y, sm.add_constant(x))` twice: once with default (classic) SEs, once with `cov_type="HAC", cov_kwds={"maxlags": h}`
4. return a dict: `beta` (the slope), `t_ols`, `t_hac` (the slope's t-statistics) and `r2`

### Learn
With h = 20 and a persistent signal, consecutive y's overlap by 19 days, so the residuals are strongly autocorrelated. The test data has **no** true predictability in one case: watch `t_ols` look "significant" while `t_hac` doesn't. That gap between naive and robust t-stats is a common reason published-looking results fail to replicate.

`res.tvalues.iloc[1]` is the slope's t-statistic (the constant comes first).
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def predictive_regression(returns: pd.Series, signal: pd.Series, h: int = 20) -> dict:
    # return {"beta": ..., "t_ols": ..., "t_hac": ..., "r2": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def predictive_regression(returns: pd.Series, signal: pd.Series, h: int = 20) -> dict:
    y = returns.rolling(h).sum().shift(-h).rename("y")
    data = pd.concat([y, signal.rename("x")], axis=1).dropna()
    X = sm.add_constant(data["x"])
    ols = sm.OLS(data["y"], X).fit()
    hac = sm.OLS(data["y"], X).fit(cov_type="HAC", cov_kwds={"maxlags": h})
    return {"beta": ols.params.iloc[1], "t_ols": ols.tvalues.iloc[1], "t_hac": hac.tvalues.iloc[1], "r2": ols.rsquared}
''',
        "hints": ["Align y and x on dates with `pd.concat([...], axis=1).dropna()` before fitting."],
        "rtol": 1e-5,
        "cases": lambda: [
            {"name": "no true predictability, h = 20", "sample": True, "args": (*_predictive(4), 20)},
            {"name": "real predictability (beta = 0.1)", "args": (*_predictive(6, beta=0.1), 20)},
            {"name": "no predictability, h = 5", "args": (*_predictive(5), 5)},
        ],
    },
    {
        "id": "r3_ridge_cv",
        "title": "Ridge with time-series cross-validation",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "pandas"],
        "fn": "ridge_cv",
        "description": r"""
Choose the ridge penalty with time-ordered cross-validation, using scikit-learn the way you would in practice:

1. `model = make_pipeline(StandardScaler(), Ridge(alpha=a))` for each `a` in `alphas`
2. score it with `cross_val_score(model, X, y, cv=TimeSeriesSplit(n_splits), scoring="neg_mean_squared_error")`; its mean CV MSE is the negative of the mean score
3. pick the alpha with the lowest mean CV MSE (ties: the first), refit that pipeline on all the data

Return a dict: `cv_mse` (Series indexed by alpha), `best_alpha`, and `coef` (Series of the refit ridge coefficients, indexed by the feature names; these are coefficients on standardized features).

### Learn
The pipeline matters: the scaler is fitted inside each training fold, so test folds never leak their mean or variance into training. The data has 10 highly collinear features with only two that matter. Compare the ridge coefficients for small and large alpha, then try `Lasso` in a notebook and watch it zero out the redundant ones.
""",
        "starter": '''import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def ridge_cv(X: pd.DataFrame, y: pd.Series, alphas, n_splits: int = 5) -> dict:
    # return {"cv_mse": ..., "best_alpha": ..., "coef": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def ridge_cv(X: pd.DataFrame, y: pd.Series, alphas, n_splits: int = 5) -> dict:
    cv = TimeSeriesSplit(n_splits)
    mse = pd.Series({a: -cross_val_score(make_pipeline(StandardScaler(), Ridge(alpha=a)), X, y, cv=cv,
                                         scoring="neg_mean_squared_error").mean() for a in alphas})
    best = mse.idxmin()
    model = make_pipeline(StandardScaler(), Ridge(alpha=best)).fit(X, y)
    return {"cv_mse": mse, "best_alpha": best, "coef": pd.Series(model[-1].coef_, index=X.columns)}
''',
        "hints": ["`pipeline[-1]` is the last step (the fitted Ridge), with `.coef_`."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "10 collinear features", "sample": True, "args": (*_ridge_data(1), [0.1, 1.0, 10.0, 100.0, 1000.0])},
            {"name": "another sample, 3 folds", "args": (*_ridge_data(2, 400), [0.01, 1.0, 50.0, 500.0], 3)},
        ],
    },
    {
        "id": "r3_fama_macbeth",
        "title": "Fama–MacBeth cross-sectional regressions",
        "difficulty": "Hard",
        "libs": ["numpy", "pandas"],
        "fn": "fama_macbeth",
        "description": r"""
Test whether characteristics predict returns across stocks. Inputs: `fwd_returns` (dates × stocks; the return **after** each date) and `chars`, a dict of name → DataFrame (dates × stocks) of characteristics known at each date.

1. for each date, keep the stocks where the forward return and every characteristic exist; skip dates with fewer than (number of characteristics + 2) such stocks
2. run the cross-sectional OLS of forward returns on an intercept and the characteristics (`np.linalg.lstsq`), giving $\lambda_t$ = [const, char₁, …]
3. return a dict:
   - `lambdas`: DataFrame (dates × [`"const"`, *char names in dict order*])
   - `summary`: DataFrame indexed by those names with columns `mean` ($\bar\lambda$) and `tstat` ($\bar\lambda / (s_\lambda/\sqrt T)$, std with ddof=1)

### Learn
Each $\lambda_t$ is the return of a long–short portfolio with unit exposure to that characteristic, so the time series of λ is like a strategy's returns and its t-stat is a Sharpe ratio × √T. Fama–MacBeth standard errors are robust to cross-sectional correlation (all stocks moving together on a date), which pooled OLS gets badly wrong.

The test panel has a planted momentum effect: expect a positive and significant `mom` premium and a `rev` premium near zero.
""",
        "starter": '''import numpy as np
import pandas as pd


def fama_macbeth(fwd_returns: pd.DataFrame, chars: dict) -> dict:
    # return {"lambdas": ..., "summary": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def fama_macbeth(fwd_returns: pd.DataFrame, chars: dict) -> dict:
    names = ["const", *chars]
    rows = {}
    for date in fwd_returns.index:
        frame = pd.DataFrame({"y": fwd_returns.loc[date], **{k: v.loc[date] for k, v in chars.items()}}).dropna()
        if len(frame) < len(chars) + 2:
            continue
        X = np.column_stack([np.ones(len(frame)), frame[list(chars)].to_numpy()])
        rows[date] = np.linalg.lstsq(X, frame["y"].to_numpy(), rcond=None)[0]
    lambdas = pd.DataFrame.from_dict(rows, orient="index", columns=names)
    summary = pd.DataFrame({"mean": lambdas.mean(), "tstat": lambdas.mean() / lambdas.std() * np.sqrt(len(lambdas))})
    return {"lambdas": lambdas, "summary": summary}
''',
        "hints": ["Build one small DataFrame per date (y plus characteristics) and `dropna()` it."],
        "timeout": 300,
        "cases": lambda: [
            {"name": "25 stocks, momentum and reversal", "sample": True, "args": _fm_panel(1)},
            {"name": "another panel", "args": _fm_panel(2)},
        ],
    },
]
