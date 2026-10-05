import numpy as np
import pandas as pd

from data import ar1, garch_returns, gbm

TITLE = "Time series essentials"
SUMMARY = "Stationarity and unit roots, AR models and mean reversion, GARCH estimated by maximum likelihood, and honest forecast evaluation."
KIND = "core"

LESSON = r"""
Financial data arrives as time series, and most modelling mistakes come from ignoring that: non-stationary inputs, autocorrelated errors, forecasts that secretly used the future. This step is the researcher's compact toolkit. (Your TS Quant Lab covers each topic in depth.)

## Stationarity and unit roots

A weakly stationary series has constant mean, variance and autocovariances. Prices have a unit root ($p_t = p_{t-1} + \varepsilon_t$, variance growing with t); returns and spreads of cointegrated assets are roughly stationary.

- **ADF**: H₀ unit root. Small p-value → evidence of stationarity.
- **KPSS**: H₀ stationarity. Small p-value → evidence of a unit root.
- Use both: they agree on clear cases and disagree when the data can't decide.
- Regressing one random walk on another gives **spurious** significance; test for stationarity (or cointegration) before you regress levels.

## AR models and mean reversion

AR(1): $x_t = c + \phi x_{t-1} + \varepsilon_t$, stationary for $|\phi| < 1$, with mean $c/(1-\phi)$, variance $\sigma^2/(1-\phi^2)$, and **half-life** $\ln 0.5/\ln\phi$ (the time for a deviation to halve). It's the discrete version of the Ornstein–Uhlenbeck process used for spreads, rates and volatility.

## Volatility: GARCH by maximum likelihood

$\sigma_t^2 = \omega + \alpha r_{t-1}^2 + \beta\sigma_{t-1}^2$, with long-run variance $\omega/(1-\alpha-\beta)$. With normal shocks the log-likelihood is

$$\ell(\omega, \alpha, \beta) = -\tfrac12\sum_t\left(\ln(2\pi\sigma_t^2) + \frac{r_t^2}{\sigma_t^2}\right)$$

which you maximize numerically (scipy). Writing that likelihood yourself once demystifies every "fit" button: a model is a recursion plus a likelihood plus an optimizer. Scale returns to percent first, since optimizers dislike variances around 10⁻⁴.

## Cointegration

Two I(1) series are cointegrated if a linear combination is stationary. Engle–Granger: regress one on the other, then test the residual with special (MacKinnon) critical values (`statsmodels.tsa.stattools.coint`). Johansen handles several series.

## Forecast evaluation

- Fit on the past, forecast the future: fixed or expanding windows, **never** fit on the full sample and then "forecast" inside it.
- Compare against the right naive baseline: random walk ($\hat x_{t+1} = x_t$) for levels, the mean (or zero) for returns. Report skill = 1 − RMSE_model / RMSE_baseline.

## statsmodels cheat sheet

```python
from statsmodels.tsa.ar_model import AutoReg
res = AutoReg(x, lags=1).fit(); res.params; res.sigma2
from statsmodels.tsa.stattools import adfuller, kpss, coint
adfuller(x, regression="c", autolag="AIC")[1]  # p-value
kpss(x, regression="c", nlags="auto")[1]               # p-value, clipped to [0.01, 0.1]
from scipy.optimize import minimize
minimize(neg_loglik, x0, method="L-BFGS-B", bounds=[...])
```
"""

