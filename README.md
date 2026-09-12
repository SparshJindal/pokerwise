# PokerWise ♠

Splitwise for your poker nights. Log buy-ins as they happen, punch in final stacks,
and let the tab ride until the end of the month.

- **Framework:** Next.js 15 (App Router) — deploys to Vercel with zero config
- **Storage:** Upstash Redis over REST (via Vercel Marketplace). No env vars = in-memory fallback for local dev.
- **Currency:** ₹ rupees, rounded to whole rupees

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Without storage env vars the app keeps games in memory, so tables disappear when
the dev server restarts. That's fine for testing the UI.

## Deploy to Vercel

### Option A — dashboard (easiest)

1. Push this folder to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "PokerWise"
   git branch -M main
   git remote add origin https://github.com/<you>/pokerwise.git
   git push -u origin main
   ```
2. Go to vercel.com → **Add New… → Project** → import the repo. Framework is
   detected as Next.js; leave every build setting as-is → **Deploy**.
3. In the project, open **Storage → Create Database → Upstash for Redis** (free
   tier). Connect it to the project. Vercel injects `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` automatically.
4. **Deployments → ⋯ → Redeploy** so the app picks up those variables. Done —
   games now persist.

### Option B — CLI

```bash
npm i -g vercel
vercel login
vercel          # first run: links/creates the project, deploys a preview
vercel --prod   # production deploy
```

Then add Redis: Vercel dashboard → your project → **Storage → Create Database →
Upstash for Redis** → connect → `vercel --prod` again.

If you prefer Upstash directly, create a database at upstash.com and set these
in Vercel → Settings → Environment Variables:

```
KV_REST_API_URL=https://<your-db>.upstash.io
KV_REST_API_TOKEN=<your-rest-token>
```

## How it works

- **Table** = one poker crew, identified by a 5-character game code (e.g. `4K9QP`).
- **Session** = one night. A table can hold many nights; the tab carries over.
- Everyone opens the site, enters the code, types their name + first buy-in.
- Re-buy? Type the amount under that player and tap **+ Add** — unlimited buy-ins.
- At the end, enter each player's **cash out** amount and save.
- **The tab** shows lifetime net per player, who owes whom with the fewest
  transfers, and lets you log part payments (₹200 of a ₹900 debt) so the
  remainder stays pending until you settle up.

## Files

```
app/
  page.tsx                 lobby: join by code / create a table
  game/[code]/page.tsx     the table UI (Tonight + The tab)
  api/games/route.ts       create a table
  api/games/[code]/route.ts read state + all actions
  globals.css              all styling
components/Logo.tsx        SVG logo + brand bar
lib/settle.ts              nets, balances, minimum-transfer settle-up
lib/store.ts               Redis REST / in-memory storage
lib/types.ts               data model
```
