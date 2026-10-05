import numpy as np

TITLE = "Expected value, betting and sizing"
SUMMARY = "Pricing games, risk versus reward, the Kelly criterion, growth versus expectation, and risk of ruin."
KIND = "core"

LESSON = r"""
Trading is repeated betting with an edge you're never quite sure of. Interviewers probe two things: can you **price** a game (its expected value), and do you know how much to **bet** when you have an edge without risking ruin?

## Pricing a game

The fair price of a game is its expected payoff. "Would you play?" means: is the EV above the cost, **and** can you afford the variance? Always state both.

Classic: roll a die and receive the face value in dollars. Fair price 3.5. With one optional re-roll (keep the second roll) you re-roll a 1, 2 or 3, worth $\frac12 \cdot 5 + \frac12 \cdot 3.5 = 4.25$. Each extra option increases value: options are never worth less than zero.

## Variance and risk

Two games with the same EV can be very different to play. The standard deviation of total P&L over n independent bets grows like $\sqrt n$ while the expected P&L grows like $n$. That's why many small edges beat a few big ones: the "Sharpe ratio" of the total improves with $\sqrt n$.

## The Kelly criterion

Bet a fraction f of wealth on a bet that pays b-to-1 with win probability p. Wealth after n bets grows like $e^{ng(f)}$ with **growth rate**

$$g(f) = p\ln(1 + bf) + (1-p)\ln(1 - f)$$

Maximizing gives the Kelly fraction

$$f^* = p - \frac{1-p}{b} = \frac{\text{edge}}{\text{odds}}$$

For continuous returns with mean μ and variance σ² (both per period), $f^* = \mu/\sigma^2$ and the maximum growth rate is $\frac{\mu^2}{2\sigma^2} = \frac{SR^2}{2}$.

Key facts:
- Kelly maximizes the **long-run growth rate** and the median outcome, not the expected wealth. Expected wealth is maximized by betting everything every time, which almost surely ends at zero.
- **Overbetting is far worse than underbetting**: growth is roughly a parabola in f, so 2× Kelly gives about zero growth and beyond that it's negative, while ½ Kelly keeps 75% of the growth with half the volatility.
- Real edges are estimated with error, so practitioners bet **fractional Kelly** (¼ to ½).

## Risk of ruin

Bet too big and a losing streak wipes you out before the edge shows up. Simulate wealth paths and measure the probability of ever dropping below a threshold. You'll see it explode as f passes Kelly.

## The St. Petersburg paradox

A coin is flipped until it lands tails; you're paid $2^k$ if that took k flips. The expected payoff $\sum_k 2^{-k}\,2^k = \infty$, yet nobody pays much to play. The resolution: utility of wealth is concave (log utility is exactly Kelly), the payer's bankroll is finite, and tiny-probability payoffs shouldn't drive decisions.

## How to answer "would you play?"

1. Compute the EV per play.
2. Compute the spread of outcomes (standard deviation, worst case).
3. Compare with your bankroll: what fraction would you risk (Kelly)?
4. Consider repetition. If you can play many times at small size, positive EV dominates.
"""