QUESTIONS = [
    {"type": "number", "prompt": "An AR(1) spread has φ = 0.9. What is its half-life in periods?",
     "answer": float(np.log(0.5) / np.log(0.9)), "display": "≈ 6.58", "explanation": "ln 0.5 / ln 0.9 ≈ 6.58 periods."},
    {"type": "number", "prompt": "An AR(1) process has φ = 0.5 and shock variance 1. What is its unconditional variance?",
     "answer": 4 / 3, "display": "4/3 ≈ 1.333", "explanation": "σ²/(1 − φ²) = 1/0.75."},
    {"type": "number", "prompt": "A GARCH(1,1) has ω = 0.00001, α = 0.1 and β = 0.85. What is its long-run daily variance?",
     "answer": 0.0002, "explanation": "ω/(1 − α − β) = 0.00001/0.05 = 0.0002, i.e. about 1.41% daily volatility."},
    {"type": "choice", "prompt": "What is the null hypothesis of the augmented Dickey–Fuller test?",
     "choices": ["The series has a unit root (non-stationary)", "The series is stationary", "The residuals are normal", "There is no autocorrelation"],
     "answer": 0, "explanation": "Rejecting ADF's null is evidence of stationarity; KPSS has the opposite null."},
    {"type": "number", "prompt": "A random walk has i.i.d. steps with variance 1. What is the variance of its position after 100 steps?",
     "answer": 100, "explanation": "Variances of independent steps add: 100 × 1."},
    {"type": "choice", "prompt": "You regress one stock's price level on another's and get R² = 0.9 and t = 40. What's the most likely issue?",
     "choices": ["Spurious regression between two non-stationary series", "Heteroskedasticity", "Too few observations", "Nothing; the relationship is strong"],
     "answer": 0, "explanation": "Two independent random walks routinely produce huge R² and t-stats. Test the residual for stationarity (cointegration) or regress returns instead."},
    {"type": "open", "prompt": "How would you check whether a spread between two assets is tradably mean-reverting?",
     "explanation": "Establish an economic reason first. Then: estimate the hedge ratio on a training window; test the spread for stationarity (Engle–Granger/coint or Johansen, plus ADF and KPSS on the spread); estimate the half-life from an AR(1)/OU fit (it must be short relative to your horizon and costs); check stability with rolling estimates and out-of-sample re-tests; backtest an entry/exit rule with costs; and be wary of multiple testing if you scanned many pairs."},
]


def _screen_frame(seed, n=800):
    px = gbm(n, seed=seed)
    return pd.DataFrame({"price": px, "log_return": np.log(px).diff().fillna(0.0),
                         "ar_0.7": ar1(n, 0.7, seed=seed + 1).to_numpy(),
                         "random_walk": np.cumsum(np.random.default_rng(seed + 2).standard_normal(n))}, index=px.index)


_NLL = '''def garch_mle(returns) -> dict:
    y = 100 * np.asarray(returns, dtype=float)

    def neg_loglik(params):
        omega, alpha, beta = params
        s2 = np.empty(len(y))
        s2[0] = np.mean(y**2)
        for t in range(1, len(y)):
            s2[t] = omega + alpha * y[t - 1] ** 2 + beta * s2[t - 1]
        return 0.5 * np.sum(np.log(2 * np.pi * s2) + y**2 / s2)

    res = minimize(neg_loglik, x0=[0.1, 0.05, 0.9], method="L-BFGS-B", bounds=[(1e-6, None), (0, 1), (0, 1)])
    omega, alpha, beta = res.x
    return {"omega": omega, "alpha": alpha, "beta": beta, "loglik": -res.fun, "persistence": alpha + beta}
'''

