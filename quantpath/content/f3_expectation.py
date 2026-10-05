import numpy as np
import pandas as pd

TITLE = "Probability II: random variables and expectation"
SUMMARY = "Expectation, variance, linearity, conditioning on the first step, and the distributions every quant must know cold."
KIND = "foundation"

LESSON = r"""
Most "expected value" interview questions are solved by one of three tricks: **linearity with indicators**, **conditioning on the first step**, or the **tail-sum formula**. Recognize which one fits and the algebra becomes short.

## Expectation and variance

$$E[X] = \sum_x x\,P(X=x), \qquad \text{Var}(X) = E[X^2] - E[X]^2, \qquad \text{Var}(aX+b) = a^2\,\text{Var}(X)$$

$$\text{Var}(X+Y) = \text{Var}(X) + \text{Var}(Y) + 2\,\text{Cov}(X,Y), \qquad \rho = \frac{\text{Cov}(X,Y)}{\sigma_X\sigma_Y}$$

## Trick 1: linearity of expectation (with indicators)

$E[X+Y] = E[X] + E[Y]$ **always**, even when X and Y are dependent. Write a count as a sum of indicators $X = \sum_i \mathbb 1_{A_i}$, so $E[X] = \sum_i P(A_i)$.

*Example:* expected number of fixed points in a random permutation of n: each item stays put with probability 1/n, so the answer is $n \cdot \frac1n = 1$, for every n.

## Trick 2: condition on the first step

Let $E$ be the quantity you want, condition on what happens first, and solve the resulting equation.

*Example:* expected rolls of a die until the first six: $E = 1 + \frac56 E$, so $E = 6$.
*Example:* expected rolls until two sixes in a row: with $E_0$ (no progress) and $E_1$ (just rolled a six), $E_0 = 1 + \frac16E_1 + \frac56E_0$ and $E_1 = 1 + \frac56E_0$, giving $E_0 = 42$.

## Trick 3: tail sums

For a non-negative integer variable, $E[X] = \sum_{k\ge1} P(X \ge k)$. It turns maxima into easy CDF calculations: $P(\max \le m) = P(\text{each} \le m) = \left(\frac{m}{6}\right)^n$ for n dice.

## Distributions to know cold

| Distribution | Models | Mean | Variance |
|---|---|---|---|
| Bernoulli(p) | one trial | $p$ | $p(1-p)$ |
| Binomial(n, p) | successes in n trials | $np$ | $np(1-p)$ |
| Geometric(p) | trials until first success | $1/p$ | $(1-p)/p^2$ |
| Poisson(λ) | count of rare events | $\lambda$ | $\lambda$ |
| Uniform(a, b) | | $\frac{a+b}{2}$ | $\frac{(b-a)^2}{12}$ |
| Exponential(λ) | waiting time | $1/\lambda$ | $1/\lambda^2$ |
| Normal(μ, σ²) | sums of many effects | $\mu$ | $\sigma^2$ |

Geometric and exponential are **memoryless**: having waited does not change the remaining wait. Order statistics of n uniforms: $E[U_{(k)}] = \frac{k}{n+1}$, so $E[\max] = \frac{n}{n+1}$.

**Coupon collector**: collecting all n coupons is a sum of geometric waits with success probabilities $\frac{n}{n}, \frac{n-1}{n}, \dots, \frac1n$, so $E = n\left(1 + \frac12 + \dots + \frac1n\right) = nH_n$.

## Conditional expectation

$E[X] = E\big[E[X\mid Y]\big]$ (the tower property), and $\text{Var}(X) = E[\text{Var}(X\mid Y)] + \text{Var}(E[X\mid Y])$. In finance, a conditional expectation given today's information is the fair price.

## Sums of random variables

The distribution of $X+Y$ for independent discrete variables is the **convolution** of their PMFs. For dice: `np.convolve(pmf, pmf)`. The CLT says sums of many independent terms look normal, which is why the sum of 10 dice is already nearly bell-shaped.
"""

