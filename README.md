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
- Sales (managers): every ticket with the period's totals (sales, average ticket, VAT, cancellations and
  payment methods), filters by ticket number, seller, customer and status, the full detail of each sale,
  reprint, cancellation with a reason and an Excel report (summary and tickets sheets).
- Purchases (managers): record stock in from a supplier (search or scan products, quantity and unit cost
  per line, margin against the sale price, an `Idempotency-Key` per purchase), the purchase history with
  totals by period and supplier, printable detail, "repeat purchase", an Excel report (summary, purchases
  and every purchased product), and the suppliers catalog.
- Inventory (managers): stock of every product with quick adjustments, the low-stock report (restock the
  selected products, or all of them, in a new purchase) and each product's stock ledger (kardex) with
  links to the purchase or sale behind every movement; each of the three exports a styled Excel report.

- Excel reports: each one opens on a dashboard (figure cards, summary tables next to native Excel charts)
  followed by the data as real Excel tables (filters, banded rows, totals that follow the filters). Figures
  and computed columns are formulas over the data, and conditional formats and data bars mark what needs
  attention, so editing the workbook keeps it consistent.

- English and Spanish (detected from the browser, switchable), including the API's common error messages;
  light, dark and Oxford blue themes (or the system's). Both choices are remembered per browser.

## Stack

React 19, TypeScript, Vite, Tailwind CSS + shadcn/ui, TanStack Query, React Router, React Hook Form + Zod,
openapi-fetch with types generated from the API's OpenAPI document, ExcelJS and JSZip (loaded only when a report
is downloaded), Vitest, oxlint.

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
