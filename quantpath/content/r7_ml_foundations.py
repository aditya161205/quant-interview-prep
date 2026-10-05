import numpy as np
import pandas as pd

from data import predictable_prices

TITLE = "Machine learning I: foundations"
SUMMARY = "Supervised learning, bias–variance, regularization, logistic regression from scratch, classification metrics, and leak-free cross-validation in scikit-learn."
KIND = "core"

LESSON = r"""
ML interviews for quant researchers are mostly about fundamentals: what a model is optimizing, why it overfits, how to evaluate it honestly, and what changes when the data is financial (tiny signal, non-stationary, autocorrelated).

## The setup

Learn $f(x)$ by minimizing average loss on training data (empirical risk minimization), hoping it generalizes. **Regression** uses squared error; **classification** uses log-loss (cross-entropy) $-[y\ln p + (1-y)\ln(1-p)]$.

## Bias–variance

For squared error: expected test error = **bias²** + **variance** + irreducible noise. Simple models underfit (high bias); flexible models overfit (high variance, chasing noise). Regularization, more data and simpler models trade variance for bias. In finance the noise term is enormous, so models must be **simpler and more regularized** than in typical ML problems.

## Logistic regression

$p = \sigma(w^\top x) = \frac{1}{1 + e^{-w^\top x}}$: a linear model of the log-odds. The gradient of the average log-loss is $\frac1n X^\top(p - y)$, the same form as linear regression's, which makes gradient descent simple. L2 regularization adds $\lambda w$ (not on the intercept). In scikit-learn, `C` is the **inverse** regularization strength.

## Classification metrics

| Metric | Meaning |
|---|---|
| precision = TP/(TP+FP) | of the predicted positives, how many were right |
| recall = TP/(TP+FN) | of the actual positives, how many you caught |
| F1 | harmonic mean of precision and recall |
| ROC AUC | probability a random positive is scored above a random negative; 0.5 = random |
| log-loss | rewards calibrated probabilities, punishes confident mistakes |

AUC is threshold-free and rank-based: the Mann–Whitney statistic. In daily return prediction an out-of-sample AUC of **0.52–0.55 is already valuable**; anything like 0.7 almost certainly means leakage.

## Validation done right

- Split train / validation / test; tune on validation, report on test once.
- Time series: **time-ordered** splits (`TimeSeriesSplit`), with a gap at least as long as the label horizon. Shuffled K-fold leaks the future through autocorrelation and overlapping labels.
- Put preprocessing (scaling, imputation, feature selection) **inside** a `Pipeline`, so it's refitted on each training fold only.

## Other essentials

- **k-NN** and the curse of dimensionality: in high dimensions every point is far from every other, so local methods need exponentially more data.
- **Class imbalance**: accuracy misleads (99% "no crash" is trivial); use precision/recall, AUC, or cost-weighted metrics.
- **Leakage checklist**: features computed with future data, scaling with full-sample statistics, target information in features, duplicated rows across splits.

## scikit-learn cheat sheet

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.metrics import roc_auc_score, log_loss, precision_score, recall_score
model = make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=1000))
cross_val_score(model, X, y, cv=TimeSeriesSplit(5, gap=5), scoring="roc_auc")
```
"""

