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
    <div className="flex w-full items-center gap-2">
      <Button
        variant={solved ? "primary" : "outline"}
        size="sm"
        onClick={() => toggleSolved(id)}
        className={cn("flex-1", solved && "bg-positive text-white")}
      >
        <Check className="h-4 w-4" />
        {solved ? "Solved" : "Mark solved"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleBookmark(id)}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        className={cn("w-9 px-0", bookmarked && "border-jacket bg-jacket text-jacket-ink hover:bg-jacket hover:text-jacket-ink")}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
      </Button>
    </div>
  );
}
