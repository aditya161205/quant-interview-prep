import numpy as np
import pandas as pd

from data import sv_ohlc

TITLE = "Volatility forecasting and the variance risk premium"
SUMMARY = "Range-based volatility estimators, the HAR model in statsmodels, honest forecast evaluation (QLIKE, Mincer–Zarnowitz), and measuring the premium that option sellers earn."
KIND = "core"

LESSON = r"""
An option's price is a bet on future volatility. Options researchers therefore spend much of their time on one question: **how much will this asset actually move**, compared with what implied volatility says? This step builds the forecasting toolkit and measures the gap, the variance risk premium.

## Measuring volatility

Volatility isn't observed; it's estimated.
- **Close-to-close**: the standard deviation of daily log returns. Simple, but it ignores everything that happened during the day.
- **Range-based** estimators use the high and low, which carry much more information: **Parkinson** $\hat\sigma^2 = \frac{1}{4\ln 2}\overline{\ln(H/L)^2}$, **Garman–Klass** (adds open and close), **Rogers–Satchell** (robust to drift). For the same window they are several times more efficient, but they miss the overnight gap and are biased by discrete trading.
- **Realized variance**: the sum of squared intraday returns (e.g. every 5 minutes) plus the overnight return. The modern standard: nearly an error-free measure of the day's variance, apart from microstructure noise.

## Forecasting volatility

Volatility clusters and is highly persistent, with a slowly decaying autocorrelation (long memory).
- **EWMA** (RiskMetrics, λ = 0.94): $\sigma^2_t = \lambda\sigma^2_{t-1} + (1-\lambda)r_t^2$. One parameter, decent, but its decay is too fast.
- **GARCH(1,1)**: mean reversion to a long-run level; you estimated it by MLE in the time-series step.
- **HAR-RV** (Corsi, 2009): regress future realized variance on its daily, weekly and monthly averages. Three horizons mimic long memory, it's estimated by OLS, and it's remarkably hard to beat. Working in logs keeps forecasts positive and the errors better behaved.
- **Implied volatility** is itself a forecast, the market's, and a strong one, but biased upward by the risk premium below.
- Machine learning (gradient boosting on HAR-style features, implied vol, returns, macro) can add a little on top; the capstone tests that.

## Evaluating forecasts honestly

- Compare forecasts with a **realized** measure over the same horizon, out of sample.
- **QLIKE** loss, $\frac{RV}{F} - \ln\frac{RV}{F} - 1$, is robust to noise in the realized proxy (Patton, 2011) and punishes under-forecasting more than over-forecasting, which matters when you're selling options.
- **Mincer–Zarnowitz** regression: realized = α + β × forecast. An unbiased forecast has α = 0 and β = 1; R² measures how much it explains. With overlapping multi-day targets, use HAC standard errors.

## The variance risk premium

Implied variance exceeds subsequently realized variance on average, for indices and most stocks: option buyers pay for insurance, and sellers demand compensation for crash risk. Selling variance (short variance swaps, or delta-hedged short straddles) therefore earns money most months, and loses a lot occasionally. The P&L is strongly **negatively skewed**: February 2018 wiped out short-volatility products overnight, and March 2020 did it again. Harvesting the premium is about sizing, diversification and tail hedges as much as about the premium itself.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Every day for a month, ln(H/L) = 0.02. What annualized volatility, in %, does the Parkinson estimator give?",
     "answer": 0.02 / np.sqrt(4 * np.log(2)) * np.sqrt(252) * 100, "tol": 0.01, "display": "≈ 19.1%",
     "explanation": "Daily variance = 0.02²/(4 ln 2) = 0.000144, so daily vol ≈ 1.20% and annualized vol ≈ 1.20% × √252 ≈ 19.1%."},
    {"type": "choice", "prompt": "Why does the HAR model use daily, weekly and monthly realized variance as regressors?",
     "choices": ["The three horizons approximate the slowly decaying, long-memory autocorrelation of volatility with a simple linear model", "To remove the day-of-week effect",
                 "Because realized variance is only available weekly", "To make the regression stationary"],
     "answer": 0, "explanation": "Volatility shocks die out slowly. A cascade of averages over different horizons captures that persistence with only four OLS coefficients."},
    {"type": "choice", "prompt": "Why is QLIKE often preferred to mean squared error for evaluating volatility forecasts?",
     "choices": ["It ranks forecasts consistently even when the realized-variance proxy is noisy, and it penalizes under-forecasting more", "It's always smaller than MSE",
                 "It doesn't need a realized measure", "It works only for daily forecasts"],
     "answer": 0, "explanation": "Patton (2011) showed MSE and QLIKE are robust to proxy noise; QLIKE also depends only on the ratio RV/F, so high-vol periods don't dominate the score."},
    {"type": "number", "prompt": "A stock's 1-month implied vol is 20% and the vol realized over that month is 16%. What was the variance risk premium, in annualized variance points (vol² × 10,000)?",
     "answer": 144, "explanation": "0.20² − 0.16² = 0.04 − 0.0256 = 0.0144, which is 144 variance points."},
    {"type": "choice", "prompt": "A Mincer–Zarnowitz regression of realized variance on implied variance gives α ≈ 0 and β ≈ 0.75. What does that say?",
     "choices": ["Implied variance is informative but too high on average: it embeds a risk premium", "Implied variance is an unbiased forecast",
                 "Implied variance underestimates realized variance", "The regression is invalid"],
     "answer": 0, "explanation": "β < 1 with α ≈ 0 means realized variance comes out at about three quarters of implied variance: the forecast is biased upward, the signature of a variance risk premium."},
    {"type": "open", "prompt": "Explain the variance risk premium and how you would harvest it without blowing up.",
     "explanation": "Implied variance exceeds expected realized variance because investors pay for crash protection and sellers demand compensation for tail risk. Harvesting: sell variance (variance swaps, delta-hedged straddles or strangles, put spreads). Risk control: size by stressed loss rather than by volatility; diversify across underlyings and expiries; prefer defined-risk structures or buy tail hedges (far OTM puts, VIX calls); scale exposure down when implied vol is low relative to realized or when the term structure inverts; account for costs, margin and liquidity in stress, when everyone tries to cover at once."},
]


def _ohlc(seed):
    return sv_ohlc(seed=seed)


def _har_inputs(seed):
    return (_ohlc(seed)["rv"],)


_HAR = '''def har_forecast(rv: pd.Series, horizon: int = 21, first_train: int = 500, refit_every: int = 21) -> pd.Series:
    X = pd.DataFrame({"d": np.log(rv), "w": np.log(rv.rolling(5).mean()), "m": np.log(rv.rolling(22).mean())})
    y = np.log(rv[::-1].rolling(horizon).mean()[::-1].shift(-1))
    preds = []
    for k in range(first_train, len(rv), refit_every):
        train = X.iloc[:k - horizon + 1].assign(y=y.iloc[:k - horizon + 1]).dropna()
        fit = sm.OLS(train["y"], sm.add_constant(train[["d", "w", "m"]])).fit()
        test = X.iloc[k:k + refit_every].dropna()
        preds.append(fit.predict(sm.add_constant(test, has_constant="add")))
    return pd.concat(preds)
'''


def _eval_inputs(seed):
    o = _ohlc(seed)
    ns = {}
    exec("import numpy as np\nimport pandas as pd\nimport statsmodels.api as sm\n\n\n" + _HAR, ns)
    har = ns["har_forecast"](o["rv"])
    target = np.log(o["rv"][::-1].rolling(21).mean()[::-1].shift(-1)).reindex(har.index)
    r = np.log(o["close"]).diff()
    ewma = np.log((r**2).ewm(alpha=0.06, adjust=False).mean()).reindex(har.index)
    implied = np.log(o["iv"] ** 2 / 252).reindex(har.index)
    return target, {"har": har, "ewma": ewma, "implied": implied}


PROBLEMS = [
    {
        "id": "r18_estimators",
        "title": "Close-to-close versus range-based volatility",
        "difficulty": "Easy",
        "libs": ["pandas", "numpy"],
        "fn": "vol_estimators",
        "description": r"""
