from functools import lru_cache

import numpy as np
import pandas as pd

from data import vol_universe

TITLE = "Capstone: options volatility strategy"
SUMMARY = "Messy option-implied and realized data for 30 stocks to a delta-hedged, cost-aware volatility strategy in eight parts: cleaning, HAR features, purged walk-forward forecasts (OLS vs LightGBM), a straddle backtest engine, variance-premium portfolios, tail-risk metrics, final report."
KIND = "capstone"

LESSON = r"""
The options counterpart of the equity capstone, and the project to present for options and volatility research roles. You'll forecast realized volatility for 30 stocks, compare the forecasts with implied volatility to find where options are rich or cheap, trade delta-hedged straddles on that view, and judge the result the way a vol fund would: by its tails as much as its Sharpe ratio.

## The pipeline

```text
raw daily data: close, realized variance, 1-month implied vol (30 stocks)
  ↓ Part 1  clean: implied vols quoted in percent, gaps
  ↓ Part 2  HAR features, implied variance, leak-free 21-day labels
  ↓ Part 3  purged walk-forward forecasts: HAR, HAR + implied, LightGBM
  ↓ Part 4  forecast evaluation: R², QLIKE, bias
  ↓ Part 5  straddle engine: monthly ATM straddles, delta-hedged daily, costs
  ↓ Part 6  portfolios: short everything, short the richest, rich-vs-cheap
  ↓ Part 7  metrics for short-vol P&L: skew, worst month, CVaR, drawdown, deflated Sharpe
  ↓ Part 8  one call that produces the final report
```

## The data

`data.vol_universe(2000, 30, messy=True)`: eight years of daily data for 30 stocks with stochastic volatility (slow market and stock factors, a fast factor with a leverage effect, rare market-wide vol spikes with sell-offs). Each day has the close, the realized variance from intraday returns, and the 1-month ATM implied vol. Implied variance equals the expected variance over the next month times (1 + a premium) that averages 20% and drifts slowly per stock, so some stocks' options are persistently richer than others'. Your pipeline sees none of that directly.

## Decisions you'll have to defend

| decision | why |
|---|---|
| forecast log realized variance, pooled across stocks | volatility is lognormal-ish; pooling gives the regression enough data |
| purge 21 days before each training cutoff | a 21-day label overlaps the test period otherwise |
| HAR as the baseline | simple, robust and hard to beat; anything fancier must earn its keep |
| measure the premium with the HAR forecast | a forecast that uses implied vol absorbs part of the premium you're trying to measure |
| delta-hedged straddles held to expiry | isolates volatility exposure; P&L ≈ vega × (implied − realized) |
| P&L in vol points per unit of vega | makes stocks with different vol levels comparable |
| costs in vol points | single-stock options are expensive to trade; the half-spread decides what's tradable |
| tail metrics and deflated Sharpe | short-vol returns are negatively skewed; Sharpe alone hides the risk |

## After you finish

1. Present it in five minutes with the structure from the researcher interview playbook, leading with the rich/cheap result and its tails.
2. Extensions worth trying: weekly rather than monthly entries, strangles or put spreads instead of straddles, vega-weighted sizing by forecast confidence, a market-vol filter that cuts exposure after spikes, and costs of 1 vol point per side.
3. On real data, the ingredients are daily implied vols (e.g. 30-day ATM from an options vendor) and realized variance from intraday or OHLC data; the structure of the pipeline doesn't change.
"""

QUESTIONS = [
    {"type": "number", "prompt": "You sell a 1-month ATM straddle at 30 implied vol and delta-hedge it daily. Volatility realized over the month is 25. Roughly how many vol points per unit of vega do you make?",
     "answer": 5, "tol": 0.1, "display": "≈ 5 (more precisely (0.30² − 0.25²)/(2 × 0.30) ≈ 4.6)",
     "explanation": "A delta-hedged option earns about vega × (implied − realized vol), here 5 vol points. The gamma P&L is really driven by variance, so the precise figure is (σᵢ² − σᵣ²)/(2σᵢ) × 100 ≈ 4.6, and path effects (when the big moves happen relative to gamma) add noise."},
    {"type": "choice", "prompt": "Why does a rich-versus-cheap volatility book (short the richest straddles, long the cheapest) have far smaller tail losses than shorting every straddle?",
     "choices": ["Its long straddles gain in a market-wide vol spike, offsetting the short side: the book is roughly vega-neutral", "It trades less often",
                 "Cheap options can't lose money", "Its positions are smaller"],
     "answer": 0, "explanation": "A vol spike hits every short straddle at once. Holding long volatility in the cheapest names hedges that common factor, leaving mostly the relative mispricing, which is what the signal predicts."},
    {"type": "open", "prompt": "The forecast that uses implied vol is your most accurate, yet the signal built from the HAR-only forecast trades at least as well. Explain.",
     "explanation": "The signal is implied variance minus forecast realized variance, an estimate of the premium. If the forecast itself leans on implied vol, a rich option (high premium) pulls the forecast up and the measured gap shrinks: the forecast absorbs part of the premium. To measure mispricing, forecast with information that excludes the price you're judging. Forecast accuracy and signal quality are different objectives."},
]

