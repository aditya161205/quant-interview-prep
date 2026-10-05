import numpy as np

TITLE = "Markov chains, martingales and optimal stopping"
SUMMARY = "Absorbing chains, gambler's ruin, stationary distributions, fair games, and when to stop: backward induction."
KIND = "core"

LESSON = r"""
Many "harder" probability questions in trader interviews are Markov chains in disguise: a game with states, moves between them, and a question about where you end up or how long it takes. Recognizing the structure turns them into a few lines of algebra or a small linear system.

## Markov chains

A process whose next state depends only on the current one. The transition matrix has rows summing to 1: $P_{ij} = P(X_{t+1} = j \mid X_t = i)$, and the n-step transitions are $P^n$.

**Stationary distribution**: a row vector π with $\pi P = \pi$, $\sum_i \pi_i = 1$. It's the long-run fraction of time spent in each state (for irreducible, aperiodic chains). For two states with $P(0\to1) = a$ and $P(1\to0) = b$: $\pi_0 = b/(a+b)$.

## Absorbing chains

Order the states as transient then absorbing: $P = \begin{pmatrix} Q & R \\ 0 & I\end{pmatrix}$. The **fundamental matrix** $N = (I - Q)^{-1}$ counts expected visits to each transient state, so

- expected steps to absorption from each transient state: $t = N\mathbf 1$
- absorption probabilities: $B = NR$

This is first-step analysis in matrix form, and it solves any "expected number of rolls until…" question.

## Gambler's ruin

Start with $i$, win $1 with probability p or lose $1, and stop at 0 or N. With $r = q/p$:

$$P(\text{reach } N) = \begin{cases} i/N & p = \tfrac12 \\[2pt] \dfrac{1 - r^i}{1 - r^N} & p \ne \tfrac12\end{cases} \qquad E[\text{duration}] = \begin{cases} i(N-i) & p = \tfrac12 \\[2pt] \dfrac{i}{q-p} - \dfrac{N}{q-p}\cdot\dfrac{1-r^i}{1-r^N} & p \ne \tfrac12\end{cases}$$

A small edge changes everything: with p = 0.49 and a $100 bankroll against a $10,000 target, you're almost certainly ruined. The house edge compounds.

## Martingales and optional stopping

A martingale is a fair game: $E[X_{t+1} \mid \text{past}] = X_t$. **Optional stopping theorem**: for a bounded stopping rule, $E[X_\tau] = X_0$. No betting system turns a fair game into a winning one. The doubling ("martingale") strategy appears to win, but only by accepting a small chance of a catastrophic loss that a finite bankroll can't survive.

It's also a computational shortcut. A symmetric random walk started at 0 and stopped at +a or −b has $E[S_\tau] = 0$, so $P(+a) = b/(a+b)$; and since $S_t^2 - t$ is also a martingale, $E[\tau] = ab$.

## Optimal stopping: backward induction

When you may stop at any point, solve **from the end backward**: with k opportunities left, the value is $V_k = E[\max(\text{stop now}, V_{k-1})]$. Stop exactly when the current offer beats the value of continuing.

- Roll a die up to 3 times and keep the last roll: $V_1 = 3.5$, $V_2 = E[\max(X, 3.5)] = 4.25$, $V_3 = E[\max(X, 4.25)] = 14/3$. So stop on the first roll with 5+, on the second with 4+.
- **Secretary problem**: interview n candidates in random order and must accept or reject each on the spot. Skip the first $n/e$, then take the first one better than all of them, and you pick the best with probability $\approx 1/e \approx 37\%$.

The same logic prices American options (exercise when the payoff beats continuation) and drives real trading decisions such as when to cross the spread versus wait.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Fair coin, $1 bets: you start with $3 and stop at $0 or $10. What is the probability of reaching $10?",
     "answer": 0.3, "explanation": "For a fair game P = i/N = 3/10. Your wealth is a martingale, and optional stopping gives 3 = 10 × P(win)."},
    {"type": "number", "prompt": "You win each $1 bet with probability 0.6. Starting with $2, what is the probability of reaching $5 before $0?",
     "answer": (1 - (2 / 3) ** 2) / (1 - (2 / 3) ** 5), "display": "≈ 0.640",
     "explanation": "r = q/p = 2/3. P = (1 − r²)/(1 − r⁵) = 0.5556/0.8683 ≈ 0.640."},
    {"type": "number", "prompt": "Fair $1 bets starting at $3, stopping at $0 or $10. What is the expected number of bets?",
     "answer": 21, "explanation": "E[duration] = i(N − i) = 3 × 7 = 21."},
    {"type": "number", "prompt": "In the secretary problem with many candidates, what is the probability of picking the best one with the optimal strategy?",
     "answer": float(1 / np.e), "tol": 0.01, "display": "1/e ≈ 0.368", "explanation": "Reject the first n/e candidates, then accept the first one better than everyone seen. Success probability → 1/e."},
    {"type": "number", "prompt": "You may roll a die up to 3 times, stopping whenever you like, and receive the last roll. What is the game's value?",
     "answer": 14 / 3, "display": "14/3 ≈ 4.667",
     "explanation": "V₁ = 3.5. V₂ = E[max(X, 3.5)] = (3 × 3.5 + 4 + 5 + 6)/6 = 4.25. V₃ = E[max(X, 4.25)] = (4 × 4.25 + 5 + 6)/6 = 14/3."},
    {"type": "number", "prompt": "A symmetric ±1 random walk starts at 0. What is the probability it hits +1 before −2?",
     "answer": 2 / 3, "display": "2/3", "explanation": "Optional stopping: E[S_τ] = 0 = P(+1) × 1 − (1 − P(+1)) × 2, so P(+1) = 2/3."},
    {"type": "number", "prompt": "A two-state chain has P(0→0) = 0.9, P(0→1) = 0.1, P(1→0) = 0.5, P(1→1) = 0.5. What is the long-run fraction of time in state 0?",
     "answer": 5 / 6, "display": "5/6 ≈ 0.833", "explanation": "π₀ = P(1→0)/(P(0→1) + P(1→0)) = 0.5/0.6 = 5/6."},
    {"type": "number", "prompt": "A symmetric random walk starts at 0 and stops when it first reaches +3 or −3. What is the expected number of steps?",
     "answer": 9, "explanation": "S_t² − t is a martingale, so E[τ] = E[S_τ²] = 9. In general E[τ] = ab for barriers at +a and −b."},
    {"type": "number", "prompt": "Weather: a sunny day is followed by sun with probability 0.8, a rainy day by sun with probability 0.4. It's sunny today. What is the probability it's sunny in two days?",
     "answer": 0.72, "explanation": "0.8 × 0.8 (sun, sun) + 0.2 × 0.4 (rain, then sun) = 0.64 + 0.08 = 0.72."},
    {"type": "choice", "prompt": "What does the optional stopping theorem say about a fair game?",
     "choices": ["With bounded stopping rules, your expected final wealth equals your starting wealth", "A clever stopping rule can guarantee a profit",
                 "You will eventually go broke", "Stopping after a win locks in a positive expected value"],
     "answer": 0, "explanation": "No stopping strategy (with bounded time or wealth) can change the expected value of a martingale."},
    {"type": "open", "prompt": "A friend's roulette system doubles the bet after every loss, so the first win recovers everything plus one unit. Why doesn't it work?",
     "explanation": "It converts many small wins into a rare, enormous loss. A run of k losses needs a bet of 2^k units; with a finite bankroll or table limit you eventually can't double, and that loss wipes out all the small gains. With the house edge the expected value per spin is negative whatever you bet, and by optional stopping no betting pattern changes the expected value of a fair game, let alone an unfair one."},
]


PROBLEMS = [
    {
        "id": "t3_absorbing",
        "title": "Absorbing Markov chain solver",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "absorbing_stats",
        "description": r"""
