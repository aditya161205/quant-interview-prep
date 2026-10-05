import numpy as np
import pandas as pd

from data import factor_universe

TITLE = "Project lab: factor model research"
SUMMARY = "Explain 30 stocks with market, size and value factors in statsmodels: exposures, rolling betas, which alphas survive multiple testing, and what the factors miss."
KIND = "project"

LESSON = r"""
Every equity research group starts here: before claiming a stock or strategy has alpha, explain its returns with known factors and see what's left. In this lab you'll build that analysis in five parts, each feeding the next, with the libraries researchers actually use (statsmodels and pandas).

## The pipeline

```text
prices → returns
  ↓ Part 1  factor regressions: alpha, betas, HAC t-stats
  ↓ Part 2  rolling betas: are exposures stable?
  ↓ Part 3  which alphas survive multiple testing?
  ↓ Part 4  residual structure: is a factor missing?
  ↓ Part 5  one function that runs it all and returns a report
```

## The data

`data.factor_universe()` simulates 10 years of 30 stocks driven by three factors (MKT, SMB, HML), with **true alpha planted in T00, T01 and T02**. You know the ground truth, so you can judge your methods. The planted alphas are large (25–35% a year) so the methods can find them. Real alphas are far smaller: a 5% alpha with 25% idiosyncratic volatility needs about $(2 \times 25/5)^2 = 100$ years of data to reach t = 2. On real data, factor returns come from Kenneth French's data library:

```python
url = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip"
ff = pd.read_csv(url, skiprows=3, index_col=0)   # values in %, last rows are a footer to drop
```

## What each part teaches

1. **Time-series factor regressions** with Newey–West standard errors: the exposures and alpha of each stock.
2. **Rolling betas** with `RollingOLS`: exposures drift, which matters for hedging.
3. **Multiple testing**: 30 alphas tested at 5% produce about 1.5 false discoveries by chance. Benjamini–Hochberg via `statsmodels.stats.multitest.multipletests` keeps the false discovery rate in check.
4. **Residual analysis**: if the residuals are still strongly correlated, the model is missing a common factor. Compare the first principal component's share before and after removing the factors.
5. **The report**: a single function a colleague can call on new data.

## Interview angle

"How would you test whether a fund manager has skill?" Regress the returns on the relevant factors, look at the alpha's robust t-stat, check stability over time, correct for how many managers or strategies were examined, and examine the residuals for missing exposures.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "A fund's returns regressed on the market show alpha 4% a year (t = 2.5). Adding size and value factors drops the alpha to 0.5% (t = 0.3). What do you conclude?",
     "choices": ["The 'alpha' was mostly compensation for size/value exposure that's cheap to replicate", "The fund has skill; the extra factors add noise",
                 "The regression is broken", "Size and value factors always remove alpha"],
     "answer": 0, "explanation": "Alpha is defined relative to a model. If known factor exposures explain the returns, you're paying active fees for something you could get from cheap factor funds."},
    {"type": "number", "prompt": "You test 30 stocks for non-zero alpha at the 5% level, but none truly has alpha. How many false discoveries do you expect?",
     "answer": 1.5, "explanation": "30 × 0.05 = 1.5. That's why you control the false discovery rate."},
    {"type": "open", "prompt": "Your factor model's residuals are still strongly correlated across stocks. What does that tell you and what would you do?",
     "explanation": "A common factor is missing (an industry, momentum, rates sensitivity…), so the residuals share a driver. Risk is understated and 'alpha' estimates may be contaminated. Run PCA on the residuals to see the missing factor's loadings, try to interpret it (do the loadings line up with sectors?), and add an explicit factor or a statistical one to the model."},
]


def _lab(seed, n=30):
    """10 years of daily data with three large planted alphas (25-35% a year) in T00-T02."""
    return factor_universe(2520, n, alpha_stocks=3, alpha_range=(0.25, 0.35), seed=seed)


def _universe(seed, n=30):
    u = _lab(seed, n)
    return u["prices"].pct_change().iloc[1:], u["factors"].iloc[1:]


_REG = '''def factor_regressions(stock_returns: pd.DataFrame, factors: pd.DataFrame, hac_lags: int = 5) -> pd.DataFrame:
    X = sm.add_constant(factors)
    rows = {}
    for stock in stock_returns.columns:
        res = sm.OLS(stock_returns[stock], X, missing="drop").fit(cov_type="HAC", cov_kwds={"maxlags": hac_lags})
        rows[stock] = {"alpha_ann": res.params["const"] * 252, "alpha_t": res.tvalues["const"],
                       **{f"beta_{f}": res.params[f] for f in factors.columns},
                       "r2": res.rsquared, "resid_vol": res.resid.std() * np.sqrt(252)}
    return pd.DataFrame.from_dict(rows, orient="index")
'''

_BH = '''def alpha_discoveries(table: pd.DataFrame, q: float = 0.10) -> pd.DataFrame:
    p = 2 * norm.sf(np.abs(table["alpha_t"]))
    reject, p_adj, _, _ = multipletests(p, alpha=q, method="fdr_bh")
    return pd.DataFrame({"p_value": p, "p_adjusted": p_adj, "discovery": reject}, index=table.index)
'''

_RESID = '''def residual_structure(stock_returns: pd.DataFrame, factors: pd.DataFrame) -> dict:
    X = sm.add_constant(factors)
    resid = pd.DataFrame({s: sm.OLS(stock_returns[s], X).fit().resid for s in stock_returns.columns})

    def stats(df):
        C = df.corr().to_numpy()
        off = C[~np.eye(len(C), dtype=bool)]
        eig = np.linalg.eigvalsh(C)
        return np.abs(off).mean(), eig[-1] / eig.sum()

    raw_corr, raw_pc = stats(stock_returns)
    res_corr, res_pc = stats(resid)
    return {"mean_abs_corr_raw": raw_corr, "mean_abs_corr_resid": res_corr,
            "top_pc_share_raw": raw_pc, "top_pc_share_resid": res_pc}
'''

_IMPORTS = '''import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import norm
from statsmodels.stats.multitest import multipletests


'''


def _table(seed):
    ns = {}
    exec(_IMPORTS + _REG, ns)
    return ns["factor_regressions"](*_universe(seed))


PROBLEMS = [
    {
        "id": "r4_factor_regressions",
        "title": "Part 1 · Factor regressions with Newey–West t-stats",
        "difficulty": "Medium",
        "libs": ["statsmodels", "pandas"],
        "fn": "factor_regressions",
        "description": r"""
