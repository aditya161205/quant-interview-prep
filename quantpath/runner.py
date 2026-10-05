"""Runs one submission in a fresh process and reports the results as JSON.

app.py pipes {"id", "code", "mode"} to stdin; the report is printed after SENTINEL.
Verify every problem (reference passes, starter fails):  python runner.py --check [ids...]
"""
import base64
import contextlib
import copy
import io
import json
import os
import sys
import time
import traceback
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path[:0] = [str(ROOT), str(ROOT / "my_work")]
SENTINEL = "\x00__RESULT__\x00"
# LightGBM and PyTorch each bundle an OpenMP runtime; multithreaded, the two segfault in one process
# on macOS. Must be set before either library loads. (Single-threaded also keeps results reproducible.)
os.environ.setdefault("OMP_NUM_THREADS", "1")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import content

plt.show = lambda *a, **k: None  # figures are collected and sent to the browser instead


def _fmt(v):
    return f"{v:.6g}" if isinstance(v, (float, np.floating)) else repr(v)


def _values(g, e, rtol, atol, path, index=None):
    g, e = np.asarray(g), np.asarray(e)
    if g.shape != e.shape:
        return f"{path}: shape {g.shape}, expected {e.shape}"
    if e.dtype.kind in "biuf":
        try:
            ok = np.isclose(g.astype(float), e.astype(float), rtol=rtol, atol=atol, equal_nan=True)
        except (TypeError, ValueError):
            return f"{path}: expected numbers, got values like {g.flat[0]!r}"
    else:  # strings, datetimes, objects
        ok = np.asarray((g == e) | (pd.isna(g) & pd.isna(e)), dtype=bool)
    if ok.all():
        return None
    pos = np.unravel_index(np.flatnonzero(~ok)[0], e.shape)
    where = repr(index[pos[0]]) if index is not None and e.ndim == 1 else ", ".join(map(str, pos))
    return f"{path}[{where}]: got {_fmt(g[pos])}, expected {_fmt(e[pos])}  ({(~ok).sum()} of {ok.size} values differ)"


def _index(got, exp, path):
    if len(got) != len(exp):
        return f"{path}: length {len(got)}, expected {len(exp)}"
    if not got.index.equals(exp.index):
        i = next((i for i, (a, b) in enumerate(zip(got.index, exp.index)) if a != b), 0)
        return f"{path}: index differs at row {i}: got {got.index[i]!r}, expected {exp.index[i]!r}"
    return None


def same(got, exp, rtol=1e-6, atol=1e-8, path="output"):
    """None if `got` matches `exp`, otherwise the reason it doesn't."""
    if isinstance(exp, pd.DataFrame):
        if not isinstance(got, pd.DataFrame):
            return f"{path}: expected a pandas DataFrame, got {type(got).__name__}"
        if set(got.columns) != set(exp.columns):
            return f"{path}: columns {list(got.columns)}, expected {list(exp.columns)}"
        return _index(got, exp, path) or next(
            (m for c in exp.columns if (m := _values(got[c], exp[c], rtol, atol, f"{path}[{c!r}]", exp.index))), None)
    if isinstance(exp, pd.Series):
        if not isinstance(got, pd.Series):
            return f"{path}: expected a pandas Series, got {type(got).__name__}"
        return _index(got, exp, path) or _values(got.to_numpy(), exp.to_numpy(), rtol, atol, path, exp.index)
    if isinstance(exp, np.ndarray):
        if isinstance(got, (pd.Series, pd.DataFrame)):
            got = got.to_numpy()
        if not isinstance(got, (np.ndarray, list, tuple)):
            return f"{path}: expected an array, got {type(got).__name__}"
        return _values(got, exp, rtol, atol, path)
    if isinstance(exp, dict):
        if not isinstance(got, dict):
            return f"{path}: expected a dict, got {type(got).__name__}"
        missing = [k for k in exp if k not in got]
        if missing:
            return f"{path}: missing key(s) {missing}"
        return next((m for k in exp if (m := same(got[k], exp[k], rtol, atol, f"{path}[{k!r}]"))), None)
    if isinstance(exp, (list, tuple)):
        if not isinstance(got, (list, tuple, np.ndarray)):
            return f"{path}: expected a {type(exp).__name__}, got {type(got).__name__}"
        if len(got) != len(exp):
            return f"{path}: length {len(got)}, expected {len(exp)}"
        return next((m for i, (g, e) in enumerate(zip(got, exp)) if (m := same(g, e, rtol, atol, f"{path}[{i}]"))), None)
    if isinstance(exp, (bool, np.bool_)):
        if not isinstance(got, (bool, np.bool_)):
            return f"{path}: expected True/False, got {type(got).__name__}"
        return None if bool(got) == bool(exp) else f"{path}: got {got}, expected {exp}"
    if isinstance(exp, (int, float, np.integer, np.floating)):
        if isinstance(got, (bool, np.bool_, pd.Series, pd.DataFrame)) or np.ndim(got) != 0:
            return f"{path}: expected a single number, got {type(got).__name__}"
        try:
            g = float(got)
        except (TypeError, ValueError):
            return f"{path}: expected a number, got {type(got).__name__}"
        return None if np.isclose(g, float(exp), rtol=rtol, atol=atol, equal_nan=True) else \
            f"{path}: got {_fmt(g)}, expected {_fmt(float(exp))}"
    try:
        equal = bool(got == exp)
    except Exception:
        equal = False
    return None if equal else f"{path}: got {got!r}, expected {exp!r}"


def show(x):
    with pd.option_context("display.max_rows", 12, "display.max_columns", 10, "display.width", 110,
                           "display.precision", 6), np.printoptions(precision=6, threshold=40, edgeitems=4):
        s = repr(x)
    return s if len(s) < 2500 else s[:2500] + "\n…"


