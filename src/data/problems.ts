export type Difficulty = "Easy" | "Medium" | "Hard";
export type Topic = "Probability" | "Expected Value" | "Brainteaser" | "Combinatorics";

export interface Problem {
  id: string;
  title: string;
  topic: Topic;
  difficulty: Difficulty;
  question: string;
  answer: string;
  solution: string;
}

export const problems: Problem[] = [
  {
    id: "p1",
    title: "Expected value of a die roll",
    topic: "Expected Value",
    difficulty: "Easy",
    question:
      "You roll a fair six-sided die once and are paid its face value in dollars. What is the fair price of this game?",
    answer: "$3.50",
    solution:
      "Each face 1–6 is equally likely (probability 1/6). EV = (1+2+3+4+5+6)/6 = 21/6 = 3.5. So the fair price is $3.50 — you'd pay below it to have edge, sell above it.",
  },
  {
    id: "p2",
    title: "The two boys problem",
    topic: "Probability",
    difficulty: "Medium",
    question:
      "A family has two children. You are told at least one of them is a boy. What is the probability that both children are boys?",
    answer: "1/3",
    solution:
      "Equally likely ordered outcomes: BB, BG, GB, GG. Conditioning on 'at least one boy' removes GG, leaving {BB, BG, GB}. Only BB has two boys, so P = 1/3. (Contrast with 'the older child is a boy', which gives 1/2.)",
  },
  {
    id: "p3",
    title: "Coin flips to the first heads",
    topic: "Expected Value",
    difficulty: "Medium",
    question:
      "You flip a fair coin repeatedly until you get the first heads. What is the expected number of flips?",
    answer: "2",
    solution:
      "Let E be the expected flips. With probability 1/2 you get heads now (1 flip); with probability 1/2 you flip tails and start over: E = 1 + (1/2)E. Solving: E/2 = 1, so E = 2. (Geometric distribution with p = 1/2 has mean 1/p = 2.)",
  },
  {
    id: "p4",
    title: "The 100 passengers problem",
    topic: "Brainteaser",
    difficulty: "Hard",
    question:
      "100 people board a plane. The first passenger lost their boarding pass and sits in a random seat. Each subsequent passenger sits in their own seat if free, otherwise a random free seat. What is the probability the last passenger sits in their own assigned seat?",
    answer: "1/2",
    solution:
      "The last passenger ends up in either seat #1 or seat #100. By symmetry, whenever a 'displaced' passenger picks randomly, seat #1 and seat #100 are equally likely to be taken first, and the process terminates the moment one of them is chosen. So P(last passenger gets their own seat) = 1/2 — independent of the number of passengers (as long as it's ≥ 2).",
  },
  {
    id: "p5",
    title: "Probability of drawing two aces",
    topic: "Combinatorics",
    difficulty: "Medium",
    question:
      "From a standard 52-card deck you draw 2 cards without replacement. What is the probability both are aces?",
    answer: "1/221",
    solution:
      "P(first ace) = 4/52. Given that, P(second ace) = 3/51. Multiply: (4/52)(3/51) = 12/2652 = 1/221 ≈ 0.45%. Equivalently C(4,2)/C(52,2) = 6/1326 = 1/221.",
  },
  {
    id: "p6",
    title: "Expected sum of two dice",
    topic: "Expected Value",
    difficulty: "Easy",
    question:
      "You roll two fair six-sided dice and are paid the sum of the faces. What is the expected payout?",
    answer: "7",
    solution:
      "Each die has mean 3.5 = (1+2+3+4+5+6)/6. Expectation is linear, so E[sum] = 3.5 + 3.5 = 7 — this holds whether or not the dice are independent.",
  },
  {
    id: "p7",
    title: "The Monty Hall problem",
    topic: "Probability",
    difficulty: "Medium",
    question:
      "You pick one of three doors; one hides a car, two hide goats. The host, who knows the layout, opens a different door revealing a goat and offers you the chance to switch. Should you switch, and what is your win probability if you do?",
    answer: "Switch — 2/3",
    solution:
      "Your first pick is the car with probability 1/3, leaving 2/3 on the other two doors. The host always reveals a goat, concentrating that full 2/3 onto the remaining unopened door. Switching therefore wins 2/3 of the time; staying wins only 1/3.",
  },
  {
    id: "p8",
    title: "Measure 45 minutes with two ropes",
    topic: "Brainteaser",
    difficulty: "Medium",
    question:
      "Two ropes each take exactly 60 minutes to burn end-to-end, but they burn unevenly. With only the ropes and a lighter, how do you measure exactly 45 minutes?",
    answer: "45 minutes",
    solution:
      "Light rope A at both ends and rope B at one end at the same time. Rope A burns out in 30 minutes. At that moment light rope B's other end — its remaining 30-minute portion now burns from both ends and finishes in 15 minutes. Total: 30 + 15 = 45 minutes.",
  },
  {
    id: "p9",
    title: "Handshakes among ten people",
    topic: "Combinatorics",
    difficulty: "Easy",
    question:
      "At a party of 10 people, everyone shakes hands with everyone else exactly once. How many handshakes happen in total?",
    answer: "45",
    solution:
      "A handshake is an unordered pair of people: C(10,2) = (10 × 9) / 2 = 45.",
  },
  {
    id: "p10",
    title: "Expected rolls to see a six",
    topic: "Expected Value",
    difficulty: "Medium",
    question:
      "How many times do you expect to roll a fair six-sided die until you first see a 6?",
    answer: "6",
    solution:
      "The number of rolls is geometric with success probability p = 1/6, whose mean is 1/p = 6.",
  },
  {
    id: "p11",
    title: "1000 bottles, one poisoned",
    topic: "Brainteaser",
    difficulty: "Hard",
    question:
      "You have 1000 bottles of wine, exactly one poisoned. A tester who sips poison dies in ~24 hours. With a single 24-hour testing round, what is the minimum number of testers needed to guarantee finding the poisoned bottle?",
    answer: "10",
    solution:
      "Number the bottles 0–999 in 10-bit binary and assign one tester per bit; each tester sips from every bottle whose bit is 1. After 24 hours, the set of testers who die spells the poisoned bottle's index in binary. Since 2¹⁰ = 1024 ≥ 1000, 10 testers suffice.",
  },
  {
    id: "p12",
    title: "Rolls to see every face",
    topic: "Expected Value",
    difficulty: "Hard",
    question:
      "You roll a fair six-sided die repeatedly. What is the expected number of rolls until every face has appeared at least once?",
    answer: "14.7",
    solution:
      "This is the coupon-collector problem. Expected rolls = 6 × (1/6 + 1/5 + 1/4 + 1/3 + 1/2 + 1/1) = 6 × H₆ ≈ 6 × 2.45 = 14.7.",
  },
];

export function getProblem(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}