For each stock (column of `stock_returns`), regress its daily returns on a constant plus every column of `factors` with statsmodels, using HAC standard errors: `sm.OLS(y, sm.add_constant(factors), missing="drop").fit(cov_type="HAC", cov_kwds={"maxlags": hac_lags})`. Return a DataFrame indexed by stock with columns:

- `alpha_ann`: the constant × 252
- `alpha_t`: the constant's (HAC) t-statistic
- `beta_<factor>` for each factor column, e.g. `beta_MKT`, `beta_SMB`, `beta_HML`
- `r2`: R-squared; `resid_vol`: residual std × √252

### Learn
`res.params` and `res.tvalues` are Series labelled by column name (`"const"`, `"MKT"`, …), so index them by name rather than position. With the synthetic universe, compare your estimated betas with `factor_universe(...)["betas"]` and your alphas with the planted ones: T00–T02 have real alpha, the rest none.

Typical R² for single stocks is 0.2–0.5: most of a stock's daily variance is idiosyncratic.
""",
        "starter": _IMPORTS + '''def factor_regressions(stock_returns: pd.DataFrame, factors: pd.DataFrame, hac_lags: int = 5) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _REG,
        "hints": ["Loop over stocks, fit once each, and collect a dict of results per stock; build the DataFrame at the end."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "30 stocks, 10 years", "sample": True, "args": _universe(2)},
            {"name": "another universe, 10 lags", "args": (*_universe(1, 20), 10)},
        ],
    },
    {
        "id": "r4_rolling_beta",
        "title": "Part 2 · Rolling market betas",
        "difficulty": "Easy",
        "libs": ["statsmodels", "pandas"],
        "fn": "rolling_market_beta",
        "description": r"""
Estimate each stock's market beta on a rolling window with `statsmodels.regression.rolling.RollingOLS`: for each stock, regress its returns on a constant and `market` over the trailing `window` days. Return a DataFrame (same index and columns as `stock_returns`) of the market coefficient, NaN until the first full window.

### Learn
`RollingOLS(y, sm.add_constant(market), window=window).fit().params` gives one row of coefficients per date; take the market column. A full-sample beta hides drift. Rolling betas show whether a hedge ratio estimated last year still applies today. Plot a few stocks' rolling betas in a notebook: in this synthetic data the true betas are constant, so every wiggle you see is estimation noise, a useful calibration for how noisy real rolling betas are.
""",
        "starter": '''import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.regression.rolling import RollingOLS


def rolling_market_beta(stock_returns: pd.DataFrame, market: pd.Series, window: int = 126) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.regression.rolling import RollingOLS


def rolling_market_beta(stock_returns: pd.DataFrame, market: pd.Series, window: int = 126) -> pd.DataFrame:
    X = sm.add_constant(market.rename("MKT"))
    return pd.DataFrame({s: RollingOLS(stock_returns[s], X, window=window).fit().params["MKT"]
                         for s in stock_returns.columns})
''',
        "hints": ["Rename the market Series so you know its column name in `params`."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "6 stocks, 126-day window", "sample": True, "args": (_universe(2)[0].iloc[:, :6], _universe(2)[1]["MKT"])},
            {"name": "60-day window", "args": (_universe(3)[0].iloc[:, :8], _universe(3)[1]["MKT"], 60)},
        ],
    },
    {
        "id": "r4_discoveries",
        "title": "Part 3 · Which alphas survive multiple testing?",
        "difficulty": "Medium",
        "libs": ["statsmodels", "scipy.stats"],
        "fn": "alpha_discoveries",
        "description": r"""
Take the table from Part 1 and decide which alphas are real discoveries:

