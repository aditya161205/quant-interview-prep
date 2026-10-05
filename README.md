# QuantPrep

A minimal MVP for practicing quant trading interviews — built with Next.js (App Router), Tailwind v4, and Zustand.

## Features
- **Dashboard** — landing page with module cards.
- **Practice Problems** — 5 sample probability / EV / brainteaser questions with toggleable solutions.
- **Market Making Game** — deal a 5-card hand (3 shown, 2 hidden), quote a bid/ask on the total sum, and get scored on PnL vs. theoretical EV and realized settlement.
- **Paths** — step-by-step Quant Trader and Quant Researcher paths: lessons, interview questions, and Python tasks, project labs and capstones graded in the browser.
- **Obsidian theme** — default dark mode (deep blacks + deep-purple accents) with a working light/dark toggle.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Paths

Lessons and questions are served by the site; answers are checked on the server. Coding tasks are graded in
the visitor's browser with Pyodide (Python compiled to WebAssembly), so nothing runs Python on the server.
Progress and saved code are stored per user in Supabase: run `supabase/schema.sql` once (it creates
`path_progress` and `path_code`). Without Supabase configured, local development keeps progress in
server memory only.

The curriculum source is `quantpath/` (Python). After editing it, regenerate the site's data:

```bash
npm run paths:setup   # once: Python 3.12 venv for authoring
npm run paths:build   # writes src/data/paths/*.json (commit them)
npm run paths:check-web
```

## Structure
```
src/
  app/                 # routes: / , /practice , /market-making , /paths
  components/paths/    # path, step, question and coding-task views (CodeMirror editor, markdown + KaTeX)
  components/          # navbar, theme toggle, game UI, ui/ primitives
  data/problems.ts     # practice problem set
  lib/market-game.ts   # pure deck + EV + PnL scoring logic
  store/game-store.ts  # zustand game state
quantpath/             # Paths curriculum source (Python), exported to src/data/paths/
```
