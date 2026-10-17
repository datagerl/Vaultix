This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Signing in

**Connect Wallet** in the header connects a Stellar wallet (Freighter, Albedo or Lobstr), then signs the backend's challenge to start a session. The session sets the `vaultix_token` cookie that `middleware.ts` requires for `/dashboard`, `/escrow/*` and the other protected routes. If the user was redirected to `/?returnTo=…`, they land back on that page after signing in.

A wallet that is connected but not signed in shows **Sign In** instead. Escrow actions (fund, release, dispute) are authorised by the signed-in wallet.

## Testing

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` (includes the E2E specs) |
| `npm test` | Jest unit and component tests |
| `npm run test:coverage` | Jest with coverage. Writes `coverage/`; open `coverage/lcov-report/index.html` |
| `npm run test:e2e` | Playwright, all browsers. Build first with `npm run build` |
| `npm run test:e2e:ci` | Playwright, Chromium only (what CI runs) |

Before running E2E locally, install a browser once with `npx playwright install chromium`. Playwright starts `next start` for you.

### E2E tests: mocked and deterministic

The Playwright suite (`e2e/`) covers the critical path: **login → create escrow → fund → release → open dispute**. It also covers role gating and live-update recovery. Nothing leaves the browser:

- **`e2e/support/mock-api.ts`** is an in-memory backend. It serves every `/v1/...` and `/api/...` call, plus Horizon, CoinGecko and the Socket.IO gateway. It mirrors the backend's preconditions (for example, fund requires a pending escrow and the exact amount) and records each request, so tests assert what the UI sent. A write the mock doesn't recognise fails the test, which flags API contract drift.
- **`e2e/support/fake-freighter.ts`** emulates the Freighter extension's `postMessage` protocol, so the app's real wallet code path runs without an extension.
- **`e2e/support/fixtures.ts`** provides the `api`, `useFreighter` and `signInAs` fixtures. `signInAs` seeds a session so later flows don't repeat the login UI. The login flow has its own test.

The base URL is `http://localhost:3000`, not `127.0.0.1`. The middleware redirects to `localhost`, and cookies and `localStorage` are per-origin.

In CI, the **Frontend CI** workflow runs lint, type-check and unit tests with coverage in one job, and headless Playwright in a separate `e2e` job. The coverage report (`frontend-coverage`) and the Playwright report (`frontend-playwright-report`) are uploaded as artifacts. The coverage totals also appear in the job summary.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
