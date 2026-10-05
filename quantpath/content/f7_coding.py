import numpy as np

TITLE = "Coding interview essentials"
SUMMARY = "The algorithm patterns that appear in quant coding rounds: heaps, deques, dynamic programming, two pointers, hashing."
KIND = "foundation"

LESSON = r"""
Most quant firms run at least one coding round: an online assessment (HackerRank-style), a live session, or both. Researcher and developer roles go deeper, but traders get tested too. The problems are usually LeetCode easy to medium, often with a market flavour: prices, order books, streams of trades.

## How to approach a problem live

1. **Clarify**: input sizes, edge cases (empty input, ties, negatives), and what exactly to return.
2. **Work an example by hand**, then state a brute-force solution and its complexity.
3. **Optimize** with a pattern (below), and say why it's correct.
4. **Code cleanly**: small helper functions, meaningful names, no premature cleverness.
5. **Test** on your example and an edge case before saying you're done.

## Patterns that cover most questions

| Pattern | Typical use | Example |
|---|---|---|
| Single pass with running state | best so far, running min/max | best time to buy and sell, max drawdown |
| Hash map / Counter | counts, lookups, dedup | two-sum, top-k volume |
| Heap (priority queue) | top-k, streaming order statistics, merging | running median, merge sorted feeds |
| Monotonic deque | sliding-window max/min | rolling high of the last k prices |
| Two pointers / sliding window | contiguous ranges | longest window with a constraint |
| Prefix sums | range sums in O(1) | VWAP between any two times |
| Binary search | sorted data, monotone predicates | first time cumulative volume ≥ X |
| Dynamic programming | optimal decisions over stages | coin change, k-transaction trading |

## Python tools

```python
from collections import Counter, defaultdict, deque
import heapq, bisect
heapq.heappush(h, x); heapq.heappop(h)      # min-heap; push -x for a max-heap
heapq.nlargest(k, items, key=...)           # top-k in O(n log k)
heapq.merge(*sorted_lists, key=...)         # lazily merge sorted inputs
bisect.bisect_left(sorted_list, x)          # insertion point in O(log n)
dq = deque(); dq.append(i); dq.popleft()    # O(1) at both ends
```

## Complexity cheat sheet

| Operation | Cost |
|---|---|
| list index / append | O(1) amortized |
| list insert / pop(0) | O(n), so use a deque |
| dict / set lookup | O(1) average |
| heap push / pop | O(log n) |
| sort | O(n log n) |
| binary search | O(log n) |

A rough budget: Python does about $10^7$ simple operations per second. With n = $10^6$, an O(n log n) solution is fine and O(n²) is not.

## Dynamic programming in one paragraph

Define the **state** (what you need to know at a stage), the **transition** (how a state's value depends on smaller ones) and the **base case**. Then fill a table in order. For "at most k trades", the state is (day, trades used, holding or not), and each day you either act or wait.
"""

QUESTIONS = [
    {"type": "choice", "prompt": "What is the time complexity of pushing an element onto a binary heap that holds n elements?",
     "choices": ["O(log n)", "O(1)", "O(n)", "O(n log n)"], "answer": 0, "explanation": "The new element sifts up at most the height of the tree, which is log₂ n."},
    {"type": "choice", "prompt": "What is the average-case cost of looking up a key in a Python dict?",
     "choices": ["O(1)", "O(log n)", "O(n)", "It depends on whether the keys are sorted"], "answer": 0,
     "explanation": "Dicts are hash tables: constant time on average (worst case O(n) with pathological collisions)."},
    {"type": "number", "prompt": "At most how many comparisons does binary search need to find an element in a sorted array of 1,000,000 elements?",
     "answer": 20, "tol": 0, "explanation": "Each comparison halves the range, and 2²⁰ ≈ 1.05 million, so 20 comparisons suffice."},
    {"type": "choice", "prompt": "You need the sum of prices over thousands of arbitrary [i, j) windows of a fixed array. What's the best approach?",
     "choices": ["Prefix sums: O(n) setup, then O(1) per query", "Sum each window directly", "Sort the array first", "Use a heap"],
     "answer": 0, "explanation": "With P[k] = sum of the first k prices, sum(i..j) = P[j] − P[i]. `np.cumsum` builds it."},
]


def _prices(n, seed):
    rng = np.random.default_rng(seed)
    return list(np.round(100 * np.exp(np.cumsum(rng.normal(0, 0.02, n))), 2))


def _trades(n, seed):
    rng = np.random.default_rng(seed)
    syms = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOG", "TSLA", "JPM"]
    return [(str(rng.choice(syms)), int(rng.integers(1, 50) * 100)) for _ in range(n)]


