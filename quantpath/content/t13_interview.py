TITLE = "Trader interview playbook"
SUMMARY = "How graduate trader hiring works, how to perform in each round, classic brainteasers, behavioral questions, and a final checklist."
KIND = "interview"

LESSON = r"""
Everything before this step built the skills. This one is about showing them under interview conditions: fast, clear, calm, and honest about uncertainty.

## How graduate trader hiring usually works

Formats change from year to year and firm to firm, so check each firm's current process. The common shape:

1. **Online assessments**: timed mental arithmetic, number sequences, probability and logic puzzles, sometimes a trading or betting game. Practise timed arithmetic daily; accuracy beats speed when wrong answers cost points.
2. **Phone or video rounds**: probability and expected-value questions solved out loud, live mental math, "make me a market", basic markets knowledge, and motivation ("why trading?").
3. **Final round / superday**: trading games (making markets, card and dice games, betting with partial information), team exercises, more probability, behavioral interviews.

## How to perform in each kind of question

**Probability / EV questions**
- Restate the problem and your assumptions. Ask about anything ambiguous.
- Start with the simplest case (smaller numbers, two players, one roll), look for symmetry, a complement, or a recursion (conditioning on the first step).
- Say the answer as a fraction and a decimal, and sanity-check it ("it should be above ½ because…").

**Market-making games**
- Quote quickly with a sensible centre and width. Update immediately on trades and new information.
- Track your position and P&L out loud. Skew quotes to manage inventory.
- Size bets according to edge and uncertainty (Kelly intuition). Don't go all-in on a small edge.
- Mistakes happen: acknowledge, correct, move on. Interviewers watch how you handle losing.

**Mental math under pressure**
- Use the shortcuts from the mental math step. Round, then adjust. Say "approximately X, exactly Y" if you need a second.

## Behavioral questions

They test whether you'll thrive in a high-pressure, feedback-heavy, collaborative environment. Prepare short, specific stories (situation, decision, result, lesson) about:
- a decision made with incomplete information, and how you weighed the risk
- a loss or a mistake, and what you changed afterwards
- competition: games, sports, poker, chess, olympiads
- teamwork under time pressure
- why trading, and why this firm (be specific: their markets, products, culture)

## Market awareness

Follow markets every day for weeks before interviews: major indices, rates (2y and 10y yields), the dollar, oil, gold, VIX, and the week's big movers and why. Have one or two **trade ideas** with thesis, expression, risks and payoff (see "Trading strategies, backtesting and risk").

## Reading list (for reference, not cover to cover)

- Zhou, *A Practical Guide to Quantitative Finance Interviews* ("the Green Book")
- Crack, *Heard on the Street*
- Joshi, Denson & Downes, *Quant Job Interview Questions and Answers*
- Natenberg, *Option Volatility and Pricing*
- Harris, *Trading and Exchanges* (market microstructure)
- Hull, *Options, Futures, and Other Derivatives*

## Final checklist

1. Every step on this path at 100%, including all projects
2. Mental math: 60+ correct in a timed 80-in-8 practice test with no mistakes, several days in a row
3. Every question on this path answered correctly or marked "Got it"
4. Three behavioral stories rehearsed out loud
5. Two current trade ideas you can defend for five minutes
6. Five mock market-making sessions with a friend (one makes markets, the other trades)
"""

