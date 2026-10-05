// Grades every Paths task in Pyodide (the browser's Python) the way the site does:
// each reference solution must pass and each starter must fail.  npm run paths:check-web [ids...]
import { readFileSync } from "node:fs";
import { loadPyodide } from "pyodide";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
const grading = JSON.parse(readFileSync(new URL("../src/data/paths/grading.json", import.meta.url), "utf8"));
const answers = JSON.parse(readFileSync(new URL("../src/data/paths/answers.json", import.meta.url), "utf8"));
const content = JSON.parse(readFileSync(new URL("../src/data/paths/content.json", import.meta.url), "utf8"));
const only = new Set(process.argv.slice(2));

export const PACKAGES = { numpy: "numpy", pandas: "pandas", scipy: "scipy", sklearn: "scikit-learn", statsmodels: "statsmodels", lightgbm: "lightgbm", matplotlib: "matplotlib" };
// Solution code lives in string literals, so any mention of a package name loads it.
const needed = (src) => [...new Set([...src.matchAll(/\b(numpy|pandas|scipy|sklearn|statsmodels|lightgbm|matplotlib)\b/g)].map((m) => PACKAGES[m[1]]))];

const py = await loadPyodide({
  packageBaseUrl: PYODIDE,
  packageCacheDir: new URL("../node_modules/.cache/pyodide/", import.meta.url).pathname, // wheels download once
  stdout: () => {},
  stderr: () => {},
});
await py.loadPackage(["numpy", "pandas", "matplotlib"]);
py.FS.mkdirTree("/home/pyodide/content");
py.FS.mkdirTree("/home/pyodide/my_work");
for (const [path, src] of Object.entries(grading.files)) py.FS.writeFile(`/home/pyodide/${path}`, src);
for (const [mod, src] of Object.entries(grading.modules)) py.FS.writeFile(`/home/pyodide/content/${mod}.py`, src);
py.runPython(`import os, sys; os.chdir("/home/pyodide"); sys.path.insert(0, "/home/pyodide")`);
await py.loadPackage(needed(grading.files["data.py"]));

let bad = 0;
for (const [sid, step] of Object.entries(content.steps)) {
  const ids = step.problems.filter((id) => !only.size || only.has(id));
  if (!ids.length) continue;
  await py.loadPackage(needed(grading.modules[sid]));
  for (const id of ids) {
    const t0 = Date.now();
    py.globals.set("pid", id);
    py.globals.set("module", sid);
    py.globals.set("ref_code", answers.solutions[id]);
    py.globals.set("starter_code", content.problems[id].starter);
    const out = JSON.parse(py.runPython(`
import json, runner, content
content.load(module)
r = runner.grade(pid, ref_code, "submit")
s = runner.grade(pid, starter_code, "submit")
ok = not r.get("error") and r["passed"] == r["total"]
fails = bool(s.get("error")) or s["passed"] < s["total"]
msg = r.get("error") or next((c.get("message", "") for c in r["cases"] if not c["ok"]), "")
json.dumps({"ok": ok, "fails": fails, "passed": r.get("passed"), "total": r.get("total"), "msg": msg[-600:]})
`));
    const good = out.ok && out.fails;
    bad += !good;
    console.log(`${good ? "ok " : "BAD"} ${id.padEnd(26)} ${out.passed}/${out.total}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (!out.ok) console.log("    " + out.msg.replace(/\n/g, "\n    "));
    else if (!out.fails) console.log("    the starter code passes the tests");
  }
}
console.log(bad ? `\n${bad} task(s) need attention` : "\nall tasks verified in Pyodide");
process.exit(bad ? 1 : 0);