QUESTIONS = [
    {"type": "number", "prompt": "You roll a die and receive its face value in dollars. What is the fair price of the game?",
     "answer": 3.5, "explanation": "(1 + 2 + … + 6)/6 = 3.5."},
    {"type": "number", "prompt": "Same game, but after the first roll you may re-roll once and must keep the second result. What is the game worth with optimal play?",
     "answer": 4.25, "explanation": "Re-roll when the first roll is below 3.5 (a 1, 2 or 3). Value = ½ × E[4,5,6] + ½ × 3.5 = ½ × 5 + ½ × 3.5 = 4.25."},
    {"type": "number", "prompt": "A bet pays even money (1-to-1) and you win with probability 0.6. What fraction of your bankroll does the Kelly criterion say to bet?",
     "answer": 0.2, "explanation": "f* = p − q/b = 0.6 − 0.4/1 = 0.2."},
    {"type": "number", "prompt": "A bet pays 2-to-1 and you win with probability 0.4. What is the Kelly fraction?",
     "answer": 0.1, "explanation": "f* = p − q/b = 0.4 − 0.6/2 = 0.1."},
    {"type": "number", "prompt": "A strategy has annual expected excess return 8% and annual volatility 20%. What leverage does continuous-time Kelly suggest?",
     "answer": 2, "explanation": "f* = μ/σ² = 0.08/0.04 = 2, i.e. 2× leverage. Most practitioners would run a fraction of that."},
    {"type": "number", "prompt": "What is the expected log-growth rate per bet when betting the Kelly fraction 0.2 on an even-money bet with p = 0.6?",
     "answer": 0.6 * np.log(1.2) + 0.4 * np.log(0.8), "display": "≈ 0.0201",
     "explanation": "g = 0.6 ln 1.2 + 0.4 ln 0.8 = 0.1094 − 0.0893 ≈ 0.0201 per bet. Wealth grows like e^(0.02n)."},
    {"type": "choice", "prompt": "In the continuous approximation, what growth rate do you get betting twice the Kelly fraction?",
     "choices": ["About zero", "About half the Kelly growth rate", "About twice the Kelly growth rate", "The same as Kelly"],
     "answer": 0, "explanation": "g(f) ≈ μf − σ²f²/2 is a parabola peaking at f* = μ/σ², and g(2f*) = 2μf* − 2σ²f*² = 0. You take double the risk for no growth."},
    {"type": "number", "prompt": "You pay $1 to roll two dice. If the sum is 7 or 11 you receive $4 (otherwise nothing). What is the expected profit per play?",
     "answer": 4 * 8 / 36 - 1, "display": "−1/9 ≈ −0.111",
     "explanation": "P(7 or 11) = (6 + 2)/36 = 2/9. EV = 4 × 2/9 − 1 = −1/9. Don't play."},
    {"type": "number", "prompt": "Each flip of a fair coin wins $2 on heads or loses $1 on tails. Over 100 flips, what is the standard deviation of your total P&L?",
     "answer": 15, "explanation": "Per flip: mean 0.5, E[X²] = (4 + 1)/2 = 2.5, variance 2.5 − 0.25 = 2.25, sd 1.5. Over 100 independent flips: 1.5 × √100 = 15 (the mean is 50)."},
    {"type": "choice", "prompt": "Why do professional traders typically size positions at a fraction (¼ to ½) of Kelly?",
     "choices": ["Edges are estimated with error and overbetting is very costly, while fractional Kelly keeps most of the growth with much less volatility",
                 "Kelly is only valid for casino games",
                 "Full Kelly maximizes expected wealth, which is too aggressive",
                 "Regulators forbid full Kelly"],
     "answer": 0, "explanation": "Half Kelly gives about 75% of the growth rate with half the volatility, and protects against overestimating the edge, which would push you past full Kelly."},
    {"type": "open", "prompt": "Would you pay $5,000 to play a game with a 1% chance of winning $1,000,000? Discuss like a trader.",
     "explanation": "EV = 0.01 × 1,000,000 − 5,000 = +$5,000, so it has a positive edge. But you lose your stake 99% of the time. Kelly: with b ≈ 199 (net odds) and p = 0.01, f* = p − q/b = 0.01 − 0.99/199 ≈ 0.005, so the stake should be about 0.5% of your wealth, which means you'd need a bankroll near $1M. If I can play it many times at small size (or share it among a syndicate), yes; as a one-off with my personal savings, no. Also check counterparty risk: will they actually pay $1M?"},
]


