"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { isActive, SECTIONS } from "@/components/shells/nav-data";

/** Each section is a line; its bullet carries the line's colour and initial. */
export const LINE: Record<string, { color: string; code: string }> = {
  "/": { color: "#15171a", code: "Q" },
  "/practice": { color: "#11905a", code: "P" },
  "/paths": { color: "#d4202c", code: "T" },
  "/market-making": { color: "#ee8a00", code: "M" },
  "/profile": { color: "#6c7380", code: "U" },
  "/pricing": { color: "#6c7380", code: "₹" },
};

export function LineBullet({ color, code, size = "md" }: { color: string; code: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`metro-bullet metro-bullet-${size}`} style={{ background: color }} aria-hidden>
      {code}
    </span>
  );
}

export function MetroShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <header className="metro-bar">
        <div className="metro-bar-inner">
          <Link href="/" className="metro-brand">
            <span className="metro-brand-mark" aria-hidden />
            QuantPrep
          </Link>
          <nav aria-label="Main" className="metro-nav">
            {SECTIONS.map((s) => {
              const line = LINE[s.href];
              const active = isActive(s.href, pathname);
              return (
                <Link key={s.href} href={s.href} aria-current={active ? "page" : undefined} className="metro-nav-link">
                  <LineBullet color={line.color} code={line.code} size="sm" />
                  {s.label}
                </Link>
              );
            })}
          </nav>
          <div className="metro-tools">
            <AuthButton />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="metro-main">
        {children}
      </main>
    </>
  );
}
