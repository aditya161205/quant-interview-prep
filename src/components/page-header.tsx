import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
      <div className="space-y-3">
        {kicker && <Badge tone="accent">{kicker}</Badge>}
        <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-muted">{description}</p>}
      </div>
    </div>
  );
}
