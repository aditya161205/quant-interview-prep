import numpy as np
import pandas as pd

TITLE = "Probability I: counting and conditioning"
SUMMARY = "Counting, conditional probability and Bayes: the backbone of every trader and researcher interview."
KIND = "foundation"

LESSON = r"""
Probability questions open almost every quant interview. They test whether you can turn a word problem into events, count carefully, and update beliefs with evidence, while talking through your reasoning.

## Counting

| Situation | Count |
|---|---|
| ordered choices, k of n, no repeats | $\frac{n!}{(n-k)!}$ |
| unordered choices, k of n | $\binom{n}{k} = \frac{n!}{k!(n-k)!}$ |
| arrangements of n items with groups of identical ones | $\frac{n!}{k_1!\,k_2!\cdots}$ (multinomial) |
| non-negative integer solutions of $x_1 + \dots + x_k = n$ | $\binom{n+k-1}{k-1}$ (stars and bars) |

**Complements** are your best friend: $P(\text{at least one}) = 1 - P(\text{none})$.

**Inclusion–exclusion**: $P(A\cup B) = P(A) + P(B) - P(A\cap B)$, and for more sets alternate the signs. It gives derangements (permutations with no fixed point): the probability tends to $1/e \approx 0.368$.

## Conditional probability and independence

$$P(A\mid B) = \frac{P(A\cap B)}{P(B)}, \qquad A, B \text{ independent} \iff P(A\cap B) = P(A)P(B)$$

**Law of total probability**: if $B_1, \dots, B_n$ partition the outcomes, $P(A) = \sum_i P(A\mid B_i)P(B_i)$. Conditioning on the first step of a process is the most useful trick in this course.

## Bayes' theorem

$$P(H\mid D) = \frac{P(D\mid H)\,P(H)}{\sum_j P(D\mid H_j)\,P(H_j)}$$

Posterior ∝ likelihood × prior. The classic trap is ignoring the **base rate**: a 99%-accurate test for a 1%-prevalence disease gives mostly false positives. When in doubt, use natural frequencies: imagine 10,000 people and count.

Sequential updating: today's posterior is tomorrow's prior. Observing data points one at a time gives the same answer as all at once, if they're conditionally independent.

## Classic patterns

- **Monty Hall**: switching wins with probability 2/3, because your first pick is right only 1/3 of the time, and the host's choice can't change that.
- **Boy–girl**: "at least one boy" leaves {BB, BG, GB}, so P(two boys) = 1/3. "The older is a boy" gives 1/2. Precise wording matters.
- **Birthday problem**: with 23 people the chance of a shared birthday exceeds 50%, because there are $\binom{23}{2} = 253$ pairs.
- **Symmetry**: the probability that the 10th card is an ace equals the probability that the 1st is, 4/52.

## Interview technique

1. Define the events and the sample space out loud.
2. Look for a complement, a symmetry or a conditioning step before brute-force counting.
3. Sanity-check with extreme cases (what if the deck had 2 cards?).
4. Give exact fractions when you can, and an approximate decimal.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Two fair dice are rolled. What is the probability that the sum is 7?",
     "answer": 1 / 6, "display": "1/6", "explanation": "6 of the 36 equally likely outcomes sum to 7: (1,6), (2,5), …, (6,1)."},
    {"type": "number", "prompt": "You roll a fair die 4 times. What is the probability of at least one six?",
     "answer": 1 - (5 / 6) ** 4, "display": "1 − (5/6)⁴ ≈ 0.5177",
     "explanation": "Complement: P(no six in 4 rolls) = (5/6)⁴ ≈ 0.4823."},
    {"type": "number", "prompt": "Two cards are drawn without replacement from a standard 52-card deck. What is the probability that both are aces?",
     "answer": 1 / 221, "display": "1/221 ≈ 0.00452", "explanation": "(4/52) × (3/51) = 12/2652 = 1/221."},
    {"type": "number", "prompt": "Monty Hall: you pick one of 3 doors, the host (who knows where the car is) opens a different door with a goat and offers a switch. What is your probability of winning if you switch?",
     "answer": 2 / 3, "display": "2/3", "explanation": "Switching wins exactly when your first pick was wrong, which happens with probability 2/3."},
    {"type": "number", "prompt": "A disease affects 1% of people. A test detects it 99% of the time and has a 5% false-positive rate. You test positive. What is the probability you have the disease?",
     "answer": 0.0099 / (0.0099 + 0.0495), "display": "1/6 ≈ 0.167",
     "explanation": "Out of 10,000 people: 100 are sick and 99 test positive; 9,900 are healthy and 495 test positive. P(sick | positive) = 99 / 594 = 1/6."},
    {"type": "number", "prompt": "A family has two children, and at least one is a boy. Assuming each child is independently a boy or girl with probability 1/2, what is the probability that both are boys?",
     "answer": 1 / 3, "display": "1/3", "explanation": "Equally likely cases with at least one boy: BB, BG, GB. Only BB has two boys."},
    {"type": "number", "prompt": "What is the smallest group size for which the probability that two people share a birthday exceeds 1/2? (365 equally likely days, no leap years.)",
     "answer": 23, "tol": 0, "explanation": "P(no shared birthday) = ∏ₖ₌₀ⁿ⁻¹ (1 − k/365) first drops below 0.5 at n = 23 (≈ 0.4927)."},
    {"type": "number", "prompt": "How many distinct arrangements are there of the letters of MISSISSIPPI?",
     "answer": 34650, "tol": 0, "display": "34,650", "explanation": "11 letters with M×1, I×4, S×4, P×2: 11! / (4! 4! 2!) = 34,650."},
    {"type": "number", "prompt": "A bag has 3 coins: two fair and one with heads on both sides. You draw one at random, flip it, and see heads. What is the probability that it's the two-headed coin?",
     "answer": 0.5, "display": "1/2", "explanation": "P(H) = (1/3)(1) + (2/3)(1/2) = 2/3. Bayes: (1/3) / (2/3) = 1/2."},
    {"type": "number", "prompt": "How many solutions in non-negative integers does x₁ + x₂ + x₃ = 10 have?",
     "answer": 66, "tol": 0, "explanation": "Stars and bars: C(10 + 3 − 1, 3 − 1) = C(12, 2) = 66."},
    {"type": "number", "prompt": "Five people put their hats in a box and each draws one at random. In how many of the 5! orderings does nobody get their own hat?",
     "answer": 44, "tol": 0, "explanation": "Derangements: D(n) = (n − 1)(D(n−1) + D(n−2)) with D(1) = 0, D(2) = 1 gives D(3) = 2, D(4) = 9, D(5) = 44. That's 44/120 ≈ 0.367, close to 1/e."},
    {"type": "number", "prompt": "A and B are independent events with P(A) = 0.3 and P(B) = 0.4. What is P(A or B)?",
     "answer": 0.58, "explanation": "Inclusion–exclusion: 0.3 + 0.4 − 0.3 × 0.4 = 0.58."},
    {"type": "open", "prompt": "Explain why switching wins in Monty Hall to someone who insists it's 50/50.",
     "explanation": "Your first pick is right 1/3 of the time, and nothing the host does can change that, since he can always open a goat door. So staying wins 1/3 and switching wins the rest, 2/3. With 100 doors where the host opens 98 goats, switching obviously wins 99%."},
]


def _likelihoods(flips, ps):
    ps = np.asarray(ps, dtype=float)
    return np.array([ps if f else 1 - ps for f in flips])


def _check_monty(fn):
    for n_doors, switch, target in [(3, True, 2 / 3), (3, False, 1 / 3), (10, True, 0.9)]:
        v = fn(200_000, switch, n_doors, 0)
        assert isinstance(v, (int, float, np.floating)), f"return the win rate as a number, got {type(v).__name__}"
        assert abs(v - target) < 0.01, (f"{n_doors} doors, switch={switch}: got {v:.4f}, expected about {target:.4f}. "
                                        "Check what the host is allowed to open.")


PROBLEMS = [
    {
        "id": "f2_bayes",
        "title": "Sequential Bayesian updating",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "bayes_sequential",
        "description": r"""
