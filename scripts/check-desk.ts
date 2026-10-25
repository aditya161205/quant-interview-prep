/** Self-check for The Desk. Run: npm run desk:check */
import { grade, makeDay, type Role } from "../src/lib/desk";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    if (failures < 20) console.error("FAIL:", msg);
  }
};
let tasks = 0;
for (const role of ["trader", "researcher"] as Role[])
  for (let n = 1; n <= 15; n++)
    for (let seed = 1; seed <= 120; seed++) {
      const day = makeDay(role, n, seed * 7919 + n);
      check(day.tasks.length >= 6, `${role} day ${n}: tasks`);
      const again = makeDay(role, n, seed * 7919 + n);
      check(JSON.stringify(again.tasks.map((t) => t.q)) === JSON.stringify(day.tasks.map((t) => t.q)), `${role} day ${n}: deterministic`);
      for (const t of day.tasks) {
        tasks++;
        const id = `${role} d${n} s${seed} ${t.time} ${t.title}`;
        check(grade(t.q, t.q.answer) === 1, `${id}: answer grades 1`);
        if (t.q.kind === "number") check(Number.isFinite(t.q.answer) && t.q.tol > 0, `${id}: finite answer ${t.q.answer}`);
        if (t.q.kind === "choice") check(new Set(t.q.options).size === t.q.options.length && t.q.options.includes(t.q.answer), `${id}: unique options with answer`);
        if (t.q.kind === "multi") check(t.q.answer.every((a) => t.q.kind === "multi" && t.q.options.includes(a)), `${id}: multi answers among options`);
        const text = JSON.stringify([t.message, t.blocks, t.why, t.q]);
        check(!/NaN|undefined|Infinity/.test(text), `${id}: clean text ${text.match(/.{40}(NaN|undefined|Infinity).{20}/)?.[0]}`);
        const good = t.outcome(t.q.answer, 1);
        const bad = t.outcome(null, 0);
        check(Number.isFinite(good.delta) && Number.isFinite(bad.delta) && !!good.text && !!bad.text, `${id}: outcomes`);
        check(good.delta >= bad.delta, `${id}: right beats wrong (${good.delta} vs ${bad.delta})`);
      }
    }
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log(`${tasks} tasks across 2 careers × 15 days × 120 seeds · desk OK`);
