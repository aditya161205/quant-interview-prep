import numpy as np
import pandas as pd

from data import factor_universe, predictable_prices

TITLE = "Machine learning II: models"
SUMMARY = "Decision trees, random forests and gradient boosting, clustering, neural networks and backpropagation, and feature importance done properly."
KIND = "core"

LESSON = r"""
Beyond linear models, three families matter for quant research: **tree ensembles** (the default for tabular data), **clustering and other unsupervised methods** (structure in assets and regimes), and **neural networks** (when there's a lot of data and structure, such as order books, text or alternative data). Interviews test whether you understand how each works, not just its sklearn call.

## Decision trees

A tree recursively splits one feature at a threshold to make the children purer:
- regression: minimize the weighted **MSE** (variance) of the children
- classification: **Gini** $1 - \sum_k p_k^2$ or **entropy** $-\sum_k p_k\log_2 p_k$

Trees capture non-linearities and interactions and need no scaling, but a single deep tree overfits badly.

## Ensembles

- **Random forest**: average many deep trees trained on bootstrap samples with random feature subsets. Decorrelating the trees reduces **variance**. Robust and hard to break, with out-of-bag error estimates for free.
- **Gradient boosting** (XGBoost, LightGBM): add shallow trees sequentially, each fitted to the **negative gradient** of the loss (the residuals, for MSE), scaled by a learning rate. Reduces **bias**; the strongest general-purpose tabular learner, and the easiest to overfit.
- LightGBM knobs: `num_leaves` (complexity), `learning_rate` × `n_estimators`, `min_child_samples` (leaf size, crucial for noisy data), `subsample` and `colsample_bytree` (randomness), `reg_lambda`. For returns use small trees, large leaves and slow learning.

## Unsupervised learning

- **k-means**: alternate assigning points to the nearest centroid and recomputing centroids; minimizes within-cluster sum of squares (inertia). Sensitive to scale and initialization (use `n_init` > 1). Uses: grouping assets by return behaviour, regime detection, peer groups.
- **Hierarchical clustering** on correlation distances underlies hierarchical risk parity (HRP).
- **PCA** (Linear algebra step) for factors and denoising.

## Neural networks

Layers of affine maps and non-linearities (ReLU, tanh), trained by **backpropagation** (the chain rule applied layer by layer) with stochastic gradient descent or Adam. For a two-layer net with $h = \text{ReLU}(XW_1 + b_1)$ and $\hat y = hW_2 + b_2$, the backward pass is a few matrix products. Regularize with weight decay, dropout and early stopping. In finance NNs need much more data than trees to beat them, except on unstructured inputs.

## Feature importance

- Impurity ("split") importance is biased toward high-cardinality and noisy features.
- **Permutation importance**: shuffle one feature in the **test** set and measure how much the score drops. Model-agnostic and honest about what generalizes. SHAP values give per-prediction attributions.
- Correlated features share importance: permuting one barely hurts if its twin remains.
"""

