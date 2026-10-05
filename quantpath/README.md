# Paths curriculum (authoring)

Source of the Quant Trader and Quant Researcher paths shown at `/paths`: lessons, questions and graded
tasks (`content/`), synthetic data generators (`data.py`) and the grader (`runner.py`).

The site never runs this folder's Python on a server. `npm run paths:build` exports it to
`src/data/paths/*.json`, and visitors' browsers grade their code with the same `runner.py` under Pyodide.
Progress and saved code are stored per user in Supabase (`supabase/schema.sql`).

```bash
npm run paths:setup      # once: Python 3.12 venv with the pinned packages
npm run paths:build      # after editing content/: regenerate src/data/paths/*.json (commit them)
npm run paths:check      # every reference solution passes and every starter fails (native Python)
npm run paths:check-web  # the same check under Pyodide, the browser's Python
```