PROBLEMS = [
    {
        "id": "r6_ar1",
        "title": "Fit an AR(1) and its half-life with statsmodels",
        "difficulty": "Easy",
        "libs": ["statsmodels"],
        "fn": "fit_ar1",
        "description": r"""
Fit an AR(1) with `statsmodels.tsa.ar_model.AutoReg(x, lags=1).fit()` and return a dict:

- `const`, `phi`: the fitted intercept and lag coefficient (`res.params`, in that order)
- `sigma`: the residual standard deviation, $\sqrt{\text{res.sigma2}}$
- `mean`: the implied long-run mean, const / (1 − φ)
- `half_life`: $\ln 0.5/\ln\phi$ if 0 < φ < 1, otherwise `inf`

### Learn
AutoReg uses conditional least squares, so it matches an OLS regression of $x_t$ on $[1, x_{t-1}]$ (try it with `np.polyfit`). Half-lives turn an abstract coefficient into a trading horizon: a spread with a 5-day half-life suits a short-term strategy, while one with a 200-day half-life will tie up capital for a year.

Passing a NumPy array (`np.asarray(x)`) avoids statsmodels' date-frequency warnings.
""",
        "starter": '''import numpy as np
from statsmodels.tsa.ar_model import AutoReg


def fit_ar1(x) -> dict:
    # return {"const": ..., "phi": ..., "sigma": ..., "mean": ..., "half_life": ...}
    pass
''',
        "solution": '''import numpy as np
from statsmodels.tsa.ar_model import AutoReg


def fit_ar1(x) -> dict:
    res = AutoReg(np.asarray(x, dtype=float), lags=1).fit()
    const, phi = res.params
    half_life = np.log(0.5) / np.log(phi) if 0 < phi < 1 else float("inf")
    return {"const": const, "phi": phi, "sigma": np.sqrt(res.sigma2), "mean": const / (1 - phi), "half_life": half_life}
''',
        "hints": ["`res.params` is an array [const, phi] when you pass a NumPy array."],
        "cases": lambda: [
            {"name": "OU spread (true φ = 0.9, mean 5)", "sample": True, "args": (ar1(1000, 0.9, c=0.5, seed=1),)},
            {"name": "slow mean reversion (φ = 0.98)", "args": (ar1(2000, 0.98, seed=2),)},
            {"name": "random walk (φ ≈ 1)", "args": (np.cumsum(np.random.default_rng(3).standard_normal(1000)),)},
        ],
    },
    {
        "id": "r6_screen",
        "title": "Stationarity screen across series",
        "difficulty": "Medium",
        "libs": ["statsmodels", "pandas"],
        "fn": "stationarity_screen",
        "description": r"""
Screen every column of a DataFrame. For each, run ADF (`adfuller(x, regression="c", autolag="AIC")`) and KPSS (`kpss(x, regression="c", nlags="auto")`), silencing their warnings. Return a DataFrame indexed by column name with:

- `adf_stat`, `adf_p`, `kpss_p`
- `verdict`: `"stationary"` if adf_p < 0.05 and kpss_p ≥ 0.05; `"unit root"` if adf_p ≥ 0.05 and kpss_p < 0.05; otherwise `"inconclusive"`

### Learn
Run this kind of screen before feeding series into any model: prices and random walks should come out as unit roots, returns and AR processes as stationary. On real data, run it on candidate features too; trending features like raw price levels or cumulative volumes will fail it, which is your cue to transform them (returns, ratios, z-scores, fractional differences).
""",
        "starter": '''import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller, kpss


def stationarity_screen(df: pd.DataFrame) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller, kpss


def stationarity_screen(df: pd.DataFrame) -> pd.DataFrame:
    rows = {}
    for col in df.columns:
        x = df[col].dropna().to_numpy()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            adf_stat, adf_p = adfuller(x, regression="c", autolag="AIC")[:2]
            kpss_p = kpss(x, regression="c", nlags="auto")[1]
        if adf_p < 0.05 and kpss_p >= 0.05:
            verdict = "stationary"
        elif adf_p >= 0.05 and kpss_p < 0.05:
            verdict = "unit root"
        else:
            verdict = "inconclusive"
        rows[col] = {"adf_stat": adf_stat, "adf_p": adf_p, "kpss_p": kpss_p, "verdict": verdict}
    return pd.DataFrame.from_dict(rows, orient="index")
''',
        "hints": ["Collect one dict per column and build the DataFrame with `from_dict(..., orient='index')`."],
        "cases": lambda: [
            {"name": "price, return, AR(1), random walk", "sample": True, "args": (_screen_frame(1),)},
            {"name": "another draw", "args": (_screen_frame(5, 1200),)},
        ],
    },
    {
        "id": "r6_garch_mle",
        "title": "Estimate GARCH(1,1) by maximum likelihood",
        "difficulty": "Hard",
        "libs": ["scipy.optimize", "numpy"],
        "fn": "garch_mle",
        "description": r"""
Fit a zero-mean GARCH(1,1) with normal shocks yourself, the way any GARCH library does internally:

1. work in percent: $y_t = 100\,r_t$
2. variance recursion: $\sigma_0^2 = \text{mean}(y^2)$, $\sigma_t^2 = \omega + \alpha y_{t-1}^2 + \beta\sigma_{t-1}^2$
3. negative log-likelihood: $\frac12\sum_t\left(\ln(2\pi\sigma_t^2) + y_t^2/\sigma_t^2\right)$
4. minimize it with `scipy.optimize.minimize(nll, x0=[0.1, 0.05, 0.9], method="L-BFGS-B", bounds=[(1e-6, None), (0, 1), (0, 1)])`

Return a dict: `omega` (in percent² units), `alpha`, `beta`, `loglik` (the maximized log-likelihood, i.e. −res.fun) and `persistence` (α + β). Results are checked to 0.1%.

### Learn
The test data was simulated with known parameters (α = 0.08, β = 0.9), so you can see how well MLE recovers them from a few years of data: persistence comes out accurately, while α and β individually are noisier. That's typical, and it's why GARCH forecasts are more reliable than its individual coefficients.

The recursion is a Python loop inside the objective, so each likelihood evaluation takes milliseconds. Fine here; libraries compile it.
""",
        "starter": '''import numpy as np
from scipy.optimize import minimize


def garch_mle(returns) -> dict:
    # return {"omega": ..., "alpha": ..., "beta": ..., "loglik": ..., "persistence": ...}
    pass
''',
        "solution": "import numpy as np\nfrom scipy.optimize import minimize\n\n\n" + _NLL,
        "hints": ["Write the negative log-likelihood as a function of one parameter vector, then hand it to `minimize`."],
        "rtol": 1e-3,
        "atol": 1e-4,
        "timeout": 300,
        "cases": lambda: [
            {"name": "6 years of GARCH returns", "sample": True, "args": (garch_returns(1500, seed=1),)},
            {"name": "another sample", "args": (garch_returns(1000, omega=5e-6, alpha=0.1, beta=0.85, seed=2),)},
        ],
    },
    {
        "id": "r6_forecast_eval",
        "title": "Out-of-sample AR forecasts versus naive",
        "difficulty": "Medium",
        "libs": ["statsmodels", "numpy"],
        "fn": "ar_forecast_eval",
        "description": r"""
Evaluate an AR(1) forecast honestly. With `x` a series and `train` the number of training observations:

1. fit `AutoReg(x[:train], lags=1)` on the training part only (pass a NumPy array)
2. one-step forecasts for t = train … n − 1 using the **fixed** fitted parameters: $\hat x_t = c + \phi\,x_{t-1}$
3. baselines on the same dates: naive $x_{t-1}$, and the training mean
4. return a dict with `rmse_ar`, `rmse_naive`, `rmse_mean`, and `skill` = 1 − rmse_ar / min(rmse_naive, rmse_mean)

### Learn
Every forecast uses parameters estimated before the test period and data up to $t-1$, so it's a genuine out-of-sample test. On a mean-reverting spread the AR model beats both baselines. On a random walk, the naive forecast is already optimal and the AR model can't add skill. Seeing skill ≈ 0 where there's nothing to find is as important as seeing it where there is.
""",
        "starter": '''import numpy as np
from statsmodels.tsa.ar_model import AutoReg


def ar_forecast_eval(x, train: int) -> dict:
    # return {"rmse_ar": ..., "rmse_naive": ..., "rmse_mean": ..., "skill": ...}
    pass
''',
        "solution": '''import numpy as np
from statsmodels.tsa.ar_model import AutoReg


def ar_forecast_eval(x, train: int) -> dict:
    x = np.asarray(x, dtype=float)
    c, phi = AutoReg(x[:train], lags=1).fit().params
    actual, prev = x[train:], x[train - 1:-1]
    rmse = lambda f: np.sqrt(np.mean((actual - f) ** 2))
    r_ar, r_naive, r_mean = rmse(c + phi * prev), rmse(prev), rmse(x[:train].mean())
    return {"rmse_ar": r_ar, "rmse_naive": r_naive, "rmse_mean": r_mean, "skill": 1 - r_ar / min(r_naive, r_mean)}
''',
        "hints": ["`x[train - 1:-1]` lines up the previous value with each test date."],
        "cases": lambda: [
            {"name": "mean-reverting spread (φ = 0.8)", "sample": True, "args": (ar1(1000, 0.8, seed=1), 700)},
            {"name": "random walk", "args": (np.cumsum(np.random.default_rng(2).standard_normal(1000)), 700)},
            {"name": "slow mean reversion", "args": (ar1(1500, 0.97, c=0.3, seed=3), 1000)},
        ],
    },
]
