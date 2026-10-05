# LogiFlow

Commercial invoices and packing lists for daily logistics paperwork. Save your
customers once, build a shipment, and export a branded PDF — invoice, packing
list, or both.

Built with **Next.js 16** (App Router, Turbopack), **React 19**, **Tailwind CSS v4**,
**shadcn/ui**, and **Supabase** (Postgres + Auth + Storage).

## Features

- **Customer management** — save buyers with full addresses and tax IDs; reuse
  them on every document.
- **Document builder** — one form drives both documents. Pricing columns feed
  the invoice, carton/weight/volume columns feed the packing list.
- **PDF export** — `Invoice`, `Packing List`, or both in one file. US Letter
  on the official Netceed letterhead (`src/assets/letterhead.jpg`), one page
  per document, repeating table headers when line items overflow. Files are
  named by document number plus kind (`INV-UAE-1007 CI.pdf`).
- **Proforma invoices** — a separate tab with its own per-entity `PI` number
  series; accepted proformas convert to commercial invoices in one click
  (the source is marked `converted`).
- **Company logo** — upload to Supabase Storage; shown on entity cards across
  the app (PDFs print on the official letterhead).
- **Per-document currency** (26 currencies) and **Incoterms 2020** with year and
  named place.
- **Live totals** — subtotal, discount, freight, insurance, tax, plus shipment
  totals (cartons, net/gross weight, CBM).
- **Exporter settings** — company identity, bank details, and numbering prefixes
  printed on your documents.
- **Status tracking** — draft → sent → paid / cancelled (plus `converted`
  for proformas turned into invoices).
- **Audit trail** — every create/update stamps the signed-in user
  (`created_by` / `updated_by`); document saves run inside a single
  `save_document` database transaction, so a failed save can never leave a
  header-only document behind.

## Getting started

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a project.

### 2. Create the database schema

Open **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](./supabase/schema.sql), and run it.

This creates the `company_settings`, `customers`, `documents` and `line_items`
tables, enables row-level security, adds a document-numbering function, and
creates the `company-assets` storage bucket for your logo.

### 3. Add your credentials

```bash
cp .env.example .env.local
```

Fill in the values from **Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, then add
your company details under **Settings**.

> Until `.env.local` is filled in, the app serves a setup screen that walks you
> through these steps.

## Verifying your install

```bash
npm run verify
```

Runs typecheck, lint, the money/totals unit checks, the save-payload unit
checks, and a PDF smoke test that renders the real templates and asserts
each document lands on the correct number of pages.

Individual steps: `npm run typecheck`, `npm run lint`, `npm run verify:math`,
`npm run verify:payload`, `npm run verify:pdf`.

## How it fits together

| Path | Role |
| --- | --- |
| `src/proxy.ts` | Refreshes the Supabase session and gates every route behind sign-in. |
| `src/lib/supabase/` | Browser, server and proxy Supabase clients. |
| `src/lib/actions/` | Server actions for customers, documents and settings. |
| `src/lib/data.ts` | Server-side reads (used by Server Components). |
| `src/lib/pdf/documents.tsx` | `@react-pdf/renderer` templates for both documents. |
| `src/app/api/documents/[id]/pdf/route.ts` | Renders and streams the PDF. |
| `src/components/document-form.tsx` | The shipment builder. |
| `supabase/schema.sql` | Tables, RLS policies, numbering, storage bucket. |

### Document numbers

Numbers are generated from the prefixes and counters in **Settings**
(`INV-1001`, `PL-1001`, …) — proformas draw from a separate per-entity `PI`
series. The `next_doc_number` function locks the settings
row so two people saving at once can't be handed the same number. The builder
previews the next number and lets you override it — edit the `doc_number` field
to use your own reference.

## Notes

- PostgREST returns `numeric` columns as strings; `num()` in `src/lib/money.ts`
  normalises them, and the totals are rounded to 2 decimals to avoid float drift.
- PDFs use the built-in Helvetica so rendering never depends on a network font
  fetch.
- `@react-pdf/renderer` is listed in `serverExternalPackages` in
  `next.config.ts`; it ships Node-only code that must not be bundled.

## Deploying

Works on any Node host (Vercel, Railway, Fly, a VPS). Set the two
`NEXT_PUBLIC_SUPABASE_*` variables in your host's environment and run
`npm run build && npm start`.