QUESTIONS = [
    {"type": "number", "prompt": "What is the Gini impurity of a node that's 50% class A and 50% class B?",
     "answer": 0.5, "explanation": "1 − (0.5² + 0.5²) = 0.5, the maximum for two classes."},
    {"type": "number", "prompt": "What is the entropy, in bits, of a node with class proportions 0.25 and 0.75?",
     "answer": float(-(0.25 * np.log2(0.25) + 0.75 * np.log2(0.75))), "display": "≈ 0.811",
     "explanation": "−(0.25 log₂ 0.25 + 0.75 log₂ 0.75) = 0.5 + 0.311 ≈ 0.811."},
    {"type": "choice", "prompt": "How does a random forest improve on a single decision tree?",
     "choices": ["It averages many decorrelated trees, reducing variance", "It fits each tree to the previous tree's residuals, reducing bias",
                 "It uses linear models in the leaves", "It prunes trees more aggressively"],
     "answer": 0, "explanation": "Bagging plus random feature subsets decorrelate the trees, so averaging them cuts variance. Fitting residuals sequentially is boosting."},
    {"type": "choice", "prompt": "You lower a gradient-boosting model's learning rate from 0.1 to 0.01. What should you do with the number of trees?",
     "choices": ["Increase it (roughly 10×)", "Decrease it", "Keep it the same", "It doesn't matter"],
     "answer": 0, "explanation": "Each tree now contributes less, so you need more trees to reach the same fit. That usually generalizes better (shrinkage)."},
    {"type": "number", "prompt": "How many parameters (weights plus biases) does a dense layer mapping 10 inputs to 5 outputs have?",
     "answer": 55, "tol": 0, "explanation": "10 × 5 weights + 5 biases = 55."},
    {"type": "number", "prompt": "What is the derivative of ReLU at x = −2?", "answer": 0, "explanation": "ReLU(x) = max(0, x) is flat for x < 0."},
    {"type": "choice", "prompt": "In gradient boosting with squared-error loss, what is each new tree fitted to?",
     "choices": ["The current residuals (the negative gradient)", "The original targets", "Random noise", "The previous tree's predictions"],
     "answer": 0, "explanation": "For MSE the negative gradient with respect to the predictions is exactly the residual y − ŷ."},
    {"type": "open", "prompt": "When would you choose gradient boosting over a regularized linear model for return prediction, and what are the risks?",
     "explanation": "Boosting helps when there are genuine non-linearities or interactions (signals that only work in certain volatility regimes, sizes or sectors) and enough data to learn them, typically a large cross-sectional panel. Risks: overfitting noise (returns are mostly noise), instability across retrains, harder interpretation, and leakage through features. Mitigate with strong regularization (shallow trees, large min_child_samples, low learning rate), purged walk-forward validation, comparison against a linear baseline, and checks on the stability of feature importance over time."},
]


def _split_data(seed, n=200, task="regression"):
    rng = np.random.default_rng(seed)
    x = np.round(rng.uniform(0, 10, n), 1)
    if task == "regression":
        return x, np.where(x > 6.3, 2.0, 0.0) + rng.normal(0, 0.5, n), task
    return x, (rng.random(n) < np.where(x > 4.1, 0.8, 0.2)).astype(int), task


def _features(seed, n_days=2500):
    d = predictable_prices(n_days, seed=seed)
    r = d["close"].pct_change()
    rng = np.random.default_rng(seed + 50)
    X = pd.DataFrame({"r1": r, "r5": d["close"].pct_change(5), "r20": d["close"].pct_change(20),
                      "r60": d["close"].pct_change(60), "vol20": r.rolling(20).std(),
                      "noise1": rng.standard_normal(n_days), "noise2": rng.standard_normal(n_days)}, index=d.index)
    y = (r.shift(-1) > 0).astype(int)
    keep = X.notna().all(axis=1) & r.shift(-1).notna()
    return X[keep], y[keep]


def _asset_features(seed):
    u = factor_universe(500, 24, seed=seed)
    r = u["prices"].pct_change().iloc[1:]
    f = pd.concat([u["betas"], (r.std() * np.sqrt(252)).rename("vol")], axis=1)
    return ((f - f.mean()) / f.std()).to_numpy()


def _net(seed, n=32, d=4, h=6):
    rng = np.random.default_rng(seed)
    return (rng.standard_normal((n, d)), rng.standard_normal((n, 1)), rng.standard_normal((d, h)) * 0.5,
            rng.standard_normal(h) * 0.1, rng.standard_normal((h, 1)) * 0.5, rng.standard_normal(1) * 0.1)


_MODELS = '''RF = dict(n_estimators=200, max_depth=3, min_samples_leaf=50, random_state=0, n_jobs=1)
GBM = dict(n_estimators=200, learning_rate=0.03, num_leaves=7, min_child_samples=100, subsample=0.8,
           subsample_freq=1, colsample_bytree=0.8, random_state=0, n_jobs=1, verbose=-1)
'''

