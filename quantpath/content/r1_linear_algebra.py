import numpy as np
import pandas as pd

from data import factor_universe, yield_curve_changes

TITLE = "Linear algebra for quants"
SUMMARY = "Projections, eigen-decompositions, PCA, covariance matrices, Cholesky and repairing broken correlation matrices."
KIND = "core"

LESSON = r"""
Linear algebra is the language of portfolios, factor models and machine learning. Interviewers ask about eigenvalues, positive definiteness and PCA because they sit under every risk model.

## Core facts

- A matrix is a linear map. **Rank** = the number of independent columns; $X^\top X$ is invertible only if X has full column rank (no perfect multicollinearity).
- **Least squares** projects y onto the column space of X: $\hat\beta = (X^\top X)^{-1}X^\top y$, $\hat y = Hy$ with the hat matrix $H = X(X^\top X)^{-1}X^\top$. Residuals are orthogonal to every column: $X^\top(y - \hat y) = 0$.
- **Matrix calculus**: $\nabla_x\, b^\top x = b$, $\nabla_x\, x^\top A x = 2Ax$ for symmetric A. That's how you derive OLS and the minimum-variance portfolio.

## Symmetric matrices and covariance

Every symmetric matrix has real eigenvalues and orthogonal eigenvectors: $\Sigma = V\Lambda V^\top$ (spectral theorem).

- A covariance or correlation matrix must be **positive semi-definite** (PSD): $w^\top\Sigma w \ge 0$ for every w, since that's a portfolio variance. Equivalently all eigenvalues ≥ 0.
- Example: three assets with common correlation ρ are PSD only if $\rho \ge -\frac12$. You can't have three assets all strongly negatively correlated with each other.
- Correlation matrices estimated **pairwise** (with missing data) or edited by hand can fail to be PSD, which breaks optimizers and Cholesky. Repair them by clipping negative eigenvalues and rescaling the diagonal back to 1 (Higham's algorithm is the rigorous version).
- **Condition number** = λ_max / λ_min. Near-singular covariance matrices make optimized portfolios explode, which is one reason for shrinkage (Portfolio step).

## Cholesky: simulating correlated variables

If $\Sigma = LL^\top$ (L lower-triangular, exists for positive definite Σ) and z is a vector of independent standard normals, then $Lz$ has covariance Σ. That's how multi-asset Monte Carlo (basket options, portfolio VaR) generates correlated paths.

## PCA

PCA finds orthogonal directions of maximum variance: the eigenvectors of the covariance matrix, ordered by eigenvalue. The share of variance explained by component k is $\lambda_k/\sum_j\lambda_j$.

In finance:
- **Yield curves**: three components explain almost all daily moves: **level** (everything shifts), **slope** (short vs long), **curvature** (belly vs wings). Rates desks hedge in these terms.
- **Equities**: the first component is roughly the market (all loadings the same sign); the next ones look like sectors and styles. Statistical-arbitrage strategies trade the residuals after removing the top components.
- Eigenvectors are only defined up to sign, so fix a sign convention before comparing results.

## Library cheat sheet

```python
np.linalg.eigh(S)                  # symmetric eigendecomposition, eigenvalues ascending
np.linalg.cholesky(C)              # lower-triangular L with C = L @ L.T
np.linalg.lstsq(X, y, rcond=None)  # least squares, numerically stable
np.linalg.cond(S)                  # condition number
from sklearn.decomposition import PCA
pca = PCA(n_components=3).fit(X)   # centres X for you
pca.explained_variance_ratio_, pca.components_, pca.transform(X)
```
"""

