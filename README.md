# QuantPrep

A minimal MVP for practicing quant trading interviews — built with Next.js (App Router), Tailwind v4, and Zustand.

## Features
- **Dashboard** — landing page with module cards.
- **Practice Problems** — 5 sample probability / EV / brainteaser questions with toggleable solutions.
- **Market Making Game** — deal a 5-card hand (3 shown, 2 hidden), quote a bid/ask on the total sum, and get scored on PnL vs. theoretical EV and realized settlement.
- **Obsidian theme** — default dark mode (deep blacks + deep-purple accents) with a working light/dark toggle.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Structure
```
src/
  app/                 # routes: / , /practice , /market-making
  components/          # navbar, theme toggle, game UI, ui/ primitives
  data/problems.ts     # practice problem set
  lib/market-game.ts   # pure deck + EV + PnL scoring logic
  store/game-store.ts  # zustand game state
```