FEATURES = ["rv_d", "rv_w", "rv_m", "iv_var", "iv_rv", "ret_21"]

_CLEAN = '''def clean_vol_data(raw: pd.DataFrame, max_fill: int = 3) -> dict:
    rescale = raw["iv"] > 3
    df = raw.assign(iv=raw["iv"].where(~rescale, raw["iv"] / 100))
    wide = {c: df.pivot(index="date", columns="ticker", values=c) for c in ("close", "rv", "iv")}
    return {"close": wide["close"].ffill(limit=max_fill), "rv": wide["rv"], "iv": wide["iv"].ffill(limit=max_fill),
            "n_rescaled": int(rescale.sum())}
'''

_PANEL = '''FEATURES = ["rv_d", "rv_w", "rv_m", "iv_var", "iv_rv", "ret_21"]


def vol_panel(close: pd.DataFrame, rv: pd.DataFrame, iv: pd.DataFrame, horizon: int = 21) -> pd.DataFrame:
    cols = {"rv_d": np.log(rv), "rv_w": np.log(rv.rolling(5, min_periods=4).mean()),
            "rv_m": np.log(rv.rolling(22, min_periods=18).mean()), "iv_var": np.log(iv**2 / 252)}
    cols["iv_rv"] = cols["iv_var"] - cols["rv_m"]
    cols["ret_21"] = np.log(close / close.shift(21))
    cols["label"] = np.log(rv[::-1].rolling(horizon, min_periods=horizon).mean()[::-1].shift(-1))
    panel = pd.concat({k: v.stack() for k, v in cols.items()}, axis=1)
    panel.index.names = ["date", "ticker"]
    return panel.dropna(subset=FEATURES).sort_index()
'''

_FORECAST = '''FEATURES = ["rv_d", "rv_w", "rv_m", "iv_var", "iv_rv", "ret_21"]
COLUMNS = {"har": ["rv_d", "rv_w", "rv_m"], "har_iv": ["rv_d", "rv_w", "rv_m", "iv_var"], "lgbm": FEATURES}


def forecast_rv(panel: pd.DataFrame, model: str = "har", first_train: int = 504, retrain_every: int = 63, purge: int = 21) -> pd.Series:
    cols = COLUMNS[model]
    d = panel.index.get_level_values("date")
    dates = d.unique()
    out = []
    for k in range(first_train, len(dates), retrain_every):
        train = panel[(d <= dates[k - purge]) & panel["label"].notna()]
        test = panel[d.isin(dates[k:k + retrain_every])]
        if model == "lgbm":
            m = LGBMRegressor(n_estimators=300, learning_rate=0.03, num_leaves=15, min_child_samples=200, reg_lambda=5.0,
                              colsample_bytree=0.8, random_state=0, n_jobs=1, verbose=-1).fit(train[cols], train["label"])
            pred = m.predict(test[cols])
        else:
            fit = sm.OLS(train["label"], sm.add_constant(train[cols])).fit()
            pred = fit.predict(sm.add_constant(test[cols], has_constant="add"))
        out.append(pd.Series(np.asarray(pred), index=test.index))
    return pd.concat(out).rename(model)
'''

