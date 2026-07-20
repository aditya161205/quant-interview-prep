import { Step } from "@/components/how-to-play";
import { Badge } from "@/components/ui/badge";

const cardValues = [
  { label: "2 – 10", v: "face value" },
  { label: "J", v: "11" },
  { label: "Q", v: "12" },
  { label: "K", v: "13" },
  { label: "A", v: "14" },
];

function ValueChips({ values }: { values: { label: string; v: string }[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground">Card values</div>
      <div className="flex flex-wrap gap-2">
        {values.map((x) => (
          <Badge key={x.label} tone="outline">
            <span className="font-mono font-semibold text-foreground">{x.label}</span>
            <span className="mx-1.5 text-border">·</span>
            {x.v}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Card Trading ------------------------------ */
export function CardGameRules() {
  return (
    <>
      <Step n={1} title="The instrument">
        Each round you see a small hand of cards — some face-up, some face-down. The tradable value is the{" "}
        <strong className="text-foreground">sum of all card values</strong>.
      </Step>
      <ValueChips values={cardValues} />
      <Step n={2} title="The market maker rotates">
        One player is the <span className="text-accent">market maker</span> each round, rotating around the table.
        They post a two-sided quote <span className="font-mono text-foreground">bid @ ask</span> — the price they
        buy at (bid) and sell at (ask), with the spread between 1 and 6.
      </Step>
      <Step n={3} title="When you're the maker">
        Quote around your estimate of fair value. If the true sum lands inside your market you{" "}
        <span className="text-positive">capture the spread</span> (tighter correct markets earn more); outside it,
        informed flow <span className="text-negative">picks you off</span>.
      </Step>
      <Step n={4} title="When a bot is the maker">
        You&apos;re the trader. Pick a size, then <span className="text-positive">Buy</span> at their ask if it&apos;s
        cheap, <span className="text-negative">Sell</span> at their bid if it&apos;s rich, or{" "}
        <span className="text-foreground">Skip</span>.
      </Step>
      <Step n={5} title="Settlement">
        Cards flip up for a few seconds, then hide — compute the settlement and your PnL from memory. A wrong PnL
        costs a penalty; time-outs skip the round at 0.
      </Step>
    </>
  );
}

/* ------------------------------ ETF Arbitrage ----------------------------- */
export function EtfArbitrageRules() {
  return (
    <>
      <Step n={1} title="The objective">
        Spot mispricings between an ETF and its underlying stock basket, then trade against 3 AI traders to grow your
        PnL.
      </Step>
      <Step n={2} title="Compute the NAV">
        The fair value (NAV) is the <span className="font-mono text-foreground">sum of weight × price</span> across
        the basket — the <span className="font-mono text-foreground">W × P</span> column does the multiplication for
        you; just add it up.
      </Step>
      <Step n={3} title="Find the edge">
        Compare NAV to the ETF&apos;s quoted bid/ask: <span className="text-positive">Buy</span> if NAV &gt; ask
        (ETF is cheap), <span className="text-negative">Sell</span> if NAV &lt; bid (rich), or{" "}
        <span className="text-foreground">Skip</span> if the gap is too small. Choose how many units to size your
        conviction.
      </Step>
      <Step n={4} title="Costs &amp; speed">
        Every trade pays a $10 transaction cost, so skip thin edges. Being the first correct trader earns a bonus —
        speed matters.
      </Step>
      <Step n={5} title="Each round">
        Prices shift slightly each round (the Change column shows what moved); recompute the NAV and trade again.
      </Step>
    </>
  );
}

/* --------------------------- Probability Betting -------------------------- */
export function BettingRules() {
  return (
    <>
      <Step n={1} title="The board">
        Each round the house quotes fractional odds (shown as <span className="font-mono text-foreground">b : 1</span>)
        on dice, card and coin events — but the odds are skewed off the true probability.
      </Step>
      <Step n={2} title="Find the mispriced bets">
        Work out the true probability of each event. A bet is in your favour when the house&apos;s implied probability
        (<span className="font-mono text-foreground">1 / (b + 1)</span>) is lower than the true one.
      </Step>
      <Step n={3} title="Size with Kelly">
        Stake from your bankroll on the bets where you have edge. The optimal fraction is{" "}
        <span className="font-mono text-foreground">f* = (b·p − q) / b</span>; if f* ≤ 0, skip it.
      </Step>
      <Step n={4} title="Special bets">
        <span className="text-foreground">Put</span> wins if your other bets net a loss; <span className="text-foreground">Call</span>{" "}
        wins if they net a profit — insurance and leverage on the round.
      </Step>
      <Step n={5} title="Resolve">
        The dice are rolled, cards drawn and coins flipped. Winning bets pay <span className="font-mono text-foreground">stake × b</span>;
        losers cost their stake.
      </Step>
    </>
  );
}

/* ----------------------------- Tournament Market -------------------------- */
export function TournamentRules() {
  return (
    <>
      <Step n={1} title="The matrix">
        Four teams — A, B, C, D. The 4×4 grid gives{" "}
        <span className="font-mono text-foreground">P(row team beats column team)</span>; the diagonal
        is dashed out. It stays on screen the whole game.
      </Step>
      <Step n={2} title="The format">
        A group stage round-robin (everyone plays everyone once) ranks the teams by wins. Any tie is
        broken by <strong className="text-foreground">replaying a round-robin among only the tied teams</strong>,
        repeating until every tie is resolved. The top two are the finalists and play once for the title.
      </Step>
      <Step n={3} title="Price the market">
        Each round you&apos;re quoted a two-sided market on an outcome (e.g. &ldquo;A reaches the final&rdquo;,
        &ldquo;C is champion&rdquo;, &ldquo;at least one team loses all its group games&rdquo;). Within the timer,{" "}
        <span className="text-positive">Buy</span> if you think fair value is above the ask,{" "}
        <span className="text-negative">Sell</span> if it&apos;s below the bid, or <span className="text-foreground">Pass</span>.
      </Step>
      <Step n={4} title="Estimate the value">
        Then lock in your estimate of the true fair value (0–100). You score for a correct trade decision{" "}
        <em>and</em> for a close estimate — within a tolerance — and lose points for wrong calls.
      </Step>
      <Step n={5} title="Trade the news">
        In the final rounds a real group-stage result is revealed (e.g. &ldquo;D beat C&rdquo;). Say whether an
        outcome&apos;s fair value moves <span className="text-positive">up</span>,{" "}
        <span className="text-negative">down</span> or stays the same, then re-estimate it on the new information.
      </Step>
    </>
  );
}

/* -------------------------------- Arrow Game ------------------------------ */
export function ArrowGameRules() {
  return (
    <>
      <Step n={1} title="Watch the middle">
        Each round a 3×5 grid of symbols flashes. React only to the{" "}
        <strong className="text-foreground">middle cell</strong> (centre row, 3rd column) — ignore
        every arrow, dash and symbol around it.
      </Step>
      <Step n={2} title="Call the direction">
        If the middle arrow points left, press <span className="font-mono text-foreground">Q</span> or{" "}
        <span className="font-mono text-foreground">←</span>. If it points right, press{" "}
        <span className="font-mono text-foreground">P</span> or <span className="font-mono text-foreground">→</span>{" "}
        (or tap the on-screen buttons).
      </Step>
      <Step n={3} title="The no-go rule">
        <span className="text-negative">Exception:</span> when the middle arrow is boxed in by{" "}
        <span className="font-mono text-foreground">✕</span> symbols, it&apos;s a no-go — press{" "}
        <strong className="text-foreground">nothing</strong> and let the round pass.
      </Step>
      <Step n={4} title="Beat the clock">
        Rounds advance on a fixed timer with <span className="text-foreground">no feedback</span>. Respond as
        quickly and accurately as you can — only your first press each round counts.
      </Step>
      <Step n={5} title="Your result">
        You&apos;re scored on overall accuracy, average reaction speed, and how well you held back on the
        no-go rounds (<span className="text-foreground">inhibition</span>).
      </Step>
    </>
  );
}

/* ----------------------------- Market of Cards ---------------------------- */
export function MarketOfCardsRules() {
  return (
    <>
      <Step n={1} title="The setup">
        You and 3 AI traders each hold 2 hidden cards; 3 more sit face-down on the table — 11 cards in play. You
        trade on their <strong className="text-foreground">total value</strong>.
      </Step>
      <Step n={2} title="Card values">
        Number cards A–10 are worth face × 10 (Ace low = 10 … 10 = 100). Red face cards are positive, black ones
        negative, so they cancel out — the whole deck sums to <span className="font-mono text-foreground">2200</span>{" "}
        (mean ≈ 42.31 per card).
      </Step>
      <Step n={3} title="Quote a market">
        Post a two-sided <span className="font-mono text-foreground">bid @ ask</span> on the 11-card total. The AIs
        will pick off your market if it&apos;s clearly mispriced.
      </Step>
      <Step n={4} title="Trade their markets">
        Each AI then posts its own quote — <span className="text-positive">Buy</span>,{" "}
        <span className="text-negative">Sell</span>, or <span className="text-foreground">Pass</span> against it.
      </Step>
      <Step n={5} title="Reveal &amp; settle">
        One table card is revealed each round — recompute your EV (exact ={" "}
        <span className="font-mono text-foreground">(2200 − known) / (52 − known count)</span>). After the last
        round all hands are shown and PnL settles at the true sum.
      </Step>
    </>
  );
}
