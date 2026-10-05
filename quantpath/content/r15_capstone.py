from functools import lru_cache

import numpy as np
import pandas as pd

from data import capstone_universe

TITLE = "Capstone: end-to-end ML equity strategy"
SUMMARY = "Raw messy data to a costed, risk-managed, market-neutral ML strategy in eight parts: cleaning, leak-free features, purged walk-forward Ridge vs LightGBM, forecast evaluation, risk-model portfolio, backtest, deflated Sharpe, final report."
KIND = "capstone"

LESSON = r"""
This is the project you'll present in interviews. It chains everything in the track into the pipeline a quant equity researcher actually runs, from raw vendor data to a net-of-cost, market-neutral strategy with an honest significance test. Each part is one function; Part 8 runs them all.

## The pipeline

```text
raw prices + volumes
  ↓ Part 1  clean: bad ticks, gaps, listings and delistings
  ↓ Part 2  leak-free features and 5-day labels
  ↓ Part 3  purged walk-forward: Ridge vs LightGBM, retrained quarterly
  ↓ Part 4  forecast evaluation: IC, HAC t-stat, decay, vs a baseline
  ↓ Part 5  risk-model portfolio: Ledoit–Wolf, dollar- and beta-neutral
  ↓ Part 6  weekly long/short backtest with costs
  ↓ Part 7  Sharpe, drawdown, turnover, market beta, deflated Sharpe
  ↓ Part 8  one call that produces the final report
```

## The data

`data.capstone_universe()` gives 60 stocks over six years with market and sector factors and two genuine, weak effects: slowly drifting expected returns (momentum) and partial reversal of recent price moves, stronger when the move came on low volume. The raw data has the problems real data has: missing days, decimal-error bad ticks, two late listings and two delistings. Your pipeline doesn't know any of this; it has to find the effects, without fooling itself.

## Decisions you'll have to defend

| decision | why |
|---|---|
| cross-sectional ranks for features and labels | robust to outliers and to market-wide moves; the strategy is market-neutral, so only relative performance matters |
| a 5-day label, weekly rebalancing | a compromise between signal decay (fast reversal) and trading costs |
| purge of 5 days before each training cutoff | the last labels before the cutoff overlap the test period; without the purge, future returns leak into training |
| Ridge as a baseline next to LightGBM | in low signal-to-noise data, a linear model on good features is hard to beat, and the comparison tells you whether the complexity earns its keep |
| a momentum-only baseline | proves the ML adds something over a one-line signal |
| Ledoit–Wolf, beta- and dollar-neutral weights | the forecasts are relative; the risk model stops the portfolio from becoming a disguised market or sector bet |
| costs and turnover reported | a fast signal can have a great IC and lose money |
| deflated Sharpe ratio | three strategies were tried; the best one gets deflated for that |

## After you finish

1. Present it in five minutes using the structure in the researcher interview playbook.
2. Run `run_capstone` on real data in a notebook (prices and volumes for 50+ US stocks from yfinance) and write up what changes. Expect weaker results, and note survivorship bias if you use today's index members.
3. Extensions worth trying: sector-neutral weights, a feature for the volume × reversal interaction given to Ridge, position caps with a QP solver, a square-root market-impact cost model, and an ensemble of Ridge and LightGBM.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Grinold's fundamental law says IR ≈ IC × √breadth. A signal with IC 0.05 trades 60 stocks with weekly rebalancing (52 independent bets per stock per year). What annual information ratio does the law predict?",
     "answer": 0.05 * np.sqrt(60 * 52), "tol": 0.03, "display": "≈ 2.8",
     "explanation": "Breadth = 60 × 52 = 3,120 bets per year, so IR ≈ 0.05 × √3,120 ≈ 2.8. Realized ratios come in lower: the bets aren't independent, the IC varies, and costs and constraints cut the transfer from forecasts to weights."},
    {"type": "choice", "prompt": "Model A has a higher IC than model B, yet B has the higher Sharpe ratio after costs. What's the most likely explanation?",
     "choices": ["A's forecasts change more from day to day, so its portfolio turns over more and pays more in costs", "IC and Sharpe are unrelated",
                 "B must be overfit", "A has look-ahead bias"],
     "answer": 0, "explanation": "IC measures forecast quality, not tradability. A noisier, faster forecast can rank stocks slightly better and still lose to a smoother one after costs. That's why the capstone reports turnover and net Sharpe next to IC."},
    {"type": "open", "prompt": "Your capstone shows a net Sharpe ratio of 1.7. Give the main reasons it might not hold up in live trading.",
     "explanation": "Synthetic data with effects built in; costs underestimated (spread, market impact, short borrow fees, the 5 bps flat assumption); capacity; regime change and signal decay as others trade it; design choices made after seeing results (the garden of forking paths) beyond the three trials the DSR counts; survivorship and point-in-time issues on real data; execution assumptions (trading at the close you used to compute signals). The fix: an untouched holdout, paper trading, small live allocation, and monitoring with kill criteria."},
]

FEATURES = ["mom_12_1", "mom_6_1", "rev_5", "rev_1", "vol_60", "abn_vol", "abn_vol_5"]

_CLEAN = '''def clean_prices(raw: pd.DataFrame, max_fill: int = 5) -> dict:
    prev, nxt = raw.ffill().shift(1), raw.bfill().shift(-1)
    jump = lambda a, b: np.abs(np.log(a / b)) > np.log(3)
    bad = jump(raw, prev) & jump(nxt, raw)
    prices = raw.mask(bad)
    filled = prices.ffill(limit=max_fill)
    return {"prices": filled, "returns": filled.pct_change(), "n_bad_ticks": int(bad.sum().sum()),
            "n_filled": int((filled.notna() & prices.isna()).sum().sum())}
'''

_PANEL = '''FEATURES = ["mom_12_1", "mom_6_1", "rev_5", "rev_1", "vol_60", "abn_vol", "abn_vol_5"]


def build_panel(prices: pd.DataFrame, volume: pd.DataFrame, horizon: int = 5) -> pd.DataFrame:
    r = prices.pct_change()
    lv = np.log(volume)
    abn = lv - lv.shift(1).rolling(60, min_periods=40).mean()
    raw = {"mom_12_1": prices.shift(21) / prices.shift(252) - 1,
           "mom_6_1": prices.shift(21) / prices.shift(126) - 1,
           "rev_5": -(prices / prices.shift(5) - 1),
           "rev_1": -r,
           "vol_60": r.rolling(60).std(),
           "abn_vol": abn,
           "abn_vol_5": abn.rolling(5, min_periods=3).mean()}
    cols = {k: v.rank(axis=1, pct=True) - 0.5 for k, v in raw.items()}
    fwd = prices.shift(-horizon) / prices - 1
    cols["label"] = fwd.rank(axis=1, pct=True) - 0.5
    cols["fwd_ret"] = fwd
    cols["fwd_ret_1d"] = prices.shift(-1) / prices - 1
    panel = pd.concat({k: v.stack() for k, v in cols.items()}, axis=1)
    panel.index.names = ["date", "ticker"]
    return panel.dropna(subset=FEATURES).sort_index()
'''

_MODELS = '''FEATURES = ["mom_12_1", "mom_6_1", "rev_5", "rev_1", "vol_60", "abn_vol", "abn_vol_5"]


def make_model(name: str):
    if name == "ridge":
        return Ridge(alpha=1.0)
    if name == "lgbm":
        return LGBMRegressor(n_estimators=300, learning_rate=0.02, num_leaves=7, min_child_samples=1000, reg_lambda=10.0,
                             colsample_bytree=0.8, random_state=0, n_jobs=1, verbose=-1)
    raise ValueError(f"unknown model {name!r}")


def walk_forward(panel: pd.DataFrame, model: str = "ridge", first_train: int = 504, retrain_every: int = 63, purge: int = 5) -> pd.Series:
    d = panel.index.get_level_values("date")
    dates = d.unique()
    out = []
    for k in range(first_train, len(dates), retrain_every):
        train = panel[(d <= dates[k - purge]) & panel["label"].notna()]
        test = panel[d.isin(dates[k:k + retrain_every])]
        m = make_model(model).fit(train[FEATURES], train["label"])
        out.append(pd.Series(m.predict(test[FEATURES]), index=test.index))
    return pd.concat(out).rename(model)
'''

_EVAL = '''def evaluate_predictions(preds: dict, panel: pd.DataFrame) -> pd.DataFrame:
    rows = {}
    for name, p in preds.items():
        P = p.unstack()
        F = panel["fwd_ret"].unstack().reindex_like(P)
        F1 = panel["fwd_ret_1d"].unstack().reindex_like(P)
        ic = P.corrwith(F, axis=1, method="spearman").dropna()
        t = sm.OLS(ic.to_numpy(), np.ones(len(ic))).fit(cov_type="HAC", cov_kwds={"maxlags": 4}).tvalues[0]
        rows[name] = {"ic_mean": ic.mean(), "ic_t": t, "ic_1d": P.corrwith(F1, axis=1, method="spearman").mean(),
                      "hit_rate": (ic > 0).mean()}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_PORT = '''def build_portfolio(scores: pd.DataFrame, returns: pd.DataFrame, rebalance: int = 5, window: int = 126,
                    target_vol: float = 0.10) -> pd.DataFrame:
    rows = {}
    for d in scores.index[::rebalance]:
        s = scores.loc[d].dropna()
        i = returns.index.get_loc(d)
        win = returns.iloc[i + 1 - window:i + 1]
        names = [c for c in s.index if win[c].notna().all()]
        X, m = win[names].to_numpy(), win.mean(axis=1).to_numpy()
        z = ((s[names] - s[names].mean()) / s[names].std()).to_numpy()
        S = LedoitWolf().fit(X).covariance_ * 252
        beta = (X - X.mean(0)).T @ (m - m.mean()) / ((m - m.mean()) ** 2).sum()
        alpha = np.sqrt(np.diag(S)) * z
        A = np.column_stack([np.ones(len(names)), beta])
        Sa, SA = np.linalg.solve(S, alpha), np.linalg.solve(S, A)
        w = Sa - SA @ np.linalg.solve(A.T @ SA, A.T @ Sa)
        w *= target_vol / np.sqrt(w @ S @ w)
        rows[d] = pd.Series(w, index=names).reindex(returns.columns, fill_value=0.0)
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_BT = '''def backtest_long_short(weights: pd.DataFrame, returns: pd.DataFrame, cost_bps: float = 5.0) -> dict:
    days = returns.index[returns.index > weights.index[0]]
    held = weights.reindex(returns.index).ffill().shift(1).loc[days]
    gross = (held * returns.loc[days].fillna(0.0)).sum(axis=1)
    turnover = weights.diff().abs().sum(axis=1)
    turnover.iloc[0] = weights.iloc[0].abs().sum()
    cost = (turnover * cost_bps / 1e4).reindex(returns.index, fill_value=0.0).shift(1, fill_value=0.0).loc[days]
    return {"returns": gross - cost, "turnover": turnover}
'''

_DSR = '''def probabilistic_sharpe(returns, sr_benchmark: float = 0.0) -> float:
    r = np.asarray(returns, dtype=float)
    sr = r.mean() / r.std(ddof=1)
    g3, g4 = stats.skew(r), stats.kurtosis(r, fisher=False)
    z = (sr - sr_benchmark) * np.sqrt(len(r) - 1) / np.sqrt(1 - g3 * sr + (g4 - 1) / 4 * sr**2)
    return float(stats.norm.cdf(z))


def deflated_sharpe(returns, trial_sharpes) -> float:
    sr = np.asarray(trial_sharpes, dtype=float)
    n, gamma = len(sr), 0.5772156649015329
    sr0 = np.sqrt(sr.var(ddof=1)) * ((1 - gamma) * stats.norm.ppf(1 - 1 / n) + gamma * stats.norm.ppf(1 - 1 / (n * np.e)))
    return probabilistic_sharpe(returns, sr0)
'''

_METRICS = '''def strategy_metrics(returns: pd.Series, turnover: pd.Series, market: pd.Series, trial_sharpes) -> dict:
    r = returns
    m = market.reindex(r.index).fillna(0.0)
    wealth = (1 + r).cumprod()
    return {"ann_return": r.mean() * 252, "ann_vol": r.std() * np.sqrt(252), "sharpe": r.mean() / r.std() * np.sqrt(252),
            "max_drawdown": (wealth / wealth.cummax() - 1).min(), "annual_turnover": turnover.sum() / (len(r) / 252),
            "market_beta": np.cov(r, m)[0, 1] / m.var(), "dsr": deflated_sharpe(r, trial_sharpes)}
'''

_RUN = '''def run_capstone(raw_prices: pd.DataFrame, raw_volume: pd.DataFrame, cost_bps: float = 5.0) -> dict:
    clean = clean_prices(raw_prices)
    returns = clean["returns"]
    panel = build_panel(clean["prices"], raw_volume)
    preds = {"ridge": walk_forward(panel, "ridge"), "lgbm": walk_forward(panel, "lgbm")}
    preds = {"momentum": panel.loc[preds["ridge"].index, "mom_6_1"], **preds}
    table = evaluate_predictions(preds, panel)
    weights = {k: build_portfolio(p.unstack(), returns) for k, p in preds.items()}
    tests = {k: backtest_long_short(w, returns, cost_bps) for k, w in weights.items()}
    sharpe = lambda r: r.mean() / r.std()
    trials = [sharpe(t["returns"]) for t in tests.values()]
    chosen = table["ic_t"].idxmax()
    gross = backtest_long_short(weights[chosen], returns, 0.0)["returns"]
    return {"n_bad_ticks": clean["n_bad_ticks"], "model_table": table, "chosen": chosen,
            "net_sharpe": pd.Series({k: sharpe(t["returns"]) * np.sqrt(252) for k, t in tests.items()}),
            "gross_sharpe": sharpe(gross) * np.sqrt(252),
            "metrics": strategy_metrics(tests[chosen]["returns"], tests[chosen]["turnover"], returns.mean(axis=1), trials)}
'''

_IMPORTS = '''import numpy as np
import pandas as pd
import statsmodels.api as sm
from lightgbm import LGBMRegressor
from scipy import stats
from sklearn.covariance import LedoitWolf
from sklearn.linear_model import Ridge


'''


@lru_cache(None)
def _ns():
    ns = {}
    exec(_IMPORTS + "\n\n".join([_CLEAN, _PANEL, _MODELS, _EVAL, _PORT, _BT, _DSR, _METRICS, _RUN]), ns)
    return ns


@lru_cache(None)
def _raw(seed):
    u = capstone_universe(seed=seed)
    return u["prices"], u["volume"]


@lru_cache(None)
def _clean(seed):
    return _ns()["clean_prices"](_raw(seed)[0])


@lru_cache(None)
def _panel(seed):
    return _ns()["build_panel"](_clean(seed)["prices"], _raw(seed)[1])


@lru_cache(None)
def _preds(seed, model):
    if model == "momentum":
        return _panel(seed).loc[_preds(seed, "ridge").index, "mom_6_1"]
    return _ns()["walk_forward"](_panel(seed), model)


@lru_cache(None)
def _weights(seed, model):
    return _ns()["build_portfolio"](_preds(seed, model).unstack(), _clean(seed)["returns"])


@lru_cache(None)
def _test(seed, model, cost_bps=5.0):
    return _ns()["backtest_long_short"](_weights(seed, model), _clean(seed)["returns"], cost_bps)


def _metrics_args(seed):
    t = _test(seed, "ridge")
    trials = [(lambda r: r.mean() / r.std())(_test(seed, m)["returns"]) for m in ("momentum", "ridge", "lgbm")]
    return t["returns"], t["turnover"], _clean(seed)["returns"].mean(axis=1), trials


def _panel_causal(fn):
    prices, volume = _clean(4)["prices"].copy(), _raw(4)[1].copy()
    cut = prices.index[900]
    base = fn(prices.copy(), volume.copy())
    noise = np.exp(np.random.default_rng(0).normal(0, 0.2, prices.shape))
    late = prices.index >= cut
    prices.loc[late] = prices.loc[late] * noise[late]
    volume.loc[late] = volume.loc[late] * noise[late]
    after = fn(prices, volume)
    early = base[base.index.get_level_values("date") < cut]
    assert early.index.isin(after.index).all(), (
        f"Rows dated before {cut:%Y-%m-%d} disappeared when only data from that date on was changed.")
    a, b = after.loc[early.index, FEATURES].to_numpy(), early[FEATURES].to_numpy()
    assert np.allclose(a, b, equal_nan=True), (
        f"Look-ahead bias: changing prices and volumes from {cut:%Y-%m-%d} on changed features dated before it. "
        "Features at date t may only use data up to t (only the label and forward returns look ahead).")


def _purge_check(fn):
    panel = _panel(1).copy()
    d = panel.index.get_level_values("date")
    dates = d.unique()
    base = fn(panel.copy(), "ridge")
    unknown = d > dates[504 - 5]
    panel.loc[unknown, "label"] = np.random.default_rng(0).permutation(panel.loc[unknown, "label"].to_numpy())
    after = fn(panel, "ridge")
    first = base.index.get_level_values("date") < dates[504 + 63]
    assert np.allclose(np.asarray(after[first]), np.asarray(base[first])), (
        f"Label leakage: predictions for the first test block changed when only labels after {dates[499]:%Y-%m-%d} "
        "were scrambled. Those labels end inside the test period, so the first model must not train on them.")


PROBLEMS = [
    {
        "id": "r15_clean",
        "title": "Part 1 · Clean the raw data",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "clean_prices",
        "description": r"""