QUESTIONS = [
    {"type": "number", "prompt": "What is the largest eigenvalue of the matrix [[2, 1], [1, 2]]?",
     "answer": 3, "explanation": "Eigenvalues of [[a, b], [b, a]] are a ± b: 3 (eigenvector (1, 1)) and 1 (eigenvector (1, −1))."},
    {"type": "choice", "prompt": "Is [[1, 2], [2, 1]] a valid correlation matrix?",
     "choices": ["No: it has a negative eigenvalue (−1) and the off-diagonals exceed 1", "Yes: it's symmetric", "Yes: its diagonal is 1", "Only for two assets"],
     "answer": 0, "explanation": "Its eigenvalues are 3 and −1, so it isn't PSD; besides, correlations must lie in [−1, 1]."},
    {"type": "number", "prompt": "Three assets have the same pairwise correlation ρ. What is the smallest ρ for which the correlation matrix is positive semi-definite?",
     "answer": -0.5, "explanation": "The eigenvalues are 1 + 2ρ (once) and 1 − ρ (twice). 1 + 2ρ ≥ 0 requires ρ ≥ −1/2."},
    {"type": "number", "prompt": "A covariance matrix has eigenvalues 3, 1 and 1. What fraction of total variance does the first principal component explain?",
     "answer": 0.6, "explanation": "3 / (3 + 1 + 1) = 0.6."},
    {"type": "number", "prompt": "u and v are non-zero vectors of length 10. What is the rank of the 10×10 matrix u vᵀ?",
     "answer": 1, "tol": 0, "explanation": "Every column of u vᵀ is a multiple of u."},
    {"type": "number", "prompt": "What is the determinant of [[3, 1], [1, 3]]?", "answer": 8, "explanation": "3 × 3 − 1 × 1 = 8 (= the product of the eigenvalues 4 and 2)."},
    {"type": "number", "prompt": "You project y = (1, 2) onto the line spanned by x = (1, 1). What is the regression coefficient?",
     "answer": 1.5, "explanation": "β = xᵀy / xᵀx = 3/2."},
    {"type": "choice", "prompt": "In PCA of daily government yield changes, how are the first three components usually interpreted?",
     "choices": ["Level, slope, curvature", "Inflation, growth, risk appetite", "Short, medium and long maturities separately", "Credit, liquidity, FX"],
     "answer": 0, "explanation": "Level (all yields move together) dominates, then slope (short vs long) and curvature (belly vs wings)."},
    {"type": "open", "prompt": "Why is the sample covariance matrix of 500 stocks estimated from 250 daily returns a problem for portfolio optimization?",
     "explanation": "With more assets (500) than observations (250) the sample covariance is singular (rank ≤ 249), so its inverse doesn't exist, and even with somewhat more data it's badly conditioned: the smallest eigenvalues are underestimated. A mean-variance optimizer then loads up on the directions that look riskless, giving extreme, unstable weights. Fixes: shrinkage (Ledoit–Wolf), factor models (Σ = BFBᵀ + D), longer or higher-frequency data, constraints, and regularized optimization."},
]


def _broken_corr(seed, n):
    rng = np.random.default_rng(seed)
    A = rng.uniform(-1, 1, (n, n))
    C = (A + A.T) / 2
    np.fill_diagonal(C, 1.0)
    return np.clip(C, -0.95, 0.95) + np.eye(n) * 0.05


def _pairwise_corr(seed):
    r = factor_universe(120, 10, seed=seed)["prices"].pct_change().iloc[1:]
    rng = np.random.default_rng(seed)
    r = r.mask(rng.random(r.shape) < 0.7)   # 70% missing: each pair is estimated on different dates
    return r.corr().to_numpy()


_PCA_EIG = '''def pca_eig(X, k: int) -> dict:
    X = np.asarray(X, dtype=float)
    Xc = X - X.mean(axis=0)
    vals, vecs = np.linalg.eigh(np.cov(Xc, rowvar=False))
    order = np.argsort(vals)[::-1][:k]
    comps = vecs[:, order].T
    signs = np.sign(comps[np.arange(k), np.abs(comps).argmax(axis=1)])
    comps = comps * signs[:, None]
    return {"components": comps, "explained_ratio": vals[order] / vals.sum(), "scores": Xc @ comps.T}
'''

