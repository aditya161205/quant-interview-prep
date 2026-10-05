import numpy as np
import pandas as pd

from data import dates, normal_returns

TITLE = "Markets and finance foundations"
SUMMARY = "How markets work, time value of money, bonds, forwards and futures, arbitrage, and the risk measures everyone uses."
KIND = "foundation"

LESSON = r"""
You can't trade or research what you don't understand. Interviewers expect fluent basics: what drives a bond price, how a forward is priced, what beta means, how an exchange matches orders.

## How markets work

- **Asset classes**: equities, government and corporate bonds (rates and credit), FX, commodities, and derivatives (futures, options, swaps) written on all of them.
- **Exchanges** run a **limit order book**: resting buy orders (bids) and sell orders (asks), matched by **price–time priority**. A **market order** takes liquidity and crosses the spread; a **limit order** provides liquidity and waits.
- The **bid–ask spread** is the cost of immediacy and the market maker's compensation. Mid = (bid + ask)/2. Spreads are quoted in ticks or basis points (1 bp = 0.01%).
- **Short selling**: borrow the asset, sell it, buy it back later. Losses are unbounded and you pay a borrow fee. **Leverage** and **margin** scale both P&L and the risk of forced liquidation.

## Time value of money

$$PV = \frac{CF}{(1+r)^t} \;\text{(annual compounding)}, \qquad PV = CF\,e^{-rt} \;\text{(continuous)}$$

Most derivatives math uses continuous compounding. Converting: $e^{r_c} = 1 + r_a$.

## Bonds

Price = present value of the coupons and principal at the bond's yield to maturity $y$:

$$P = \sum_{k=1}^{n} \frac{CF_k}{(1 + y/m)^k}$$

- Price and yield move **inversely**.
- **Macaulay duration**: the PV-weighted average time of the cash flows. **Modified duration** $D_{mod} = D_{mac}/(1+y/m)$ gives $\frac{\Delta P}{P} \approx -D_{mod}\,\Delta y$.
- **Convexity** adds the second-order term: $\frac{\Delta P}{P} \approx -D_{mod}\Delta y + \frac12 C\,(\Delta y)^2$. Positive convexity means gains when yields fall exceed losses when they rise.
- **DV01**: the dollar change for a 1 bp move, $D_{mod} \times P \times 0.0001$.

## Forwards and futures: cost of carry

Buying the asset today and holding it must cost the same as buying it forward, or there's an arbitrage:

$$F = S\,e^{(r - q)T}$$

with $q$ the dividend yield (or storage costs entering with a plus sign, convenience yield with a minus). If $F_{\text{market}} > F$: **cash-and-carry** (borrow, buy spot, sell forward). If lower: the reverse (short spot, lend, buy forward).

**FX forwards (covered interest parity)**: $F = S\,\frac{1 + r_{\text{quote}}}{1 + r_{\text{base}}}$ for EURUSD quoted in USD per EUR. The higher-rate currency trades at a forward discount.

## Arbitrage and the law of one price

Identical cash flows must have identical prices. Most pricing in quant finance (forwards, put–call parity, risk-neutral valuation) is the law of one price applied carefully.

## Risk measures

- **Volatility**: annualized standard deviation of returns, daily × √252.
- **Beta**: $\beta = \text{Cov}(r_i, r_m)/\text{Var}(r_m)$, the sensitivity to the market. CAPM: $E[r_i] - r_f = \beta\,(E[r_m] - r_f)$, and **alpha** is the return not explained by beta.
- **Sharpe ratio**: excess return / volatility. **Max drawdown**: worst peak-to-trough loss.
- **Portfolio volatility**: $\sigma_p = \sqrt{w^\top \Sigma w}$. Diversification works through correlations below 1. The **risk contribution** of asset i is $w_i(\Sigma w)_i/\sigma_p$, and the contributions sum to $\sigma_p$.

Compounding asymmetry: +50% then −50% leaves you at 75%. Volatility drags down compound growth: $g \approx \mu - \sigma^2/2$.
"""

