import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { splitHints } from "@/lib/problems";

export const dynamic = "force-dynamic";

/** Returns the problem's hints (split into individual, ordered hints). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!problemsEnabled) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from("problems").select("hints").eq("id", numId).maybeSingle();
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ hints: splitHints(data.hints as string | null) });
}
