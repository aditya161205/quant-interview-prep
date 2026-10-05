import numpy as np
import pandas as pd

TITLE = "Project: game strategist"
SUMMARY = "Solve two classic trading-interview games end to end: optimal policy by dynamic programming, verification by simulation, full payoff distribution."
KIND = "project"

LESSON = r"""
Trading firms love games because they compress the job into ten minutes: work out what something is worth, decide when to act, and understand the risk of your decision. This project solves two famous ones completely, the way a desk would: exact value, optimal policy, simulated check, and the distribution of outcomes.

## Game 1: the red–black card game

A shuffled deck holds `r` red and `b` black cards. You turn cards over one at a time. Each red card pays you +1 and each black card costs you 1, and **you may stop at any moment** (including before the first card). What is the game worth with optimal play?

With $i$ red and $j$ black cards left, let $V(i, j)$ be the value of the rest of the game. You either stop (worth 0) or draw:

$$V(i, j) = \max\left(0,\; \frac{i}{i+j}\big(1 + V(i-1, j)\big) + \frac{j}{i+j}\big({-1} + V(i, j-1)\big)\right)$$

with $V(i, 0) = i$ (only reds left: take them all) and $V(0, j) = 0$ (only blacks: stop). For a full 26/26 deck, $V \approx 2.62$, even though the deck is balanced: the option to stop is worth something.

## Game 2: dice with a cost per roll

You may roll a die up to n times; **each roll costs c**, paid before rolling. After each roll you can stop and take the face value or pay to roll again (the last roll must be kept). Costs lower the value of continuing, so you stop earlier: the thresholds fall as c rises. You'll compute the value, the thresholds, and the full distribution of your net payoff, which is what you need to judge the risk, not only the mean.

## What you build

```text
Part 1  red–black DP table
  ↓ Part 2  simulate the optimal policy: does it match the DP?
Part 3  dice game: value and thresholds
  ↓ Part 4  exact payoff distribution
Parts 1, 3 and 4
  ↓ Part 5  price both games, measure risk, quote two-sided markets
```

1. `red_black_values`: the DP table for game 1
2. `simulate_red_black`: play the optimal policy on simulated shuffles and report the mean and standard error; it should match the DP value within a few standard errors
3. `cost_game`: value and thresholds for game 2
4. `cost_game_distribution`: the exact probability distribution of game 2's net payoff under the optimal policy
5. `game_desk`: the desk view of both games: fair value, payoff standard deviation, probability of losing, and a bid/ask around fair value

## Interview angle

You'll be asked "What's the game worth? Would you pay X? What's your strategy?", and then "Make me a market in it." Your bid and ask should straddle your fair value, with a width that reflects your uncertainty and the standard deviation of the payoff. Being able to compute that standard deviation (Parts 4 and 5) is what makes the width defensible.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Red–black game with 1 red and 1 black card. What is it worth with optimal play?",
     "answer": 0.5, "explanation": "Draw once. Red (prob ½): +1 and stop, since only black remains. Black (prob ½): −1, then take the red for +1, total 0. Value = ½ × 1 + ½ × 0 = ½."},
    {"type": "number", "prompt": "Red–black game with 2 red and 1 black. What is it worth?",
     "answer": 4 / 3, "display": "4/3 ≈ 1.333",
     "explanation": "V(1,1) = ½, V(2,0) = 2, V(1,0) = 1. V(2,1) = max(0, ⅔(1 + V(1,1)) + ⅓(−1 + V(2,0))) = ⅔ × 1.5 + ⅓ × 1 = 4/3."},
    {"type": "choice", "prompt": "A balanced red–black deck (26 red, 26 black) is worth about 2.62 under optimal stopping. Where does the value come from?",
     "choices": ["The option to stop when you're ahead, which truncates the downside", "Red cards are more likely to come first", "Card counting changes the probabilities in your favour", "It comes from the last card always being red"],
     "answer": 0, "explanation": "Without the stopping option the expected payoff is exactly 0. The right to stop is a free option, and options have positive value."},
    {"type": "open", "prompt": "Someone offers to sell you the full-deck red–black game for 2.0. Do you buy, and how would you make a two-sided market in it?",
     "explanation": "Fair value ≈ 2.62, so buying at 2.0 has an expected profit of about 0.62 per game. Check the spread of outcomes (simulate: the standard deviation is large relative to the edge) and size accordingly. A market might be 2.3 bid / 2.9 ask: centred near fair value, wide enough to cover uncertainty in my estimate and the risk of being picked off by someone who computed it more precisely. Tighten as I become confident in the 2.62 number."},
]


_RB = '''def red_black_values(r: int, b: int) -> np.ndarray:
    V = np.zeros((r + 1, b + 1))
    for i in range(r + 1):
        for j in range(b + 1):
            if i == 0:
                V[i, j] = 0.0
            elif j == 0:
                V[i, j] = i
            else:
                draw = i / (i + j) * (1 + V[i - 1, j]) + j / (i + j) * (-1 + V[i, j - 1])
                V[i, j] = max(0.0, draw)
    return V
'''

_DIST = '''def cost_game_distribution(n_rolls: int, cost: float, sides: int = 6) -> pd.Series:
    thresholds = cost_game(n_rolls, cost, sides)["thresholds"]
    dist, alive = {}, 1.0
    for i in range(1, n_rolls + 1):
        go_on = 0.0
        for face in range(1, sides + 1):
            p = alive / sides
            if i == n_rolls or face >= thresholds[i - 1]:
                key = round(face - cost * i, 10)
                dist[key] = dist.get(key, 0.0) + p
            else:
                go_on += p
        alive = go_on
    return pd.Series(dist).sort_index()
'''

_COST = '''def cost_game(n_rolls: int, cost: float, sides: int = 6) -> dict:
    faces = np.arange(1, sides + 1)
    W = [faces.mean() - cost]                     # W[k-1]: value with k rolls left, incl. next roll's cost
    for _ in range(n_rolls - 1):
        W.append(float(np.mean(np.maximum(faces, W[-1])) - cost))
    thresholds = [int(np.ceil(W[n_rolls - i - 1] - 1e-12)) for i in range(1, n_rolls)]
    return {"value": W[-1], "thresholds": thresholds}
'''

PROBLEMS = [
    {
        "id": "t4_red_black",
        "title": "Part 1 · Red–black game: the DP table",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "red_black_values",
        "description": r"""
