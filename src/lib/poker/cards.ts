/** Cards are numbers 0–51: rank = card >> 2 (0 = two … 12 = ace), suit = card & 3. */
export type Card = number;

export const RANK_CHARS = "23456789TJQKA";
export const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"] as const;

export const rankOf = (c: Card) => c >> 2;
export const suitOf = (c: Card) => c & 3;
export const isRed = (c: Card) => suitOf(c) === 1 || suitOf(c) === 2;

/** "A", "10", "7" … for display. */
export const rankLabel = (c: Card) => (rankOf(c) === 8 ? "10" : RANK_CHARS[rankOf(c)]);
export const cardLabel = (c: Card) => `${rankLabel(c)}${SUIT_SYMBOLS[suitOf(c)]}`;

export const RANK_NAMES = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
export const RANK_PLURALS = ["Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces"];

/** Uniform in [0, 1) from the platform CSPRNG, so deals can't be predicted from earlier ones. */
export function secureRandom(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

export function shuffledDeck(rand: () => number = secureRandom): Card[] {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
