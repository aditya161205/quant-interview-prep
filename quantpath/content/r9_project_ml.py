import numpy as np
import pandas as pd

from data import predictable_prices

TITLE = "Project lab: ML trading model"
SUMMARY = "Build a direction-prediction model end to end: leak-free features and labels, walk-forward logistic and LightGBM, probabilistic evaluation, and a costed strategy."
KIND = "project"

LESSON = r"""
This lab is the standard "predict tomorrow" research loop on one asset, done the way a careful researcher does it, with scikit-learn and LightGBM. Each part's output is the next part's input, and Part 5 runs everything with one call.

## The pipeline

```text
prices + volume
  ↓ Part 1  leak-free features, label (next day up?), forward return
  ↓ Part 2  walk-forward probabilities: logistic and LightGBM
  ↓ Part 3  evaluation: AUC, log-loss, Brier, versus the base rate
  ↓ Part 4  probabilities → positions → net returns after costs
  ↓ Part 5  one call that runs it all and reports
```

## The data

`data.predictable_prices()` produces a price and volume series with a **weak** planted edge: a 5-day reversal plus a faint 60-day trend, in a two-regime volatility environment. It's the realistic case: if your out-of-sample AUC is 0.52–0.55, you've found it; if it's 0.7, you've leaked the future.

## What each part teaches

1. **Features vs labels**: features may only look backward; the label looks forward by definition. A causality test perturbs future prices and checks your features don't move.
2. **Walk-forward training** with `TimeSeriesSplit(gap=...)`, a `Pipeline` for the linear model, and fixed-seed LightGBM.
3. **Probabilistic evaluation**: AUC (ranking), log-loss and Brier score (calibration), compared against the base rate. A model that can't beat "always predict the historical up-frequency" on log-loss isn't adding information.
4. **From prediction to P&L**: trade only when the model is confident (a band around 0.5), and pay costs on every change of position. Accuracy and profit are different things.
5. **The report**: metrics and net Sharpe ratios for both models side by side.

## After you pass

Run Part 5 on real data in a notebook (`yf.download("SPY", ...)` gives Close and Volume). Expect even weaker results. Then try a different horizon (weekly), adding a market-volatility feature, or longer training windows, and keep a log of everything you tried. That log is your N for the deflated Sharpe ratio.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "Your direction model has 54% accuracy but loses money after costs. Which is the most likely explanation?",
     "choices": ["It's right on small moves and wrong on big ones, and/or it trades so often that costs eat the edge", "54% accuracy always loses money",
                 "Accuracy doesn't matter at all", "The test set is too large"],
     "answer": 0, "explanation": "P&L depends on the size of the moves you get right and wrong, and on turnover. Evaluate the strategy (returns after costs), not just accuracy."},
    {"type": "choice", "prompt": "Why compare a model's log-loss against a base-rate forecast?",
     "choices": ["To check the probabilities carry information beyond the unconditional frequency of up days", "Log-loss is always lower for the base rate",
                 "To compute the Sharpe ratio", "Because AUC can't be computed otherwise"],
     "answer": 0, "explanation": "Predicting the historical up-frequency every day is the no-skill benchmark for probabilistic forecasts."},
    {"type": "open", "prompt": "Walk me through how you'd make sure an ML trading backtest has no look-ahead bias.",
     "explanation": "Features: built only from data available at the decision time (rolling or expanding windows, lagged fundamentals with reporting delays), verified with a perturbation test (change future data, confirm past features don't move). Labels: aligned so the decision at t earns the return from t to t+1, with no reuse of that return in features. Validation: time-ordered walk-forward splits with a gap or purging for overlapping labels; preprocessing fitted on training folds only. Execution: trade at the next available price with realistic costs. Process: a held-out final period, and a log of all variants tried."},
]


def _check_causal(fn):
    data = predictable_prices(800, seed=11)
    cut = 600
    X1 = fn(data)[0]
    bumped = data.copy()
    rng = np.random.default_rng(0)
    bumped.iloc[cut:, 0] *= np.exp(rng.normal(0, 0.05, len(data) - cut))
    bumped.iloc[cut:, 1] *= np.exp(rng.normal(0, 0.3, len(data) - cut))
    X2 = fn(bumped)[0]
    when = data.index[cut]
    a, b = X1[X1.index < when], X2[X2.index < when]
    assert a.shape == b.shape and np.allclose(a.to_numpy(), b.to_numpy(), equal_nan=True), (
        f"Changing prices/volume on or after {when:%Y-%m-%d} changed your features before that date: look-ahead. "
        "Features must only use data up to each row's date (labels are allowed to look forward).")


_FEATURES = '''def build_dataset(data: pd.DataFrame, horizon: int = 1) -> tuple:
    close, volume = data["close"], data["volume"]
    ret_1 = close.pct_change()
    X = pd.DataFrame({
        "ret_1": ret_1,
        "ret_5": close.pct_change(5),
        "ret_20": close.pct_change(20),
        "vol_20": ret_1.rolling(20).std(),
        "ma_gap": close / close.rolling(50).mean() - 1,
        "volume_z": (volume - volume.rolling(20).mean()) / volume.rolling(20).std(),
    })
    fwd = (close.shift(-horizon) / close - 1).rename("fwd")
    keep = X.notna().all(axis=1) & fwd.notna()
    return X[keep], (fwd[keep] > 0).astype(int).rename("y"), fwd[keep]
'''

_PARAMS = '''GBM = dict(n_estimators=200, learning_rate=0.03, num_leaves=7, min_child_samples=100, subsample=0.8,
           subsample_freq=1, colsample_bytree=0.8, random_state=0, n_jobs=1, verbose=-1)
'''

_PREDICT = '''def walk_forward_predict(X: pd.DataFrame, y: pd.Series, n_splits: int = 5, gap: int = 5) -> pd.DataFrame:
    out = []
    for tr, te in TimeSeriesSplit(n_splits, gap=gap).split(X):
        logit = make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=1000)).fit(X.iloc[tr], y.iloc[tr])
        gbm = LGBMClassifier(**GBM).fit(X.iloc[tr], y.iloc[tr])
        out.append(pd.DataFrame({"logistic": logit.predict_proba(X.iloc[te])[:, 1],
                                 "lightgbm": gbm.predict_proba(X.iloc[te])[:, 1]}, index=X.index[te]))
    return pd.concat(out)
'''

_EVAL = '''def evaluate_probs(preds: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
    y = y.loc[preds.index]
    base = np.full(len(y), y.mean())
    rows = {m: {"auc": roc_auc_score(y, preds[m]), "log_loss": log_loss(y, preds[m]),
                "brier": brier_score_loss(y, preds[m]), "base_log_loss": log_loss(y, base)} for m in preds.columns}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_STRAT = '''def probability_strategy(prob: pd.Series, fwd: pd.Series, band: float = 0.02, cost_bps: float = 5.0) -> pd.DataFrame:
    fwd = fwd.loc[prob.index]
    position = pd.Series(np.where(prob > 0.5 + band, 1.0, np.where(prob < 0.5 - band, -1.0, 0.0)), index=prob.index)
    gross = position * fwd
    cost = position.diff().fillna(position).abs() * cost_bps / 1e4
    return pd.DataFrame({"position": position, "gross": gross, "cost": cost, "net": gross - cost})
'''

_IMPORTS = '''import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

'''


def _ns():
    ns = {}
    exec(_IMPORTS + _PARAMS + "\n\n" + _FEATURES + "\n\n" + _PREDICT + "\n\n" + _EVAL + "\n\n" + _STRAT, ns)
    return ns


def _stage(seed, upto):
    ns = _ns()
    X, y, fwd = ns["build_dataset"](predictable_prices(2500, seed=seed))
    if upto == 1:
        return X, y
    preds = ns["walk_forward_predict"](X, y)
    return preds, y if upto == 2 else fwd


PROBLEMS = [
    {
        "id": "r9_dataset",
        "title": "Part 1 · Leak-free features and labels",
        "difficulty": "Medium",
        "libs": ["pandas"],
        "fn": "build_dataset",
        "description": r"""
