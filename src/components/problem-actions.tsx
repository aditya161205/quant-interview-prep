"use client";

import { Bookmark, Check } from "lucide-react";
import { usePracticeStore, useMounted } from "@/store/practice-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProblemActions({ id }: { id: string }) {
  const mounted = useMounted();
  const solved = usePracticeStore((s) => mounted && !!s.solved[id]);
  const bookmarked = usePracticeStore((s) => mounted && !!s.bookmarked[id]);
  const toggleSolved = usePracticeStore((s) => s.toggleSolved);
  const toggleBookmark = usePracticeStore((s) => s.toggleBookmark);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={solved ? "primary" : "outline"}
        size="sm"
        onClick={() => toggleSolved(id)}
        className={cn(solved && "bg-emerald-500 text-white hover:opacity-90")}
      >
        <Check className="h-4 w-4" />
        {solved ? "Solved" : "Mark solved"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleBookmark(id)}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        className={cn("w-9 px-0", bookmarked && "border-accent/50 text-accent")}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-accent")} />
      </Button>
    </div>
  );
}
