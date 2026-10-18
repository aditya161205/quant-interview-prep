import { isRed, rankLabel, SUIT_SYMBOLS, suitOf, type Card } from "@/lib/poker/cards";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-14 w-10 text-sm",
  md: "h-[4.5rem] w-[3.25rem] text-base",
  lg: "h-24 w-[4.25rem] text-xl",
} as const;

/** A playing card: white face with rank and suit, or a dark QP back. `glow` marks a card in the winning hand. */
export function PokerCard({
  card,
  hidden = false,
  size = "md",
  dim = false,
  glow = false,
  className,
}: {
  card?: Card;
  hidden?: boolean;
  size?: keyof typeof SIZES;
  dim?: boolean;
  glow?: boolean;
  className?: string;
}) {
  if (card === undefined || hidden) {
    return (
      <span
        aria-label="Face-down card"
        className={cn(
          "inline-grid shrink-0 place-items-center rounded-[6px] border-[3px] border-white bg-[#0f131a] shadow-(--shadow-raised)",
          SIZES[size],
          dim && "opacity-40",
          className,
        )}
      >
        <span className="font-xx text-[0.6em] font-black text-gold">QP</span>
      </span>
    );
  }
  const red = isRed(card);
  return (
    <span
      aria-label={`${rankLabel(card)} of ${["spades", "hearts", "diamonds", "clubs"][suitOf(card)]}`}
      className={cn(
        "animate-deal relative inline-flex shrink-0 flex-col justify-between rounded-[6px] bg-white p-1 leading-none shadow-(--shadow-raised)",
        SIZES[size],
        dim && "opacity-40",
        glow && "ring-4 ring-gold",
        className,
      )}
      style={{ color: red ? "#d4163c" : "#14161c" }}
    >
      <span className="font-xx font-black">{rankLabel(card)}</span>
      <span className="self-center text-[1.6em] leading-none">{SUIT_SYMBOLS[suitOf(card)]}</span>
      <span className="self-end rotate-180 font-xx text-[0.7em] font-black">{rankLabel(card)}</span>
    </span>
  );
}

/** An empty board slot. */
export function CardSlot({ size = "lg", className }: { size?: keyof typeof SIZES; className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rounded-[6px] border-2 border-dashed border-white/30", SIZES[size], className)} />;
}