From a DataFrame with columns `close` and `volume`, build the modelling dataset. Features at date t (only data up to t):

| feature | definition |
|---|---|
| `ret_1`, `ret_5`, `ret_20` | `close.pct_change(k)` for k = 1, 5, 20 |
| `vol_20` | 20-day rolling std of `ret_1` |
| `ma_gap` | close / 50-day moving average − 1 |
| `volume_z` | (volume − 20-day mean volume) / 20-day std of volume |

Target: `fwd` = close.shift(−horizon) / close − 1 (the return **after** t) and `y` = 1 if fwd > 0 else 0. Keep only rows where every feature and `fwd` exist. Return the tuple `(X, y, fwd)`.

### Learn
Features look backward, labels look forward, and the two meet in the same row. One test perturbs prices after a cutoff and checks that your features before the cutoff don't change; labels are exempt, since they're supposed to see the future.

`ma_gap` and `volume_z` are scale-free (ratios and z-scores), so they mean the same thing in 2015 and 2025. Raw prices or raw volume as features would let the model learn the date instead of the pattern.
""",
        "starter": '''import numpy as np
import pandas as pd


def build_dataset(data: pd.DataFrame, horizon: int = 1) -> tuple:
    # return X, y, fwd
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _FEATURES,
        "hints": ["Build all features in one DataFrame, then filter rows with a single boolean mask."],
        "cases": lambda: [
            {"name": "10 years of daily data", "sample": True, "args": (predictable_prices(2500, seed=1),)},
            {"name": "5-day horizon", "args": (predictable_prices(1500, seed=2), 5)},
            {"name": "features use only the past", "check": _check_causal},
        ],
    },
    {
        "id": "r9_walk_forward",
        "title": "Part 2 · Walk-forward out-of-sample probabilities",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "lightgbm"],
        "fn": "walk_forward_predict",
        "description": r"""