QUESTIONS = [
    {"type": "number", "prompt": "What is the expected number of rolls of a fair die until the first six?",
     "answer": 6, "explanation": "Geometric with p = 1/6, so the mean is 1/p = 6. Or condition on the first roll: E = 1 + (5/6)E."},
    {"type": "number", "prompt": "What is the expected number of rolls until you get two sixes in a row?",
     "answer": 42, "explanation": "States: E₀ (no six last) and E₁ (six last). E₀ = 1 + E₁/6 + 5E₀/6 and E₁ = 1 + 5E₀/6. Solving gives E₀ = 42."},
    {"type": "number", "prompt": "You roll a die 6 times. What is the expected number of distinct faces you see?",
     "answer": 6 * (1 - (5 / 6) ** 6), "display": "6(1 − (5/6)⁶) ≈ 3.991",
     "explanation": "Indicators: face k appears with probability 1 − (5/6)⁶. Sum over 6 faces."},
    {"type": "number", "prompt": "What is the expected value of the maximum of two fair dice?",
     "answer": 161 / 36, "display": "161/36 ≈ 4.472",
     "explanation": "P(max ≤ m) = (m/6)², so P(max = m) = (2m − 1)/36. Then Σ m(2m − 1)/36 = 161/36."},
    {"type": "number", "prompt": "A cereal box contains one of 6 equally likely toys. What is the expected number of boxes needed to collect all 6?",
     "answer": 14.7, "explanation": "6 × (1 + 1/2 + 1/3 + 1/4 + 1/5 + 1/6) = 6 × 2.45 = 14.7."},
    {"type": "number", "prompt": "X and Y are independent Uniform(0, 1). What is E[max(X, Y)]?",
     "answer": 2 / 3, "display": "2/3", "explanation": "For n uniforms, E[max] = n/(n + 1). With n = 2 that's 2/3."},
    {"type": "number", "prompt": "A random permutation of 100 items is drawn. What is the expected number of items that stay in their original position?",
     "answer": 1, "explanation": "Linearity: each item is fixed with probability 1/100, and 100 × 1/100 = 1."},
    {"type": "number", "prompt": "What is the variance of the sum of 10 fair dice?",
     "answer": 10 * 35 / 12, "display": "175/6 ≈ 29.17",
     "explanation": "One die has variance E[X²] − E[X]² = 91/6 − 49/4 = 35/12. Independent variances add: 10 × 35/12."},
    {"type": "number", "prompt": "A stick is broken at two points chosen uniformly at random. What is the probability that the three pieces can form a triangle?",
     "answer": 0.25, "display": "1/4", "explanation": "A triangle needs every piece shorter than 1/2. In the unit square of break points this region has area 1/4."},
    {"type": "number", "prompt": "What is the expected number of fair coin flips until you see two heads in a row (HH)?",
     "answer": 6, "explanation": "Same state method as the dice: E₀ = 1 + (E₁ + E₀)/2 and E₁ = 1 + E₀/2, so E₀ = 6. Note that HT needs only 4."},
    {"type": "number", "prompt": "Defaults in a portfolio follow a Poisson distribution with mean 2 per year. What is the probability of no defaults this year?",
     "answer": float(np.exp(-2)), "display": "e⁻² ≈ 0.1353", "explanation": "P(X = 0) = e^(−λ) = e⁻²."},
    {"type": "number", "prompt": "Cards are dealt one at a time from a shuffled 52-card deck. What is the expected position of the first ace?",
     "answer": 53 / 5, "display": "53/5 = 10.6",
     "explanation": "The 4 aces split the 48 other cards into 5 gaps, each holding 48/5 = 9.6 cards on average. The first ace is at 9.6 + 1 = 10.6."},
    {"type": "open", "prompt": "Why does linearity of expectation hold even for dependent variables? Give an example where it saves a lot of work.",
     "explanation": "Expectation is a sum (or integral) over outcomes, and sums can be split term by term whatever the dependence: E[X+Y] = Σ(x+y)p = Σxp + Σyp. Example: expected number of couples seated together at a random round table. The events are dependent, but by indicators the answer is n × P(a given couple is adjacent) = n × 2/(2n − 1), with no joint probabilities needed."},
]