From daily `open`, `high`, `low`, `close` columns, compute four rolling annualized volatility estimates over `window` days. With daily terms

- close-to-close: $c_t = \ln(C_t/C_{t-1})$, estimate = rolling std (ddof=1) × √252
- Parkinson: $\frac{\ln(H/L)^2}{4\ln 2}$
- Garman–Klass: $\frac12\ln(H/L)^2 - (2\ln 2 - 1)\ln(C/O)^2$
- Rogers–Satchell: $\ln(H/C)\ln(H/O) + \ln(L/C)\ln(L/O)$

the last three are √(rolling mean × 252). Return a DataFrame with columns `close_to_close`, `parkinson`, `garman_klass`, `rogers_satchell`.

### Learn
The data also has `rv` (realized variance from intraday returns, including the overnight move): compare each estimator with `np.sqrt(252 * rv.rolling(21).mean())` in a notebook. The range estimators track it much more smoothly than close-to-close, but they sit lower on average, because they can't see the overnight gap (about 15% of the variance here). On real stocks the overnight share is often larger, which is why Yang–Zhang adds the overnight return back in.
""",
        "starter": '''import numpy as np
import pandas as pd


def vol_estimators(ohlc: pd.DataFrame, window: int = 21) -> pd.DataFrame:
    # return a DataFrame with columns close_to_close, parkinson, garman_klass, rogers_satchell
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def vol_estimators(ohlc: pd.DataFrame, window: int = 21) -> pd.DataFrame:
    o, h, l, c = (np.log(ohlc[x]) for x in ("open", "high", "low", "close"))
    hl, co = h - l, c - o
    daily = {"parkinson": hl**2 / (4 * np.log(2)),
             "garman_klass": 0.5 * hl**2 - (2 * np.log(2) - 1) * co**2,
             "rogers_satchell": (h - c) * (h - o) + (l - c) * (l - o)}
    out = {"close_to_close": c.diff().rolling(window).std() * np.sqrt(252)}
    out.update({k: np.sqrt(v.rolling(window).mean() * 252) for k, v in daily.items()})
    return pd.DataFrame(out)
''',
        "hints": ["Take logs of the four price columns once; every estimator is a combination of their differences."],
        "cases": lambda: [
            {"name": "one stock, 21-day window", "sample": True, "args": (_ohlc(1),)},
            {"name": "63-day window", "args": (_ohlc(2), 63)},
            {"name": "no look-ahead", "lookahead": 800, "args": (_ohlc(3),)},
        ],
    },
    {
        "id": "r18_har",
        "title": "HAR forecasts of realized variance with statsmodels",
        "difficulty": "Medium",
        "libs": ["statsmodels", "pandas", "numpy"],
        "fn": "har_forecast",
        "description": r"""
