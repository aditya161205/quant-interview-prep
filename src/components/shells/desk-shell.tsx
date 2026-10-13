"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { usePaths } from "@/components/paths/load";
import { GAMES, isActive, SECTIONS } from "@/components/shells/nav-data";
import { stepPct, trackPct, type PathsState } from "@/lib/paths";

/** A reading-room index: every section, path step and game is always one click away, with its progress. */
export function DeskShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = usePaths<PathsState>("state");
  const link = (href: string) => ({ href, "aria-current": pathname === href ? ("page" as const) : undefined });

  return (
    <div className="desk">
      <aside className="desk-index" aria-label="Index">
        <Link href="/" className="desk-brand">
          QuantPrep
        </Link>
        <nav className="desk-tree">
          {SECTIONS.map((s) => {
            const active = isActive(s.href, pathname);
            if (s.href === "/paths") {
              return (
                <details key={s.href} open={active || undefined} className="desk-group">
                  <summary className={active ? "is-active" : undefined}>{s.label}</summary>
                  {(data?.tracks ?? []).map((t) => (
                    <details key={t.id} open={pathname.startsWith(`/paths/${t.id}`) || undefined} className="desk-group desk-sub">
                      <summary>
                        <span>{t.title}</span>
                        <span className="desk-pct">{Math.round(100 * trackPct(t))}%</span>
                      </summary>
                      <Link {...link(`/paths/${t.id}`)} className="desk-leaf desk-leaf-all">
                        All steps
                      </Link>
                      <ol className="desk-steps">
                        {t.steps.map((st) => (
                          <li key={st.id}>
                            <Link {...link(`/paths/${t.id}/${st.id}`)} className="desk-leaf">
                              <span className="desk-meter" style={{ ["--p" as string]: stepPct(st) }} aria-hidden />
                              <span className="desk-leaf-label">{st.title}</span>
                              {st.locked && <Lock className="h-3 w-3 shrink-0" aria-label="Pro" />}
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </details>
              );
            }
            if (s.href === "/market-making") {
              return (
                <details key={s.href} open={active || undefined} className="desk-group">
                  <summary className={active ? "is-active" : undefined}>{s.label}</summary>
                  <Link {...link(s.href)} className="desk-leaf desk-leaf-all">
                    All games
                  </Link>
                  {GAMES.map((g) => (
                    <Link key={g.href} {...link(g.href)} className="desk-leaf">
                      <span className="desk-leaf-label">{g.title}</span>
                    </Link>
                  ))}
                </details>
              );
            }
            return (
              <Link key={s.href} href={s.href} aria-current={active ? "page" : undefined} className="desk-top">
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="desk-account">
          <AuthButton />
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="desk-main">
        {children}
      </main>
    </div>
  );
}