PROBLEMS = [
    {
        "id": "f3_dice_pmf",
        "title": "Exact distribution of a dice sum",
        "difficulty": "Easy",
        "libs": ["numpy", "pandas"],
        "fn": "dice_sum_pmf",
        "description": r"""
Return the exact probability mass function of the sum of `n_dice` fair dice with `sides` faces each, as a Series indexed by every possible sum (`n_dice` … `n_dice * sides`).

### Learn
The PMF of a sum of independent variables is the convolution of their PMFs. Start from one die, `np.full(sides, 1 / sides)`, and convolve it with itself `n_dice - 1` times using `np.convolve`. The result's position 0 corresponds to the smallest sum, `n_dice`.

Compare with your simulation from the Python step: they should agree to within a few standard errors. With 10 dice the PMF already looks like a normal curve with mean 35 and variance $10 \times 35/12$ (the CLT at work).
""",
        "starter": '''import numpy as np
import pandas as pd


def dice_sum_pmf(n_dice: int, sides: int = 6) -> pd.Series:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def dice_sum_pmf(n_dice: int, sides: int = 6) -> pd.Series:
    die = np.full(sides, 1 / sides)
    pmf = die
    for _ in range(n_dice - 1):
        pmf = np.convolve(pmf, die)
    return pd.Series(pmf, index=pd.RangeIndex(n_dice, n_dice * sides + 1, name="sum"))
''',
        "hints": ["After k convolutions the array has length k·(sides − 1) + sides."],
        "cases": lambda: [
            {"name": "2 dice", "sample": True, "args": (2,)},
            {"name": "10 dice", "args": (10,)},
            {"name": "3 four-sided dice", "args": (3, 4)},
            {"name": "1 die", "args": (1,)},
        ],
    },
    {
        "id": "f3_pattern_wait",
        "title": "Expected waiting time for a coin pattern",
        "difficulty": "Hard",
        "libs": ["numpy"],
        "fn": "expected_wait",
        "description": r"""
A coin lands heads with probability `p_heads`. Return the expected number of flips until the string `pattern` (made of `"H"` and `"T"`) first appears in the sequence of flips.

### Learn
Generalize the first-step method. Track the **state** = length of the longest prefix of the pattern that matches the end of the flips so far (0 … m). After a flip, move to the longest prefix of the pattern that is a suffix of (current prefix + new flip). With $E_i$ the expected remaining flips from state i:

$$E_m = 0, \qquad E_i = 1 + p\,E_{\text{next}(i, H)} + (1-p)\,E_{\text{next}(i, T)}$$

That's a linear system: build the matrix and use `np.linalg.solve`.

There's also an elegant closed form (from a martingale argument, the "ABRACADABRA" problem): $E = \sum_{k=1}^{m} \mathbb 1[\text{first } k \text{ letters} = \text{last } k \text{ letters}] / P(\text{first } k \text{ letters})$. For a fair coin that gives HH = 2 + 4 = 6 and HTH = 2 + 8 = 10. Check your solver against it.

Interviewers love asking "HH or HT, which takes longer on average?": 6 vs 4, because a failed HH attempt sends you back to the start, while a failed HT attempt doesn't.
""",
        "starter": '''import numpy as np


def expected_wait(pattern: str, p_heads: float = 0.5) -> float:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def expected_wait(pattern: str, p_heads: float = 0.5) -> float:
    m = len(pattern)

    def nxt(state, flip):
        s = pattern[:state] + flip
        for k in range(min(len(s), m), 0, -1):
            if s.endswith(pattern[:k]):
                return k
        return 0

    A = np.eye(m + 1)
    b = np.zeros(m + 1)
    for i in range(m):
        b[i] = 1.0
        A[i, nxt(i, "H")] -= p_heads
        A[i, nxt(i, "T")] -= 1 - p_heads
    return float(np.linalg.solve(A, b)[0])
''',
        "hints": ["State m (the full pattern) is absorbing: its equation is just E_m = 0.",
                  "`str.endswith` is enough to compute the next state for short patterns."],
        "cases": lambda: [
            {"name": "HH", "sample": True, "args": ("HH",)},
            {"name": "HT", "args": ("HT",)},
            {"name": "HTH", "args": ("HTH",)},
            {"name": "HHTHH", "args": ("HHTHH",)},
            {"name": "biased coin, THT", "args": ("THT", 0.6)},
        ],
    },
    {
        "id": "f3_coupon_stats",
        "title": "Coupon collector: mean and variance",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "coupon_stats",
        "description": r"""
There are `n` equally likely coupon types. Return a dict with the mean and the variance of the number of draws needed to collect all of them.

### Learn
When $k$ types are still missing, each draw finds a new one with probability $p_k = k/n$, so the wait is Geometric($p_k$) with mean $1/p_k$ and variance $(1-p_k)/p_k^2$. The waits are independent, so means and variances add:

$$E = \sum_{k=1}^{n} \frac{n}{k} = nH_n, \qquad \text{Var} = \sum_{k=1}^{n} \frac{1 - k/n}{(k/n)^2} = n^2\sum_{k=1}^{n}\frac1{k^2} - nH_n$$

The standard deviation is about $1.28\,n$ for large n, the same order as the mean. Collecting everything is a very uncertain project.
""",
        "starter": '''import numpy as np


def coupon_stats(n: int) -> dict:
    # return {"mean": ..., "var": ...}
    pass
''',
        "solution": '''import numpy as np


def coupon_stats(n: int) -> dict:
    p = np.arange(1, n + 1) / n
    return {"mean": float(np.sum(1 / p)), "var": float(np.sum((1 - p) / p**2))}
''',
        "hints": ["Vectorize over k = 1..n with `np.arange`."],
        "cases": lambda: [
            {"name": "6 coupons", "sample": True, "args": (6,)},
            {"name": "1 coupon", "args": (1,)},
            {"name": "52 coupons", "args": (52,)},
        ],
    },
    {
        "id": "f3_expected_max",
        "title": "Expected maximum by the tail-sum formula",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "expected_max",
        "description": r"""
Return the exact expected value of the maximum of `n` independent fair dice with `sides` faces.

### Learn
Use the tail-sum formula $E[M] = \sum_{m=1}^{\text{sides}} P(M \ge m)$ with

$$P(M \ge m) = 1 - P(\text{all dice} \le m-1) = 1 - \left(\frac{m-1}{\text{sides}}\right)^n$$

As n grows the expected maximum approaches `sides`. This pattern of reasoning about a maximum through its CDF reappears in order statistics, extreme value theory, and the expected best Sharpe ratio among many backtests.
""",
        "starter": '''import numpy as np


def expected_max(n: int, sides: int = 6) -> float:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def expected_max(n: int, sides: int = 6) -> float:
    m = np.arange(1, sides + 1)
    return float(np.sum(1 - ((m - 1) / sides) ** n))
''',
        "hints": ["Two dice should give 161/36 ≈ 4.4722."],
        "cases": lambda: [
            {"name": "2 dice", "sample": True, "args": (2,)},
            {"name": "1 die", "args": (1,)},
            {"name": "5 twenty-sided dice", "args": (5, 20)},
        ],
    },
]