_EVAL = '''def evaluate_forecasts(preds: dict, panel: pd.DataFrame) -> pd.DataFrame:
    rows = {}
    for name, p in preds.items():
        y = panel["label"].reindex(p.index)
        ok = y.notna()
        e = y[ok] - p[ok]
        rows[name] = {"r2": 1 - (e**2).sum() / ((y[ok] - y[ok].mean()) ** 2).sum(), "mse": (e**2).mean(),
                      "qlike": (np.exp(e) - e - 1).mean(), "bias": e.mean()}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_STRADDLE = '''def straddle_pnl(close: pd.DataFrame, iv: pd.DataFrame, entries, days: int = 21, spread_vp: float = 0.5,
                 cost_bps: float = 1.0) -> dict:
    T0 = days / 252
    tau = ((days - np.arange(days)) / 252)[:, None]
    gross, costs = {}, {}
    for e in entries:
        i = close.index.get_loc(e)
        if i + days >= len(close):
            break
        S = close.iloc[i:i + days + 1].to_numpy()
        sig = iv.iloc[i].to_numpy()
        K = S[0]
        delta = 2 * norm.cdf((np.log(S[:-1] / K) + 0.5 * sig**2 * tau) / (sig * np.sqrt(tau))) - 1
        d1 = 0.5 * sig * np.sqrt(T0)
        premium = 2 * K * (2 * norm.cdf(d1) - 1)
        vega = 2 * K * norm.pdf(d1) * np.sqrt(T0) / 100
        pnl = np.abs(S[-1] - K) - premium - (delta * np.diff(S, axis=0)).sum(axis=0)
        trades = np.abs(np.diff(delta, axis=0, prepend=0.0))
        gross[e] = pd.Series(pnl / vega, index=close.columns)
        costs[e] = pd.Series((trades * S[:-1]).sum(axis=0) * cost_bps / 1e4 / vega + spread_vp, index=close.columns)
    return {"gross": pd.DataFrame.from_dict(gross, orient="index"), "cost": pd.DataFrame.from_dict(costs, orient="index")}
'''

_STRATS = '''def vol_strategies(signal: pd.DataFrame, gross: pd.DataFrame, cost: pd.DataFrame) -> pd.DataFrame:
    valid = signal.notna() & gross.notna() & cost.notna()
    rank = signal.where(valid).rank(axis=1, pct=True)
    short, long_ = (-gross - cost).where(valid), (gross - cost).where(valid)
    rich, cheap = short.where(rank > 2 / 3).mean(axis=1), long_.where(rank <= 1 / 3).mean(axis=1)
    return pd.DataFrame({"short_all": short.mean(axis=1), "short_rich": rich, "rich_cheap": (rich + cheap) / 2})
'''

_METRICS = '''def deflated_sharpe(returns, trial_sharpes) -> float:
    r = np.asarray(returns, dtype=float)
    sr = r.mean() / r.std(ddof=1)
    g3, g4 = stats.skew(r), stats.kurtosis(r, fisher=False)
    t = np.asarray(trial_sharpes, dtype=float)
    n, gamma = len(t), 0.5772156649015329
    sr0 = np.sqrt(t.var(ddof=1)) * ((1 - gamma) * stats.norm.ppf(1 - 1 / n) + gamma * stats.norm.ppf(1 - 1 / (n * np.e)))
    return float(stats.norm.cdf((sr - sr0) * np.sqrt(len(r) - 1) / np.sqrt(1 - g3 * sr + (g4 - 1) / 4 * sr**2)))


def vol_metrics(pnl: pd.Series, trial_sharpes) -> dict:
    cum = pnl.cumsum()
    tail = np.sort(pnl.to_numpy())[:max(1, int(np.ceil(0.05 * len(pnl))))]
    return {"sharpe": pnl.mean() / pnl.std() * np.sqrt(12), "mean": pnl.mean(), "skew": pnl.skew(), "worst": pnl.min(),
            "max_drawdown": (cum - cum.cummax()).min(), "cvar_5": tail.mean(), "hit_rate": (pnl > 0).mean(),
            "dsr": deflated_sharpe(pnl, trial_sharpes)}
'''

_RUN = '''def run_options_capstone(raw: pd.DataFrame, spread_vp: float = 0.5) -> dict:
    clean = clean_vol_data(raw)
    panel = vol_panel(clean["close"], clean["rv"], clean["iv"])
    preds = {m: forecast_rv(panel, m) for m in ("har", "har_iv", "lgbm")}
    table = evaluate_forecasts(preds, panel)
    entries = preds["har"].index.get_level_values("date").unique()[::21]
    pnl = straddle_pnl(clean["close"], clean["iv"], entries, spread_vp=spread_vp)
    implied = np.log(clean["iv"] ** 2 / 252)
    strats = {}
    for m, p in preds.items():
        F = p.unstack()
        signal = (implied.reindex(index=F.index, columns=F.columns) - F).reindex(pnl["gross"].index)
        strats[m] = vol_strategies(signal, pnl["gross"], pnl["cost"])
    sharpe = lambda x: x.mean() / x.std()
    trials = [sharpe(strats["har"]["short_all"])] + [sharpe(s[c]) for s in strats.values() for c in ("short_rich", "rich_cheap")]
    return {"n_rescaled": clean["n_rescaled"], "forecast_table": table,
            "signal_sharpe": pd.Series({m: sharpe(s["rich_cheap"]) * np.sqrt(12) for m, s in strats.items()}),
            "strategy_table": pd.DataFrame({c: vol_metrics(strats["har"][c], trials) for c in strats["har"]}).T}
