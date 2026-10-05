import numpy as np
import pandas as pd

TITLE = "Options fundamentals"
SUMMARY = "Payoffs, put–call parity, no-arbitrage bounds, binomial trees, Black–Scholes and the Greeks."
KIND = "foundation"

LESSON = r"""
Options questions appear in nearly every trader interview and in many researcher ones. You need payoffs at a glance, parity without thinking, and an intuition for how prices move with spot, volatility and time.

## Payoffs

A **call** pays $\max(S_T - K, 0)$ and a **put** pays $\max(K - S_T, 0)$ at expiry. Long positions pay a premium up front; short positions collect it and carry the risk.

| Strategy | Legs | View |
|---|---|---|
| Covered call | long stock + short call | mildly bullish, sells upside for income |
| Protective put | long stock + long put | insurance against a crash |
| Bull call spread | long call K₁ + short call K₂ (K₁ < K₂) | bullish, cheaper, capped |
| Straddle | long call + long put, same K | big move either way (long volatility) |
| Strangle | long OTM put + long OTM call | cheaper big-move bet |
| Butterfly | long K₁, short 2×K₂, long K₃ calls | price pinned near K₂ (short volatility) |
| Calendar | short near expiry, long far expiry | time decay, term-structure view |

## Put–call parity (European, no dividends)

$$C - P = S - K e^{-rT}$$

A long call plus a short put **is** a forward. If the quotes violate parity, buy the cheap side, sell the rich side and hedge with stock and a loan. With a continuous dividend yield q, replace $S$ with $S e^{-qT}$.

## No-arbitrage bounds

- $\max(S - Ke^{-rT}, 0) \le C \le S$ and $\max(Ke^{-rT} - S, 0) \le P \le Ke^{-rT}$
- Call prices fall as the strike rises, with slope between −1 and 0 ($-e^{-rT}$ for discounting), and are convex in strike: a butterfly can never cost less than zero.
- **Early exercise**: an American call on a non-dividend stock is never exercised early (it's worth at least $S - Ke^{-rT} > S - K$, so selling beats exercising). An American put can be worth exercising early when deep in the money, since you'd rather earn interest on K now.

## Binomial model: replication and risk-neutral pricing

In one step the stock goes to $uS$ or $dS$. Holding $\Delta = \frac{V_u - V_d}{uS - dS}$ shares plus cash replicates the option, so its price can't depend on anyone's view of the real probabilities:

$$V = e^{-r\Delta t}\left[q V_u + (1-q)V_d\right], \qquad q = \frac{e^{r\Delta t} - d}{u - d}$$

**Cox–Ross–Rubinstein**: $u = e^{\sigma\sqrt{\Delta t}}$, $d = 1/u$. Work backward through the tree; for American options take $\max(\text{continuation}, \text{exercise})$ at every node. As the number of steps grows, the price converges to Black–Scholes.

## Black–Scholes

$$C = S N(d_1) - Ke^{-rT}N(d_2), \qquad d_{1,2} = \frac{\ln(S/K) + (r \pm \sigma^2/2)T}{\sigma\sqrt T}$$

Assumptions: GBM with constant σ, continuous frictionless hedging, constant r. $N(d_2)$ is the risk-neutral probability of finishing in the money. **Rule of thumb**: an at-the-money option is worth about $0.4\,S\sigma\sqrt T$ (a straddle ≈ $0.8\,S\sigma\sqrt T$).

## The Greeks

| Greek | Definition | Long call | Long put | Notes |
|---|---|---|---|---|
| Delta Δ | ∂V/∂S | 0 to 1 | −1 to 0 | hedge ratio; ATM ≈ 0.5 |
| Gamma Γ | ∂²V/∂S² | + | + | convexity; peaks ATM near expiry |
| Vega ν | ∂V/∂σ | + | + | largest ATM, longer-dated |
| Theta Θ | ∂V/∂t | usually − | usually − | time decay; the cost of being long gamma |
| Rho ρ | ∂V/∂r | + | − | small for short-dated options |

Long options are **long gamma and vega, short theta**: you pay decay for the right to profit from moves. Γ and Θ are linked: $\Theta \approx -\frac12\Gamma S^2\sigma^2$ for a delta-hedged option (with r = 0).
"""