PROBLEMS = [
    {
        "id": "t2_kelly",
        "title": "Kelly fraction and growth rate",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "kelly",
        "description": r"""
For a bet paying `b`-to-1 that wins with probability `p`, return a dict:

- `fraction`: the Kelly fraction $f^* = p - (1-p)/b$, floored at 0 (never bet on a negative edge)
- `growth`: the expected log-growth per bet at that fraction, $g(f^*) = p\ln(1 + bf^*) + (1-p)\ln(1 - f^*)$

### Learn
Plot $g(f)$ for $f \in [0, 1)$ in a notebook for p = 0.55, b = 1: a hump with its peak at Kelly, crossing zero near 2× Kelly. That one picture explains why sizing matters as much as having an edge.
""",
        "starter": '''import numpy as np


def kelly(p: float, b: float) -> dict:
    # return {"fraction": ..., "growth": ...}
    pass
''',
        "solution": '''import numpy as np


def kelly(p: float, b: float) -> dict:
    f = max(p - (1 - p) / b, 0.0)
    return {"fraction": f, "growth": p * np.log(1 + b * f) + (1 - p) * np.log(1 - f)}
''',
        "hints": ["With f = 0 the growth is exactly 0."],
        "cases": lambda: [
            {"name": "60% even money", "sample": True, "args": (0.6, 1.0)},
            {"name": "40% at 2-to-1", "args": (0.4, 2.0)},
            {"name": "negative edge", "args": (0.45, 1.0)},
            {"name": "long shot at 10-to-1", "args": (0.12, 10.0)},
        ],
    },
    {
        "id": "t2_wealth_sim",
        "title": "Simulate wealth under different bet sizes",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "simulate_bets",
        "description": r"""
Simulate `n_paths` gamblers, each starting with wealth 1 and making `n_bets` bets, staking a fixed fraction `f` of current wealth each time on a `b`-to-1 bet that wins with probability `p`. Follow this recipe exactly:

1. `rng = np.random.default_rng(seed)`; `wins = rng.random((n_paths, n_bets)) < p`
2. each bet multiplies wealth by `1 + f * b` on a win and `1 - f` on a loss
3. return the array of terminal wealths (length `n_paths`)

### Learn
`np.where(wins, 1 + f * b, 1 - f).prod(axis=1)` does it in one line.

Then experiment in a notebook with p = 0.6, b = 1, 200 bets: compare the **median** and the **mean** terminal wealth for f = 0.1, 0.2 (Kelly), 0.4 and 0.6. In theory the mean keeps rising with f, but it's carried by a handful of extremely lucky paths, while the median peaks at Kelly and collapses beyond it. That divergence between mean and median is the whole point of Kelly.
""",
        "starter": '''import numpy as np


def simulate_bets(f: float, p: float, b: float, n_bets: int, n_paths: int, seed: int = 0) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def simulate_bets(f: float, p: float, b: float, n_bets: int, n_paths: int, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    wins = rng.random((n_paths, n_bets)) < p
    return np.where(wins, 1 + f * b, 1 - f).prod(axis=1)
''',
        "hints": ["Build a matrix of per-bet growth factors, then take the product across each row."],
        "cases": lambda: [
            {"name": "Kelly bettor", "sample": True, "args": (0.2, 0.6, 1.0, 100, 1000, 1)},
            {"name": "overbetting", "args": (0.6, 0.6, 1.0, 200, 2000, 2)},
            {"name": "2-to-1 odds", "args": (0.1, 0.4, 2.0, 250, 500, 3)},
        ],
    },
    {
        "id": "t2_kelly_numeric",
        "title": "Kelly for a general bet (numerical)",
        "difficulty": "Medium",
        "libs": ["scipy.optimize", "numpy"],
        "fn": "optimal_fraction",
        "description": r"""
A bet returns `outcomes[i]` per unit staked with probability `probs[i]` (for example −1 for losing the stake, 0.5 for a 50% gain). Find the fraction f that maximizes the expected log-growth $E[\ln(1 + fX)]$:

- the largest admissible fraction keeps every outcome solvent: $f < f_{\max} = 1/\max(-\text{outcomes})$
- maximize with `scipy.optimize.minimize_scalar(lambda f: -E[log(1 + f X)], bounds=(0, 0.999 * f_max), method="bounded", options={"xatol": 1e-10})`
- return the optimal f (a float)

### Learn
Real trades rarely have two outcomes. A strategy with a return distribution (say, a backtest's daily returns) has a Kelly fraction found exactly this way, with the empirical distribution as the outcomes. For a binary bet the answer matches $p - q/b$; one test checks that.

`minimize_scalar` minimizes, so pass the negative of the objective. The bounded method needs finite bounds, which is why the solvency limit matters.
""",
        "starter": '''import numpy as np
from scipy.optimize import minimize_scalar


def optimal_fraction(outcomes, probs) -> float:
    # your code here
    pass
''',
        "solution": '''import numpy as np
from scipy.optimize import minimize_scalar


def optimal_fraction(outcomes, probs) -> float:
    x, p = np.asarray(outcomes, dtype=float), np.asarray(probs, dtype=float)
    f_max = 1 / np.max(-x)
    res = minimize_scalar(lambda f: -np.sum(p * np.log1p(f * x)), bounds=(0, 0.999 * f_max),
                          method="bounded", options={"xatol": 1e-10})
    return float(res.x)
''',
        "hints": ["`np.log1p(f * x)` computes ln(1 + f·x) accurately."],
        "rtol": 1e-5,
        "cases": lambda: [
            {"name": "binary bet: matches p − q/b", "sample": True, "args": ([1.0, -1.0], [0.6, 0.4])},
            {"name": "three outcomes", "args": ([2.0, 0.0, -1.0], [0.3, 0.3, 0.4])},
            {"name": "partial loss", "args": ([0.5, -0.4], [0.5, 0.5])},
        ],
    },
    {
        "id": "t2_ruin",
        "title": "Probability of ruin by bet size",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "ruin_probability",
        "description": r"""
Using the same simulation recipe as the wealth simulation (`rng = np.random.default_rng(seed)`, `wins = rng.random((n_paths, n_bets)) < p`, growth factors `1 + f*b` / `1 - f`), compute each path's wealth after every bet (starting from 1). Return the fraction of paths whose wealth **ever** falls to or below `ruin_level`.

### Learn
`np.cumprod(factors, axis=1)` gives the wealth path, and `.min(axis=1) <= ruin_level` flags the paths that hit the floor.

Run it for f from 0.05 to 0.5 with p = 0.55, b = 1, 500 bets and a ruin level of 0.5 (losing half the bankroll). A surprising classic: even at full Kelly (f = 0.1) you halve your bankroll at some point about half the time (for Kelly betting, the chance of ever falling to a fraction x of your starting wealth is roughly x). Half Kelly cuts that to around 12%, and at 2–3× Kelly it's near certain. In practice "ruin" means a drawdown that gets you shut down long before you reach zero, which is another argument for fractional Kelly.
""",
        "starter": '''import numpy as np


def ruin_probability(f: float, p: float, b: float, n_bets: int, n_paths: int,
                     ruin_level: float = 0.5, seed: int = 0) -> float:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def ruin_probability(f: float, p: float, b: float, n_bets: int, n_paths: int,
                     ruin_level: float = 0.5, seed: int = 0) -> float:
    rng = np.random.default_rng(seed)
    wins = rng.random((n_paths, n_bets)) < p
    wealth = np.cumprod(np.where(wins, 1 + f * b, 1 - f), axis=1)
    return float((wealth.min(axis=1) <= ruin_level).mean())
''',
        "hints": ["Reuse the simulation from the previous task, but keep the whole path with cumprod."],
        "cases": lambda: [
            {"name": "Kelly-sized bets", "sample": True, "args": (0.1, 0.55, 1.0, 500, 2000)},
            {"name": "3× Kelly", "args": (0.3, 0.55, 1.0, 500, 2000, 0.5, 1)},
            {"name": "tight ruin level", "args": (0.05, 0.55, 1.0, 1000, 1000, 0.8, 2)},
        ],
    },
]