QUESTIONS = [
    {"type": "number", "prompt": "You invest $100 at 5% per year, continuously compounded, for 2 years. What is it worth?",
     "answer": 100 * np.exp(0.1), "display": "100e^0.1 ≈ $110.52", "explanation": "100 × e^(0.05 × 2) = 100 × e^0.1."},
    {"type": "number", "prompt": "A stock trades at 100 with a 2% continuous dividend yield; the risk-free rate is 5% (continuous). What is the fair 1-year forward price?",
     "answer": 100 * np.exp(0.03), "display": "100e^0.03 ≈ 103.05", "explanation": "F = S e^((r − q)T) = 100 e^0.03."},
    {"type": "number", "prompt": "What is the price of a 2-year zero-coupon bond with face value 100 at a 4% annually compounded yield?",
     "answer": 100 / 1.04**2, "display": "≈ 92.46", "explanation": "100 / 1.04² = 92.456."},
    {"type": "number", "prompt": "A bond has modified duration 7. Yields rise by 50 bp. What is the approximate percentage change in its price? (Answer in %, e.g. −1.2)",
     "answer": -3.5, "explanation": "ΔP/P ≈ −D Δy = −7 × 0.005 = −3.5%."},
    {"type": "number", "prompt": "A portfolio holds 60% in asset A (volatility 20%) and 40% in asset B (volatility 10%), with correlation 0.5. What is the portfolio volatility, in %?",
     "answer": 100 * np.sqrt(0.36 * 0.04 + 0.16 * 0.01 + 2 * 0.6 * 0.4 * 0.5 * 0.2 * 0.1), "display": "√0.0208 ≈ 14.42%",
     "explanation": "σ² = 0.6²(0.2)² + 0.4²(0.1)² + 2(0.6)(0.4)(0.5)(0.2)(0.1) = 0.0144 + 0.0016 + 0.0048 = 0.0208."},
    {"type": "number", "prompt": "A stock rises 50% and then falls 50%. What is your total return, in %?",
     "answer": -25, "explanation": "1.5 × 0.5 = 0.75, a 25% loss. Returns compound; they don't add."},
    {"type": "number", "prompt": "EURUSD spot is 1.10 (USD per EUR). The 1-year USD rate is 5% and the EUR rate is 3% (annual). What is the 1-year forward EURUSD rate under covered interest parity?",
     "answer": 1.10 * 1.05 / 1.03, "display": "1.10 × 1.05/1.03 ≈ 1.1214",
     "explanation": "F = S (1 + r_USD)/(1 + r_EUR). The lower-rate currency (EUR) trades at a forward premium, which removes the gain from borrowing EUR to lend USD."},
    {"type": "number", "prompt": "Cov(stock, market) = 0.02 and Var(market) = 0.04. What is the stock's beta?",
     "answer": 0.5, "explanation": "β = Cov/Var = 0.02/0.04 = 0.5."},
    {"type": "number", "prompt": "How many dollars is 1 basis point on a $10,000,000 notional?",
     "answer": 1000, "display": "$1,000", "explanation": "1 bp = 0.0001, and 0.0001 × 10,000,000 = 1,000."},
    {"type": "choice", "prompt": "Interest rates rise unexpectedly. What happens to the price of a long-dated fixed-coupon bond?",
     "choices": ["It falls, and by more than a short-dated bond's", "It rises", "It falls, but by less than a short-dated bond's", "It doesn't change, since coupons are fixed"],
     "answer": 0, "explanation": "Price and yield move inversely, and longer duration means a bigger move."},
    {"type": "open", "prompt": "A 1-year gold future trades well above spot × e^(rT). Explain the arbitrage and what could make it not a free lunch.",
     "explanation": "Cash-and-carry: borrow at r, buy gold spot, store it, and sell the future. At expiry, deliver the gold and repay the loan; the profit is F − S e^(rT) − storage. Real-world frictions: storage and insurance costs (which belong in the carry), borrowing rates above r, capital and margin requirements, delivery logistics, and the fact that the 'mispricing' may just reflect costs you forgot."},
]


def _capm(n, beta, alpha_annual, seed):
    rng = np.random.default_rng(seed)
    m = normal_returns(n, mu=4e-4, sigma=0.011, seed=seed)
    a = alpha_annual / 252 + beta * m + rng.normal(0, 0.012, n)
    return a.rename("asset"), m.rename("market")


def _cov(seed, n):
    rng = np.random.default_rng(seed)
    vol = rng.uniform(0.1, 0.4, n)
    A = rng.standard_normal((n, n))
    C = np.corrcoef(A @ A.T + n * np.eye(n))
    return np.outer(vol, vol) * C