Return the numpy array `V` of shape `(r + 1, b + 1)` where `V[i, j]` is the value of the red–black game with `i` red and `j` black cards remaining under optimal stopping (recursion in the lesson: `V[i, 0] = i`, `V[0, j] = 0`).

### Learn
Fill the table in an order where both $V(i-1, j)$ and $V(i, j-1)$ are already known: increasing i, and increasing j inside. That's all dynamic programming is: a recursion plus an order that makes every lookup ready when needed.

`V[26, 26]` should be about 2.6245. The table also contains the policy: draw exactly when `V[i, j] > 0`.
""",
        "starter": '''import numpy as np


def red_black_values(r: int, b: int) -> np.ndarray:
    # your code here
    pass
''',
        "solution": "import numpy as np\n\n\n" + _RB,
        "hints": ["Handle the boundaries (i == 0 or j == 0) first inside the double loop."],
        "cases": lambda: [
            {"name": "2 red, 1 black", "sample": True, "args": (2, 1)},
            {"name": "full deck 26/26", "args": (26, 26)},
            {"name": "unbalanced 10/20", "args": (10, 20)},
        ],
    },
    {
        "id": "t4_red_black_sim",
        "title": "Part 2 · Red–black game: simulate the optimal policy",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "simulate_red_black",
        "description": r"""
Check the DP by simulation. Compute `V = red_black_values(r, b)`, then play `n_sims` games:

```
rng = np.random.default_rng(seed)
deck = np.array([1] * r + [-1] * b)
for each game:
    cards = rng.permutation(deck)
    i, j, total = r, b, 0
    for c in cards:
        if V[i, j] <= 0: stop
        total += c, and decrement i (red) or j (black)
```

Return a dict with `mean` (average payoff) and `se` (sample std with ddof=1 / √n_sims).

### Learn
If the DP is right, the simulated mean lands within about 2 standard errors of `V[r, b]`. This "theory then simulation" loop is how you should verify every model you build.

