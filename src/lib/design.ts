import { cookies } from "next/headers";

/** Redesign candidates compared locally. The last three replace the page structure, not just the styling. */
export const DESIGNS = ["original", "pit", "board", "pad", "metro", "slate", "desk"] as const;
export type Design = (typeof DESIGNS)[number];
export const OWN_LAYOUT: ReadonlySet<string> = new Set(["metro", "slate", "desk"]);

/** The chosen candidate, from the switcher's cookie. Production always gets the original. */
export async function getDesign(): Promise<Design> {
  if (process.env.NODE_ENV === "production") return "original";
  const v = (await cookies()).get("qp-design")?.value;
  return (DESIGNS as readonly string[]).includes(v ?? "") ? (v as Design) : "original";
}