Given a transition matrix `P` (list of lists or array) and the list of `absorbing` state indices, return a dict:

- `transient`: the transient state indices in increasing order (a list)
- `steps`: expected number of steps to absorption from each transient state, $t = N\mathbf 1$ with $N = (I - Q)^{-1}$
- `probs`: absorption probabilities $B = NR$, rows = transient states (in order), columns = absorbing states in the order given

### Learn
$Q$ is P restricted to transient rows and columns, and $R$ is transient rows with absorbing columns. Index with `P[np.ix_(rows, cols)]`. Prefer `np.linalg.solve(I - Q, ...)` to forming the inverse explicitly.

Every first-step-analysis puzzle becomes this solver: gambler's ruin, "expected rolls until two sixes in a row", or "probability that pattern A appears before pattern B". The tests include a gambler's-ruin chain whose answers you can check against the closed forms.
""",
        "starter": '''import numpy as np


def absorbing_stats(P, absorbing: list) -> dict:
    # return {"transient": ..., "steps": ..., "probs": ...}
    pass
''',
        "solution": '''import numpy as np


def absorbing_stats(P, absorbing: list) -> dict:
    P = np.asarray(P, dtype=float)
    transient = [i for i in range(len(P)) if i not in absorbing]
    Q = P[np.ix_(transient, transient)]
    R = P[np.ix_(transient, absorbing)]
    I = np.eye(len(transient))
    return {"transient": transient,
            "steps": np.linalg.solve(I - Q, np.ones(len(transient))),
            "probs": np.linalg.solve(I - Q, R)}
''',
        "hints": ["`np.linalg.solve(A, B)` solves A X = B for a matrix right-hand side too."],
        "cases": lambda: [
            {"name": "gambler's ruin, N = 4, p = 0.5", "sample": True,
             "args": ([[1, 0, 0, 0, 0], [.5, 0, .5, 0, 0], [0, .5, 0, .5, 0], [0, 0, .5, 0, .5], [0, 0, 0, 0, 1]], [0, 4])},
            {"name": "two sixes in a row (states: none, one six, done)", "args": ([[5 / 6, 1 / 6, 0], [5 / 6, 0, 1 / 6], [0, 0, 1]], [2])},
            {"name": "biased ruin, absorbing order reversed", "args": ([[1, 0, 0, 0], [.4, 0, .6, 0], [0, .4, 0, .6], [0, 0, 0, 1]], [3, 0])},
        ],
    },
    {
        "id": "t3_stationary",
        "title": "Stationary distribution",
        "difficulty": "Easy",
        "libs": ["numpy"],
        "fn": "stationary_distribution",
        "description": r"""
