"""Curriculum. Every module in this package is one step and defines:

TITLE, SUMMARY, KIND ("foundation" | "core" | "project" | "capstone" | "interview"), LESSON (markdown),
QUESTIONS: list of {"type": "number" | "choice" | "open", "prompt", "answer", "explanation",
           optional "choices" (choice), "tol" (relative tolerance, number), "display"}
PROBLEMS:  list of graded coding problems (format documented in runner.py's run_case):
           {"id", "title", "difficulty", "libs", "fn", "description", "starter", "solution",
            "hints", "cases", optional "rtol"/"atol"/"timeout"/"setup"}

TRACKS orders the steps of each path; f* steps (and the options steps t7, t8) appear in both tracks.
"""
import importlib
import pkgutil

TRACKS = [
    {
        "id": "trader",
        "title": "Quant Trader",
        "tagline": "Probability, expected value, market making, options and execution: think fast, price risk, make markets.",
        "steps": ["f1_python", "f2_probability", "f3_expectation", "t1_mental_math", "f4_statistics", "f5_markets",
                  "t2_expected_value", "t3_markov", "t4_project_games", "t5_market_making", "t6_project_mm",
                  "f6_options", "t7_volatility", "t8_hedging", "t9_project_options", "t10_execution",
                  "t11_strategies", "t12_project_stocks", "f7_coding", "t13_interview"],
    },
    {
        "id": "researcher",
        "title": "Quant Researcher",
        "tagline": "Statistics, econometrics and machine learning for equity alpha, plus volatility modeling and options research.",
        "steps": ["f1_python", "f2_probability", "f3_expectation", "f4_statistics", "r1_linear_algebra",
                  "r2_optimization", "r3_regression", "r4_project_factors", "f5_markets", "f6_options",
                  "t7_volatility", "t8_hedging", "r5_stochastic", "r16_vol_surface", "r17_project_surface",
                  "r6_time_series", "r18_vol_forecasting", "r7_ml_foundations", "r8_ml_models", "r9_project_ml",
                  "r10_ml_finance", "r11_project_signals", "r12_portfolio", "r13_project_portfolio", "f7_coding",
                  "r14_interview", "r15_capstone", "r19_options_capstone"],
    },
]

STEPS, PROBLEMS, QUESTIONS = {}, {}, {}

for _name in sorted(m.name for m in pkgutil.iter_modules(__path__)):
    _mod = importlib.import_module(f"{__name__}.{_name}")
    _qs = [dict(q, id=f"{_name}.q{i}", step=_name) for i, q in enumerate(_mod.QUESTIONS, 1)]
    STEPS[_name] = {"id": _name, "title": _mod.TITLE, "summary": _mod.SUMMARY, "kind": _mod.KIND,
                    "lesson": _mod.LESSON, "questions": _qs, "problems": _mod.PROBLEMS}
    QUESTIONS.update((q["id"], q) for q in _qs)
    for _p in _mod.PROBLEMS:
        PROBLEMS[_p["id"]] = dict(_p, step=_name)

for _t in TRACKS:  # steps still being written are simply skipped
    _t["steps"] = [s for s in _t["steps"] if s in STEPS]