1. two-sided p-values from the alpha t-stats with a normal approximation: `2 * norm.sf(abs(t))`
2. Benjamini–Hochberg at false discovery rate `q`: `reject, p_adj, _, _ = multipletests(p, alpha=q, method="fdr_bh")`

Return a DataFrame indexed by stock with columns `p_value`, `p_adjusted` and `discovery` (bool).

### Learn
Compare with a naive "p < 0.05" rule. On the sample universe, BH flags exactly the three planted stocks, while the naive rule also flags a stock with no alpha at all. With planted alphas you can count true and false discoveries exactly; on real data you never know the truth, which is why the procedure matters.
""",
        "starter": _IMPORTS + '''def alpha_discoveries(table: pd.DataFrame, q: float = 0.10) -> pd.DataFrame:
    # your code here
    pass
''',
        "solution": _IMPORTS + _BH,
        "hints": ["`multipletests` returns four values; the first two are the reject flags and adjusted p-values."],
        "cases": lambda: [
            {"name": "table from Part 1", "sample": True, "args": (_table(2),)},
            {"name": "stricter FDR (q = 0.05)", "args": (_table(1), 0.05)},
        ],
    },
    {
        "id": "r4_residuals",
        "title": "Part 4 · What do the factors miss?",
        "difficulty": "Medium",
        "libs": ["statsmodels", "numpy"],
        "fn": "residual_structure",
        "description": r"""
Check how much common structure the factor model removes. Compute residuals stock by stock from full-sample OLS on a constant plus the factors (`sm.OLS(...).fit().resid`). Then, for both the raw returns and the residuals, compute from the correlation matrix C:

- the mean absolute off-diagonal correlation
- the share of the largest eigenvalue: λ_max / Σλ (the first principal component's share)

Return a dict with `mean_abs_corr_raw`, `mean_abs_corr_resid`, `top_pc_share_raw` and `top_pc_share_resid`.

### Learn
Raw stock returns share a strong first component (the market). If the factors capture the common drivers, the residuals' correlations collapse toward zero and their first PC's share falls to roughly 1/N. If they don't, a missing factor is hiding in the residuals. Try dropping `SMB` and `HML` from the factor set in a notebook and watch the residual structure come back.
""",
        "starter": _IMPORTS + '''def residual_structure(stock_returns: pd.DataFrame, factors: pd.DataFrame) -> dict:
    # your code here
    pass
''',
        "solution": _IMPORTS + _RESID,
        "hints": ["`np.eye(n, dtype=bool)` masks the diagonal; `C[~mask]` gives the off-diagonal entries."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "all three factors", "sample": True, "args": _universe(2)},
            {"name": "market factor only", "args": (_universe(1)[0], _universe(1)[1][["MKT"]])},
        ],
    },
    {
        "id": "r4_report",
        "title": "Part 5 · Run the full factor research pipeline",
        "difficulty": "Medium",
        "libs": ["statsmodels", "pandas"],
        "fn": "factor_research_report",
        "description": r"""
Wrap Parts 1, 3 and 4 into one function that takes raw **prices** and factor returns and returns a report dict:

1. returns = `prices.pct_change()`, dropping the first row; align factors to those dates (`factors.loc[returns.index]`)
2. `table` = Part 1 on the returns (default HAC lags)
3. `discoveries` = the list of stocks flagged by Part 3 at FDR `q`, in table order
4. `residual` = Part 4's dict
5. return `{"table": table, "discoveries": [...], "avg_r2": table["r2"].mean(), "residual": {...}}`

### Learn
This is what "productionizing" research means at small scale: one call, documented inputs, a structured output someone else can use. Import your earlier parts instead of rewriting them:

```python
from r4_factor_regressions import factor_regressions
from r4_discoveries import alpha_discoveries
from r4_residuals import residual_structure
```

Then point it at real data in a notebook: download 20 stocks with yfinance and the French factors, and see who has alpha after correcting for multiple tests (usually: nobody, which is itself a useful result).
""",
        "starter": _IMPORTS + '''def factor_research_report(prices: pd.DataFrame, factors: pd.DataFrame, q: float = 0.10) -> dict:
    # return {"table": ..., "discoveries": [...], "avg_r2": ..., "residual": {...}}
    pass
''',
        "solution": _IMPORTS + _REG + "\n\n" + _BH + "\n\n" + _RESID + '''

def factor_research_report(prices: pd.DataFrame, factors: pd.DataFrame, q: float = 0.10) -> dict:
    returns = prices.pct_change().iloc[1:]
    f = factors.loc[returns.index]
    table = factor_regressions(returns, f)
    found = alpha_discoveries(table, q)
    return {"table": table, "discoveries": list(found.index[found["discovery"]]),
            "avg_r2": table["r2"].mean(), "residual": residual_structure(returns, f)}
''',
        "hints": ["Keep each step a call to an earlier part; the report function itself should be short."],
        "rtol": 1e-6,
        "cases": lambda: [
            {"name": "30-stock universe", "sample": True, "args": (_lab(2)["prices"], _lab(2)["factors"])},
            {"name": "another universe, q = 0.05", "args": (_lab(1)["prices"], _lab(1)["factors"], 0.05)},
        ],
    },
]
