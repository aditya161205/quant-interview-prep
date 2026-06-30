import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getAdminClient, problemsEnabled } from "@/lib/supabase/admin";
import { answerMatches } from "@/lib/problems";

export const dynamic = "force-dynamic";

/** Checks an answer server-side. The correct answer is NEVER returned. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!problemsEnabled) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let body: { answer?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const answer = typeof body.answer === "string" ? body.answer : "";

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("problems")
    .select("final_answer")
    .eq("id", numId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const correct = answerMatches(answer, data.final_answer as string | null);
  return NextResponse.json({ correct });
}
