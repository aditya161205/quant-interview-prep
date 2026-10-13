import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The page's jacket: a full-width band in the section's colour that opens every page.
 * `code` puts a trader badge beside the title; `aside` holds stats or actions on the right.
 */
export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  code,
  aside,
  children,
  compact,
}: {
  kicker?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  code?: string;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className="full-bleed mb-8 bg-jacket text-jacket-ink">
      <div className={cn("mx-auto max-w-[96rem] px-4 sm:px-6", compact ? "py-6" : "py-9 sm:py-11")}>
        {backHref && (
          <Link
            href={backHref}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold opacity-80 transition-opacity hover:opacity-100"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
        )}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            {code && <span className="font-xx grid h-16 min-w-[5.5rem] place-items-center rounded-[4px] bg-jacket-ink px-3 text-2xl font-black tracking-[0.04em] text-jacket">{code}</span>}
            <div className="min-w-0">
              <h1
                className={cn(
                  "font-xx font-black leading-[0.95] tracking-[-0.02em] text-balance",
                  compact ? "text-[2rem] sm:text-[2.4rem]" : "text-[2.4rem] sm:text-[3.4rem]",
                )}
              >
                {title}
              </h1>
              {description && <p className="mt-3 max-w-2xl text-[1.0625rem] leading-relaxed opacity-85">{description}</p>}
            </div>
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        {children}
      </div>
    </header>
  );
}
