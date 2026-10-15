# Inventory Billing Web

Web client for the [Inventory Billing System API](https://github.com/IrvinSegura/Sistema-de-Inventario-y-Facturacion):
checkout (point of sale) and cash drawer for a grocery store.

## Features

- Sign in with JWT; the session survives reloads and the access token is renewed transparently. Refreshes
  are serialized across tabs (Web Locks), since the API rotates refresh tokens and revokes every session if
  an old one is reused.
- Cash drawer: open the day's drawer with an opening float and close it with a blind count (the expected
  cash is shown only after the count is recorded).
- Checkout: scan or type barcodes, adjust quantities, VAT preview per line (same rounding as the API), cash
  change, and an `Idempotency-Key` per checkout so a double click or a retried request never charges twice.

- English and Spanish (detected from the browser, switchable), including the API's common error messages;
  light, dark and Oxford blue themes (or the system's). Both choices are remembered per browser.

## Stack

React 19, TypeScript, Vite, Tailwind CSS + shadcn/ui, TanStack Query, React Router, React Hook Form + Zod,
openapi-fetch with types generated from the API's OpenAPI document, Vitest, oxlint.

## Run locally

Requires Node 22+ and the API running on `http://localhost:8080` (see the API's README; it allows
`http://localhost:5173` by default). To use another API, set `VITE_API_URL` in `.env.development.local`.

```bash
npm install
npm run dev
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Typecheck and production build (`dist/`) |
| `npm run lint` | oxlint |
| `npm test` | Unit tests (Vitest) |
| `npm run api:generate` | Regenerate `src/api/schema.d.ts` from the deployed API's OpenAPI document |

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL, no trailing slash (`.env.development` / `.env.production`) |