PROBLEMS = [
    {
        "id": "r1_pca_scratch",
        "title": "PCA from the covariance matrix",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "pca_eig",
        "description": r"""
Implement PCA yourself, the way it's derived. Given a data matrix X (n observations × p variables) and k, return a dict:

- `components`: a k × p array whose rows are the top-k eigenvectors of the sample covariance matrix (ddof=1), largest eigenvalue first
- `explained_ratio`: each component's eigenvalue divided by the sum of **all** eigenvalues
- `scores`: the centred data projected onto the components, an n × k array

Sign convention (eigenvectors are only defined up to sign): flip each component so that its entry with the largest absolute value is positive.

### Learn
`np.linalg.eigh` is the right tool for symmetric matrices: real eigenvalues, orthonormal eigenvectors, returned in **ascending** order (reverse them). `np.cov(X, rowvar=False)` treats columns as variables.

The next task does the same with scikit-learn on yield-curve data; doing it by hand first is what lets you answer "what does PCA actually compute?" in an interview.
""",
        "starter": '''import numpy as np


def pca_eig(X, k: int) -> dict:
    # return {"components": ..., "explained_ratio": ..., "scores": ...}
    pass
''',
        "solution": "import numpy as np\n\n\n" + _PCA_EIG,
        "hints": ["Centre the columns first: `Xc = X - X.mean(axis=0)`.",
                  "`np.argsort(vals)[::-1]` orders eigenvalues from largest to smallest."],
        "cases": lambda: [
            {"name": "yield-curve changes, k = 3", "sample": True, "args": (yield_curve_changes(500, seed=1).to_numpy(), 3)},
            {"name": "stock returns, k = 2", "args": (factor_universe(500, 10, seed=2)["prices"].pct_change().iloc[1:].to_numpy(), 2)},
        ],
    },
    {
        "id": "r1_curve_pca",
        "title": "Yield-curve factors with scikit-learn",
        "difficulty": "Medium",
        "libs": ["scikit-learn", "pandas"],
        "fn": "yield_curve_factors",
        "description": r"""
Decompose daily yield-curve changes (a DataFrame, one column per maturity, ordered short to long) into level, slope and curvature with `sklearn.decomposition.PCA(n_components=k)`. Return a dict:

- `explained`: `explained_variance_ratio_` (array)
- `loadings`: a DataFrame of the components, index `["PC1", "PC2", …]`, columns = the maturities
- `scores`: a DataFrame of `pca.transform(changes)`, same index as the input, columns `["PC1", …]`

Sign convention, applied to both loadings and scores (flip a component and its scores together):
- PC1: the sum of its loadings is positive (a parallel rise in yields)
- PC2: last-maturity loading minus first-maturity loading is positive (steepening)
- PC3: the loading at the middle maturity (`columns[len(columns) // 2]`) is positive (the belly rises)

### Learn
This is exactly how rates desks summarize risk: "we're long 2 bp of level and short slope". With the synthetic data you'll see roughly 91% / 7% / 1% explained, with loadings shaped like a flat line, a downward slope and a hump, the textbook picture.

`PCA` centres the data itself. Plot `loadings.T` in a notebook to see the three shapes. The scores are the daily factor moves; a parallel shift shows up almost entirely in PC1.
""",
        "starter": '''import numpy as np
import pandas as pd
from sklearn.decomposition import PCA


def yield_curve_factors(changes: pd.DataFrame, k: int = 3) -> dict:
    # return {"explained": ..., "loadings": ..., "scores": ...}
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
from sklearn.decomposition import PCA


def yield_curve_factors(changes: pd.DataFrame, k: int = 3) -> dict:
    pca = PCA(n_components=k).fit(changes)
    comps, scores = pca.components_.copy(), pca.transform(changes)
    mid = len(changes.columns) // 2
    rules = [lambda c: c.sum(), lambda c: c[-1] - c[0], lambda c: c[mid]]
    for i in range(k):
        if rules[i](comps[i]) < 0:
            comps[i], scores[:, i] = -comps[i], -scores[:, i]
    names = [f"PC{i + 1}" for i in range(k)]
    return {"explained": pca.explained_variance_ratio_,
            "loadings": pd.DataFrame(comps, index=names, columns=changes.columns),
            "scores": pd.DataFrame(scores, index=changes.index, columns=names)}
''',
        "hints": ["Copy `components_` before flipping signs so you don't modify the fitted model."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "1,000 days of curve changes", "sample": True, "args": (yield_curve_changes(1000, seed=1),)},
            {"name": "another sample, 2 components", "args": (yield_curve_changes(600, seed=4), 2)},
        ],
    },
    {
        "id": "r1_correlated_paths",
        "title": "Correlated multi-asset paths with Cholesky",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "correlated_gbm",
        "description": r"""
Simulate one path of correlated geometric Brownian motions for several assets, as a basket-option or portfolio-risk Monte Carlo would. Inputs: start prices `S0`, drifts `mu`, volatilities `vols` (arrays of length n_assets), a correlation matrix `corr`, horizon `T` (years) and `n_steps`. Follow this recipe exactly:

1. `dt = T / n_steps`, `L = np.linalg.cholesky(corr)`, `rng = np.random.default_rng(seed)`
2. `z = rng.standard_normal((n_steps, n_assets)) @ L.T` (correlated standard normals)
3. log-returns `(mu - vols**2 / 2) * dt + vols * np.sqrt(dt) * z`
4. prices = S0 × exp(cumulative log-returns), with S0 as the first row

Return a numpy array of shape `(n_steps + 1, n_assets)`.

### Learn
Why `z @ L.T`: each row z is a vector of independent normals, and $L z$ has covariance $LL^\top$ = corr. Row-wise that's `z @ L.T`. Check it in a notebook: with 10,000 steps, `np.corrcoef` of the log-returns should be close to `corr`.

Cholesky fails if the matrix isn't positive definite, which leads straight to the next task.
""",
        "starter": '''import numpy as np


def correlated_gbm(S0, mu, vols, corr, T: float, n_steps: int, seed: int = 0) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def correlated_gbm(S0, mu, vols, corr, T: float, n_steps: int, seed: int = 0) -> np.ndarray:
    S0, mu, vols = (np.asarray(a, dtype=float) for a in (S0, mu, vols))
    dt = T / n_steps
    L = np.linalg.cholesky(np.asarray(corr, dtype=float))
    rng = np.random.default_rng(seed)
    z = rng.standard_normal((n_steps, len(S0))) @ L.T
    logret = (mu - vols**2 / 2) * dt + vols * np.sqrt(dt) * z
    return S0 * np.exp(np.vstack([np.zeros(len(S0)), logret.cumsum(axis=0)]))
''',
        "hints": ["Stack a row of zeros on top of the cumulative log-returns so the first row equals S0."],
        "cases": lambda: [
            {"name": "3 assets, 1 year daily", "sample": True,
             "args": ([100, 50, 20], [0.05, 0.07, 0.02], [0.2, 0.3, 0.15], [[1, 0.6, 0.2], [0.6, 1, 0.3], [0.2, 0.3, 1]], 1.0, 252)},
            {"name": "strongly correlated pair", "args": ([10, 10], [0.0, 0.0], [0.4, 0.4], [[1, 0.95], [0.95, 1]], 0.5, 126, 3)},
        ],
    },
    {
        "id": "r1_repair_corr",
        "title": "Repair a broken correlation matrix",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "repair_correlation",
        "description": r"""
A correlation matrix estimated pairwise from data with gaps, or adjusted by hand for a stress scenario, can fail to be positive semi-definite. Repair it:

1. symmetrize: $C \leftarrow (C + C^\top)/2$
2. eigen-decompose with `np.linalg.eigh` and clip the eigenvalues at `eps` (default 1e-8)
3. rebuild $C' = V\,\text{diag}(\lambda_{clipped})\,V^\top$
4. rescale to unit diagonal: $C'' = D^{-1/2}C'D^{-1/2}$ with D = diag(C′)

Return the repaired numpy array.

### Learn
Where broken matrices come from: `df.corr()` with missing values computes each pair on different dates, so the pieces needn't fit together (one of the tests builds a matrix exactly that way). The fix keeps the matrix as close as possible in spirit while making it usable for Cholesky, VaR and optimization. Higham's (2002) alternating-projections algorithm finds the truly nearest correlation matrix; this one-shot version is the common quick fix.

Check afterwards: `np.linalg.eigvalsh(result).min() >= -1e-12` and `np.diag(result)` is all ones.
""",
        "starter": '''import numpy as np


def repair_correlation(C, eps: float = 1e-8) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def repair_correlation(C, eps: float = 1e-8) -> np.ndarray:
    C = np.asarray(C, dtype=float)
    C = (C + C.T) / 2
    vals, vecs = np.linalg.eigh(C)
    fixed = vecs @ np.diag(np.maximum(vals, eps)) @ vecs.T
    d = 1 / np.sqrt(np.diag(fixed))
    return fixed * np.outer(d, d)
''',
        "hints": ["`np.outer(d, d)` builds the matrix of D^{-1/2} products for the rescaling."],
        "cases": lambda: [
            {"name": "hand-edited stress matrix", "sample": True, "args": ([[1, 0.9, 0.7], [0.9, 1, -0.4], [0.7, -0.4, 1]],)},
            {"name": "random symmetric 'correlations'", "args": (_broken_corr(1, 6),)},
            {"name": "pairwise estimates from gappy data", "args": (_pairwise_corr(1),)},
        ],
    },
]