For each fold of `TimeSeriesSplit(n_splits, gap=gap)` on the dataset from Part 1, fit two models on the training rows:

- `make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=1000))`
- `LGBMClassifier(**GBM)` with the parameters in the starter

and predict the test rows' probability of an up day (`predict_proba(...)[:, 1]`). Return one DataFrame of all out-of-sample predictions with columns `logistic` and `lightgbm`, indexed by the test dates in time order.

### Learn
Each prediction comes from a model that never saw that date or anything after it, and the gap keeps the last training labels from overlapping the test period (it matters more for multi-day horizons). Refitting a fresh model per fold mimics periodic retraining in production.

Import your Part 1 with `from r9_dataset import build_dataset` when you experiment in a notebook.
""",
        "starter": _IMPORTS + _PARAMS + '''

def walk_forward_predict(X: pd.DataFrame, y: pd.Series, n_splits: int = 5, gap: int = 5) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _PARAMS + "\n\n" + _PREDICT,
        "hints": ["Build a small DataFrame of both models' predictions per fold, indexed by `X.index[te]`, and concatenate."],
        "rtol": 1e-5,
        "timeout": 300,
        "cases": lambda: [
            {"name": "dataset from Part 1", "sample": True, "args": _stage(1, 1)},
            {"name": "another series, 4 folds", "args": (*_stage(3, 1), 4, 10)},
        ],
    },
    {
        "id": "r9_evaluate",
        "title": "Part 3 · Evaluate the probabilities",
        "difficulty": "Easy",
        "libs": ["scikit-learn"],
        "fn": "evaluate_probs",
        "description": r"""
Score each column of `preds` (out-of-sample probabilities from Part 2) against the labels on the same dates. Return a DataFrame indexed by model name with columns:

- `auc`: `roc_auc_score`
- `log_loss`: `log_loss`
- `brier`: `brier_score_loss` (mean squared error of the probabilities)
- `base_log_loss`: the log-loss of predicting the constant up-frequency (the mean of y over those same dates) for every day

### Learn
AUC measures ranking; log-loss and Brier measure calibration and sharpness. Don't be surprised if both models beat 0.5 on AUC yet have log-loss slightly **worse** than the base rate, as in the sample: the ranking carries information while the probabilities are miscalibrated (too confident). Two remedies: calibrate (`CalibratedClassifierCV`, Platt or isotonic) or trade on ranks rather than raw probabilities. Plot a reliability diagram in a notebook with `sklearn.calibration.calibration_curve` to see it.
""",
        "starter": _IMPORTS + '''def evaluate_probs(preds: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _EVAL,
        "hints": ["Align the labels first: `y.loc[preds.index]`."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "predictions from Part 2", "sample": True, "args": _stage(1, 2)},
        ],
    },
    {
        "id": "r9_strategy",
        "title": "Part 4 · From probabilities to a costed strategy",
        "difficulty": "Medium",
        "libs": ["pandas", "numpy"],
        "fn": "probability_strategy",
        "description": r"""
