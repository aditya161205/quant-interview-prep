import { Crown, Swords } from "lucide-react";
import type { Card as CardType, Rank, Suit } from "@/lib/market-game";
import { cn } from "@/lib/utils";

/* Fixed ink colors so the card always reads correctly on a WHITE face,
   regardless of light/dark app theme. */
const RED = "#d4163c";
const BLACK = "#17171d";

function inkFor(suit: Suit) {
  return suit === "♥" || suit === "♦" ? RED : BLACK;
}

/* Authentic pip layouts. Coordinates: x ∈ {0=left, .5=center, 1=right};
   y ∈ [0 (top) .. 1 (bottom)]. Pips below the midline render upside-down. */
const PIPS: Record<number, [number, number][]> = {
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 0.33], [1, 0.33], [0.5, 0.5], [0, 0.67], [1, 0.67], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 0.17], [0, 0.33], [1, 0.33], [0, 0.67], [1, 0.67], [0.5, 0.83], [0, 1], [1, 1]],
};

function Corner({ rank, suit, flip = false }: { rank: Rank; suit: Suit; flip?: boolean }) {
  return (
    <div
      className={cn(
        "absolute z-10 flex w-5 flex-col items-center leading-[0.95]",
        flip ? "bottom-1 right-1 rotate-180" : "top-1 left-1",
      )}
      style={{ color: inkFor(suit) }}
    >
      <span className="text-[16px] font-bold">{rank}</span>
      <span className="text-[10px]">{suit}</span>
    </div>
  );
}

function Pips({ value, suit }: { value: number; suit: Suit }) {
  const layout = PIPS[value] ?? [];
  return (
    <div className="absolute inset-x-[30%] inset-y-[19%]" style={{ color: inkFor(suit) }}>
      {layout.map(([x, y], i) => (
        <span
          key={i}
          className="absolute text-[22px] leading-none"
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${y > 0.5 ? 180 : 0}deg)`,
          }}
        >
          {suit}
        </span>
      ))}
    </div>
  );
}

function CourtFigure({ rank, suit }: { rank: Rank; suit: Suit }) {
  const ink = inkFor(suit);
  const Icon = rank === "J" ? Swords : Crown;
  return (
    <div
      className="flex h-[68%] w-[58%] flex-col items-center justify-center gap-1 rounded-md border-2"
      style={{
        borderColor: ink,
        background: "linear-gradient(160deg, rgba(212,22,60,0.07), rgba(23,23,29,0.06))",
        color: ink,
      }}
    >
      <Icon className="h-7 w-7" strokeWidth={1.75} />
      <span className="text-2xl font-bold">{rank}</span>
      <span className="text-base">{suit}</span>
    </div>
  );
}

function CardFront({ card }: { card: CardType }) {
  const isCourt = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const isAce = card.rank === "A";

  return (
    <div className="card-face overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-lg">
      <Corner rank={card.rank} suit={card.suit} />
      <Corner rank={card.rank} suit={card.suit} flip />

      <div className="grid h-full w-full place-items-center">
        {isAce ? (
          <span className="text-5xl" style={{ color: inkFor(card.suit) }}>
            {card.suit}
          </span>
        ) : isCourt ? (
          <CourtFigure rank={card.rank} suit={card.suit} />
        ) : (
          <Pips value={card.value} suit={card.suit} />
        )}
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="card-face card-face--back overflow-hidden rounded-xl border border-accent/40">
      <div className="grid h-full w-full place-items-center bg-surface-2 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.16)_8px,rgba(139,92,246,0.16)_16px)]">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-accent/50 bg-background/50 text-xl font-bold text-accent">
          Q
        </span>
      </div>
    </div>
  );
}

export function PlayingCard({
  card,
  delayMs = 0,
}: {
  card: CardType;
  delayMs?: number;
}) {
  return (
    // Outer wrapper carries the 2D deal-in animation; the inner .card3d owns
    // the 3D perspective. Keeping them separate stops the flip from warping.
    <div className="animate-deal shrink-0" style={{ animationDelay: `${delayMs}ms` }}>
      <div className="card3d h-[9.75rem] w-[7rem]">
        <div className={cn("card3d-inner", !card.faceUp && "is-down")}>
          <CardFront card={card} />
          <CardBack />
        </div>
      </div>
    </div>
  );
}
