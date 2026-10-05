-- ---------------------------------------------------------------------------
-- 005 — Per-document bank-details toggle
--
-- The commercial invoice prints the entity's bank panel so buyers can wire
-- payment, but some shipments must go out without it. Each document now
-- carries its own switch; the invoice PDF reads it before deciding whether
-- to render the BANK DETAILS block. Packing lists never show it.
--
-- Idempotent on purpose: it is independent of 004 and safe to run before or
-- after it (or more than once).
-- ---------------------------------------------------------------------------

alter table public.documents
  add column if not exists include_bank_details boolean not null default true;

-- Existing invoices keep printing their bank details.
comment on column public.documents.include_bank_details is
  'Show the entity bank panel on the commercial invoice PDF.';
