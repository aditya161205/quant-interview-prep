import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Consistent page header used across every section and game window. */
export function PageHeader({
  kicker,
  title,
  description,
  backHref,
  backLabel = "Back",
}: {
  kicker?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-3">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
      )}
      <div className="space-y-2">
        {/* A quiet eyebrow rather than an accent pill: every page led with a
            accent badge, which spent the accent before the primary action. */}
        {kicker && (
          <span className="block text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            {kicker}
          </span>
        )}
        {/* Sentence case: uppercase is reserved for eyebrow-sized labels and
            the one display moment on the dashboard, so headings read as
            hierarchy instead of shouting alongside everything else. */}
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2rem]">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-muted">{description}</p>}
      </div>
    </div>
  );
}
