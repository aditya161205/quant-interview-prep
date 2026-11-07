/** Pages where you're working on one thing, so the bar drops its links. */
export function isFocusPage(path: string): boolean {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "practice") return parts.length === 2;
  if (parts[0] === "paths") return parts.length === 3;
  if (parts[0] === "market-making") return parts.length === 2;
  return parts[0] === "poker";
}

/** The sections on the bar. Each owns every page beneath it. */
export const SECTIONS = [
  { href: "/practice", label: "Practice", owns: ["/practice"] },
  { href: "/paths", label: "Paths", owns: ["/paths"] },
  { href: "/desk", label: "Desk", owns: ["/desk"] },
  { href: "/market-making", label: "Games", owns: ["/market-making", "/poker"] },
];