Import your table: `from t4_red_black import red_black_values`.
""",
        "starter": '''import numpy as np


def simulate_red_black(r: int, b: int, n_sims: int, seed: int = 0) -> dict:
    # your code here
    pass
''',
        "solution": "import numpy as np\n\n\n" + _RB + '''

def simulate_red_black(r: int, b: int, n_sims: int, seed: int = 0) -> dict:
    V = red_black_values(r, b)
    rng = np.random.default_rng(seed)
    deck = np.array([1] * r + [-1] * b)
    payoffs = np.empty(n_sims)
    for k in range(n_sims):
        i, j, total = r, b, 0
        for c in rng.permutation(deck):
            if V[i, j] <= 0:
                break
            total += c
            if c == 1:
                i -= 1
            else:
                j -= 1
        payoffs[k] = total
    return {"mean": payoffs.mean(), "se": payoffs.std(ddof=1) / np.sqrt(n_sims)}
''',
        "hints": ["Call `rng.permutation(deck)` exactly once per game, in order, to match the reference's random stream."],
        "timeout": 300,
        "cases": lambda: [
            {"name": "5 red, 5 black", "sample": True, "args": (5, 5, 20_000, 1)},
            {"name": "full deck", "args": (26, 26, 10_000, 2)},
        ],
    },
    {
        "id": "t4_cost_game",
        "title": "Part 3 · Dice game with a cost per roll",
        "difficulty": "Medium",
        "libs": ["numpy"],
        "fn": "cost_game",
        "description": r"""
You may roll a fair `sides`-sided die up to `n_rolls` times; each roll costs `cost` (paid before rolling, including the first). After each roll you stop and take the face, or pay for another roll (the last roll must be kept). Return a dict:

- `value`: expected net payoff under optimal play, $W_n$ with $W_1 = E[X] - c$ and $W_k = E[\max(X, W_{k-1})] - c$
- `thresholds`: for rolls 1 … n − 1, the smallest face at which you stop (smallest face ≥ the value of continuing with the remaining rolls)

### Learn
$W_k$ already includes the cost of the next roll, which makes the comparison clean: after rolling X with k rolls left, stop if X ≥ $W_k$.

Compare cost 0 (the classic game) with cost 0.5: thresholds drop and you stop sooner. Once the cost exceeds what an extra roll can add, you never re-roll at all.
""",
        "starter": '''import numpy as np


def cost_game(n_rolls: int, cost: float, sides: int = 6) -> dict:
    # return {"value": ..., "thresholds": [...]}
    pass
''',
        "solution": "import numpy as np\n\n\n" + _COST,
        "hints": ["With cost 0 you should reproduce the backward-induction results from the Markov step."],
        "cases": lambda: [
            {"name": "3 rolls, cost 0.5", "sample": True, "args": (3, 0.5)},
            {"name": "no cost", "args": (3, 0.0)},
            {"name": "expensive rolls", "args": (5, 2.0)},
            {"name": "10 rolls of a d20, cost 1", "args": (10, 1.0, 20)},
        ],
    },
    {
        "id": "t4_cost_distribution",
        "title": "Part 4 · Distribution of the game's net payoff",
        "difficulty": "Hard",
        "libs": ["numpy", "pandas"],
        "fn": "cost_game_distribution",
        "description": r"""
Under the optimal policy from `cost_game(n_rolls, cost, sides)`, compute the **exact** probability distribution of the net payoff = final face − cost × (number of rolls made). Return a Series indexed by payoff value (rounded to 10 decimals, sorted ascending) with probabilities that sum to 1.

### Learn
Walk forward through the rolls carrying the probability of still playing. At roll i (1-based), each face has probability 1/sides; if i is the last roll or the face meets that roll's threshold, the game ends with payoff face − cost·i; otherwise the probability carries over to roll i + 1. Accumulate probabilities per payoff value in a dict.

Now you can answer what matters for sizing: the standard deviation of the payoff, the probability of losing money, and the worst case. A market maker quoting this game would set the width partly from its standard deviation.
""",
        "starter": '''import numpy as np
import pandas as pd


def cost_game_distribution(n_rolls: int, cost: float, sides: int = 6) -> pd.Series:
    # your code here
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _COST + "\n\n" + _DIST,
        "hints": ["Keep a running `alive` probability: the chance you're still playing at roll i.",
                  "The expected value of your distribution should equal `cost_game(...)['value']`."],
        "cases": lambda: [
            {"name": "3 rolls, cost 0.5", "sample": True, "args": (3, 0.5)},
            {"name": "6 rolls, no cost", "args": (6, 0.0)},
            {"name": "d20, cost 1.5", "args": (5, 1.5, 20)},
        ],
    },
    {
        "id": "t4_game_desk",
        "title": "Part 5 · Make markets in both games",
        "difficulty": "Medium",
        "libs": ["numpy", "pandas"],
        "fn": "game_desk",
        "description": r"""