def fmt_exc(e):
    tb = e.__traceback__
    while tb is not None and tb.tb_frame.f_code.co_filename == __file__:
        tb = tb.tb_next  # hide the runner's own frames
    return "".join(traceback.format_exception(type(e), e, tb)).rstrip()


def _from_user(e):
    tb = e.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == "solution.py":
            return True
        tb = tb.tb_next
    return False


def lookahead(fn, args, kwargs, cut, rtol, atol):
    """Perturb every time-indexed input from row `cut` on; outputs before that date must not change."""
    rng = np.random.default_rng(123)
    when = next(a.index[cut] for a in args if isinstance(a, (pd.Series, pd.DataFrame)))

    def bump(a):
        if not isinstance(a, (pd.Series, pd.DataFrame)):
            return a
        a = a.astype(float)
        late = a.index >= when
        a.loc[late] = a.loc[late] * np.exp(rng.normal(0, 0.3, a.loc[late].shape))
        return a

    def head(o):
        if isinstance(o, (pd.Series, pd.DataFrame)):
            return o[o.index < when]
        if isinstance(o, (tuple, list)):
            return [head(v) for v in o]
        if isinstance(o, dict):
            return {k: head(v) for k, v in o.items()}
        return None  # scalars summarize the whole sample, so they can't be checked

    before = fn(*copy.deepcopy(args), **copy.deepcopy(kwargs))
    after = fn(*[bump(a) for a in copy.deepcopy(args)], **copy.deepcopy(kwargs))
    msg = same(head(after), head(before), rtol, atol)
    if msg:
        return (f"Look-ahead bias: changing the inputs on/after {when:%Y-%m-%d} changed your output "
                f"before that date. A value at time t may only use data up to t.\n{msg}")


def run_case(case, p, user_fn, ref_fn):
    rtol, atol = case.get("rtol", p.get("rtol", 1e-6)), case.get("atol", p.get("atol", 1e-8))
    args, kwargs = case.get("args", ()), case.get("kwargs", {})
    out = {"name": case.get("name", "test"), "sample": bool(case.get("sample"))}
    t0 = time.time()
    try:
        if "check" in case:
            case["check"](user_fn)  # raises AssertionError with an explanation
        elif "lookahead" in case:
            msg = lookahead(user_fn, args, kwargs, case["lookahead"], rtol, atol)
            if msg:
                out["message"] = msg
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                expected = ref_fn(*copy.deepcopy(args), **copy.deepcopy(kwargs))
            got = user_fn(*copy.deepcopy(args), **copy.deepcopy(kwargs))
            msg = same(got, expected, rtol, atol)
            if msg:
                out["message"] = msg
            if msg or out["sample"]:
                out["got"], out["expected"] = show(got), show(expected)
    except AssertionError as e:
        out["message"] = fmt_exc(e) if _from_user(e) else (str(e) or "check failed")
    except Exception as e:
        out["message"] = fmt_exc(e)
    out["ok"] = "message" not in out
    out["seconds"] = round(time.time() - t0, 2)
    return out


def figures():
    imgs = []
    for n in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(n).savefig(buf, format="png", dpi=100, bbox_inches="tight")
        imgs.append(base64.b64encode(buf.getvalue()).decode())
    plt.close("all")
    return imgs


def grade(pid, code, mode):
    p = content.PROBLEMS.get(pid)
    res = {"cases": []}
    buf = io.StringIO()
    t0 = time.time()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        try:
            if p and p.get("setup"):
                p["setup"]()
            ns = {"__name__": "__main__"}
            exec(compile(code, "solution.py", "exec"), ns)
            if p:
                fn = ns.get(p["fn"])
                if not callable(fn):
                    raise NameError(f"Define a function named `{p['fn']}` (see the starter code).")
                ref = {"__name__": "reference"}
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    exec(p["solution"], ref)
                cases = p["cases"]()
                if mode == "run":
                    cases = [c for c in cases if c.get("sample")] or cases[:1]
                res["cases"] = [run_case(c, p, fn, ref[p["fn"]]) for c in cases]
                res["passed"] = sum(c["ok"] for c in res["cases"])
                res["total"] = len(res["cases"])
        except BaseException as e:  # SystemExit/KeyboardInterrupt from user code included
            res["error"] = fmt_exc(e)
    res["seconds"] = round(time.time() - t0, 2)
    res["stdout"] = buf.getvalue()[-20000:]
    res["figures"] = figures()
    return res


def check(ids):
    bad = 0
    for pid in ids or content.PROBLEMS:
        p = content.PROBLEMS[pid]
        t = time.time()
        r = grade(pid, p["solution"], "submit")
        ok = not r.get("error") and r["passed"] == r["total"]
        s = grade(pid, p["starter"], "submit")
        starter_fails = bool(s.get("error")) or s["passed"] < s["total"]
        print(f"{'ok ' if ok and starter_fails else 'BAD'} {pid:<26} {r.get('passed')}/{r.get('total')}"
              f"  {time.time() - t:5.1f}s", flush=True)
        if not ok:
            print("   ", r.get("error") or next(c["message"] for c in r["cases"] if not c["ok"]))
        elif not starter_fails:
            print("    the starter code passes the tests")
        bad += not (ok and starter_fails)
    print(f"\n{bad} problem(s) need attention" if bad else "\nall problems verified")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    if sys.argv[1:2] == ["--check"]:
        check(sys.argv[2:])
    else:
        req = json.loads(sys.stdin.read())
        result = grade(req.get("id"), req["code"], req.get("mode", "run"))
        sys.stdout.write(SENTINEL + json.dumps(result, default=str))
