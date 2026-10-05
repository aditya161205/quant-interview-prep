TITLE = "Mental math and estimation"
SUMMARY = "Arithmetic shortcuts, fractions, sequences and Fermi estimates for the timed tests that screen trader candidates."
KIND = "core"

LESSON = r"""
Many trading firms screen with timed arithmetic before anyone looks at your CV. Optiver's "80 in 8" (80 questions in 8 minutes), IMC and Flow Traders numerical tests and SIG's math test are well-known examples, and wrong answers often cost points. Accuracy first, then speed. The only way to get fast is **10–15 minutes of timed practice every day**; keep a log of your scores.

## Multiplication shortcuts

| Trick | Example |
|---|---|
| difference of squares: $(a+b)(a-b) = a^2 - b^2$ | $47 \times 53 = 50^2 - 3^2 = 2491$ |
| round and adjust | $49 \times 36 = 50 \times 36 - 36 = 1764$ |
| ×25 = ×100 ÷ 4, ×125 = ×1000 ÷ 8 | $25 \times 48 = 4800/4 = 1200$ |
| ×9, ×99, ×999 = ×10ⁿ minus the number | $999 \times 37 = 37000 - 37 = 36963$ |
| ×11: add neighbouring digits | $11 \times 72 = 7\,(7{+}2)\,2 = 792$ |
| squares near 50 or 100 | $68^2 = (70-2)^2 = 4900 - 280 + 4 = 4624$ |
| numbers ending in 5 | $65^2$: $6 \times 7 = 42$, append 25, giving $4225$ |
| halve and double | $16 \times 35 = 8 \times 70 = 560$ |

## Fractions and decimals: memorize these

| | | | |
|---|---|---|---|
| 1/2 = 0.5 | 1/3 = 0.333 | 1/4 = 0.25 | 1/5 = 0.2 |
| 1/6 = 0.1667 | 1/7 = 0.142857 | 1/8 = 0.125 | 1/9 = 0.111 |
| 1/11 = 0.0909 | 1/12 = 0.0833 | 1/16 = 0.0625 | 1/20 = 0.05 |

Then 3/8 = 3 × 0.125 = 0.375, 5/7 = 0.714, and 7/16 = 0.4375 are immediate. **Percentages are symmetric**: x% of y = y% of x, so 8% of 25 = 25% of 8 = 2.

## Number sequences

Check in this order: differences (and differences of differences), ratios, squares/cubes/primes/Fibonacci, alternating or interleaved sequences, and operations on digits. Example: 2, 6, 12, 20, 30 has differences 4, 6, 8, 10, so the next term is 42 (these are $n(n+1)$).

## Estimation and Fermi questions

"How many piano tuners are in Chicago?" tests structured thinking, not trivia:

1. Break the quantity into factors you can estimate (population → households → pianos → tunings per year → tuner capacity).
2. Use round numbers and state every assumption out loud.
3. Multiply, then sanity-check the order of magnitude against anything you know.
4. Give a range and say which assumption matters most.

Traders use the same skill to make markets on unknown quantities: a quick, defensible central estimate plus a sense of the uncertainty.

## Test strategy

- Accuracy over speed: a wrong answer can cost more than a skip.
- Skip ugly questions, come back if time allows.
- Write nothing down unless allowed. Practise the way you'll be tested.
- Train under the clock: in the trainer, aim for 60+ correct out of 80 in 8 minutes with no errors, then push higher.
"""

QUESTIONS = [
    {"type": "number", "prompt": "Compute 47 × 53 in your head.", "answer": 2491, "tol": 0,
     "explanation": "(50 − 3)(50 + 3) = 2500 − 9 = 2491."},
    {"type": "number", "prompt": "Write 1/7 as a decimal to 4 decimal places.", "answer": 0.1429, "tol": 0.001,
     "explanation": "1/7 = 0.142857…, which rounds to 0.1429. Multiples of 1/7 cycle through the same digits: 2/7 = 0.285714."},
    {"type": "number", "prompt": "What is 15% of 360?", "answer": 54, "tol": 0,
     "explanation": "10% is 36 and 5% is 18, so 54."},
    {"type": "number", "prompt": "What is 25 × 48?", "answer": 1200, "tol": 0, "explanation": "25 × 48 = 4800/4 = 1200."},
    {"type": "number", "prompt": "What is 999 × 37?", "answer": 36963, "tol": 0, "explanation": "37,000 − 37 = 36,963."},
    {"type": "number", "prompt": "What is 3/8 + 5/12? (fraction or decimal)", "answer": 19 / 24, "display": "19/24 ≈ 0.7917",
     "explanation": "Common denominator 24: 9/24 + 10/24 = 19/24."},
    {"type": "number", "prompt": "Next term: 2, 6, 12, 20, 30, ?", "answer": 42, "tol": 0,
     "explanation": "Differences 4, 6, 8, 10, 12, giving 42. Equivalently n(n + 1) for n = 6."},
    {"type": "number", "prompt": "Next term: 3, 5, 9, 17, 33, ?", "answer": 65, "tol": 0,
     "explanation": "Each term is 2 × previous − 1 (differences double: 2, 4, 8, 16, 32)."},
    {"type": "number", "prompt": "What is 0.125 × 72?", "answer": 9, "tol": 0, "explanation": "0.125 = 1/8, and 72/8 = 9."},
    {"type": "number", "prompt": "What is 68²?", "answer": 4624, "tol": 0, "explanation": "(70 − 2)² = 4900 − 280 + 4 = 4624."},
    {"type": "number", "prompt": "What is 7.5% of 640?", "answer": 48, "tol": 0, "explanation": "10% is 64, minus 2.5% (16), giving 48."},
    {"type": "number", "prompt": "What is 65²?", "answer": 4225, "tol": 0, "explanation": "6 × 7 = 42, append 25: 4225."},
    {"type": "open", "prompt": "Estimate how many tennis balls fit in a school bus. Talk through your assumptions.",
     "explanation": "Bus interior roughly 2.4 m wide × 2 m high × 10 m long ≈ 50 m³ (minus seats, call it 40 m³). A tennis ball is about 6.7 cm across, so its bounding cube is about 3×10⁻⁴ m³; random packing fills roughly 65% of space, so about 0.65 / (π/6 × 0.067³) ≈ 4,000 balls per m³. Total ≈ 40 × 4,000 ≈ 160,000, so 'a few hundred thousand'. The interviewer cares that the structure is clean and the big assumption (usable volume) is named."},
    {"type": "open", "prompt": "Estimate the annual revenue of all coffee shops in a city of 1 million people.",
     "explanation": "Suppose a third of people buy coffee out on a typical day, about 1 cup each at around $4 (and fewer at weekends): 1,000,000 × 1/3 × 1 × $4 × ~300 days ≈ $400 million a year. Sanity check: at roughly $500k–1M revenue per shop, that's 400–800 shops, about one per 1,500–2,500 people, which sounds plausible for a city."},
]

PROBLEMS = []