QUESTIONS = [
    {"type": "number", "prompt": "S = 100, K = 100, r = 0. The European call costs 10. What should the European put with the same strike and expiry cost?",
     "answer": 10, "explanation": "C − P = S − K = 0 with zero rates, so P = C = 10."},
    {"type": "number", "prompt": "S = 100, K = 95, r = 5% (continuous), T = 1 year, call price 12. What is the fair put price by put–call parity?",
     "answer": 12 - 100 + 95 * np.exp(-0.05), "display": "≈ 2.37", "explanation": "P = C − S + K e^(−rT) = 12 − 100 + 95 e^(−0.05) ≈ 2.367."},
    {"type": "number", "prompt": "Estimate the price of a 3-month at-the-money call on a $100 stock with 20% implied volatility (rates ≈ 0).",
     "answer": 4.0, "tol": 0.03, "display": "≈ 4.0", "explanation": "0.4 × S × σ × √T = 0.4 × 100 × 0.2 × 0.5 = 4.0. Black–Scholes gives 3.99."},
    {"type": "number", "prompt": "One-step binomial: S = 100 moves to 120 or 80, r = 0. What is the price of a call with strike 100?",
     "answer": 10, "explanation": "q = (1 − 0.8)/(1.2 − 0.8) = 0.5, so C = 0.5 × 20 + 0.5 × 0 = 10. Replication check: Δ = 20/40 = 0.5 shares minus a 40 loan costs 50 − 40 = 10."},
    {"type": "number", "prompt": "You hold a long call butterfly with strikes 90/100/110 (long 1, short 2, long 1). What is its payoff at expiry if the stock is at 104?",
     "answer": 6, "explanation": "Long the 90 call: 14. Short two 100 calls: −8. The 110 call expires worthless. Total 6."},
    {"type": "choice", "prompt": "What is the delta of a deep in-the-money European call (no dividends)?",
     "choices": ["Close to 1", "Close to 0.5", "Close to 0", "Close to −1"], "answer": 0,
     "explanation": "Deep ITM the call behaves like the stock (minus a loan), so its delta approaches 1."},
    {"type": "choice", "prompt": "Should you ever exercise an American call on a non-dividend-paying stock early?",
     "choices": ["No, selling it is always at least as good", "Yes, when it's deep in the money", "Yes, just before expiry", "Only if rates are negative"],
     "answer": 0, "explanation": "C ≥ S − Ke^(−rT) > S − K for r > 0. The option is worth more alive than exercised. Puts are different: early exercise can be optimal."},
    {"type": "number", "prompt": "What is the no-arbitrage lower bound for a European call with S = 50, K = 45, r = 0?",
     "answer": 5, "explanation": "C ≥ max(S − Ke^(−rT), 0) = 5. If it traded below 5, you'd buy the call, short the stock, and lock in a profit."},
    {"type": "number", "prompt": "You buy a 100-strike straddle for 8. Above what price does it make money at expiry?",
     "answer": 108, "explanation": "The upper breakeven is K + premium = 108 (the lower one is 92)."},
    {"type": "choice", "prompt": "Implied volatility rises while everything else stays the same. What happens to call and put prices?",
     "choices": ["Both rise", "Calls rise, puts fall", "Calls fall, puts rise", "Both fall"], "answer": 0,
     "explanation": "Vega is positive for both: more volatility makes big moves likelier, and the option holder keeps the upside while the downside is capped at the premium."},
    {"type": "number", "prompt": "What is the no-arbitrage lower bound for a European put with S = 40, K = 50, r = 0?",
     "answer": 10, "explanation": "P ≥ max(Ke^(−rT) − S, 0) = 10."},
    {"type": "open", "prompt": "Explain risk-neutral pricing to a non-specialist. Why doesn't the option price depend on the stock's expected return?",
     "explanation": "Because the option can be replicated by a dynamically adjusted position in the stock and cash, its price must equal the replication cost, or there's an arbitrage. The replication cost depends only on how much the stock can move (volatility) and the interest rate, not on the drift. Pricing as if everyone were risk-neutral (expected return = r) gives the same answer, so we compute expected payoffs under that convenient 'risk-neutral' probability and discount at r."},
]

