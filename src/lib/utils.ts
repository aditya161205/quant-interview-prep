/** Tiny classnames helper (avoids pulling in clsx/tailwind-merge for the MVP). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a number as a signed points string, e.g. +9 / -59 / 0 */
export function formatSigned(value: number, digits = 0): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}