'''

_IMPORTS = '''import numpy as np
import pandas as pd
import statsmodels.api as sm
from lightgbm import LGBMRegressor
from scipy import stats
from scipy.stats import norm


'''


@lru_cache(None)
def _ns():
    ns = {}
    exec(_IMPORTS + "\n\n".join([_CLEAN, _PANEL, _FORECAST, _EVAL, _STRADDLE, _STRATS, _METRICS, _RUN]), ns)
    return ns


@lru_cache(None)
def _raw(seed):
    return vol_universe(2000, 30, messy=True, seed=seed)


@lru_cache(None)
def _clean(seed):
    return _ns()["clean_vol_data"](_raw(seed))


@lru_cache(None)
def _panel(seed):
    c = _clean(seed)
    return _ns()["vol_panel"](c["close"], c["rv"], c["iv"])


@lru_cache(None)
def _preds(seed, model):
    return _ns()["forecast_rv"](_panel(seed), model)


@lru_cache(None)
def _pnl(seed):
    entries = _preds(seed, "har").index.get_level_values("date").unique()[::21]
    return _ns()["straddle_pnl"](_clean(seed)["close"], _clean(seed)["iv"], entries)


def _signal(seed, model):
    F = _preds(seed, model).unstack()
    implied = np.log(_clean(seed)["iv"] ** 2 / 252)
    return (implied.reindex(index=F.index, columns=F.columns) - F).reindex(_pnl(seed)["gross"].index)


@lru_cache(None)
def _strats(seed, model):
    p = _pnl(seed)
    return _ns()["vol_strategies"](_signal(seed, model), p["gross"], p["cost"])


def _metrics_args(seed, column):
    s = {m: _strats(seed, m) for m in ("har", "har_iv", "lgbm")}
    sr = lambda x: x.mean() / x.std()
    trials = [sr(s["har"]["short_all"])] + [sr(v[c]) for v in s.values() for c in ("short_rich", "rich_cheap")]
    return s["har"][column], trials


def _panel_causal(fn):
    c = _clean(3)
    close, rv, iv = c["close"].copy(), c["rv"].copy(), c["iv"].copy()
    cut = close.index[1200]
    base = fn(close.copy(), rv.copy(), iv.copy())
    noise = np.exp(np.random.default_rng(0).normal(0, 0.3, close.shape))
    late = close.index >= cut
    for df in (close, rv, iv):
        df.loc[late] = df.loc[late] * noise[late]
    after = fn(close, rv, iv)
    early = base[base.index.get_level_values("date") < cut]
    assert early.index.isin(after.index).all(), f"Rows dated before {cut:%Y-%m-%d} disappeared when only later data changed."
    assert np.allclose(after.loc[early.index, FEATURES].to_numpy(), early[FEATURES].to_numpy(), equal_nan=True), (
        f"Look-ahead bias: changing data from {cut:%Y-%m-%d} on changed features dated before it. "
        "Features at date t may only use data up to t (only the label looks ahead).")


def _purge_check(fn):
    panel = _panel(1).copy()
    d = panel.index.get_level_values("date")
    dates = d.unique()
    base = fn(panel.copy(), "har")
    unknown = d > dates[504 - 21]
    panel.loc[unknown, "label"] = np.random.default_rng(0).permutation(panel.loc[unknown, "label"].to_numpy())
    after = fn(panel, "har")
    first = base.index.get_level_values("date") < dates[504 + 63]
    assert np.allclose(np.asarray(after[first]), np.asarray(base[first])), (
        f"Label leakage: the first block's forecasts changed when only labels after {dates[504 - 21]:%Y-%m-%d} were scrambled. "
        "Those labels end inside the test period, so the first model must not train on them.")


PROBLEMS = [
    {
        "id": "r19_clean",
        "title": "Part 1 · Clean the volatility data",
        "difficulty": "Easy",
        "libs": ["pandas"],
        "fn": "clean_vol_data",
        "description": r"""
`raw` is a long table with columns `date`, `ticker`, `close`, `rv` (daily realized variance) and `iv` (1-month ATM implied vol, annualized). Clean it:

1. some implied vols were delivered **in percent** (25.3 instead of 0.253): divide any `iv` above 3 by 100 and count how many you fixed
2. pivot `close`, `rv` and `iv` to wide tables (dates × tickers)
3. forward-fill `close` and `iv` at most `max_fill` days; leave `rv` as it is (a missing realized variance shouldn't be invented)

Return a dict: `close`, `rv`, `iv` (wide DataFrames) and `n_rescaled` (int).

### Learn
Unit mismatches are among the most common real data errors: one vendor field in percent, another in decimals. A 2,530% implied vol would wreck every downstream number, and a rule this simple catches it because real implied vols essentially never exceed 300%. Forward-filling a quote for a day or two is harmless; forward-filling a *measurement* like realized variance would fabricate data.
""",
        "starter": '''import numpy as np