PROBLEMS = [
    {
        "id": "r8_best_split",
        "title": "Find a decision tree's best split",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "best_split",
        "description": r"""
Implement the core step of a decision tree for one feature. Candidate thresholds are the midpoints between consecutive **distinct** sorted values of `x`; a split sends `x <= threshold` left. For each candidate compute the weighted child impurity
$\frac{n_L}{n}I(L) + \frac{n_R}{n}I(R)$ with
- `task="regression"`: I = variance (mean squared deviation from the node mean)
- `task="classification"`: I = Gini, $1 - \sum_k p_k^2$

Return a dict: `threshold` (the best one; ties go to the smallest) and `gain` = I(parent) − best weighted child impurity.

### Learn
Every tree library repeats this search over all features at every node; LightGBM speeds it up by binning features into histograms. The test data has a true break at x ≈ 6.3 (regression) and 4.1 (classification); see whether the best split finds it.

Vectorizing is optional: a loop over candidates is fine for a few hundred points.
""",
        "starter": '''import numpy as np


def best_split(x, y, task: str = "regression") -> dict:
    # return {"threshold": ..., "gain": ...}
    pass
''',
        "solution": '''import numpy as np


def best_split(x, y, task: str = "regression") -> dict:
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)

    def impurity(v):
        if task == "regression":
            return np.mean((v - v.mean()) ** 2)
        p = np.mean(v)
        return 1 - p**2 - (1 - p) ** 2

    values = np.unique(x)
    best_t, best_imp = None, np.inf
    for t in (values[:-1] + values[1:]) / 2:
        left, right = y[x <= t], y[x > t]
        imp = (len(left) * impurity(left) + len(right) * impurity(right)) / len(y)
        if imp < best_imp:
            best_t, best_imp = t, imp
    return {"threshold": best_t, "gain": impurity(y) - best_imp}
''',
        "hints": ["`np.unique` returns sorted distinct values; midpoints are `(v[:-1] + v[1:]) / 2`.",
                  "For 0/1 labels the Gini impurity is 1 − p² − (1 − p)² with p the share of ones."],
        "cases": lambda: [
            {"name": "regression with a step at 6.3", "sample": True, "args": _split_data(1)},
            {"name": "classification with a step at 4.1", "args": _split_data(2, task="classification")},
        ],
    },
    {
        "id": "r8_tree_models",
        "title": "Random forest vs LightGBM vs logistic, walk-forward",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "lightgbm", "pandas"],
        "fn": "compare_models",
        "description": r"""
Compare three classifiers out of sample on next-day direction, with the parameter dicts `RF` and `GBM` given in the starter (fixed seeds and `n_jobs=1` keep the results reproducible):

- `logistic`: `make_pipeline(StandardScaler(), LogisticRegression(C=0.01, max_iter=1000))`
- `random_forest`: `RandomForestClassifier(**RF)`
- `lightgbm`: `LGBMClassifier(**GBM)`

For each fold of `TimeSeriesSplit(n_splits, gap=gap)`, fit every model on the training rows and predict the test rows' probability of class 1 (`predict_proba(...)[:, 1]`). Concatenate each model's out-of-sample predictions over the folds and return a Series of `roc_auc_score(y_test_all, predictions)` indexed by model name.

### Learn
Notice the heavy regularization: shallow trees, large leaves (`min_samples_leaf=50`, `min_child_samples=100`), a slow learning rate. With a weak signal and lots of noise, default settings overfit. Expect all three AUCs in the 0.50–0.56 range; the flexible models don't automatically win. Report the linear baseline alongside every fancy model, the way a good research note does.
""",
        "starter": '''import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

''' + _MODELS + '''

def compare_models(X: pd.DataFrame, y: pd.Series, n_splits: int = 5, gap: int = 5) -> pd.Series:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

''' + _MODELS + '''

def compare_models(X: pd.DataFrame, y: pd.Series, n_splits: int = 5, gap: int = 5) -> pd.Series:
    makers = {"logistic": lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.01, max_iter=1000)),
              "random_forest": lambda: RandomForestClassifier(**RF),
              "lightgbm": lambda: LGBMClassifier(**GBM)}
    preds, truth = {m: [] for m in makers}, []
    for tr, te in TimeSeriesSplit(n_splits, gap=gap).split(X):
        truth.append(y.iloc[te].to_numpy())
        for name, make in makers.items():
            model = make().fit(X.iloc[tr], y.iloc[tr])
            preds[name].append(model.predict_proba(X.iloc[te])[:, 1])
    y_all = np.concatenate(truth)
    return pd.Series({name: roc_auc_score(y_all, np.concatenate(p)) for name, p in preds.items()})
''',
        "hints": ["Create a fresh model per fold (a dict of constructor lambdas keeps this tidy)."],
        "rtol": 1e-5,
        "timeout": 300,
        "cases": lambda: [
            {"name": "7 features incl. 2 pure noise", "sample": True, "args": _features(1)},
            {"name": "another sample, 4 folds", "args": (*_features(3), 4, 10)},
        ],
    },
    {
        "id": "r8_kmeans",
        "title": "k-means clustering of assets",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "kmeans",
        "description": r"""
Implement k-means and use it to group stocks by their (standardized) factor betas and volatility. Start with the rows `X[init_idx]` as centroids, then repeat up to `n_iter` times:

1. assign each point to its nearest centroid (Euclidean distance; ties go to the lower index)
2. move each centroid to the mean of its assigned points (leave it in place if no points are assigned)
3. stop early if no assignment changed

Return a dict: `labels` (array of cluster indices), `centers` (k × d array) and `inertia` (the sum of squared distances to the assigned centroids).

### Learn
Broadcasting computes all point-to-centroid distances at once: `((X[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)` has shape (n, k). In practice you'd use `sklearn.cluster.KMeans(n_clusters=k, n_init=10)`, which reruns from several initializations because k-means only finds a local optimum. Compare your result with it in a notebook.

Clustering stocks by behaviour rather than by official sector labels is a common first step in building peer groups and statistical risk models.
""",
        "starter": '''import numpy as np


def kmeans(X, k: int, init_idx, n_iter: int = 100) -> dict:
    # return {"labels": ..., "centers": ..., "inertia": ...}
    pass
''',
        "solution": '''import numpy as np


def kmeans(X, k: int, init_idx, n_iter: int = 100) -> dict:
    X = np.asarray(X, dtype=float)
    C = X[list(init_idx)].copy()
    labels = None
    for _ in range(n_iter):
        d2 = ((X[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)
        new = d2.argmin(axis=1)
        if labels is not None and np.array_equal(new, labels):
            break
        labels = new
        for j in range(k):
            if np.any(labels == j):
                C[j] = X[labels == j].mean(axis=0)
    d2 = ((X - C[labels]) ** 2).sum()
    return {"labels": labels, "centers": C, "inertia": float(d2)}
''',
        "hints": ["`argmin(axis=1)` picks the first (lowest-index) centroid on ties."],
        "cases": lambda: [
            {"name": "24 stocks, 3 clusters", "sample": True, "args": (_asset_features(1), 3, [0, 1, 2])},
            {"name": "4 clusters", "args": (_asset_features(2), 4, [3, 7, 11, 15])},
        ],
    },
    {
        "id": "r8_backprop",
        "title": "Backpropagation for a two-layer network",
        "difficulty": "Hard",
        "libs": ["numpy"],
        "fn": "two_layer_net",
        "description": r"""
Compute the forward pass, the loss and every gradient of a two-layer regression network:

$$H = \text{ReLU}(XW_1 + b_1), \qquad \hat Y = HW_2 + b_2, \qquad L = \frac1n\sum(\hat Y - Y)^2$$

Shapes: X (n × d), Y (n × 1), W1 (d × h), b1 (h,), W2 (h × 1), b2 (1,). Return a dict with `loss` and the gradients `dW1`, `db1`, `dW2`, `db2` (same shapes as the parameters).

### Learn
Backward pass, one chain-rule step at a time:
- $\partial L/\partial\hat Y = \frac{2}{n}(\hat Y - Y)$
- $dW_2 = H^\top\,\partial\hat Y$, $db_2 = \sum_{\text{rows}}\partial\hat Y$
- $\partial H = \partial\hat Y\,W_2^\top$, then $\partial Z_1 = \partial H \odot \mathbb 1[Z_1 > 0]$ (ReLU's derivative)
- $dW_1 = X^\top\partial Z_1$, $db_1 = \sum_{\text{rows}}\partial Z_1$

Check your gradients numerically: nudge one weight by ε = 1e-6 and compare (L(w + ε) − L(w − ε))/2ε with your analytic value. Gradient checking is how deep-learning code gets debugged, and "derive backprop for a small net" is a common interview question.
""",
        "starter": '''import numpy as np


def two_layer_net(X, Y, W1, b1, W2, b2) -> dict:
    # return {"loss": ..., "dW1": ..., "db1": ..., "dW2": ..., "db2": ...}
    pass
''',
        "solution": '''import numpy as np


def two_layer_net(X, Y, W1, b1, W2, b2) -> dict:
    n = len(X)
    Z1 = X @ W1 + b1
    H = np.maximum(Z1, 0)
    Y_hat = H @ W2 + b2
    loss = np.mean((Y_hat - Y) ** 2)
    dY = 2 * (Y_hat - Y) / n
    dW2, db2 = H.T @ dY, dY.sum(axis=0)
    dZ1 = (dY @ W2.T) * (Z1 > 0)
    return {"loss": loss, "dW1": X.T @ dZ1, "db1": dZ1.sum(axis=0), "dW2": dW2, "db2": db2}
''',
        "hints": ["Keep Z1 (the pre-activation) from the forward pass: ReLU's derivative needs it."],
        "cases": lambda: [
            {"name": "32 × 4 input, 6 hidden units", "sample": True, "args": _net(1)},
            {"name": "bigger batch and layer", "args": _net(2, 100, 8, 16)},
        ],
    },
    {
        "id": "r8_permutation",
        "title": "Permutation importance on held-out data",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "lightgbm"],
        "fn": "test_importance",
        "description": r"""
Train `LGBMClassifier(**GBM)` on the first `train_frac` of the rows (time order) and measure feature importance on the remaining rows with scikit-learn:

```python
from sklearn.inspection import permutation_importance
res = permutation_importance(model, X_test, y_test, scoring="roc_auc", n_repeats=n_repeats, random_state=seed)
```

Return a Series of `res.importances_mean` indexed by feature name, sorted from most to least important.

### Learn
Permutation importance answers "how much worse does the model get **on new data** if this feature is scrambled?". The features include two columns of pure noise. With a signal this weak, the importance estimates are noisy themselves: in the sample the planted reversal feature `r5` ranks first, yet a noise column lands close behind it. So look at `res.importances_std`, rerun on other test periods, and trust only rankings that are stable. Compare with `model.feature_importances_` (split counts), which ranks noise features highly because trees split on them in training.
""",
        "starter": '''import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.inspection import permutation_importance

''' + _MODELS + '''

def test_importance(X: pd.DataFrame, y: pd.Series, train_frac: float = 0.7, n_repeats: int = 10, seed: int = 0) -> pd.Series:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.inspection import permutation_importance

''' + _MODELS + '''

def test_importance(X: pd.DataFrame, y: pd.Series, train_frac: float = 0.7, n_repeats: int = 10, seed: int = 0) -> pd.Series:
    cut = int(len(X) * train_frac)
    model = LGBMClassifier(**GBM).fit(X.iloc[:cut], y.iloc[:cut])
    res = permutation_importance(model, X.iloc[cut:], y.iloc[cut:], scoring="roc_auc",
                                 n_repeats=n_repeats, random_state=seed)
    return pd.Series(res.importances_mean, index=X.columns).sort_values(ascending=False)
''',
        "hints": ["Split by position (`iloc`), never randomly: the test rows must come after the training rows."],
        "rtol": 1e-5,
        "timeout": 300,
        "cases": lambda: [
            {"name": "7 features incl. 2 noise", "sample": True, "args": _features(1)},
            {"name": "another sample", "args": (*_features(4), 0.6, 5, 3)},
        ],
    },
]