Put the project together the way a trader would present it: for each game, its value, its risk, and a two-sided market.

1. **Red–black payoff distribution** (new): under the optimal policy from Part 1, carry probability forward through the states. Start with probability 1 at `(r, b)` and process states in order of cards remaining, from `r + b` down to 0. At state (i, j) with probability p: if `V[i, j] <= 0` you stop, with payoff `(r - i) - (b - j)` (reds drawn minus blacks drawn); otherwise pass `p * i/(i+j)` to (i−1, j) and `p * j/(i+j)` to (i, j−1)
2. **Dice game**: the distribution from Part 4 (`cost_game_distribution(n_rolls, cost, sides)`)
3. for each game: `fair` = the DP value (Part 1's `V[r, b]`, Part 3's `value`), `std` = standard deviation of the payoff distribution, `p_loss` = probability of a negative payoff, `bid` = fair − k × std, `ask` = fair + k × std

Return a DataFrame indexed by `["red_black", "dice"]` with columns `fair`, `std`, `p_loss`, `bid`, `ask`.

### Learn
The mean of each distribution must equal its DP value, a free consistency check worth asserting. For the full deck the game is worth about 2.62, but its payoff spread is comparable to that value, which is why a sensible market is wide. The quoting rule here (a width proportional to the payoff's standard deviation) is the simplest defensible one; in an interview you'd also widen for uncertainty in your own estimate and tighten as you become confident.

Import your earlier parts: `from t4_red_black import red_black_values`, `from t4_cost_game import cost_game`, `from t4_cost_distribution import cost_game_distribution`.
""",
        "starter": '''import numpy as np
import pandas as pd


def game_desk(r: int, b: int, n_rolls: int, cost: float, sides: int = 6, k: float = 0.25) -> pd.DataFrame:
    # return a DataFrame indexed by ["red_black", "dice"] with columns fair, std, p_loss, bid, ask
    pass
''',
        "solution": "import numpy as np\nimport pandas as pd\n\n\n" + _RB + "\n\n" + _COST + "\n\n" + _DIST + '''

def red_black_distribution(r: int, b: int) -> pd.Series:
    V = red_black_values(r, b)
    prob, dist = {(r, b): 1.0}, {}
    for n in range(r + b, -1, -1):
        for i in range(max(0, n - b), min(r, n) + 1):
            j = n - i
            p = prob.get((i, j), 0.0)
            if p == 0.0:
                continue
            if V[i, j] <= 0:
                payoff = (r - i) - (b - j)
                dist[payoff] = dist.get(payoff, 0.0) + p
            else:
                if i:
                    prob[(i - 1, j)] = prob.get((i - 1, j), 0.0) + p * i / n
                if j:
                    prob[(i, j - 1)] = prob.get((i, j - 1), 0.0) + p * j / n
    return pd.Series(dist).sort_index()


def game_desk(r: int, b: int, n_rolls: int, cost: float, sides: int = 6, k: float = 0.25) -> pd.DataFrame:
    games = {"red_black": (red_black_values(r, b)[r, b], red_black_distribution(r, b)),
             "dice": (cost_game(n_rolls, cost, sides)["value"], cost_game_distribution(n_rolls, cost, sides))}
    rows = {}
    for name, (fair, dist) in games.items():
        x, p = dist.index.to_numpy(dtype=float), dist.to_numpy()
        std = np.sqrt(np.sum(p * (x - np.sum(p * x)) ** 2))
        rows[name] = {"fair": fair, "std": std, "p_loss": p[x < 0].sum(), "bid": fair - k * std, "ask": fair + k * std}
    return pd.DataFrame.from_dict(rows, orient="index")
''',
        "hints": ["Index states by (i, j) in a dict of probabilities; process n = i + j from high to low so every state's probability is complete before you use it.",
                  "Check that the mean of each distribution equals its fair value."],
        "cases": lambda: [
            {"name": "full deck, 3 rolls at cost 0.5", "sample": True, "args": (26, 26, 3, 0.5)},
            {"name": "small deck, d20 game, wider quotes", "args": (5, 4, 6, 1.0, 20, 0.5)},
        ],
    },
]
