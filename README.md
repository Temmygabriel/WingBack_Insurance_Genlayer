# Wingback

Decentralized flight-delay adjudication, built on GenLayer. Register a flight,
and once it's landed, GenLayer validators independently fetch real flight
status data, an AI reaches a verdict, and consensus across validators writes
that verdict on-chain — status, delay minutes, and reasoning, all public.

Currently targets **GenLayer studionet** only (free simulator network).
See `WingbackInsurance.py` for the contract; this repo is the frontend.

## 1. Local setup

```bash
npm install
cp .env.local.example .env.local
```

Open `.env.local` and paste in your deployed studionet contract address:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

```bash
npm run dev
```

Open `http://localhost:3000`.

The app auto-generates a browser-local account on first visit (stored in
`localStorage`) — no wallet connection needed for studionet.

## 2. Push to GitHub

From this folder, in your terminal:

```bash
git init
git add .
git commit -m "Initial commit — Wingback frontend"
```

Create a new empty repo on GitHub (no README/license, so it stays empty),
then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo you just pushed.
2. Vercel will auto-detect it as a Next.js project — leave build settings as default.
3. Before the first deploy (or right after, then redeploy), add the environment variable
   under **Project Settings → Environment Variables**:
   - Key: `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - Value: your deployed studionet contract address
4. Deploy. Every push to `main` will auto-redeploy from then on.

## Project structure

```
app/
  layout.tsx        root layout, loads globals.css
  page.tsx           thin client wrapper (keeps genlayer-js out of SSR)
  App.tsx            main orchestrator: account setup, state, handlers
components/
  BuyForm.tsx         registration form ("ticket" panel)
  PolicyCard.tsx       one flight's row on the board
  SplitFlap.tsx         the flip-tile status readout
lib/
  contract.ts          all genlayer-js calls + GEN unit conversion
types.ts               Policy shape + status strings (matches the contract exactly)
globals.css             design tokens + component styles
```

## Notes for iteration

- Status strings (`active`, `not_delayed`, `paid`, `delayed_unfunded`, `unresolved`)
  are defined once in `types.ts` (`POLICY_STATUS`) and imported everywhere —
  never hardcode these as string literals elsewhere.
- `lib/contract.ts` converts between human GEN amounts and raw on-chain units
  (18 decimals) at the `toRawUnits`/`fromRawUnits` boundary — the rest of the
  app never touches raw units directly.
- `adjudicate_flight` takes roughly 3–5 minutes to resolve (live fetch + AI
  consensus across validators) — the "Check this flight" button reflects this
  in its own label rather than looking frozen.