QUESTIONS = [
    {"type": "number", "prompt": "A classifier makes 50 positive predictions, 40 of them correct (TP = 40, FP = 10). What is its precision?",
     "answer": 0.8, "explanation": "TP/(TP + FP) = 40/50 = 0.8."},
    {"type": "number", "prompt": "There were 100 actual positives and the classifier caught 40 of them. What is its recall?",
     "answer": 0.4, "explanation": "TP/(TP + FN) = 40/100 = 0.4."},
    {"type": "number", "prompt": "What is the F1 score for precision 0.8 and recall 0.4?",
     "answer": 2 * 0.8 * 0.4 / 1.2, "display": "≈ 0.533", "explanation": "2PR/(P + R) = 0.64/1.2 ≈ 0.533."},
    {"type": "number", "prompt": "A model predicts probability 0.9 for an example that turns out positive. What is its log-loss on that example (natural log)?",
     "answer": float(-np.log(0.9)), "display": "≈ 0.105", "explanation": "−ln(0.9) ≈ 0.105. Predicting 0.1 instead would cost −ln(0.1) ≈ 2.30."},
    {"type": "choice", "prompt": "As model complexity increases, what typically happens to bias and variance?",
     "choices": ["Bias falls, variance rises", "Both fall", "Both rise", "Bias rises, variance falls"],
     "answer": 0, "explanation": "Flexible models fit the training data (and its noise) more closely: lower bias, higher variance."},
    {"type": "number", "prompt": "What is the ROC AUC of a classifier that assigns random scores?", "answer": 0.5,
     "explanation": "A random positive is ranked above a random negative half the time."},
    {"type": "choice", "prompt": "In k-nearest neighbours, what does a very small k (say k = 1) tend to do?",
     "choices": ["Overfit: low bias, high variance", "Underfit: high bias, low variance", "Nothing; k doesn't matter", "Make the model linear"],
     "answer": 0, "explanation": "Each prediction copies its single nearest neighbour, noise included."},
    {"type": "choice", "prompt": "A daily return-direction model shows an out-of-sample AUC of 0.71. What is your first reaction?",
     "choices": ["Look for leakage (future data in features, overlapping labels, scaling on the full sample) before celebrating", "Deploy it immediately",
                 "Add more features to push it higher", "AUC is irrelevant for trading"],
     "answer": 0, "explanation": "Real daily signals rarely exceed AUC 0.55. Numbers far above that usually mean the model saw the future somewhere."},
    {"type": "open", "prompt": "Explain overfitting and how you would detect and prevent it in a financial ML model.",
     "explanation": "Overfitting means the model learned noise specific to the training sample, so it performs well in-sample and poorly out of sample. Detect it with a large gap between training and validation scores, unstable feature importances across periods, and poor walk-forward results. Prevent it with time-ordered validation (purged and embargoed), strong regularization, few well-motivated features, early stopping, ensembling, limiting the number of model variants tried (and accounting for them, e.g. the deflated Sharpe ratio), and keeping a final test period untouched until the end."},
]


def _logit_data(seed, n=500, p=3):
    rng = np.random.default_rng(seed)
    X = rng.standard_normal((n, p))
    w = rng.uniform(-1.5, 1.5, p)
    prob = 1 / (1 + np.exp(-(0.3 + X @ w)))
    return X, (rng.random(n) < prob).astype(float)


def _scores(seed, n=400):
    rng = np.random.default_rng(seed)
    y = rng.integers(0, 2, n)
    s = 1 / (1 + np.exp(-(0.8 * (2 * y - 1) + rng.standard_normal(n))))
    s[:40] = np.round(s[:40], 1)                      # some ties
    return y, s


def _direction_data(seed, n_days=2500):
    d = predictable_prices(n_days, seed=seed)
    r = d["close"].pct_change()
    X = pd.DataFrame({"r1": r, "r5": d["close"].pct_change(5), "r20": d["close"].pct_change(20),
                      "vol20": r.rolling(20).std(), "volume_z": (d["volume"] - d["volume"].rolling(20).mean()) / d["volume"].rolling(20).std()})
    y = (r.shift(-1) > 0).astype(int)
    keep = X.notna().all(axis=1) & r.shift(-1).notna()
    return X[keep], y[keep]