_BS = '''def bs_greeks(S: float, K: float, r: float, sigma: float, T: float, kind: str = "call") -> dict:
    sq = sigma * np.sqrt(T)
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / sq
    d2 = d1 - sq
    disc = K * np.exp(-r * T)
    gamma = norm.pdf(d1) / (S * sq)
    vega = S * norm.pdf(d1) * np.sqrt(T)
    decay = -S * norm.pdf(d1) * sigma / (2 * np.sqrt(T))
    if kind == "call":
        return {"price": S * norm.cdf(d1) - disc * norm.cdf(d2), "delta": norm.cdf(d1), "gamma": gamma,
                "vega": vega, "theta": decay - r * disc * norm.cdf(d2), "rho": T * disc * norm.cdf(d2)}
    return {"price": disc * norm.cdf(-d2) - S * norm.cdf(-d1), "delta": norm.cdf(d1) - 1, "gamma": gamma,
            "vega": vega, "theta": decay + r * disc * norm.cdf(-d2), "rho": -T * disc * norm.cdf(-d2)}
'''

PROBLEMS = [
    {
        "id": "f6_payoff",
        "title": "Profit of an option strategy at expiry",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "strategy_profit",
        "description": r"""
A strategy is a list of legs, each a dict `{"type": "call" | "put" | "stock", "strike": K, "qty": q, "premium": p}` (negative `qty` means short; for stock, `strike` is ignored and `premium` is the purchase price). Return a numpy array with the strategy's **profit** at expiry for each terminal price in `S_T`:

$$\text{profit} = \sum_{\text{legs}} q\,\big(\text{payoff}(S_T) - p\big), \qquad \text{payoff} = \begin{cases}\max(S_T-K,0) & \text{call}\\ \max(K-S_T,0) & \text{put}\\ S_T & \text{stock}\end{cases}$$

### Learn
Being able to draw any payoff diagram instantly is table stakes in trader interviews. Plot your function over a range of $S_T$ in a notebook for the strategies in the lesson table: straddle, butterfly, bull spread, covered call.

Spot the equivalences parity implies: long call + short put = long stock − K (a synthetic forward), and covered call = short put plus cash.
""",
        "starter": '''import numpy as np


def strategy_profit(legs: list, S_T) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def strategy_profit(legs: list, S_T) -> np.ndarray:
    S = np.asarray(S_T, dtype=float)
    total = np.zeros_like(S)
    for leg in legs:
        if leg["type"] == "call":
            payoff = np.maximum(S - leg["strike"], 0)
        elif leg["type"] == "put":
            payoff = np.maximum(leg["strike"] - S, 0)
        else:
            payoff = S
        total += leg["qty"] * (payoff - leg["premium"])
    return total
''',
        "hints": ["Start from `np.zeros_like(S)` and add each leg's contribution."],
        "cases": lambda: [
            {"name": "long straddle", "sample": True,
             "args": ([{"type": "call", "strike": 100, "qty": 1, "premium": 5}, {"type": "put", "strike": 100, "qty": 1, "premium": 4}],
                      np.arange(80, 121, 5))},
            {"name": "call butterfly", "args": ([{"type": "call", "strike": 90, "qty": 1, "premium": 12},
                                                {"type": "call", "strike": 100, "qty": -2, "premium": 6},
                                                {"type": "call", "strike": 110, "qty": 1, "premium": 2.5}], np.linspace(70, 130, 61))},
            {"name": "covered call", "args": ([{"type": "stock", "strike": 0, "qty": 100, "premium": 50},
                                              {"type": "call", "strike": 55, "qty": -100, "premium": 1.2}], [40, 50, 55, 60, 70])},
        ],
    },
    {
        "id": "f6_parity",
        "title": "Spot a put–call parity violation",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "parity_check",
        "description": r"""
Given European call and put prices with the same strike and expiry, check them against parity with a continuous dividend yield q:

$$\text{gap} = C - P - \left(S e^{-qT} - K e^{-rT}\right)$$

Return a dict: `gap`, `rich` (`"call"` if gap > 1e-9, `"put"` if gap < −1e-9, else `"none"`) and `profit` = |gap| (the riskless profit per unit from the conversion or reversal trade).

### Learn
If the call is rich (gap > 0), sell the call, buy the put and buy the forward (stock plus borrowing). That's a **conversion**, and it locks in the gap. If the put is rich, do the opposite: a **reversal**. Market makers scan for these constantly, and in practice violations are usually explained by dividends, borrow costs or American early exercise rather than free money.
""",
        "starter": '''import numpy as np


def parity_check(C: float, P: float, S: float, K: float, r: float, T: float, q: float = 0.0) -> dict:
    # return {"gap": ..., "rich": ..., "profit": ...}
    pass
''',
        "solution": '''import numpy as np


def parity_check(C: float, P: float, S: float, K: float, r: float, T: float, q: float = 0.0) -> dict:
    gap = C - P - (S * np.exp(-q * T) - K * np.exp(-r * T))
    rich = "call" if gap > 1e-9 else "put" if gap < -1e-9 else "none"
    return {"gap": gap, "rich": rich, "profit": abs(gap)}
''',
        "hints": ["Compute the parity value of C − P, then compare."],
        "cases": lambda: [
            {"name": "call rich", "sample": True, "args": (12.0, 2.0, 100, 95, 0.05, 1)},
            {"name": "put rich with dividends", "args": (3.0, 6.5, 50, 52, 0.03, 0.5, 0.02)},
            {"name": "consistent quotes", "args": (10.0, 10.0 - (100 - 100 * np.exp(-0.02)), 100, 100, 0.02, 1)},
        ],
    },
    {
        "id": "f6_binomial",
        "title": "Cox–Ross–Rubinstein binomial pricer",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "crr_price",
        "description": r"""
Price a European or American option on a non-dividend stock with an `steps`-step CRR tree:

- $\Delta t = T/\text{steps}$, $u = e^{\sigma\sqrt{\Delta t}}$, $d = 1/u$, $q = \dfrac{e^{r\Delta t} - d}{u - d}$
- terminal prices $S\,u^j d^{\,\text{steps}-j}$ for $j = 0, \dots, \text{steps}$, with the payoff at each
- step backward: $V = e^{-r\Delta t}\,(q V_{\text{up}} + (1-q) V_{\text{down}})$; if `american`, take $\max(V, \text{exercise value})$ at every node

Return the price at the root (a float).

### Learn
Vectorize each backward step with numpy slices: if `V` holds the values at one level (ordered by number of up moves), the previous level is `disc * (q * V[1:] + (1 - q) * V[:-1])`, and the node prices are `S * u**j * d**(level - j)`.

Experiments worth running: with 500 steps a European call matches Black–Scholes to about a cent. An American call equals the European one (never exercise early), while an American put is worth more.
""",
        "starter": '''import numpy as np


def crr_price(S: float, K: float, r: float, sigma: float, T: float, steps: int = 200,
              kind: str = "call", american: bool = False) -> float:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def crr_price(S: float, K: float, r: float, sigma: float, T: float, steps: int = 200,
              kind: str = "call", american: bool = False) -> float:
    dt = T / steps
    u = np.exp(sigma * np.sqrt(dt))
    d = 1 / u
    q = (np.exp(r * dt) - d) / (u - d)
    disc = np.exp(-r * dt)

    def payoff(prices):
        return np.maximum(prices - K, 0) if kind == "call" else np.maximum(K - prices, 0)

    j = np.arange(steps + 1)
    V = payoff(S * u**j * d ** (steps - j))
    for level in range(steps - 1, -1, -1):
        V = disc * (q * V[1:] + (1 - q) * V[:-1])
        if american:
            j = np.arange(level + 1)
            V = np.maximum(V, payoff(S * u**j * d ** (level - j)))
    return float(V[0])
''',
        "hints": ["Order the nodes at each level by the number of up moves j = 0..level.",
                  "Sanity check: with 500+ steps a European call should match Black–Scholes to about a cent."],
        "cases": lambda: [
            {"name": "European call, 200 steps", "sample": True, "args": (100, 100, 0.05, 0.2, 1.0)},
            {"name": "American put", "args": (100, 110, 0.05, 0.3, 1.0, 300, "put", True)},
            {"name": "European put", "args": (50, 45, 0.03, 0.25, 0.5, 150, "put")},
            {"name": "American call = European call", "args": (80, 75, 0.04, 0.35, 2.0, 250, "call", True)},
        ],
    },
    {
        "id": "f6_bs_greeks",
        "title": "Black–Scholes price and Greeks",
        "difficulty": "Medium",
        "libs": ["numpy", "scipy.stats"],
        "fn": "bs_greeks",
        "description": r"""
Implement the Black–Scholes price and Greeks for a European option on a non-dividend stock. Return a dict with `price`, `delta`, `gamma`, `vega`, `theta`, `rho`, using these conventions:

- `vega` = ∂V/∂σ per **1.00** of volatility (divide by 100 for "per vol point")
- `theta` = ∂V/∂t per **year** (divide by 365 or 252 for per day); usually negative
- `rho` = ∂V/∂r per 1.00 of rate

With $d_{1,2} = \frac{\ln(S/K) + (r \pm \sigma^2/2)T}{\sigma\sqrt T}$, $N$ the normal CDF and $n$ its density:

| | call | put |
|---|---|---|
| price | $SN(d_1) - Ke^{-rT}N(d_2)$ | $Ke^{-rT}N(-d_2) - SN(-d_1)$ |
| delta | $N(d_1)$ | $N(d_1) - 1$ |
| gamma | $\frac{n(d_1)}{S\sigma\sqrt T}$ | same |
| vega | $S\,n(d_1)\sqrt T$ | same |
| theta | $-\frac{S n(d_1)\sigma}{2\sqrt T} - rKe^{-rT}N(d_2)$ | $-\frac{S n(d_1)\sigma}{2\sqrt T} + rKe^{-rT}N(-d_2)$ |
| rho | $KTe^{-rT}N(d_2)$ | $-KTe^{-rT}N(-d_2)$ |

### Learn
`scipy.stats.norm.cdf` and `norm.pdf` give $N$ and $n$. Verify your Greeks with finite differences, e.g. delta ≈ (V(S + h) − V(S − h))/(2h). That's how you'd check any pricer.

Once it's solved, later tasks can import it (`from f6_bs_greeks import bs_greeks`); the Trader track's options steps reuse it constantly.
""",
        "starter": '''import numpy as np
from scipy.stats import norm


def bs_greeks(S: float, K: float, r: float, sigma: float, T: float, kind: str = "call") -> dict:
    # return {"price": ..., "delta": ..., "gamma": ..., "vega": ..., "theta": ..., "rho": ...}
    pass
''',
        "solution": "import numpy as np\nfrom scipy.stats import norm\n\n\n" + _BS,
        "hints": ["Compute d1, d2 and the shared pieces once, then branch on the option type."],
        "cases": lambda: [
            {"name": "ATM call", "sample": True, "args": (100, 100, 0.05, 0.2, 1.0)},
            {"name": "OTM put", "args": (100, 90, 0.03, 0.25, 0.5, "put")},
            {"name": "short-dated ITM call", "args": (105, 100, 0.01, 0.3, 0.05)},
            {"name": "long-dated put", "args": (50, 60, 0.04, 0.4, 3.0, "put")},
        ],
    },
]