Return the stationary distribution π of an irreducible Markov chain with transition matrix `P`: the probability vector with $\pi P = \pi$.

### Learn
Stack the equations $(P^\top - I)\pi = 0$ with the normalization $\mathbf 1^\top\pi = 1$ and solve the (overdetermined but consistent) system with `np.linalg.lstsq`. An alternative is the left eigenvector of P for eigenvalue 1, normalized to sum to 1.

Regime models (Researcher track) use exactly this: the long-run fraction of time spent in calm and turbulent markets comes from the stationary distribution of the regime chain.
""",
        "starter": '''import numpy as np


def stationary_distribution(P) -> np.ndarray:
    # your code here
    pass
''',
        "solution": '''import numpy as np


def stationary_distribution(P) -> np.ndarray:
    P = np.asarray(P, dtype=float)
    n = len(P)
    A = np.vstack([P.T - np.eye(n), np.ones(n)])
    b = np.r_[np.zeros(n), 1.0]
    return np.linalg.lstsq(A, b, rcond=None)[0]
''',
        "hints": ["Append a row of ones to (Pᵀ − I) and a 1 to the right-hand side."],
        "cases": lambda: [
            {"name": "two states", "sample": True, "args": ([[0.9, 0.1], [0.5, 0.5]],)},
            {"name": "three-state regime chain", "args": ([[0.95, 0.04, 0.01], [0.10, 0.85, 0.05], [0.05, 0.25, 0.70]],)},
            {"name": "random walk on a 5-cycle", "args": ([[0, .5, 0, 0, .5], [.5, 0, .5, 0, 0], [0, .5, 0, .5, 0], [0, 0, .5, 0, .5], [.5, 0, 0, .5, 0]],)},
        ],
    },
    {
        "id": "t3_ruin",
        "title": "Gambler's ruin: closed forms",
        "difficulty": "Easy",
        "libs": ["python"],
        "fn": "gamblers_ruin",
        "description": r"""