QUESTIONS = [
    {"type": "number", "prompt": "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost, in dollars?",
     "answer": 0.05, "explanation": "Ball = x, bat = x + 1, so 2x + 1 = 1.10 and x = 0.05. The quick answer of 0.10 is the trap; interviewers use questions like this to check you verify before answering."},
    {"type": "number", "prompt": "100 lockers start closed. Person k toggles every k-th locker, for k = 1 … 100. How many lockers are open at the end?",
     "answer": 10, "tol": 0, "explanation": "A locker is toggled once per divisor. Only perfect squares have an odd number of divisors: 1, 4, …, 100 make 10 lockers."},
    {"type": "number", "prompt": "25 horses, a track that races 5 at a time, no stopwatch. What is the minimum number of races needed to find the 3 fastest?",
     "answer": 7, "tol": 0, "explanation": "5 heats, then a race of the 5 winners (6 races). The fastest overall is known; only 5 horses can still be 2nd or 3rd (the winners' race 2nd and 3rd, the overall winner's heat 2nd and 3rd, and the 2nd-place winner's heat runner-up). One more race decides: 7."},
    {"type": "number", "prompt": "I pick a whole number from 1 to 100 uniformly at random. You guess, and I say higher or lower until you're right. With the best strategy, what's the expected number of guesses?",
     "answer": 5.8, "explanation": "Binary search: depths 1–6 hold 1 + 2 + 4 + 8 + 16 + 32 = 63 numbers and depth 7 the remaining 37. Total guesses = 1(1) + 2(2) + 3(4) + 4(8) + 5(16) + 6(32) + 7(37) = 580, so the mean is 5.8. If each guess costs $1 and a correct guess pays $10, the game is worth +$4.20."},
    {"type": "number", "prompt": "What is the expected number of fair-coin tosses needed to see 2 heads in total (not necessarily in a row)?",
     "answer": 4, "explanation": "Each head takes 2 tosses on average (geometric with p = ½), and linearity gives 2 + 2 = 4."},
    {"type": "number", "prompt": "You and a friend each pick a random point on a 1-km circular track. What is the expected distance between you along the shorter arc, in km?",
     "answer": 0.25, "explanation": "The shorter-arc distance is uniform on [0, ½], so its mean is ¼ km."},
    {"type": "open", "prompt": "Why do you want to be a trader?",
     "explanation": "Strong answers are specific and evidenced: you enjoy making quick decisions under uncertainty with immediate feedback (examples from games, competitions or projects), you like quantitative reasoning applied to real markets (projects, markets you follow), and you want to work in a team where performance is measurable. Tie it to the firm: its markets, its style (market making vs prop), its culture. Avoid 'money' as the headline and generic 'I like fast-paced environments' with no evidence."},
    {"type": "open", "prompt": "Tell me about a time you made a decision with incomplete information.",
     "explanation": "Pick a real story with stakes. Structure it as situation → what you knew and didn't → how you estimated the odds and the downside → the decision and how you sized or hedged it → the outcome → what you'd do differently. Show that you separated decision quality from outcome luck: a good decision can lose, a bad one can win."},
    {"type": "open", "prompt": "Make me a market on the temperature in London at noon tomorrow (°C). I then sell to you at your bid. What next?",
     "explanation": "Start from a quick estimate: season (October, say ~14°C), uncertainty ±3–4°C. Quote something like 12 at 16. When I sell at 12, I learn you think it'll be colder (maybe you checked a forecast), so I lower my market, e.g. 10 at 13, and I'm now long one unit, so I lean lower to avoid buying more. Explain each update briefly; the interviewer is grading reasoning, speed and risk management."},
    {"type": "open", "prompt": "Tell me about a mistake or a loss and what you learned from it.",
     "explanation": "Choose a genuine mistake with consequences, own it without excuses, and focus on the process change: what you now check, how you size, or how you communicate. Trading firms want people who lose well: who learn fast, don't tilt, and don't repeat errors."},
    {"type": "open", "prompt": "Would you rather own a stock at $100, or an at-the-money call on it? Discuss.",
     "explanation": "It depends on the price of volatility and your view. The call gives leverage and convexity (losses limited to the premium, the upside kept), but you pay time value: if implied vol is high relative to the moves you expect, the call is expensive and decays. The stock has linear exposure, pays dividends, and doesn't decay. If you expect a big move soon or want a defined maximum loss, the call; if you expect a slow grind up, the stock (or sell options against it)."},
]

PROBLEMS = []
