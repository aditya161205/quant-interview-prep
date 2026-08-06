/**
 * Study Field — the theory side of the app. Each entry is a technique rather
 * than a topic dump: what it is, when it is the right tool, and the mechanical
 * steps. `category` links an entry back into the practice bank so a concept
 * can hand you the questions that exercise it.
 *
 * Math is written in $…$ / $$…$$ and rendered by MathText.
 */

export interface StudySection {
  label: string;
  body: string;
}

export interface StudyEntry {
  slug: string;
  title: string;
  summary: string;
  /** Matches a `topic` in the problem bank, so "practise this" can filter. */
  category: string;
  tags: string[];
  sections: StudySection[];
}

export const STUDY: StudyEntry[] = [
  {
    slug: "recursion-and-states",
    title: "Recursion and state equations",
    summary:
      "Express the unknown by conditioning on one step, so it reappears on both sides of an equation you can solve.",
    category: "Probability",
    tags: ["Recursion", "Markov states", "Stopping times", "Expectation"],
    sections: [
      {
        label: "Definition",
        body: "Recursion here means defining an unknown quantity — a probability, an expectation, a value — by conditioning on the next step and writing it in terms of the same quantity evaluated at future states.\n\nIf a process moves between states $s$, introduce $v(s)$ = probability of eventual success from $s$, or $E(s)$ = expected remaining steps from $s$, and write\n\n$$E(s) = 1 + \\sum_{s'} P(s \\to s')\\, E(s').$$\n\nThe unknown appears on both sides, because after one transition the problem has the same shape as before.",
      },
      {
        label: "When to reach for it",
        body: "Recursion is the right tool when the process is sequential, state-dependent, and decomposes naturally after one move. It beats brute-force enumeration whenever the number of paths grows but the number of *states* stays small.\n\nIt is the wrong tool when the answer follows from symmetry or from linearity of expectation — those give the result without any equation to solve.",
      },
      {
        label: "The mechanics",
        body: "1. Name the states. Keep the set as small as the memory of the process demands.\n2. Define one unknown per state.\n3. Condition on the first step to get one equation per unknown.\n4. Fix the boundary states, where the value is known outright.\n5. Solve the linear system.\n\nWorked: expected flips to see two consecutive heads. States are $E_0$ (no run) and $E_1$ (last flip a head):\n\n$$E_0 = 1 + \\tfrac12 E_1 + \\tfrac12 E_0, \\qquad E_1 = 1 + \\tfrac12 (0) + \\tfrac12 E_0$$\n\ngiving $E_0 = 6$.",
      },
    ],
  },
  {
    slug: "linearity-of-expectation",
    title: "Linearity of expectation",
    summary:
      "Expectations add whether or not the pieces are independent — which turns many counting nightmares into one line.",
    category: "Expected Value",
    tags: ["Expectation", "Indicators", "Symmetry"],
    sections: [
      {
        label: "Definition",
        body: "For any random variables $X_1,\\dots,X_n$ on the same space,\n\n$$E\\left[\\sum_i X_i\\right] = \\sum_i E[X_i].$$\n\nThe striking part is that **no independence is required**. Dependence changes the variance, never the mean of a sum.",
      },
      {
        label: "The indicator trick",
        body: "Most interview uses follow one pattern: write the quantity as a sum of indicator variables, then take expectations term by term.\n\nIf $X$ counts how many events among $A_1,\\dots,A_n$ occur, set $X = \\sum_i \\mathbf{1}[A_i]$, so\n\n$$E[X] = \\sum_i P(A_i).$$\n\nYou never need the joint distribution — only $n$ marginal probabilities.",
      },
      {
        label: "Worked example",
        body: "Ten people are paired uniformly at random into five pairs. Expected number of pairs that are a specified couple?\n\nFor a given person, the partner is equally likely to be any of the other $9$, so $P(\\text{Alice with Bob}) = 1/9$. No enumeration of matchings is needed — the symmetry gives the marginal directly, and linearity handles the sum.",
      },
    ],
  },
  {
    slug: "conditioning-and-bayes",
    title: "Conditioning and Bayes",
    summary:
      "Reweight beliefs when evidence lands, and spot when a question is secretly asking for a posterior.",
    category: "Probability",
    tags: ["Conditional", "Bayes", "Base rates"],
    sections: [
      {
        label: "Definition",
        body: "$$P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}, \\qquad P(A \\mid B) = \\frac{P(B \\mid A) P(A)}{P(B)}.$$\n\nThe denominator usually comes from the law of total probability: $P(B) = \\sum_i P(B \\mid A_i) P(A_i)$ over a partition $\\{A_i\\}$.",
      },
      {
        label: "The classic trap",
        body: "Confusing $P(B \\mid A)$ with $P(A \\mid B)$. A test that is 99% accurate on a condition affecting 1 in 10,000 people still produces mostly false positives, because the base rate dominates.\n\nWhen a question gives you an accuracy and asks for the chance you actually have the thing, it is asking for a posterior, and the base rate is the whole answer.",
      },
      {
        label: "Technique",
        body: "Work in natural frequencies rather than percentages. Imagine a concrete population — 10,000 people — and count bodies into each cell. The arithmetic becomes integers and the trap disappears, because the small true-positive count sits visibly next to the large false-positive one.",
      },
    ],
  },
  {
    slug: "counting-and-symmetry",
    title: "Counting and symmetry",
    summary:
      "Choose the right sample space, then let symmetry collapse the work before you compute anything.",
    category: "Combinatorics",
    tags: ["Counting", "Symmetry", "Complement"],
    sections: [
      {
        label: "The three moves",
        body: "**Symmetry.** If outcomes are exchangeable, a marginal probability often follows with no counting at all — any specific card is equally likely to be in any position.\n\n**Complement.** \"At least one\" is nearly always $1 - P(\\text{none})$.\n\n**Right sample space.** Ordered or unordered, labelled or unlabelled — pick one and stay in it. Most wrong answers come from counting the numerator in one space and the denominator in another.",
      },
      {
        label: "Standard counts",
        body: "Ordered selections without replacement: $n!/(n-k)!$. Unordered: $\\binom{n}{k} = \\frac{n!}{k!(n-k)!}$.\n\nPerfect matchings of $2n$ labelled people into pairs:\n\n$$(2n-1)!! = (2n-1)(2n-3)\\cdots 3 \\cdot 1.$$\n\nWorth memorising, because pairing questions recur constantly.",
      },
    ],
  },
  {
    slug: "making-a-market",
    title: "Making a market",
    summary:
      "Quote two-sided around fair value, and understand why the trades you get are the ones you least want.",
    category: "Brainteaser",
    tags: ["Market making", "Adverse selection", "Spread", "EV"],
    sections: [
      {
        label: "Fair value first",
        body: "Compute $E[V]$ for the instrument before thinking about the quote. For a sum of hidden cards, that is the revealed total plus (number hidden) × (mean of the remaining deck) — conditioned on what you have already seen, not the unconditional deck mean.",
      },
      {
        label: "Why the spread exists",
        body: "You are not quoting against noise; you are quoting against people who may know more. If your market is $b/a$ and true value is $V$:\n\n- $V > a$ — informed flow lifts your offer and you are short too cheap.\n- $V < b$ — informed flow hits your bid and you are long too dear.\n- $b \\le V \\le a$ — you bracketed it, and you earn the spread from uninformed flow.\n\nThe spread is the premium charged for that adverse selection. Quote too tight and it does not cover the times you are picked off; too wide and you trade nothing.",
      },
      {
        label: "Under questioning",
        body: "Interviewers will widen or tighten your market and ask you to defend it. Anchor on $E[V]$, state your uncertainty, and move your quote when information arrives — being wrong is fine, being *unresponsive to new information* is not.",
      },
    ],
  },
  {
    slug: "kelly-sizing",
    title: "Kelly sizing",
    summary:
      "Given an edge, size the bet to maximise long-run growth rather than expected value.",
    category: "Statistics",
    tags: ["Kelly", "Bankroll", "Log utility", "Variance"],
    sections: [
      {
        label: "The formula",
        body: "For a bet paying net odds $b$ with win probability $p$ (and $q = 1-p$), the growth-optimal fraction of bankroll is\n\n$$f^* = \\frac{bp - q}{b}.$$\n\nIf $f^* \\le 0$ there is no edge and the bet should be passed — the sign is the edge test.",
      },
      {
        label: "Why not maximise EV",
        body: "Maximising expected value alone tells you to bet everything on any positive edge, which busts you with probability approaching 1 over repeated play. Kelly maximises $E[\\log(\\text{bankroll})]$, so it maximises the long-run growth *rate* and never risks the whole stack.\n\nIn practice desks bet a fraction of Kelly — half-Kelly gives about three-quarters of the growth with materially less variance, and edges are usually estimated rather than known.",
      },
    ],
  },
];

export function studyBySlug(slug: string): StudyEntry | undefined {
  return STUDY.find((e) => e.slug === slug);
}