Raw vendor prices (dates × tickers) have gaps, bad ticks, late listings and delistings. Clean them:

1. for each price, find the previous valid price (`raw.ffill().shift(1)`) and the next valid price (`raw.bfill().shift(-1)`)
2. a **bad tick** is a price more than a factor of 3 away from both: $|\ln(p/p_{prev})| > \ln 3$ **and** $|\ln(p_{next}/p)| > \ln 3$. Set bad ticks to NaN
3. forward-fill gaps of up to `max_fill` days (`ffill(limit=max_fill)`); longer gaps, pre-listing and post-delisting periods stay NaN
4. daily returns: `prices.pct_change()` (in pandas 3 this doesn't fill, so NaN stays NaN)

Return a dict: `prices` (cleaned), `returns`, `n_bad_ticks` (int) and `n_filled` (int: values that were NaN after step 2 and are filled after step 3).

### Learn
A decimal error (a price recorded 10× too high for one day) creates a +900% return followed by −90%: a single bad tick can dominate a volatility estimate, a covariance matrix, or a momentum signal. The rule looks one day ahead, which is fine for repairing *historical* data (a vendor would have corrected it by then) but not for a live system, which must judge a suspicious print without knowing tomorrow's price. Forward-filling with a limit keeps short gaps from breaking rolling windows, without inventing prices for stocks that stopped trading; filled days get a return of exactly 0, a small distortion worth knowing about.
""",
        "starter": '''import numpy as np
import pandas as pd


def clean_prices(raw: pd.DataFrame, max_fill: int = 5) -> dict:
    # return {"prices": ..., "returns": ..., "n_bad_ticks": ..., "n_filled": ...}
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _CLEAN,
        "hints": ["`raw.mask(bad)` sets the flagged cells to NaN.", "n_filled = `(filled.notna() & prices.isna()).sum().sum()`."],
        "cases": lambda: [
            {"name": "60 stocks, 6 years of raw data", "sample": True, "args": (_raw(1)[0],)},
            {"name": "another universe, max_fill = 2", "args": (_raw(2)[0], 2)},
        ],
    },
    {
        "id": "r15_features",
        "title": "Part 2 · Leak-free features and labels",
        "difficulty": "Hard",
        "libs": ["pandas", "numpy"],
        "fn": "build_panel",
        "description": r"""
Turn cleaned prices and raw volumes (both dates × tickers) into a modeling panel. With `r = prices.pct_change()`, `lv = np.log(volume)` and `abn = lv - lv.shift(1).rolling(60, min_periods=40).mean()` (today's log volume versus its trailing average):

| feature | raw value |
|---|---|
| `mom_12_1` | `prices.shift(21) / prices.shift(252) - 1` |
| `mom_6_1` | `prices.shift(21) / prices.shift(126) - 1` |
| `rev_5` | `-(prices / prices.shift(5) - 1)` |
| `rev_1` | `-r` |
| `vol_60` | `r.rolling(60).std()` |
| `abn_vol` | `abn` |
| `abn_vol_5` | `abn.rolling(5, min_periods=3).mean()` |

1. transform every feature to a **cross-sectional rank** per date: `rank(axis=1, pct=True) - 0.5`
2. `fwd_ret = prices.shift(-horizon) / prices - 1`; `label` = its cross-sectional rank (same transform); `fwd_ret_1d = prices.shift(-1) / prices - 1`
3. stack everything into one DataFrame with a `(date, ticker)` MultiIndex and columns = the 7 features + `label`, `fwd_ret`, `fwd_ret_1d`
4. drop rows where any feature is NaN (labels may be NaN at the end), and sort the index

### Learn
Ranks make features comparable across stocks and over time, and immune to outliers; ranking the label too means the model learns *relative* performance, exactly what a market-neutral book trades. The abnormal-volume baseline uses `shift(1)` so today's volume isn't compared with an average that contains itself. A check perturbs prices and volumes after a cutoff and confirms no feature dated before it moves.

`pd.concat({name: frame.stack() for name, frame in columns.items()}, axis=1)` builds the panel in one line.
""",
        "starter": '''import numpy as np
import pandas as pd

FEATURES = ["mom_12_1", "mom_6_1", "rev_5", "rev_1", "vol_60", "abn_vol", "abn_vol_5"]


def build_panel(prices: pd.DataFrame, volume: pd.DataFrame, horizon: int = 5) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _PANEL,
        "hints": ["Build a dict of dates × tickers frames (ranked features, label, forward returns), stack each, and concat along columns.",
                  "Name the index levels with `panel.index.names = ['date', 'ticker']`."],
        "cases": lambda: [
            {"name": "panel from cleaned data", "sample": True, "args": (_clean(1)["prices"], _raw(1)[1])},
            {"name": "another universe, 10-day labels", "args": (_clean(3)["prices"], _raw(3)[1], 10)},
            {"name": "no look-ahead in features", "check": _panel_causal},
        ],
    },
    {
        "id": "r15_models",
        "title": "Part 3 · Purged walk-forward: Ridge vs LightGBM",
        "difficulty": "Hard",
        "libs": ["scikit-learn", "LightGBM", "pandas"],
        "fn": "walk_forward",
        "description": r"""
Produce honest out-of-sample forecasts. Let `dates` be the panel's sorted unique dates. For `k` in `range(first_train, len(dates), retrain_every)`:

1. **train** on rows with date ≤ `dates[k - purge]` and a non-NaN `label`, using the 7 `FEATURES` from Part 2
2. **predict** the rows whose date is in `dates[k : k + retrain_every]`

Models: `"ridge"` → `Ridge(alpha=1.0)`; `"lgbm"` → `LGBMRegressor(n_estimators=300, learning_rate=0.02, num_leaves=7, min_child_samples=1000, reg_lambda=10.0, colsample_bytree=0.8, random_state=0, n_jobs=1, verbose=-1)`. Keep training rows in the panel's (date, ticker) order.

Return one Series of predictions indexed by the predicted rows' `(date, ticker)`.

### Learn
Why `k - purge`: a label dated $t$ is the return from $t$ to $t+5$, so at the close of `dates[k]` only labels up to `dates[k-5]` are known. Training on later rows would let the model peek at returns inside its own test period, the most common leak in ML-for-finance code. A check scrambles exactly those not-yet-known labels and confirms the first block of predictions doesn't move.

Retraining quarterly with an expanding window lets the model learn from new data while every forecast stays out of sample. The LightGBM settings are deliberately conservative (shallow trees, big leaves, a low learning rate, L2 penalty), the usual starting point for noisy financial targets.
""",
        "starter": '''import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.linear_model import Ridge

FEATURES = ["mom_12_1", "mom_6_1", "rev_5", "rev_1", "vol_60", "abn_vol", "abn_vol_5"]


def walk_forward(panel: pd.DataFrame, model: str = "ridge", first_train: int = 504, retrain_every: int = 63, purge: int = 5) -> pd.Series:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nfrom lightgbm import LGBMRegressor\nfrom sklearn.linear_model import Ridge\n\n\n" + _MODELS,
        "hints": ["`d = panel.index.get_level_values('date')` gives a per-row date array to build boolean masks with.",
                  "`d.isin(dates[k:k + retrain_every])` selects the test block."],
        "rtol": 1e-6,
        "atol": 1e-8,
        "timeout": 600,
        "cases": lambda: [
            {"name": "Ridge, quarterly retraining", "sample": True, "args": (_panel(1), "ridge")},
            {"name": "LightGBM", "args": (_panel(2), "lgbm")},
            {"name": "purge: no label leakage", "check": _purge_check},
        ],
    },
    {
        "id": "r15_evaluate",
        "title": "Part 4 · Evaluate the forecasts",
        "difficulty": "Medium",
        "libs": ["pandas", "statsmodels"],
        "fn": "evaluate_predictions",
        "description": r"""
`preds` maps a model name to a Part 3 forecast Series (the tests include a no-ML baseline, the raw `mom_6_1` rank). For each, with forecasts unstacked to dates × tickers and the panel's forward returns aligned to them (`reindex_like`):

- `ic_mean`: mean per-date Spearman IC against `fwd_ret` (`corrwith(..., axis=1, method="spearman")`, NaN dates dropped)
- `ic_t`: t-stat of that mean with Newey–West errors: `sm.OLS(ic, np.ones(len(ic))).fit(cov_type="HAC", cov_kwds={"maxlags": 4}).tvalues[0]`
- `ic_1d`: mean per-date Spearman IC against `fwd_ret_1d`
- `hit_rate`: fraction of dates with IC > 0

Return a DataFrame indexed by model name.

### Learn
Overlapping 5-day labels make consecutive daily ICs strongly correlated, so a naive t-stat overstates significance; HAC errors with 4 lags (horizon − 1) fix that, as in the regression step. Compare `ic_1d` with `ic_mean`: much of a reversal signal's power arrives in the first day, which is why speed of execution matters for it.

On this data Ridge should come out ahead of LightGBM, and both ahead of the momentum baseline. The effects here are close to linear in the ranked features, and in noisy data a well-specified linear model is hard to beat. That's not a law: with richer interactions or far more data, boosted trees often win. The pipeline's job is to tell you honestly which case you're in.
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm


def evaluate_predictions(preds: dict, panel: pd.DataFrame) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nimport statsmodels.api as sm\n\n\n" + _EVAL,
        "hints": ["`p.unstack()` turns a (date, ticker) Series into a dates × tickers frame."],
        "rtol": 1e-6,
        "timeout": 600,
        "cases": lambda: [
            {"name": "momentum baseline, Ridge, LightGBM", "sample": True,
             "args": ({m: _preds(1, m) for m in ("momentum", "ridge", "lgbm")}, _panel(1))},
            {"name": "another universe", "args": ({m: _preds(2, m) for m in ("momentum", "ridge")}, _panel(2))},
        ],
    },
    {
        "id": "r15_portfolio",
        "title": "Part 5 · Risk-model portfolio construction",
        "difficulty": "Hard",
        "libs": ["scikit-learn", "numpy", "pandas"],
        "fn": "build_portfolio",
        "description": r"""
Turn forecasts (`scores`, dates × tickers) into market-neutral weights on every `rebalance`-th date of `scores.index` (starting with the first). On each such date d:

1. `win` = the `window` rows of `returns` ending at d (inclusive); eligible names = those with a score on d and no NaN in `win`
2. z = cross-sectional z-score of the eligible scores (std with ddof=1)
3. Σ = `LedoitWolf().fit(win[eligible]).covariance_` × 252
4. β = each stock's beta to the equal-weighted market `m = win.mean(axis=1)`: $\beta_i = \sum_t (x_{it}-\bar x_i)(m_t-\bar m) / \sum_t (m_t-\bar m)^2$
5. alpha = $\sigma_i z_i$ with $\sigma_i = \sqrt{\Sigma_{ii}}$ (Grinold's alpha ∝ volatility × score)
6. mean-variance weights under dollar and beta neutrality, in closed form: with $A = [\mathbf 1, \beta]$, $w = \Sigma^{-1}\alpha - \Sigma^{-1}A\,(A^\top\Sigma^{-1}A)^{-1}A^\top\Sigma^{-1}\alpha$ (use `np.linalg.solve`, not explicit inverses)
7. scale w so its predicted volatility $\sqrt{w^\top\Sigma w}$ equals `target_vol`

Return a DataFrame (rebalance dates × all tickers in `returns`), 0 for names not held.

### Learn
Step 6 is the Lagrangian solution of $\max_w w^\top\alpha - \frac\lambda2 w^\top\Sigma w$ subject to $A^\top w = 0$, a derivation worth being able to do on a whiteboard. Check it: $\mathbf 1^\top w$ and $\beta^\top w$ should be zero to machine precision. Compared with the SLSQP version in the portfolio step, the closed form is exact and fast but can't impose position limits; production systems use a QP solver for those.
""",
        "starter": '''import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf


def build_portfolio(scores: pd.DataFrame, returns: pd.DataFrame, rebalance: int = 5, window: int = 126,
                    target_vol: float = 0.10) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nfrom sklearn.covariance import LedoitWolf\n\n\n" + _PORT,
        "hints": ["`returns.index.get_loc(d)` gives d's row, so the window is `returns.iloc[i + 1 - window:i + 1]`.",
                  "Solve once for Σ⁻¹α and once for Σ⁻¹A, then combine."],
        "rtol": 1e-6,
        "atol": 1e-9,
        "timeout": 600,
        "cases": lambda: [
            {"name": "Ridge forecasts, weekly", "sample": True, "args": (_preds(1, "ridge").unstack(), _clean(1)["returns"])},
            {"name": "momentum scores, biweekly, 15% vol", "args": (_preds(2, "momentum").unstack(), _clean(2)["returns"], 10, 252, 0.15)},
        ],
    },
    {
        "id": "r15_backtest",
        "title": "Part 6 · Costed long/short backtest",
        "difficulty": "Medium",
        "libs": ["pandas"],
        "fn": "backtest_long_short",
        "description": r"""
Backtest the Part 5 weights, vectorized:

1. `days` = the trading days after the first rebalance date
2. weights held on each day = the most recent rebalance row dated **before** it (`weights.reindex(returns.index).ffill().shift(1)`)
3. gross return = Σ held weight × return, treating NaN returns as 0
4. turnover at each rebalance = Σ|w_new − w_previous| (the first rebalance counts the whole book, Σ|w|)
5. cost = turnover × `cost_bps` / 10,000, charged on the first trading day after the rebalance
6. net = gross − cost

Return a dict: `returns` (net daily returns over `days`) and `turnover` (Series indexed by the rebalance dates).

### Learn
Between rebalances this holds weights constant, which implicitly rebalances daily for free; that's a standard research simplification for long/short books (Part 3 of the portfolio lab did the exact drift accounting). Run it with `cost_bps=0` as well: the gap between gross and net Sharpe is the price of the signal's speed, and in this capstone it's large.
""",
        "starter": '''import numpy as np
import pandas as pd


def backtest_long_short(weights: pd.DataFrame, returns: pd.DataFrame, cost_bps: float = 5.0) -> dict:
    # return {"returns": ..., "turnover": ...}
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _BT,
        "hints": ["`(turnover * cost_bps / 1e4).reindex(returns.index, fill_value=0.0).shift(1, fill_value=0.0)` moves each cost to the next day."],
        "rtol": 1e-6,
        "atol": 1e-10,
        "timeout": 600,
        "cases": lambda: [
            {"name": "Ridge portfolio, 5 bps", "sample": True, "args": (_weights(1, "ridge"), _clean(1)["returns"])},
            {"name": "LightGBM portfolio, 20 bps", "args": (_weights(3, "lgbm"), _clean(3)["returns"], 20.0)},
        ],
    },
    {
        "id": "r15_metrics",
        "title": "Part 7 · Strategy evaluation with a deflated Sharpe",
        "difficulty": "Medium",
        "libs": ["numpy", "scipy.stats", "pandas"],
        "fn": "strategy_metrics",
        "description": r"""
Evaluate a strategy's net daily returns. Return a dict:

- `ann_return` (mean × 252), `ann_vol` (std × √252), `sharpe` (their ratio)
- `max_drawdown`: minimum of `wealth / wealth.cummax() - 1` with `wealth = (1 + r).cumprod()`
- `annual_turnover`: total turnover / (days / 252)
- `market_beta`: the slope of strategy returns on `market` returns (aligned to the strategy's dates, missing as 0): `np.cov(r, m)[0, 1] / m.var()`
- `dsr`: the deflated Sharpe ratio of `returns` given `trial_sharpes`, the per-period Sharpe ratios of every strategy tried, exactly as in the ML-in-finance step (`from r10_dsr import deflated_sharpe`)

### Learn
`market_beta` near zero confirms the neutrality constraints worked out of sample, not just in the optimizer. The DSR asks whether the chosen strategy's Sharpe ratio survives the fact that you picked it from several; with only three honest trials the haircut is modest, but every extra variant you tried while building the capstone (feature tweaks, parameters) should count too.
""",
        "starter": '''import numpy as np
import pandas as pd
from scipy import stats


def strategy_metrics(returns: pd.Series, turnover: pd.Series, market: pd.Series, trial_sharpes) -> dict:
    # return {"ann_return": ..., "ann_vol": ..., "sharpe": ..., "max_drawdown": ..., "annual_turnover": ..., "market_beta": ..., "dsr": ...}
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\n\n" + _DSR + "\n\n" + _METRICS,
        "hints": ["Reindex the market to the strategy's dates before computing the beta."],
        "rtol": 1e-6,
        "timeout": 600,
        "cases": lambda: [
            {"name": "Ridge strategy, three trials", "sample": True, "args": _metrics_args(1)},
            {"name": "another universe", "args": _metrics_args(2)},
        ],
    },
    {
        "id": "r15_run",
        "title": "Part 8 · Run the capstone end to end",
        "difficulty": "Medium",
        "libs": ["pandas", "scikit-learn", "LightGBM", "statsmodels"],
        "fn": "run_capstone",
        "description": r"""
Chain Parts 1–7 into one call from raw data:

1. `clean = clean_prices(raw_prices)`; `returns = clean["returns"]`; `panel = build_panel(clean["prices"], raw_volume)`
2. forecasts: `"ridge"` and `"lgbm"` from `walk_forward`, plus the `"momentum"` baseline = `panel.loc[ridge_preds.index, "mom_6_1"]`, in the order momentum, ridge, lgbm
3. `model_table = evaluate_predictions(preds, panel)`
4. for each model: `build_portfolio(pred.unstack(), returns)` and `backtest_long_short(weights, returns, cost_bps)`
5. `chosen` = the model with the highest `ic_t` (choose on forecast quality, not on backtest Sharpe)
6. return a dict:
   - `n_bad_ticks`, `model_table`, `chosen`
   - `net_sharpe`: Series of each model's annualized net Sharpe ratio
   - `gross_sharpe`: the chosen model's annualized Sharpe ratio with `cost_bps=0`
   - `metrics`: `strategy_metrics` for the chosen model's net returns, with the market = `returns.mean(axis=1)` and the three models' per-period net Sharpe ratios as trials

Import your earlier parts (`from r15_clean import clean_prices`, and likewise `r15_features`, `r15_models`, `r15_evaluate`, `r15_portfolio`, `r15_backtest`, `r15_metrics`).

### Learn
Expect Ridge to be chosen, with a net Sharpe ratio between about 1 and 2, near-zero market beta, and a high DSR. Notice the cost story: LightGBM's forecasts are only modestly worse by IC, but they change more from week to week, and after costs its Sharpe falls much further. Gross versus net for the chosen model shows how much of the edge trading costs eat.

This is your interview project. Present it with the structure from the researcher interview playbook, then rerun it on real data in a notebook and report what holds up.
""",
        "starter": '''import numpy as np
import pandas as pd


def run_capstone(raw_prices: pd.DataFrame, raw_volume: pd.DataFrame, cost_bps: float = 5.0) -> dict:
    # return {"n_bad_ticks": ..., "model_table": ..., "chosen": ..., "net_sharpe": ..., "gross_sharpe": ..., "metrics": ...}
    pass
''',
        "solution": _IMPORTS + "\n\n".join([_CLEAN, _PANEL, _MODELS, _EVAL, _PORT, _BT, _DSR, _METRICS, _RUN]),
        "hints": ["Keep the weights for every model so you can rerun the chosen one with zero costs."],
        "rtol": 1e-6,
        "timeout": 900,
        "cases": lambda: [
            {"name": "raw universe, 5 bps", "sample": True, "args": _raw(1)},
            {"name": "another universe, 10 bps", "args": (*_raw(3), 10.0)},
        ],
    },
]