You have `k` hypotheses with prior probabilities `prior` (length k) and observe data points one at a time. `likelihoods[t, j]` is the probability of observation t under hypothesis j. Return a numpy array of shape `(n_obs, k)` whose row t is the posterior after seeing observations 0…t.

### Learn
Each update is "multiply by the likelihood, then renormalize":

$$\pi_t(j) = \frac{\pi_{t-1}(j)\, L_t(j)}{\sum_i \pi_{t-1}(i)\, L_t(i)}$$

Example from the tests: is a coin biased? Hypotheses p(heads) ∈ {0.3, 0.5, 0.7} with equal priors; a head multiplies each hypothesis by p, a tail by 1 − p. Watch the posterior concentrate as flips arrive.

Traders do this informally all day: every print, news item or order is evidence that moves your estimate of fair value.
""",
        "starter": '''import numpy as np


def bayes_sequential(prior, likelihoods) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def bayes_sequential(prior, likelihoods) -> np.ndarray:
    post = np.asarray(prior, dtype=float)
    rows = []
    for lik in np.asarray(likelihoods, dtype=float):
        post = post * lik
        post = post / post.sum()
        rows.append(post)
    return np.array(rows)
''',
        "hints": ["Keep the current posterior in a variable and append a copy after each update."],
        "cases": lambda: [
            {"name": "coin bias, 6 flips", "sample": True, "args": ([1 / 3] * 3, _likelihoods([1, 1, 0, 1, 1, 1], [0.3, 0.5, 0.7]))},
            {"name": "skewed prior, 40 flips", "args": ([0.8, 0.15, 0.05], _likelihoods(np.random.default_rng(1).random(40) < 0.7, [0.5, 0.6, 0.7]))},
            {"name": "two hypotheses", "args": ([0.5, 0.5], [[0.9, 0.2], [0.1, 0.8], [0.9, 0.2]])},
        ],
    },
    {
        "id": "f2_birthday",
        "title": "Birthday problem table",
        "difficulty": "Easy",
        "libs": ["numpy", "pandas"],
        "fn": "birthday_table",
        "description": r"""