Turn one model's probabilities into trades. At date t the model gives P(up from t to t+1); `fwd` (from Part 1) is that same forward return, already aligned at t.

1. position = +1 if prob > 0.5 + `band`, −1 if prob < 0.5 − `band`, otherwise 0
2. gross = position × fwd (no shift: both refer to t → t+1)
3. cost = |change in position| × `cost_bps`/10,000, where the first position counts as a change from flat
4. net = gross − cost

Return a DataFrame indexed like `prob` with columns `position`, `gross`, `cost`, `net`.

### Learn
Why no `.shift(1)` here when backtests usually need one? Because the forward return is already stored on the decision date. Mixing the two conventions (shifting an already-forward return, or not shifting a same-day return) is one of the most common bugs. Always write down which date each column refers to.

The band filters out low-conviction days, cutting turnover and costs. Try a few bands and costs in a notebook and watch the trade-off.
""",
        "starter": '''import numpy as np
import pandas as pd


def probability_strategy(prob: pd.Series, fwd: pd.Series, band: float = 0.02, cost_bps: float = 5.0) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _STRAT,
        "hints": ["`np.where` twice builds the three-state position."],
        "cases": lambda: [
            {"name": "logistic probabilities", "sample": True, "args": (_stage(1, 3)[0]["logistic"], _stage(1, 3)[1])},
            {"name": "LightGBM, no band, 10 bp", "args": (_stage(1, 3)[0]["lightgbm"], _stage(1, 3)[1], 0.0, 10.0)},
        ],
    },
    {
        "id": "r9_report",
        "title": "Part 5 · Run the whole ML lab",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "lightgbm", "pandas"],
        "fn": "ml_lab_report",
        "description": r"""
Chain Parts 1–4 into one function. From raw `data` (close, volume):

1. `X, y, fwd = build_dataset(data)`
2. `preds = walk_forward_predict(X, y, n_splits, gap)`
3. `metrics = evaluate_probs(preds, y)`
4. for each model column, run `probability_strategy(preds[model], fwd, band, cost_bps)` and compute the annualized net Sharpe ratio (mean/std × √252) and the average daily turnover (mean of |change in position|)

Return a dict: `metrics` (Part 3's DataFrame), `sharpe` (Series by model) and `turnover` (Series by model).

### Learn
One call, from raw prices to a comparison table, is what makes research repeatable: you can rerun it on new data, another asset or another cost assumption in seconds. Import your parts:

```python
from r9_dataset import build_dataset
from r9_walk_forward import walk_forward_predict
from r9_evaluate import evaluate_probs
from r9_strategy import probability_strategy
```
""",
        "starter": _IMPORTS + _PARAMS + '''

def ml_lab_report(data: pd.DataFrame, n_splits: int = 5, gap: int = 5, band: float = 0.02, cost_bps: float = 5.0) -> dict:
    # return {"metrics": ..., "sharpe": ..., "turnover": ...}
    pass
''',
        "solution": _IMPORTS + _PARAMS + "\n\n" + _FEATURES + "\n\n" + _PREDICT + "\n\n" + _EVAL + "\n\n" + _STRAT + '''

def ml_lab_report(data: pd.DataFrame, n_splits: int = 5, gap: int = 5, band: float = 0.02, cost_bps: float = 5.0) -> dict:
    X, y, fwd = build_dataset(data)
    preds = walk_forward_predict(X, y, n_splits, gap)
    sharpe, turnover = {}, {}
    for model in preds.columns:
        s = probability_strategy(preds[model], fwd, band, cost_bps)
        sharpe[model] = s["net"].mean() / s["net"].std() * np.sqrt(252)
        turnover[model] = s["position"].diff().fillna(s["position"]).abs().mean()
    return {"metrics": evaluate_probs(preds, y), "sharpe": pd.Series(sharpe), "turnover": pd.Series(turnover)}
''',
        "hints": ["Keep this function short: every step is a call to an earlier part."],
        "rtol": 1e-5,
        "timeout": 300,
        "cases": lambda: [
            {"name": "10-year series", "sample": True, "args": (predictable_prices(2500, seed=1),)},
            {"name": "another series, higher costs", "args": (predictable_prices(2500, seed=4), 5, 5, 0.03, 10.0)},
        ],
    },
]