Forecast the average realized variance over the next `horizon` days with a log-HAR model, out of sample.

1. features at day t: `d` = ln rv_t, `w` = ln(mean of rv over the last 5 days), `m` = ln(mean over the last 22 days) (full windows)
2. target at t: y_t = ln(mean of rv over t+1 … t+horizon), i.e. `np.log(rv[::-1].rolling(horizon).mean()[::-1].shift(-1))`
3. for k in `range(first_train, len(rv), refit_every)`: fit `sm.OLS(y, sm.add_constant(X))` on rows 0 … k − horizon (the targets already known at day k) with complete data, then predict rows k … k + refit_every − 1 that have complete features

Return one Series of predictions (log variance), indexed by date.

### Learn
Why stop training at row k − horizon? The target at row i uses rv up to i + horizon, so at day k only targets up to row k − horizon are fully observed: the same purge as in the ML capstone. Print a fitted model's `params`: the monthly component usually carries the most weight, the signature of long memory. The forecast is for log variance; exp(forecast) slightly underestimates mean variance (Jensen's inequality), which the evaluation in the next task will show up as bias.
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def har_forecast(rv: pd.Series, horizon: int = 21, first_train: int = 500, refit_every: int = 21) -> pd.Series:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nimport statsmodels.api as sm\n\n\n" + _HAR,
        "hints": ["Build X and y for the whole series once, then slice rows inside the loop.",
                  "`sm.add_constant(test, has_constant='add')` keeps the constant column even for a short test block."],
        "rtol": 1e-7,
        "cases": lambda: [
            {"name": "monthly horizon", "sample": True, "args": _har_inputs(1)},
            {"name": "weekly horizon, quarterly refits", "args": (_ohlc(2)["rv"], 5, 400, 63)},
            {"name": "no look-ahead", "lookahead": 1000, "args": _har_inputs(3)},
        ],
    },
    {
        "id": "r18_evaluate",
        "title": "Evaluate volatility forecasts: QLIKE and Mincer–Zarnowitz",
        "difficulty": "Medium",
        "libs": ["statsmodels", "pandas", "numpy"],
        "fn": "evaluate_vol_forecasts",
        "description": r"""
`target` is the realized log variance over each forecast's horizon; `forecasts` maps a model name to a Series of log-variance forecasts. For each model, on the dates where both exist:

- `mse`: mean squared error in logs
- `qlike`: mean of $\frac{RV}{F} - \ln\frac{RV}{F} - 1$ with RV = exp(target) and F = exp(forecast)
- `alpha`, `beta`, `r2`: the Mincer–Zarnowitz regression `sm.OLS(target, sm.add_constant(forecast)).fit(cov_type="HAC", cov_kwds={"maxlags": horizon - 1})`

Return a DataFrame indexed by model name.

### Learn
The tests compare three forecasts of the next month's variance: HAR, EWMA (λ = 0.94) and the option market's implied variance. Expect HAR to beat EWMA on both losses, and implied variance to be informative (high R²) yet biased: its forecasts sit above realized variance by the risk premium, so its QLIKE suffers and its regression line is shifted. That bias is exactly what the next task measures, and what option sellers get paid for.
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def evaluate_vol_forecasts(target: pd.Series, forecasts: dict, horizon: int = 21) -> pd.DataFrame:
    # return a DataFrame indexed by model with columns mse, qlike, alpha, beta, r2
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def evaluate_vol_forecasts(target: pd.Series, forecasts: dict, horizon: int = 21) -> pd.DataFrame:
    rows = {}
    for name, f in forecasts.items():
        d = pd.concat({"y": target, "f": f}, axis=1).dropna()
        ratio = np.exp(d["y"] - d["f"])
        fit = sm.OLS(d["y"], sm.add_constant(d["f"])).fit(cov_type="HAC", cov_kwds={"maxlags": horizon - 1})
        rows[name] = {"mse": ((d["y"] - d["f"]) ** 2).mean(), "qlike": (ratio - np.log(ratio) - 1).mean(),
                      "alpha": fit.params.iloc[0], "beta": fit.params.iloc[1], "r2": fit.rsquared}
    return pd.DataFrame.from_dict(rows, orient="index")
''',
        "hints": ["`pd.concat({'y': target, 'f': f}, axis=1).dropna()` aligns the two Series."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "HAR vs EWMA vs implied", "sample": True, "args": _eval_inputs(1)},
            {"name": "another stock", "args": _eval_inputs(4)},
        ],
    },
    {
        "id": "r18_vrp",
        "title": "Measure the variance risk premium",
        "difficulty": "Medium",
        "libs": ["statsmodels", "pandas", "numpy"],
        "fn": "vrp_study",
        "description": r"""
`iv` is the daily 1-month implied vol (annualized) and `rv` the daily realized variance. In variance points (annualized variance × 10,000):

1. realized forward variance at t: 252 × mean of rv over t+1 … t+horizon
2. VRP_t = iv_t² − realized forward variance; drop dates where it's unknown
3. `vrp_mean` and its `vrp_t`: the t-stat of the mean with HAC errors (`sm.OLS(vrp, np.ones(len(vrp))).fit(cov_type="HAC", cov_kwds={"maxlags": horizon - 1})`), since overlapping months make daily values autocorrelated
4. a **short 1-month variance swap** entered every `horizon` days (starting with the first date): its P&L is that date's VRP. `swap_pnl` = those values, then `sharpe` (mean/std × √(252/horizon)), `skew` (pandas `skew()`), `worst` and `hit_rate` (fraction positive)

Return a dict with `vrp_mean`, `vrp_t`, `swap_pnl`, `sharpe`, `skew`, `worst`, `hit_rate`.

### Learn
On the sample stock, expect a clearly positive premium with a t-stat near 3, a high hit rate, and a strongly negative skew with a worst month many times the average gain: the shape of every short-volatility strategy. The second test stock is the warning: one vol spike wipes out its entire average premium over six years. The disasters come from spikes that implied vol didn't price in advance. Before building a strategy on this, ask how you'd survive the worst month at the size you'd want to trade, and why diversifying across many underlyings (the capstone) helps.
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def vrp_study(iv: pd.Series, rv: pd.Series, horizon: int = 21) -> dict:
    # return {"vrp_mean": ..., "vrp_t": ..., "swap_pnl": ..., "sharpe": ..., "skew": ..., "worst": ..., "hit_rate": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def vrp_study(iv: pd.Series, rv: pd.Series, horizon: int = 21) -> dict:
    realized = 252 * rv[::-1].rolling(horizon).mean()[::-1].shift(-1)
    vrp = (1e4 * (iv**2 - realized)).dropna()
    t = sm.OLS(vrp.to_numpy(), np.ones(len(vrp))).fit(cov_type="HAC", cov_kwds={"maxlags": horizon - 1}).tvalues[0]
    pnl = vrp.iloc[::horizon]
    return {"vrp_mean": vrp.mean(), "vrp_t": t, "swap_pnl": pnl, "sharpe": pnl.mean() / pnl.std() * np.sqrt(252 / horizon),
            "skew": pnl.skew(), "worst": pnl.min(), "hit_rate": (pnl > 0).mean()}
''',
        "hints": ["Reverse the series, take a rolling mean, reverse back and shift by one to get the mean over the *next* days."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "one stock, monthly", "sample": True, "args": (_ohlc(1)["iv"], _ohlc(1)["rv"])},
            {"name": "another stock", "args": (_ohlc(5)["iv"], _ohlc(5)["rv"])},
        ],
    },
]