Return a Series indexed by group size $n = 1, \dots,$ `max_n` with the exact probability that at least two people in the group share a birthday, assuming `days` equally likely birthdays:

$$P(\text{shared}) = 1 - \prod_{k=0}^{n-1}\left(1 - \frac{k}{\text{days}}\right)$$

### Learn
`np.cumprod` computes all the products at once: the $n$-th cumulative product is the probability of no match among $n$ people. Once $n >$ `days` the product contains a zero factor, so the probability becomes exactly 1 (pigeonhole).

The surprise (23 people for 50%) comes from counting pairs, not people. The same logic explains why "coincidences" in large datasets are expected, and why scanning many strategies always finds an impressive-looking one.
""",
        "starter": '''import numpy as np
import pandas as pd


def birthday_table(max_n: int, days: int = 365) -> pd.Series:
    # your code here
    pass
''',
        "solution": '''import numpy as np
import pandas as pd


def birthday_table(max_n: int, days: int = 365) -> pd.Series:
    k = np.arange(max_n)
    p_none = np.cumprod(np.clip(1 - k / days, 0, None))
    return pd.Series(1 - p_none, index=pd.RangeIndex(1, max_n + 1, name="n"))
''',
        "hints": ["Index the result with `range(1, max_n + 1)`."],
        "cases": lambda: [
            {"name": "up to 30 people", "sample": True, "args": (30,)},
            {"name": "up to 80 people", "args": (80,)},
            {"name": "12 'days', beyond the pigeonhole limit", "args": (15, 12)},
        ],
    },
    {
        "id": "f2_monty",
        "title": "Simulate Monty Hall with n doors",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "monty_hall",
        "description": r"""
Simulate `n_games` games of Monty Hall with `n_doors` doors and return the fraction won (a float). In each game the car is behind a uniformly random door, you pick a uniformly random door, and the host, who knows where the car is, opens every other door except one, never revealing the car. You then either stay with your door or switch to the one remaining closed door.

This task is graded statistically: with 200,000 games your win rate must be within 0.01 of the true probability (3 doors: switch 2/3, stay 1/3; 10 doors: switch 0.9).

### Learn
You don't need to simulate the host door by door. Ask: when does switching win? Exactly when your first pick was wrong. Then the remaining closed door must hide the car, because the host never opens it. That insight turns the simulation into two lines of numpy, and the formula into $(n-1)/n$.

This "simulate to confirm" workflow is how you should check any puzzle answer you're not sure of.
""",
        "starter": '''import numpy as np


def monty_hall(n_games: int, switch: bool, n_doors: int = 3, seed: int = 0) -> float:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def monty_hall(n_games: int, switch: bool, n_doors: int = 3, seed: int = 0) -> float:
    rng = np.random.default_rng(seed)
    car = rng.integers(0, n_doors, n_games)
    pick = rng.integers(0, n_doors, n_games)
    first_right = car == pick
    wins = ~first_right if switch else first_right
    return float(wins.mean())
''',
        "hints": ["When you switch, you end up with the car exactly when your first pick was wrong."],
        "cases": lambda: [
            {"name": "3 doors (switch and stay) and 10 doors", "sample": True, "check": _check_monty},
        ],
    },
    {
        "id": "f2_derangements",
        "title": "Derangements and the 1/e limit",
        "difficulty": "Easy",
        "libs": ["python"],
        "fn": "derangements",
        "description": r"""
Return a tuple `(count, probability)`: the number of permutations of `n` items with no fixed point, and that count divided by $n!$.

Use the recurrence $D(n) = (n-1)\,\big(D(n-1) + D(n-2)\big)$ with $D(0) = 1$, $D(1) = 0$, and Python integers, which never overflow.

### Learn
Where the recurrence comes from: item 1 goes to some position $j$ ($n - 1$ choices). Either item $j$ goes to position 1 (leaving a derangement of $n - 2$ items), or it doesn't (equivalent to a derangement of $n - 1$ items).

Inclusion–exclusion gives the closed form $D(n)/n! = \sum_{k=0}^{n} (-1)^k/k! \to 1/e$. The limit arrives fast: by $n = 10$ it matches $1/e$ to 7 digits. `math.factorial` gives exact factorials.
""",
        "starter": '''import math


def derangements(n: int) -> tuple:
    # return count, probability
    pass
''',
        "solution": '''import math


def derangements(n: int) -> tuple:
    a, b = 1, 0  # D(0), D(1)
    if n == 0:
        return 1, 1.0
    for k in range(2, n + 1):
        a, b = b, (k - 1) * (a + b)
    return b, b / math.factorial(n)
''',
        "hints": ["Keep the last two values in two variables and update them in a loop."],
        "cases": lambda: [
            {"name": "n = 4", "sample": True, "args": (4,)},
            {"name": "n = 5", "args": (5,)},
            {"name": "n = 1", "args": (1,)},
            {"name": "n = 20 (big integers)", "args": (20,)},
        ],
    },
]
