/* Runs and grades Python in the browser with Pyodide, using quantpath/runner.py — the same grader the
 * native and Pyodide checks use. Messages in: {id, files, module, pid, code, mode, imports} or {id, warm}.
 * Messages out: {id, status} while loading, then {id, result}. A module worker: some browsers refuse
 * importScripts from a CDN but allow module imports. */
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const PACKAGES = {
  numpy: "numpy",
  pandas: "pandas",
  scipy: "scipy",
  sklearn: "scikit-learn",
  statsmodels: "statsmodels",
  lightgbm: "lightgbm",
  matplotlib: "matplotlib",
};
// Solution code sits in string literals, so any mention of a package name loads it.
const needed = (src) =>
  [...new Set([...src.matchAll(/\b(numpy|pandas|scipy|sklearn|statsmodels|lightgbm|matplotlib)\b/g)].map((m) => PACKAGES[m[1]]))];

const loaded = new Set();
let ready = null;

async function boot(id) {
  self.postMessage({ id, status: "Starting Python" });
  const py = await loadPyodide();
  self.postMessage({ id, status: "Loading numpy, pandas and matplotlib" });
  await py.loadPackage(["numpy", "pandas", "matplotlib"]);
  ["numpy", "pandas", "matplotlib"].forEach((p) => loaded.add(p));
  py.FS.mkdirTree("/home/pyodide/content");
  py.FS.mkdirTree("/home/pyodide/my_work");
  py.runPython('import os, sys; os.chdir("/home/pyodide"); sys.path.insert(0, "/home/pyodide")');
  return py;
}

self.onmessage = async ({ data }) => {
  const { id } = data;
  try {
    ready ??= boot(id).catch((e) => {
      ready = null;
      throw e;
    });
    const py = await ready;
    if (data.warm) return self.postMessage({ id, result: { warm: true } });

    const { files, module, pid, code, mode, imports } = data;
    for (const [path, src] of Object.entries(files)) py.FS.writeFile(`/home/pyodide/${path}`, src);
    for (const [name, src] of Object.entries(imports)) py.FS.writeFile(`/home/pyodide/my_work/${name}.py`, src);

    const missing = needed(Object.values(files).join("\n") + "\n" + code).filter((p) => !loaded.has(p));
    if (missing.length) {
      self.postMessage({ id, status: `Loading ${missing.join(", ")}` });
      await py.loadPackage(missing);
      missing.forEach((p) => loaded.add(p));
    }

    self.postMessage({ id, status: mode === "submit" ? "Running all tests" : "Running" });
    py.globals.set("pid", pid);
    py.globals.set("module", module);
    py.globals.set("code", code);
    py.globals.set("mode", mode);
    py.globals.set("imports", py.toPy(Object.keys(imports)));
    const out = py.runPython(`
import importlib, json, sys
for name in imports:
    sys.modules.pop(name, None)  # re-import earlier tasks' latest saved code
importlib.invalidate_caches()
import runner, content
content.load(module)
json.dumps(runner.grade(pid, code, mode), default=str)
`);
    self.postMessage({ id, result: JSON.parse(out) });
  } catch (e) {
    self.postMessage({ id, result: { error: String((e && e.message) || e) } });
  }
};
