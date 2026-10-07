import { NextResponse } from "next/server";
import {
  answer,
  getStore,
  grading,
  isFreeItem,
  isQuestion,
  isStep,
  isTask,
  result,
  revealSolution,
  selfmark,
  show,
  state,
  step,
  task,
} from "@/lib/paths-server";
import { hasPro } from "@/lib/billing";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string }> };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const notFound = () => json({ error: "not found" }, 404);
const paywall = () => json({ error: "subscription_required" }, 402);
const MAX_CODE = 200_000;

export async function GET(request: Request, { params }: Ctx) {
  const { action } = await params;
  const store = await getStore();
  if (!store) return json({ error: "unauthorized" }, 401);
  const pro = await hasPro();
  const q = new URL(request.url).searchParams;

  // The path overview and step list are free; opening a step past the first needs a subscription.
  if (action === "state") return json(state(await store.load(), pro));
  const item = action === "grading" ? q.get("module") : q.get("id");
  if (!pro && action !== "code" && !isFreeItem(item)) return paywall();
  if (action === "step") {
    const id = q.get("id");
    return isStep(id) ? json(step(id, await store.load())) : notFound();
  }
  if (action === "problem") {
    const id = q.get("id");
    return isTask(id) ? json(await task(id, await store.load(), store)) : notFound();
  }
  if (action === "grading") {
    const id = q.get("module");
    return isStep(id) ? json(grading(id)) : notFound();
  }
  if (action === "code") {
    // Saved solutions of earlier tasks, so a later one can `from r13_weights import target_weights`.
    const ids = (q.get("ids") ?? "").split(",").filter(isTask).filter((t) => pro || isFreeItem(t)).slice(0, 50);
    return json(await store.code(ids));
  }
  return notFound();
}

export async function POST(request: Request, { params }: Ctx) {
  const { action } = await params;
  const store = await getStore();
  if (!store) return json({ error: "unauthorized" }, 401);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad body" }, 400);
  }
  const id = body.id;
  if (!isFreeItem(id) && !(await hasPro())) return paywall();

  if (action === "save" && isTask(id)) {
    if (typeof body.code !== "string" || body.code.length > MAX_CODE) return json({ error: "bad code" }, 400);
    await store.saveCode(id, body.code);
    return json({ ok: true });
  }

  // Everything else edits the progress record: load it, change it, write it back.
  const p = await store.load();
  let out: unknown;
  if (action === "answer" && isQuestion(id)) out = answer(id, String(body.answer ?? ""), p);
  else if (action === "show" && isQuestion(id)) out = show(id, p);
  else if (action === "selfmark" && isQuestion(id) && (body.value === "gotit" || body.value === "review")) {
    selfmark(id, body.value, p);
    out = { ok: true };
  } else if (action === "read" && isStep(id)) {
    p.marks[`read:${id}`] = Boolean(body.value);
    out = { ok: true };
  } else if (action === "result" && isTask(id)) {
    const mode = body.mode === "submit" ? "submit" : "run";
    const passed = Number(body.passed), total = Number(body.total);
    if (!Number.isInteger(passed) || !Number.isInteger(total) || passed < 0 || passed > total) return json({ error: "bad counts" }, 400);
    out = { status: result(id, mode, passed, total, p) };
  } else if (action === "solution" && isTask(id)) {
    out = { solution: revealSolution(id, p) };
  } else {
    return notFound();
  }
  if (!(out && typeof out === "object" && "error" in out)) await store.save(p);
  return json(out);
}
