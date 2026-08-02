# Wingback

A parametric flight-delay derivative, built on GenLayer. Register a flight
and pay a real GEN premium. Once it's landed, file a claim in your own
words — GenLayer validators independently fetch real flight status data, an
AI reconciles your account against it, and consensus across validators
writes the verdict on-chain: status, delay minutes, reasoning, and payout,
all public.

**Worth being precise about what this is.** This isn't underwritten
insurance — there's no check that you actually held a ticket on the flight
you're covering, and pricing isn't calculated from real route-specific risk
data. It's structurally closer to a real-world weather derivative: a fixed,
graduated payout that triggers on an objectively measurable, independently
verified event. That's a legitimate category on its own; we're just not
calling it something it isn't.

Currently targets **GenLayer studionet** only (free simulator network).
See `WingbackInsurance.py` for the contract; this repo is the frontend.

## How the payout actually works

- Premium is whatever you choose to pay, real GEN, sent with the
  registration transaction.
- Before selling coverage, the contract fetches the flight's *current* live
  status. If it's already showing real trouble — cancelled, diverted, or a
  meaningful delay already reported — the sale is refused outright. This
  mostly only matters for near-term flights; a flight booked weeks out
  simply has no live status yet, so registration is instant for those.
  **For a near-term flight, registration itself now takes a few minutes**,
  the same live-fetch-and-consensus process claims already went through.
- If a claim resolves in your favor, the payout is graduated by how bad the
  delay actually was, not a flat multiple of your premium:

  | Delay | Payout |
  |---|---|
  | Under 3 hours | none (`not_delayed`) |
  | 3–6 hours | 3× premium |
  | 6–12 hours | 5× premium |
  | 12+ hours, cancelled, or diverted | 8× premium |

- The contract will never sell a policy it can't prove it could cover in
  the worst case — every registration checks that the pool's real balance
  covers every outstanding worst-case obligation, including the new one,
  before accepting it. Anyone can top up the pool's real reserve via
  `deposit_reserve`, independent of buying a policy.

**Known, disclosed limitations, not solved here:** premiums aren't priced
from real risk data (you choose your own), and there's no verification of
insurable interest (anyone can register any flight, not just one they're
actually flying). Both are open problems, named honestly rather than
pretended away.

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
`localStorage`) — this works immediately on studionet with no setup. A real
wallet (MetaMask) can also be connected instead, from the Account tab or the
topbar's Connect Wallet button, and used to sign transactions directly.

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
  App.tsx            main orchestrator: account setup, wallet state, handlers
components/
  BuyForm.tsx         registration form ("ticket" panel)
  PolicyCard.tsx       one flight's row on the board — shows worst-case
                       ceiling pre-resolution, actual tier-based payout after
  WalletIcon.tsx       icon for the topbar account pill / Connect Wallet button
  SplitFlap.tsx         the flip-tile status readout
lib/
  contract.ts          all genlayer-js calls + GEN unit conversion + explorer links
  wallet.ts             MetaMask connect, GenLayer Studio Network add/switch
types.ts               Policy shape + status strings (matches the contract exactly)
globals.css             design tokens + component styles
```

## Notes for iteration

- Status strings (`active`, `not_delayed`, `paid`, `delayed_unfunded`, `unresolved`,
  `flagged_inconsistent`) are defined once in `types.ts` (`POLICY_STATUS`) and
  imported everywhere — never hardcode these as string literals elsewhere.
- `lib/contract.ts` converts between human GEN amounts and raw on-chain units
  (18 decimals) at the `toRawUnits`/`fromRawUnits` boundary — the rest of the
  app never touches raw units directly. `value` passed into any `writeContract`
  call must stay a raw `BigInt` — never `.toString()` it (this silently
  corrupts the amount; see commit history / handover notes for why).
- A policy's `reserved_payout_amount` is the worst-case ceiling, fixed at
  purchase. `payout_amount` is the real, tier-based amount and stays `0`
  until the policy actually resolves to `paid` — don't treat `0` there as
  "no coverage."
- Both `buy_policy` and `adjudicate_flight` can take a few minutes to resolve
  for near-term flights (live fetch + AI consensus across validators) — button
  labels should reflect this rather than looking frozen. `buy_policy` is
  instant for advance-dated flights with no live status yet.
- MetaMask signing requires two different account shapes at two different
  layers of `genlayer-js` — see `lib/wallet.ts` and `lib/contract.ts`'s
  `toCallAccount` helper before changing either.