A gambler starts with `start` and wins $1 with probability `p` (else loses $1), stopping at 0 or `target`. Return a dict with `p_win` (probability of reaching `target`) and `expected_steps` (expected number of bets), using the closed forms from the lesson, with the special case p = 0.5.

### Learn
Check yourself against your absorbing-chain solver on a small chain. Then explore: with p = 0.49, start 50 and target 100, the gambler wins only about 12% of the time. A 1% edge is decisive over many bets, which is the casino's entire business model and a market maker's too.
""",
        "starter": '''def gamblers_ruin(p: float, start: int, target: int) -> dict:
    # return {"p_win": ..., "expected_steps": ...}
    pass
''',
        "solution": '''def gamblers_ruin(p: float, start: int, target: int) -> dict:
    if abs(p - 0.5) < 1e-12:
        return {"p_win": start / target, "expected_steps": start * (target - start)}
    q = 1 - p
    r = q / p
    p_win = (1 - r**start) / (1 - r**target)
    return {"p_win": p_win, "expected_steps": start / (q - p) - target / (q - p) * p_win}
''',
        "hints": ["Handle p = 0.5 separately to avoid dividing by zero."],
        "cases": lambda: [
            {"name": "fair game", "sample": True, "args": (0.5, 3, 10)},
            {"name": "favourable game", "args": (0.6, 2, 5)},
            {"name": "small house edge", "args": (0.49, 50, 100)},
        ],
    },
    {
        "id": "t3_stopping",
        "title": "Optimal stopping by backward induction",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "dice_stopping",
        "description": r"""
You may roll a fair `sides`-sided die up to `n_rolls` times; after each roll you either stop and receive that face value, or roll again (you must accept the last roll). Return a dict:

- `value`: the expected payoff under optimal play, $V_n$, where $V_1 = \frac{\text{sides}+1}{2}$ and $V_k = E[\max(X, V_{k-1})]$
- `thresholds`: a list with one entry for each roll 1 … n − 1: the smallest face at which you should **stop**, i.e. the smallest face ≥ the value of continuing ($V$ with the remaining rolls)

### Learn
Backward induction: solve the last decision first (with one roll left you just take it, worth 3.5), then the one before, and so on. For 3 rolls of a d6 the thresholds are [5, 4]: stop on 5+ at first, 4+ at the second roll.

Note how thresholds fall as opportunities run out. American option exercise boundaries behave the same way as expiry approaches.
""",
        "starter": '''import numpy as np


def dice_stopping(n_rolls: int, sides: int = 6) -> dict:
    # return {"value": ..., "thresholds": [...]}
    pass
''',
        "solution": '''import numpy as np


def dice_stopping(n_rolls: int, sides: int = 6) -> dict:
    faces = np.arange(1, sides + 1)
    V = [(sides + 1) / 2]                       # V[k-1] = value with k rolls left
    for _ in range(n_rolls - 1):
        V.append(float(np.mean(np.maximum(faces, V[-1]))))
    thresholds = [int(np.ceil(V[n_rolls - i - 1] - 1e-12)) for i in range(1, n_rolls)]
    return {"value": V[-1], "thresholds": thresholds}
''',
        "hints": ["At roll i (1-based) there are n_rolls − i rolls left; compare the face with V for that many rolls."],
        "cases": lambda: [
            {"name": "3 rolls of a d6", "sample": True, "args": (3,)},
            {"name": "1 roll", "args": (1,)},
            {"name": "6 rolls", "args": (6,)},
            {"name": "4 rolls of a d20", "args": (4, 20)},
        ],
    },
]