PROBLEMS = [
    {
        "id": "f5_bond",
        "title": "Bond price, duration and convexity",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "bond_analytics",
        "description": r"""
Price a fixed-coupon bond and compute its risk measures. The bond pays `coupon_rate * face / freq` every period for `years * freq` periods, plus `face` at maturity; the yield `ytm` is compounded `freq` times a year. With cash flow $CF_k$ at time $t_k = k/\text{freq}$ and discount factor $d_k = (1 + y/\text{freq})^{-k}$, return a dict:

- `price`: $P = \sum_k CF_k\, d_k$
- `macaulay`: $\sum_k t_k\, CF_k\, d_k \,/\, P$ (in years)
- `modified`: macaulay / $(1 + y/\text{freq})$
- `convexity`: $\dfrac{1}{P\,(1+y/\text{freq})^2}\sum_k CF_k\, d_k\, t_k\,(t_k + 1/\text{freq})$

### Learn
Check yourself: a bond whose coupon equals its yield prices at par (100). A zero-coupon bond's Macaulay duration equals its maturity.

Then use the outputs: for a +100 bp move, $\Delta P/P \approx -D_{mod}(0.01) + \frac12 C (0.01)^2$. Compare with exact repricing at the new yield; the convexity term closes most of the gap.
""",
        "starter": '''import numpy as np


def bond_analytics(face: float, coupon_rate: float, ytm: float, years: float, freq: int = 2) -> dict:
    # return {"price": ..., "macaulay": ..., "modified": ..., "convexity": ...}
    pass
''',
        "solution": '''import numpy as np


def bond_analytics(face: float, coupon_rate: float, ytm: float, years: float, freq: int = 2) -> dict:
    n = int(round(years * freq))
    k = np.arange(1, n + 1)
    t = k / freq
    cf = np.full(n, face * coupon_rate / freq)
    cf[-1] += face
    d = (1 + ytm / freq) ** (-k)
    price = np.sum(cf * d)
    macaulay = np.sum(t * cf * d) / price
    convexity = np.sum(cf * d * t * (t + 1 / freq)) / (price * (1 + ytm / freq) ** 2)
    return {"price": price, "macaulay": macaulay, "modified": macaulay / (1 + ytm / freq), "convexity": convexity}
''',
        "hints": ["Build arrays of times, cash flows and discount factors, then every output is a weighted sum."],
        "cases": lambda: [
            {"name": "10y 5% semi-annual at a 5% yield (par)", "sample": True, "args": (100, 0.05, 0.05, 10)},
            {"name": "30y 3% at a 4.5% yield", "args": (100, 0.03, 0.045, 30)},
            {"name": "5y zero coupon, annual", "args": (1000, 0.0, 0.04, 5, 1)},
            {"name": "2y 8% quarterly at 6%", "args": (100, 0.08, 0.06, 2, 4)},
        ],
    },
    {
        "id": "f5_forward_arb",
        "title": "Forward pricing and cash-and-carry arbitrage",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "cash_and_carry",
        "description": r"""
Given spot `S`, a quoted forward price `F_market`, the continuously compounded rate `r`, dividend yield `q` and maturity `T` in years, return a dict:

- `fair`: $S e^{(r-q)T}$
- `strategy`: `"cash_and_carry"` if the market forward is above fair (buy spot, sell forward), `"reverse"` if below (short spot, buy forward), `"none"` if equal within 1e-9
- `profit`: the riskless profit per unit at time T, $|F_{\text{market}} - \text{fair}|$

### Learn
Why the profit is $|F - \text{fair}|$: buy $e^{-qT}$ units of stock for $Se^{-qT}$, financed by borrowing. Reinvesting the dividends grows the holding to exactly 1 share at T, which you deliver into the forward for $F_{\text{market}}$. The loan costs $Se^{-qT}e^{rT}$ = fair. The reverse trade mirrors it.

In interviews you're expected to write out each leg's cash flows at t = 0 and at T and show the t = 0 total is zero.
""",
        "starter": '''import numpy as np


def cash_and_carry(S: float, F_market: float, r: float, q: float, T: float) -> dict:
    # return {"fair": ..., "strategy": ..., "profit": ...}
    pass
''',
        "solution": '''import numpy as np


def cash_and_carry(S: float, F_market: float, r: float, q: float, T: float) -> dict:
    fair = S * np.exp((r - q) * T)
    diff = F_market - fair
    strategy = "none" if abs(diff) < 1e-9 else ("cash_and_carry" if diff > 0 else "reverse")
    return {"fair": fair, "strategy": strategy, "profit": abs(diff)}
''',
        "hints": ["Compare the market forward with the fair forward; the sign tells you which way to trade."],
        "cases": lambda: [
            {"name": "forward too rich", "sample": True, "args": (100, 106, 0.05, 0.01, 1)},
            {"name": "forward too cheap", "args": (50, 49.5, 0.03, 0.0, 0.5)},
            {"name": "fairly priced", "args": (80, 80 * np.exp(0.02 * 2), 0.04, 0.02, 2)},
        ],
    },
    {
        "id": "f5_portfolio_risk",
        "title": "Portfolio volatility and risk contributions",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "portfolio_risk",
        "description": r"""
Given portfolio weights `w` and an annualized covariance matrix `cov`, return a dict:

- `vol`: $\sigma_p = \sqrt{w^\top \Sigma w}$
- `marginal`: marginal risk $\partial\sigma_p/\partial w_i = (\Sigma w)_i/\sigma_p$ (an array)
- `contribution`: $w_i\,(\Sigma w)_i/\sigma_p$ (an array that sums to $\sigma_p$)
- `pct`: contribution / $\sigma_p$ (sums to 1)

### Learn
Risk contributions answer "where does my risk come from?" A 50/50 split by capital between a bond fund (5% vol) and an equity fund (20% vol) is roughly 10/90 by risk. Risk-parity portfolios equalize these contributions (Researcher track).

The decomposition works because $\sigma_p$ is homogeneous of degree 1 in w (Euler's theorem): $\sigma_p = \sum_i w_i\,\partial\sigma_p/\partial w_i$.
""",
        "starter": '''import numpy as np


def portfolio_risk(w, cov) -> dict:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def portfolio_risk(w, cov) -> dict:
    w, cov = np.asarray(w, dtype=float), np.asarray(cov, dtype=float)
    sigma_w = cov @ w
    vol = np.sqrt(w @ sigma_w)
    contribution = w * sigma_w / vol
    return {"vol": vol, "marginal": sigma_w / vol, "contribution": contribution, "pct": contribution / vol}
''',
        "hints": ["`cov @ w` is the vector Σw; everything else follows from it."],
        "cases": lambda: [
            {"name": "two assets", "sample": True, "args": ([0.6, 0.4], [[0.04, 0.01], [0.01, 0.01]])},
            {"name": "6 assets, random covariance", "args": (np.full(6, 1 / 6), _cov(1, 6))},
            {"name": "long/short weights", "args": ([1.2, -0.5, 0.3], _cov(2, 3))},
        ],
    },
    {
        "id": "f5_capm",
        "title": "Beta, alpha and the CAPM regression",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "capm_regression",
        "description": r"""
Regress an asset's daily excess returns on the market's: $r_a - r_f = \alpha + \beta\,(r_m - r_f) + \varepsilon$, with `rf` a daily risk-free rate (default 0). Return a dict:

- `beta`: $\text{Cov}(x, y)/\text{Var}(x)$ on the excess returns
- `alpha_annual`: the intercept × 252
- `r2`: squared correlation of the two excess-return series
- `resid_vol_annual`: standard deviation (ddof=1) of the residuals × √252

### Learn
Beta measures market exposure. Alpha is what's left: the part of the return a cheap index fund can't replicate. A fund with beta 1.5 that returned 15% in a 10% market had no alpha at all.

`np.cov(x, y)` returns the 2×2 covariance matrix (ddof=1); use element `[0, 1]` with `np.var(x, ddof=1)`. Residual volatility (idiosyncratic risk) is what a market hedge can't remove, and what stock pickers are paid to take.
""",
        "starter": '''import numpy as np
import pandas as pd


def capm_regression(asset: pd.Series, market: pd.Series, rf: float = 0.0) -> dict:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def capm_regression(asset: pd.Series, market: pd.Series, rf: float = 0.0) -> dict:
    y = np.asarray(asset, dtype=float) - rf
    x = np.asarray(market, dtype=float) - rf
    beta = np.cov(x, y)[0, 1] / np.var(x, ddof=1)
    alpha = y.mean() - beta * x.mean()
    resid = y - alpha - beta * x
    return {"beta": beta, "alpha_annual": alpha * 252, "r2": np.corrcoef(x, y)[0, 1] ** 2,
            "resid_vol_annual": resid.std(ddof=1) * np.sqrt(252)}
''',
        "hints": ["The OLS intercept is mean(y) − β·mean(x)."],
        "cases": lambda: [
            {"name": "beta 1.2, alpha 3%", "sample": True, "args": _capm(756, 1.2, 0.03, seed=1)},
            {"name": "defensive stock, beta 0.5", "args": _capm(1260, 0.5, 0.0, seed=2)},
            {"name": "with a risk-free rate", "args": (*_capm(500, 0.9, -0.02, seed=3), 0.04 / 252)},
        ],
    },
]
