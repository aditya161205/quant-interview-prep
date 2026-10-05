"""Export the curriculum for the QuantPrep site:  npm run paths:build  (after editing anything in content/).

Writes three files to src/data/paths/:
- content.json  public: tracks, steps (lessons), question prompts, task descriptions and starters
- answers.json  server only: question answers and reference solutions (revealed when earned)
- grading.json  served to signed-in browsers at run time: runner.py, data.py and each step's module with its
                lesson and questions stripped, so Pyodide can grade code exactly as runner.py does natively
"""
import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "src" / "data" / "paths"
sys.path.insert(0, str(ROOT))

import content  # noqa: E402

# In the browser only one step module is loaded per run (see `load`), instead of the whole curriculum.
CONTENT_SHIM = '''import importlib

PROBLEMS = {}


def load(module):
    for p in importlib.import_module(f"content.{module}").PROBLEMS:
        PROBLEMS[p["id"]] = dict(p, step=module)
'''


def strip(source):
    """The module without its lesson text and question answers, which browsers must not receive."""
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            if node.targets[0].id == "LESSON":
                node.value = ast.Constant("")
            elif node.targets[0].id == "QUESTIONS":
                node.value = ast.List(elts=[], ctx=ast.Load())
    return ast.unparse(tree) + "\n"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    public = {
        "tracks": [{"id": t["id"], "title": t["title"], "tagline": t["tagline"], "steps": t["steps"]} for t in content.TRACKS],
        "steps": {}, "questions": {}, "problems": {},
    }
    answers = {"questions": {}, "solutions": {}}
    for sid, st in content.STEPS.items():
        public["steps"][sid] = {"id": sid, "title": st["title"], "summary": st["summary"], "kind": st["kind"],
                                "lesson": st["lesson"], "questions": [q["id"] for q in st["questions"]],
                                "problems": [p["id"] for p in st["problems"]]}
        for q in st["questions"]:
            public["questions"][q["id"]] = {"id": q["id"], "type": q["type"], "prompt": q["prompt"],
                                            "choices": q.get("choices"), "step": sid}
            answers["questions"][q["id"]] = {k: q[k] for k in ("type", "answer", "tol", "display", "explanation", "choices") if k in q}
        for p in st["problems"]:
            public["problems"][p["id"]] = {"id": p["id"], "step": sid, "title": p["title"], "difficulty": p["difficulty"],
                                           "libs": p.get("libs", []), "description": p["description"],
                                           "hints": p.get("hints", []), "starter": p["starter"], "fn": p["fn"],
                                           "timeout": p.get("timeout", 180)}
            answers["solutions"][p["id"]] = p["solution"]
    grading = {
        "files": {"runner.py": (ROOT / "runner.py").read_text(), "data.py": (ROOT / "data.py").read_text(),
                  "content/__init__.py": CONTENT_SHIM},
        "modules": {sid: strip((ROOT / "content" / f"{sid}.py").read_text()) for sid in content.STEPS},
    }
    for name, obj in (("content", public), ("answers", answers), ("grading", grading)):
        path = OUT / f"{name}.json"
        path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT.parent)}  ({path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