import pandas as pd


def clean_vol_data(raw: pd.DataFrame, max_fill: int = 3) -> dict:
    # return {"close": ..., "rv": ..., "iv": ..., "n_rescaled": ...}
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _CLEAN,
        "hints": ["`raw.pivot(index='date', columns='ticker', values='iv')` makes one wide table."],
        "cases": lambda: [
            {"name": "30 stocks, 8 years", "sample": True, "args": (_raw(1),)},
            {"name": "another universe, max_fill = 1", "args": (_raw(2), 1)},
        ],
    },
    {
        "id": "r19_features",
        "title": "Part 2 · HAR features and leak-free labels",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "vol_panel",
        "description": r"""
Build the modeling panel from the wide tables (dates × tickers):

| column | definition |
|---|---|
| `rv_d` | ln rv |
| `rv_w` | ln(5-day mean of rv), `rolling(5, min_periods=4)` |
| `rv_m` | ln(22-day mean of rv), `rolling(22, min_periods=18)` |
| `iv_var` | ln(iv² / 252), implied daily variance |
| `iv_rv` | `iv_var − rv_m` |
| `ret_21` | ln(close / close 21 days earlier) |
| `label` | ln(mean rv over the next `horizon` days, t+1 … t+horizon), full windows only |

Stack into a DataFrame with a `(date, ticker)` MultiIndex, drop rows where any feature (not the label) is NaN, and sort the index.

### Learn
Everything is in log daily variance, so implied and realized are directly comparable: `iv_rv` is the option market's premium over recent realized variance. `ret_21` captures the leverage effect (falling prices, rising vol). A check perturbs the data after a cutoff and confirms that no feature dated before it moves.
""",
        "starter": '''import numpy as np
import pandas as pd

FEATURES = ["rv_d", "rv_w", "rv_m", "iv_var", "iv_rv", "ret_21"]


def vol_panel(close: pd.DataFrame, rv: pd.DataFrame, iv: pd.DataFrame, horizon: int = 21) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _PANEL,
        "hints": ["The forward mean: `rv[::-1].rolling(horizon, min_periods=horizon).mean()[::-1].shift(-1)`."],
        "cases": lambda: [
            {"name": "cleaned universe", "sample": True, "args": (_clean(1)["close"], _clean(1)["rv"], _clean(1)["iv"])},
            {"name": "weekly labels", "args": (_clean(2)["close"], _clean(2)["rv"], _clean(2)["iv"], 5)},
            {"name": "no look-ahead in features", "check": _panel_causal},
        ],
    },
    {
        "id": "r19_forecast",
        "title": "Part 3 · Purged walk-forward volatility forecasts",
        "difficulty": "Hard",
        "libs": ["statsmodels", "LightGBM", "pandas"],
        "fn": "forecast_rv",
        "description": r"""
Forecast `label` out of sample, pooled across stocks. With `dates` the panel's sorted unique dates, for k in `range(first_train, len(dates), retrain_every)`: train on rows dated ≤ `dates[k - purge]` with a label, predict the rows dated in `dates[k : k + retrain_every]`.

Models and their columns:
- `"har"`: OLS on `rv_d`, `rv_w`, `rv_m`, with `sm.OLS(y, sm.add_constant(X)).fit()` (predict with `sm.add_constant(X_test, has_constant="add")`)
- `"har_iv"`: OLS on those three plus `iv_var`
- `"lgbm"`: all six features with `LGBMRegressor(n_estimators=300, learning_rate=0.03, num_leaves=15, min_child_samples=200, reg_lambda=5.0, colsample_bytree=0.8, random_state=0, n_jobs=1, verbose=-1)`

Return one Series of forecasts indexed by `(date, ticker)`.

### Learn
Same discipline as the equity capstone: a 21-day label isn't known until 21 days later, so the purge is 21. A check scrambles the not-yet-known labels and confirms the first block of forecasts doesn't move. Pooling across stocks treats every stock-day as a sample, which works here because everything is in comparable log-variance units.
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm
from lightgbm import LGBMRegressor

FEATURES = ["rv_d", "rv_w", "rv_m", "iv_var", "iv_rv", "ret_21"]


def forecast_rv(panel: pd.DataFrame, model: str = "har", first_train: int = 504, retrain_every: int = 63, purge: int = 21) -> pd.Series:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nimport statsmodels.api as sm\nfrom lightgbm import LGBMRegressor\n\n\n" + _FORECAST,
        "hints": ["Keep a dict from model name to its feature columns, so one loop handles all three."],
        "rtol": 1e-6,
        "atol": 1e-8,
        "timeout": 600,
        "cases": lambda: [
            {"name": "HAR", "sample": True, "args": (_panel(1), "har")},
            {"name": "HAR + implied variance", "args": (_panel(2), "har_iv")},
            {"name": "LightGBM", "args": (_panel(2), "lgbm")},
            {"name": "purge: no label leakage", "check": _purge_check},
        ],
    },
    {
        "id": "r19_evaluate",
        "title": "Part 4 · Evaluate the forecasts",
        "difficulty": "Easy",
        "libs": ["pandas", "numpy"],
        "fn": "evaluate_forecasts",
        "description": r"""
For each model's forecasts (log variance), against the panel's `label` on the rows where it exists, with errors e = label − forecast:

- `r2` = 1 − Σe² / Σ(label − mean label)²
- `mse` = mean e²
- `qlike` = mean of $e^{e} - e - 1$ (QLIKE on variances, since RV/F = exp(e))
- `bias` = mean e

Return a DataFrame indexed by model name.

### Learn
Expect implied variance to help a lot: HAR + implied beats plain HAR on R², MSE and QLIKE, and LightGBM, given everything, lands close to it but doesn't beat it. A well-specified linear model on the right inputs is hard to beat, as in the equity capstone. Keep the ranking in mind for Part 8, where the most accurate forecast turns out not to be the best trading signal.
""",
        "starter": '''import numpy as np
import pandas as pd


def evaluate_forecasts(preds: dict, panel: pd.DataFrame) -> pd.DataFrame:
    # return a DataFrame indexed by model with columns r2, mse, qlike, bias
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _EVAL,
        "hints": ["`panel['label'].reindex(p.index)` aligns the labels with a forecast Series."],
        "rtol": 1e-6,
        "timeout": 600,
        "cases": lambda: [
            {"name": "three models", "sample": True, "args": ({m: _preds(1, m) for m in ("har", "har_iv", "lgbm")}, _panel(1))},
            {"name": "another universe", "args": ({m: _preds(2, m) for m in ("har", "har_iv")}, _panel(2))},
        ],
    },
    {
        "id": "r19_straddles",
        "title": "Part 5 · The delta-hedged straddle engine",
        "difficulty": "Hard",
        "libs": ["numpy", "scipy.stats", "pandas"],
        "fn": "straddle_pnl",
        "description": r"""
For each entry date (in order; stop at the first one without `days` more closes), buy one ATM straddle per stock, priced and hedged with Black–Scholes at that day's implied vol σ, zero rates, held `days` trading days to expiry. With closes $S_0 … S_{days}$ from the entry date, $K = S_0$, $T_0 = days/252$:

1. hedge at j = 0 … days − 1 with time left $\tau_j = (days - j)/252$: straddle delta $\Delta_j = 2N(d_1) - 1$, $d_1 = \frac{\ln(S_j/K) + \frac12\sigma^2\tau_j}{\sigma\sqrt{\tau_j}}$
2. premium = $2K(2N(\frac12\sigma\sqrt{T_0}) - 1)$ and vega per vol point = $2K\,\varphi(\frac12\sigma\sqrt{T_0})\sqrt{T_0}/100$
3. gross P&L of the long hedged straddle = $|S_{days} - K|$ − premium − $\sum_j \Delta_j(S_{j+1} - S_j)$, divided by vega (vol points)
4. cost = hedging cost $\frac{\text{cost\_bps}}{10^4}\sum_j |\Delta_j - \Delta_{j-1}|\,S_j$ (with $\Delta_{-1} = 0$) divided by vega, plus `spread_vp`

Return a dict: `gross` and `cost`, each a DataFrame (entry dates × tickers). Missing data in a window gives NaN.

### Learn
The gross P&L is the realized-versus-implied bet in vol points: about +(realized − implied) for a long straddle, so a short straddle earns the premium. Sanity check: averaged over everything, short straddles earn roughly one vol point per month gross here, less than the raw implied-minus-realized gap, because vol spikes produce a few very large losses. Costs are in the same units: `spread_vp = 0.5` means you give up half a vol point per straddle when you trade it, a realistic figure for liquid single-stock options.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy.stats import norm


def straddle_pnl(close: pd.DataFrame, iv: pd.DataFrame, entries, days: int = 21, spread_vp: float = 0.5,
                 cost_bps: float = 1.0) -> dict:
    # return {"gross": ..., "cost": ...}
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nfrom scipy.stats import norm\n\n\n" + _STRADDLE,
        "hints": ["Work with arrays of shape (days + 1, n_stocks) for one entry at a time; every step vectorizes across stocks.",
                  "`np.diff(delta, axis=0, prepend=0.0)` gives the hedge trades including the initial one."],
        "rtol": 1e-7,
        "cases": lambda: [
            {"name": "monthly entries, 0.5 vol-point spread", "sample": True,
             "args": (_clean(1)["close"], _clean(1)["iv"], _preds(1, "har").index.get_level_values("date").unique()[::21])},
            {"name": "weekly straddles, wider spread", "args": (_clean(2)["close"], _clean(2)["iv"], _clean(2)["close"].index[600::5], 5, 1.0, 2.0)},
        ],
    },
    {
        "id": "r19_portfolios",
        "title": "Part 6 · Variance-premium portfolios",
        "difficulty": "Medium",
        "libs": ["pandas"],
        "fn": "vol_strategies",
        "description": r"""
Combine the straddle P&L into three monthly strategies, per entry date, using a premium `signal` (entry dates × tickers; higher = richer options):

1. valid = stocks with a signal, a gross P&L and a cost; percentile-rank the signal across valid stocks (`rank(axis=1, pct=True)`)
2. short P&L = −gross − cost, long P&L = gross − cost (costs hurt both directions)
3. `short_all` = mean short P&L over valid stocks
4. `short_rich` = mean short P&L over the richest third (rank > 2/3)
5. `rich_cheap` = the average of `short_rich` and the mean long P&L over the cheapest third (rank ≤ 1/3)

Return a DataFrame (entry dates × those three columns), in vol points per unit of vega.

### Learn
Three ways to own the variance premium. `short_all` is pure premium harvesting; `short_rich` concentrates on the options your model thinks are most overpriced; `rich_cheap` is a relative-value book, roughly vega-neutral: in a market-wide vol spike its long legs gain while its short legs lose. Before running Part 7, guess which has the best Sharpe ratio and which the worst month.
""",
        "starter": '''import numpy as np
import pandas as pd


def vol_strategies(signal: pd.DataFrame, gross: pd.DataFrame, cost: pd.DataFrame) -> pd.DataFrame:
    # return a DataFrame with columns short_all, short_rich, rich_cheap
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _STRATS,
        "hints": ["`df.where(mask).mean(axis=1)` averages each row over the masked stocks only."],
        "rtol": 1e-7,
        "timeout": 600,
        "cases": lambda: [
            {"name": "HAR premium signal", "sample": True, "args": (_signal(1, "har"), _pnl(1)["gross"], _pnl(1)["cost"])},
            {"name": "LightGBM signal", "args": (_signal(2, "lgbm"), _pnl(2)["gross"], _pnl(2)["cost"])},
        ],
    },
    {
        "id": "r19_metrics",
        "title": "Part 7 · Metrics for short-volatility P&L",
        "difficulty": "Medium",
        "libs": ["numpy", "scipy.stats", "pandas"],
        "fn": "vol_metrics",
        "description": r"""
Summarize one strategy's monthly P&L (vol points). Return a dict:

- `sharpe` = mean/std × √12, `mean`, `skew` (pandas), `worst` (the minimum month)
- `max_drawdown`: the minimum of cumulative P&L minus its running maximum (P&L is additive in vol points)
- `cvar_5`: the mean of the worst ⌈5% × n⌉ months
- `hit_rate`: the fraction of positive months
- `dsr`: the deflated Sharpe ratio of the monthly P&L given `trial_sharpes` (per-month Sharpe ratios of every strategy tried), exactly as in the ML-in-finance step

### Learn
For short volatility, `skew`, `worst`, `cvar_5` and `max_drawdown` matter as much as `sharpe`: a strategy that earns a little almost every month and occasionally loses ten months of profit can show a fine Sharpe ratio right up to the month it blows up. Risk committees size these books by stressed loss, not by volatility.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy import stats


def vol_metrics(pnl: pd.Series, trial_sharpes) -> dict:
    # return {"sharpe": ..., "mean": ..., "skew": ..., "worst": ..., "max_drawdown": ..., "cvar_5": ..., "hit_rate": ..., "dsr": ...}
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\n\n" + _METRICS,
        "hints": ["`from r10_dsr import deflated_sharpe` reuses your earlier work."],
        "rtol": 1e-6,
        "timeout": 600,
        "cases": lambda: [
            {"name": "short every straddle", "sample": True, "args": _metrics_args(1, "short_all")},
            {"name": "rich versus cheap", "args": _metrics_args(1, "rich_cheap")},
        ],
    },
    {
        "id": "r19_run",
        "title": "Part 8 · Run the options capstone end to end",
        "difficulty": "Medium",
        "libs": ["pandas", "statsmodels", "LightGBM", "scipy"],
        "fn": "run_options_capstone",
        "description": r"""
Chain Parts 1–7 from the raw data:

1. `clean = clean_vol_data(raw)`; `panel = vol_panel(clean["close"], clean["rv"], clean["iv"])`
2. forecasts for `"har"`, `"har_iv"`, `"lgbm"` (in that order); `forecast_table = evaluate_forecasts(preds, panel)`
3. entries = every 21st date of the HAR forecasts' dates, starting with the first; `pnl = straddle_pnl(clean["close"], clean["iv"], entries, spread_vp=spread_vp)`
4. for each model: signal = ln(iv²/252) − forecast (unstacked to dates × tickers, on the entry dates kept in `pnl["gross"]`), then `vol_strategies(signal, pnl["gross"], pnl["cost"])`
5. trials = per-month Sharpe ratios of `short_all` (once, from the HAR run) and of `short_rich` and `rich_cheap` for each model: 7 in all
6. return a dict:
   - `n_rescaled`, `forecast_table`
   - `signal_sharpe`: each model's annualized `rich_cheap` Sharpe ratio (Series)
   - `strategy_table`: `vol_metrics` of the three HAR-signal strategies as rows (DataFrame)

Import your earlier parts: `from r19_clean import clean_vol_data`, and likewise `r19_features`, `r19_forecast`, `r19_evaluate`, `r19_straddles`, `r19_portfolios`, `r19_metrics`.

### Learn
The headline results to expect and explain:
- **Shorting everything** earns the premium but has the lowest Sharpe ratio of the three, with a strongly negative skew and a worst month that wipes out a year or more of gains.
- **Shorting only the richest options** at least doubles the average P&L; the tails stay ugly.
- **Rich versus cheap**, at the default half-vol-point spread, gives up average P&L for a much better Sharpe ratio and a worst month several times smaller, because its long legs hedge vol spikes. Its deflated Sharpe ratio stays high after counting all seven trials.
- **Costs decide**: the second test doubles the spread to one vol point. The relative-value book pays it on both legs for a smaller gross edge, and its advantage disappears. Always show results across cost assumptions.
- **Accuracy isn't everything**: compare `signal_sharpe` with `forecast_table`. HAR forecasts worst, yet its premium signal trades best in both tests, because forecasts that use implied vol absorb part of the premium.
""",
        "starter": '''import numpy as np
import pandas as pd


def run_options_capstone(raw: pd.DataFrame, spread_vp: float = 0.5) -> dict:
    # return {"n_rescaled": ..., "forecast_table": ..., "signal_sharpe": ..., "strategy_table": ...}
    pass
''',
        "solution": _IMPORTS + "\n\n".join([_CLEAN, _PANEL, _FORECAST, _EVAL, _STRADDLE, _STRATS, _METRICS, _RUN]),
        "hints": ["Keep each model's strategy frame in a dict; both outputs come from it."],
        "rtol": 1e-6,
        "timeout": 900,
        "cases": lambda: [
            {"name": "30 stocks, 8 years, 0.5 vol-point spread", "sample": True, "args": (_raw(4),)},
            {"name": "another universe, 1 vol-point spread", "args": (_raw(2), 1.0)},
        ],
    },
]