PROBLEMS = [
    {
        "id": "r7_logistic_scratch",
        "title": "Logistic regression from scratch",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "logistic_gd",
        "description": r"""
Train logistic regression by gradient descent. Prepend a column of ones to X (the intercept), start from $w = 0$, and take `n_iter` steps

$$w \leftarrow w - \eta\left(\frac1n X^\top(\sigma(Xw) - y) + \lambda\,\tilde w\right)$$

where σ is the sigmoid, η = `lr`, λ = `l2`, and $\tilde w$ equals w with its intercept entry set to 0 (the intercept isn't penalized). Return the weight vector (intercept first).

### Learn
The gradient has the same form as linear regression's, $X^\top(\text{prediction} - y)/n$, because log-loss and the sigmoid fit together neatly. That's a favourite interview derivation; do it on paper once.

Compare with `LogisticRegression(C=1/(l2 * n))`: scikit-learn's C is an inverse penalty on a *sum* of losses. With enough iterations your weights converge to the same optimum.
""",
        "starter": '''import numpy as np


def logistic_gd(X, y, lr: float = 0.5, n_iter: int = 1000, l2: float = 0.0) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def logistic_gd(X, y, lr: float = 0.5, n_iter: int = 1000, l2: float = 0.0) -> np.ndarray:
    y = np.asarray(y, dtype=float)
    X = np.column_stack([np.ones(len(y)), np.asarray(X, dtype=float)])
    w = np.zeros(X.shape[1])
    for _ in range(n_iter):
        p = 1 / (1 + np.exp(-X @ w))
        penalty = l2 * np.r_[0.0, w[1:]]
        w -= lr * (X.T @ (p - y) / len(y) + penalty)
    return w
''',
        "hints": ["`np.r_[0.0, w[1:]]` zeroes the intercept's entry in the penalty."],
        "cases": lambda: [
            {"name": "3 features", "sample": True, "args": _logit_data(1)},
            {"name": "with L2 penalty", "args": (*_logit_data(2), 0.5, 1000, 0.1)},
            {"name": "few iterations", "args": (*_logit_data(3, 300, 5), 0.1, 50)},
        ],
    },
    {
        "id": "r7_metrics",
        "title": "Classification metrics and AUC by ranks",
        "difficulty": "Medium",
        "libs": ["numpy", "scipy.stats"],
        "fn": "classification_metrics",
        "description": r"""
Given true labels (0/1), predicted probabilities `scores` and a `threshold`, return a dict:

- `accuracy`, `precision`, `recall`, `f1` for predictions `scores >= threshold`
- `auc`: the Mann–Whitney formula with average ranks for ties: $\text{AUC} = \frac{R_+ - n_+(n_+ + 1)/2}{n_+ n_-}$, where $R_+$ is the sum of the positives' ranks among all scores (`scipy.stats.rankdata`)
- `log_loss`: mean of $-[y\ln p + (1-y)\ln(1-p)]$, with p clipped to [1e-15, 1 − 1e-15]

### Learn
The rank formula shows what AUC really is: the probability that a random positive outranks a random negative. It's invariant to any monotone transformation of the scores, so it measures ranking ability only (which is exactly what a long/short strategy uses).

Check against `sklearn.metrics.roc_auc_score` and `log_loss` in a notebook; they should match to machine precision.
""",
        "starter": '''import numpy as np
from scipy.stats import rankdata


def classification_metrics(y_true, scores, threshold: float = 0.5) -> dict:
    # your code here
    pass
''',
        "solution": '''import numpy as np
from scipy.stats import rankdata


def classification_metrics(y_true, scores, threshold: float = 0.5) -> dict:
    y = np.asarray(y_true).astype(int)
    s = np.asarray(scores, dtype=float)
    pred = (s >= threshold).astype(int)
    tp, fp = np.sum((pred == 1) & (y == 1)), np.sum((pred == 1) & (y == 0))
    fn = np.sum((pred == 0) & (y == 1))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    n_pos, n_neg = y.sum(), len(y) - y.sum()
    auc = (rankdata(s)[y == 1].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)
    p = np.clip(s, 1e-15, 1 - 1e-15)
    return {"accuracy": np.mean(pred == y), "precision": precision, "recall": recall,
            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
            "auc": auc, "log_loss": -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))}
''',
        "hints": ["`rankdata` assigns average ranks to ties by default, which is what the formula needs."],
        "cases": lambda: [
            {"name": "400 scored examples", "sample": True, "args": _scores(1)},
            {"name": "threshold 0.7", "args": (*_scores(2), 0.7)},
        ],
    },
    {
        "id": "r7_walk_forward_cv",
        "title": "Walk-forward CV with a scikit-learn pipeline",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "pandas"],
        "fn": "walk_forward_auc",
        "description": r"""
Tune a logistic regression's regularization the way you would on a real research project. Features X (DataFrame) and labels y (next-day direction, 0/1) are in time order. For each `C` in `C_values`:

- `model = make_pipeline(StandardScaler(), LogisticRegression(C=C, max_iter=1000))`
- score it with `cross_val_score(model, X, y, cv=TimeSeriesSplit(n_splits, gap=gap), scoring="roc_auc")` and take the mean

Return a dict: `auc_by_C` (Series indexed by C) and `best_C` (the C with the highest mean AUC; ties go to the first).

### Learn
Everything that can leak is inside the pipeline (the scaler is refitted per fold) and the splits respect time, with a gap so that labels at the end of training don't overlap the test period. Expect AUCs between about 0.50 and 0.55: the data has a weak planted reversal effect, roughly what real daily signals look like. Differences between C values are small, which is itself a lesson: tuning can't create signal.
""",
        "starter": '''import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def walk_forward_auc(X: pd.DataFrame, y: pd.Series, C_values, n_splits: int = 5, gap: int = 5) -> dict:
    # return {"auc_by_C": ..., "best_C": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def walk_forward_auc(X: pd.DataFrame, y: pd.Series, C_values, n_splits: int = 5, gap: int = 5) -> dict:
    cv = TimeSeriesSplit(n_splits, gap=gap)
    auc = pd.Series({C: cross_val_score(make_pipeline(StandardScaler(), LogisticRegression(C=C, max_iter=1000)),
                                        X, y, cv=cv, scoring="roc_auc").mean() for C in C_values})
    return {"auc_by_C": auc, "best_C": auc.idxmax()}
''',
        "hints": ["`pd.Series({C: score for C in C_values})` keeps the C values as the index; `idxmax` picks the best."],
        "rtol": 1e-5,
        "cases": lambda: [
            {"name": "5 price features", "sample": True, "args": (*_direction_data(1), [0.001, 0.01, 0.1, 1.0])},
            {"name": "another sample, 3 folds", "args": (*_direction_data(2), [0.01, 1.0, 100.0], 3, 10)},
        ],
    },
    {
        "id": "r7_bias_variance",
        "title": "Measure bias and variance by simulation",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "bias_variance",
        "description": r"""
Estimate the bias–variance decomposition for polynomial regression. The truth is $f(x) = \sin(2\pi x)$ and the test grid is `np.linspace(0, 1, 50)`. With `rng = np.random.default_rng(seed)`, repeat `n_sims` times:

1. draw a training set: `x = rng.uniform(0, 1, n_train)`, then `y = f(x) + rng.normal(0, noise, n_train)` (in that order)
2. for every degree d in `degrees`, fit `np.polyfit(x, y, d)` and predict on the grid with `np.polyval`

Then for each degree: `bias2` = mean over the grid of (average prediction − f)², `variance` = mean over the grid of the variance of predictions across simulations (ddof=0), and `total` = bias2 + variance + noise². Return a DataFrame indexed by degree with those three columns.

### Learn
Plot the table: bias falls and variance rises with the degree, and the total error is U-shaped, lowest at a moderate degree. Shrink n_train or raise the noise and the best degree moves lower, which is the regime financial ML lives in: lots of noise, little data, so simple models win.
""",
        "starter": '''import numpy as np
import pandas as pd


def bias_variance(degrees, n_train: int = 30, n_sims: int = 200, noise: float = 0.3, seed: int = 0) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def bias_variance(degrees, n_train: int = 30, n_sims: int = 200, noise: float = 0.3, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    grid = np.linspace(0, 1, 50)
    truth = np.sin(2 * np.pi * grid)
    preds = {d: [] for d in degrees}
    for _ in range(n_sims):
        x = rng.uniform(0, 1, n_train)
        y = np.sin(2 * np.pi * x) + rng.normal(0, noise, n_train)
        for d in degrees:
            preds[d].append(np.polyval(np.polyfit(x, y, d), grid))
    rows = {}
    for d in degrees:
        P = np.array(preds[d])
        bias2 = np.mean((P.mean(axis=0) - truth) ** 2)
        var = np.mean(P.var(axis=0))
        rows[d] = {"bias2": bias2, "variance": var, "total": bias2 + var + noise**2}
    return pd.DataFrame.from_dict(rows, orient="index")
''',
        "hints": ["Keep a list of grid predictions per degree, then stack them into an (n_sims × 50) array."],
        "cases": lambda: [
            {"name": "degrees 1 to 9", "sample": True, "args": ([1, 3, 5, 7, 9],)},
            {"name": "small, noisy samples", "args": ([1, 2, 3, 6], 15, 150, 0.6, 2)},
        ],
    },
]
