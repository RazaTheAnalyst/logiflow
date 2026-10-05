-- ---------------------------------------------------------------------------
-- 006 — Per-line discount and tax
--
-- Tax/VAT and discount move from document-level inputs onto the line items:
--   * discount_percent / discount_amount — kept in sync by the form (typing a
--     percent fills the amount, typing an amount back-fills the percent); a
--     flat amount-only discount is also valid (percent left at 0).
--   * tax_percent — VAT/GST rate applied to the line's net after discount.
--
-- The old documents.discount / documents.tax columns stay in place as legacy
-- data; the app no longer reads or writes them.
--
-- Idempotent: safe to run more than once and in any order alongside 004/005.
-- ---------------------------------------------------------------------------

alter table public.line_items
  add column if not exists discount_percent numeric(7, 4) not null default 0;

alter table public.line_items
  add column if not exists discount_amount numeric(18, 2) not null default 0;

alter table public.line_items
  add column if not exists tax_percent numeric(7, 4) not null default 0;