def _feeds(seed):
    rng = np.random.default_rng(seed)
    out = []
    for v, venue in enumerate(["NYSE", "NASDAQ", "BATS"]):
        ts = np.sort(rng.integers(0, 1000, 40 + 10 * v))
        out.append([(int(t), venue, float(np.round(100 + rng.normal(0, 0.5), 2))) for t in ts])
    return out


PROBLEMS = [
    {
        "id": "f7_max_profit",
        "title": "Best time to buy and sell (one trade)",
        "difficulty": "Easy",
        "libs": ["python"],
        "fn": "max_profit",
        "description": r"""
Given a list of daily prices, return the maximum profit from one buy followed later by one sell (0 if no profitable trade exists). Aim for O(n) time and O(1) memory.

### Learn
Brute force checks every pair, O(n²). The single-pass idea: walk forward keeping the **lowest price seen so far**; on each day the best sale is today's price minus that minimum. This "running state" pattern also computes maximum drawdown (keep the running peak instead of the trough).
""",
        "starter": '''def max_profit(prices: list) -> float:
    # your code here
    pass
''',
        "solution": '''def max_profit(prices: list) -> float:
    best, low = 0.0, float("inf")
    for p in prices:
        low = min(low, p)
        best = max(best, p - low)
    return best
''',
        "hints": ["Track the minimum price so far and the best profit so far."],
        "cases": lambda: [
            {"name": "classic example", "sample": True, "args": ([7, 1, 5, 3, 6, 4],)},
            {"name": "falling prices", "args": ([9, 7, 4, 3, 1],)},
            {"name": "single day", "args": ([5],)},
            {"name": "10,000 prices", "args": (_prices(10_000, 1),)},
        ],
    },
    {
        "id": "f7_max_profit_k",
        "title": "Best profit with at most k trades",
        "difficulty": "Hard",
        "libs": ["python"],
        "fn": "max_profit_k",
        "description": r"""
Return the maximum profit from at most `k` non-overlapping buy-then-sell trades (you must sell before buying again).

### Learn
Dynamic programming over (trades used, holding or not). Keep two arrays of length k + 1 and update them every day:

- `cash[j]`: best profit with j completed trades, holding nothing
- `hold[j]`: best profit holding a position bought during trade j + 1

Each day: `hold[j] = max(hold[j], cash[j] - p)` (buy or keep holding) and `cash[j + 1] = max(cash[j + 1], hold[j] + p)` (sell, completing a trade). The answer is `max(cash)`.

If k ≥ n/2 the constraint never binds, and the answer is the sum of every positive daily move. Think about why.
""",
        "starter": '''def max_profit_k(prices: list, k: int) -> float:
    # your code here
    pass
''',
        "solution": '''def max_profit_k(prices: list, k: int) -> float:
    if k == 0 or len(prices) < 2:
        return 0.0
    cash = [0.0] * (k + 1)
    hold = [float("-inf")] * (k + 1)
    for p in prices:
        for j in range(k - 1, -1, -1):
            cash[j + 1] = max(cash[j + 1], hold[j] + p)
            hold[j] = max(hold[j], cash[j] - p)
    return max(cash)
''',
        "hints": ["Loop over j downwards inside each day so a single day isn't used to both sell and re-buy within the same trade count.",
                  "Check k = 1 against your one-trade solution."],
        "cases": lambda: [
            {"name": "k = 2", "sample": True, "args": ([3, 3, 5, 0, 0, 3, 1, 4], 2)},
            {"name": "k = 1", "args": ([7, 1, 5, 3, 6, 4], 1)},
            {"name": "k large (unconstrained)", "args": ([1, 2, 3, 4, 5, 3, 6], 10)},
            {"name": "k = 0", "args": ([1, 5], 0)},
            {"name": "500 prices, k = 4", "args": (_prices(500, 2), 4)},
        ],
    },
    {
        "id": "f7_running_median",
        "title": "Running median of a stream",
        "difficulty": "Medium",
        "libs": ["heapq"],
        "fn": "running_median",
        "description": r"""
Prices arrive one at a time. After each arrival, report the median of everything seen so far (for an even count, the mean of the two middle values). Return the list of medians. Aim for O(log n) per element.

### Learn
Keep two heaps: a **max-heap of the lower half** (store negatives in Python's min-heap) and a **min-heap of the upper half**, with sizes differing by at most one. The median is the top of the bigger heap, or the average of both tops.

Sorting after every arrival would cost O(n log n) each time. The two-heap design is a classic interview question, and the same idea is used for streaming quantiles in risk systems.
""",
        "starter": '''import heapq


def running_median(stream: list) -> list:
    # your code here
    pass
''',
        "solution": '''import heapq


def running_median(stream: list) -> list:
    low, high, out = [], [], []          # low is a max-heap (negated values)
    for x in stream:
        if low and x > -low[0]:
            heapq.heappush(high, x)
        else:
            heapq.heappush(low, -x)
        if len(low) > len(high) + 1:
            heapq.heappush(high, -heapq.heappop(low))
        elif len(high) > len(low):
            heapq.heappush(low, -heapq.heappop(high))
        out.append(-low[0] if len(low) > len(high) else (-low[0] + high[0]) / 2)
    return out
''',
        "hints": ["Push to one heap, then rebalance so that len(low) is len(high) or len(high) + 1."],
        "cases": lambda: [
            {"name": "small stream", "sample": True, "args": ([5, 15, 1, 3, 8, 7],)},
            {"name": "sorted input", "args": (list(range(1, 11)),)},
            {"name": "duplicates", "args": ([2, 2, 2, 1, 3, 2],)},
            {"name": "5,000 prices", "args": (_prices(5000, 3),)},
        ],
    },
    {
        "id": "f7_sliding_max",
        "title": "Sliding-window maximum",
        "difficulty": "Medium",
        "libs": ["collections.deque"],
        "fn": "sliding_window_max",
        "description": r"""
Return the maximum of every window of `k` consecutive values in `x` (a list of length `n - k + 1`), in O(n) total time.

### Learn
Use a **monotonic deque** of indices whose values are decreasing from front to back:
- before adding index i, pop from the back every index whose value is ≤ x[i] (it can never be a future maximum)
- pop from the front if that index has left the window (index ≤ i − k)
- once i ≥ k − 1, the front of the deque is the window maximum

Every index enters and leaves the deque at most once, so the whole pass is O(n). This is how a "rolling 20-day high" breakout signal is computed efficiently in a streaming system.
""",
        "starter": '''from collections import deque


def sliding_window_max(x: list, k: int) -> list:
    # your code here
    pass
''',
        "solution": '''from collections import deque


def sliding_window_max(x: list, k: int) -> list:
    dq, out = deque(), []
    for i, v in enumerate(x):
        while dq and x[dq[-1]] <= v:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()
        if i >= k - 1:
            out.append(x[dq[0]])
    return out
''',
        "hints": ["Store indices, not values, so you can tell when the front has expired."],
        "cases": lambda: [
            {"name": "k = 3", "sample": True, "args": ([1, 3, -1, -3, 5, 3, 6, 7], 3)},
            {"name": "k = 1", "args": ([4, 2, 12, 3], 1)},
            {"name": "k = n", "args": ([4, 2, 12, 3], 4)},
            {"name": "100,000 prices, k = 250", "args": (_prices(100_000, 4), 250)},
        ],
    },
    {
        "id": "f7_max_drawdown",
        "title": "Maximum drawdown in one pass",
        "difficulty": "Easy",
        "libs": ["python"],
        "fn": "max_drawdown_period",
        "description": r"""
Return a tuple `(peak_index, trough_index, drawdown)` for the worst peak-to-trough decline in `prices`, where drawdown = price[trough] / price[peak] − 1 (a negative number). The peak is the highest price before the trough (its first occurrence); if several troughs tie, return the first. If prices never fall below a previous peak, return `(0, 0, 0.0)`.

### Learn
One pass with running state: keep the index of the running peak (update it only when a strictly higher price appears) and the worst drawdown seen so far. Same pattern as best-time-to-buy, mirrored. Drawdown periods matter to investors as much as drawdown depth: also report how long the recovery took.
""",
        "starter": '''def max_drawdown_period(prices: list) -> tuple:
    # return peak_index, trough_index, drawdown
    pass
''',
        "solution": '''def max_drawdown_period(prices: list) -> tuple:
    peak, best = 0, (0, 0, 0.0)
    for i, p in enumerate(prices):
        if p > prices[peak]:
            peak = i
        dd = p / prices[peak] - 1
        if dd < best[2]:
            best = (peak, i, dd)
    return best
''',
        "hints": ["Only replace the best result on a strictly worse drawdown, so ties keep the first trough."],
        "cases": lambda: [
            {"name": "small example", "sample": True, "args": ([100, 120, 90, 130, 80, 140],)},
            {"name": "only rising", "args": ([1, 2, 3, 4],)},
            {"name": "equal peaks", "args": ([10, 12, 9, 12, 6, 7],)},
            {"name": "5,000 prices", "args": (_prices(5000, 5),)},
        ],
    },
    {
        "id": "f7_coin_change",
        "title": "Count the ways to make an amount",
        "difficulty": "Medium",
        "libs": ["python"],
        "fn": "coin_change_ways",
        "description": r"""
Return the number of ways to make `amount` from unlimited coins of the given denominations, where order doesn't matter (1+2 and 2+1 are the same way).

### Learn
`ways[a]` = number of ways to make a. Process one denomination at a time and, for each, sweep amounts upward: `ways[a] += ways[a - coin]`. Looping coins on the outside is what makes order not matter; swapping the loops would count ordered sequences (compositions) instead.

DP problems in interviews are about articulating the state and the transition. Say them out loud before coding.
""",
        "starter": '''def coin_change_ways(amount: int, coins: list) -> int:
    # your code here
    pass
''',
        "solution": '''def coin_change_ways(amount: int, coins: list) -> int:
    ways = [1] + [0] * amount
    for coin in coins:
        for a in range(coin, amount + 1):
            ways[a] += ways[a - coin]
    return ways[amount]
''',
        "hints": ["`ways[0] = 1`: there's exactly one way to make zero (use no coins)."],
        "cases": lambda: [
            {"name": "amount 5 with 1, 2, 5", "sample": True, "args": (5, [1, 2, 5])},
            {"name": "impossible", "args": (3, [2])},
            {"name": "amount 0", "args": (0, [1, 2])},
            {"name": "US coins, $1", "args": (100, [1, 5, 10, 25, 50])},
        ],
    },
    {
        "id": "f7_top_k",
        "title": "Top-k symbols by traded volume",
        "difficulty": "Easy",
        "libs": ["collections", "heapq"],
        "fn": "top_k_symbols",
        "description": r"""
`trades` is a list of `(symbol, quantity)` tuples. Return the `k` symbols with the largest total quantity as a list of `(symbol, total)` tuples, sorted by total descending and then by symbol alphabetically for ties.

### Learn
Aggregate with `collections.Counter` (or a defaultdict), then select the top k with `heapq.nlargest` in O(n log k), or simply sort if n is small. For tie-breaking, use a sort key such as `(-total, symbol)`.

Interviewers often follow up with "now the trades arrive as an endless stream and you must answer at any moment", which pushes you toward maintaining counts and a heap incrementally.
""",
        "starter": '''from collections import Counter
import heapq


def top_k_symbols(trades: list, k: int) -> list:
    # your code here
    pass
''',
        "solution": '''from collections import Counter
import heapq


def top_k_symbols(trades: list, k: int) -> list:
    totals = Counter()
    for sym, qty in trades:
        totals[sym] += qty
    return sorted(totals.items(), key=lambda t: (-t[1], t[0]))[:k]
''',
        "hints": ["`sorted(items, key=lambda t: (-t[1], t[0]))` handles the tie-break."],
        "cases": lambda: [
            {"name": "small", "sample": True, "args": ([("AAPL", 100), ("MSFT", 300), ("AAPL", 250), ("NVDA", 300)], 2)},
            {"name": "k larger than the number of symbols", "args": ([("X", 5), ("Y", 5)], 5)},
            {"name": "2,000 trades", "args": (_trades(2000, 1), 3)},
        ],
    },
    {
        "id": "f7_merge_feeds",
        "title": "Merge timestamped market-data feeds",
        "difficulty": "Easy",
        "libs": ["heapq"],
        "fn": "merge_feeds",
        "description": r"""
`feeds` is a list of lists; each inner list holds `(timestamp, venue, price)` tuples already sorted by timestamp. Return one list of all ticks sorted by timestamp. When timestamps tie, keep ticks from earlier feeds first (and the original order within a feed).

### Learn
Concatenating and sorting is O(N log N). A k-way merge with a heap is O(N log k) and works on streams too: `heapq.merge(*feeds, key=lambda t: t[0])` does exactly this, lazily and stably (ties keep the order of the input iterables). This is the core of consolidating quotes from several exchanges into one book.
""",
        "starter": '''import heapq


def merge_feeds(feeds: list) -> list:
    # your code here
    pass
''',
        "solution": '''import heapq


def merge_feeds(feeds: list) -> list:
    return list(heapq.merge(*feeds, key=lambda tick: tick[0]))
''',
        "hints": ["`heapq.merge` takes any number of sorted iterables plus a `key`."],
        "cases": lambda: [
            {"name": "three small feeds", "sample": True, "args": ([[(1, "A", 10.0), (4, "A", 10.1)], [(2, "B", 10.05), (4, "B", 10.2)], [(3, "C", 9.99)]],)},
            {"name": "three venues", "args": (_feeds(1),)},
            {"name": "an empty feed", "args": ([[], [(1, "X", 1.0)], []],)},
        ],
    },
]
