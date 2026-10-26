-- =====================================================================
--  Sweet House Immobilier — قاعدة البيانات (Supabase / PostgreSQL)
--  شغّل هذا الملف مرة واحدة في: Supabase → SQL Editor → New query → Run
--  يمكن إعادة تشغيله بأمان (لا يحذف أي بيانات).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ⚠️ اكتب بريدك الإلكتروني (حساب المدير) بين علامتي التنصيص أدناه.
--    The owner's e-mail: the account created with it becomes the admin.
-- ---------------------------------------------------------------------
create table if not exists public.re_config (
  id int primary key default 1 check (id = 1),
  owner_email text not null
);
insert into public.re_config (id, owner_email)
values (1, 'OWNER_EMAIL@example.com')
on conflict (id) do update set owner_email = excluded.owner_email;
alter table public.re_config enable row level security; -- nobody reads it through the API

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Team (staff)
-- ---------------------------------------------------------------------
create table if not exists public.re_staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'secretary' check (role in ('admin', 'secretary')),
  phone text,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Job title shown in the team, and what a member may do besides the daily work
-- (requests, clients, agenda, tasks, calls). The admin role can do everything;
-- the owner picks everyone else's permissions in the dashboard («الفريق»).
alter table public.re_staff add column if not exists title text;
alter table public.re_staff add column if not exists permissions text[] not null default '{properties}';
alter table public.re_staff drop constraint if exists re_staff_permissions_check;
alter table public.re_staff add constraint re_staff_permissions_check
  check (permissions <@ array['properties', 'delete', 'deals', 'reports', 'export', 'settings', 'activity']);

create or replace function public.re_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.re_staff where id = auth.uid() and active)
$$;

create or replace function public.re_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.re_staff where id = auth.uid() and active and role = 'admin')
$$;

-- true when the signed-in member is active and is an admin or holds this permission
create or replace function public.re_can(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.re_staff
    where id = auth.uid() and active and (role = 'admin' or p_perm = any (permissions))
  )
$$;

-- The owner's account always stays an active admin with the same e-mail:
-- nobody (not even another admin) can lock the agency out.
create or replace function public.re_staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.re_config where lower(owner_email) = lower(old.email)) then
    new.email := old.email;
    new.role := 'admin';
    new.active := true;
  end if;
  return new;
end $$;

drop trigger if exists re_staff_guard on public.re_staff;
create trigger re_staff_guard
  before update on public.re_staff
  for each row execute function public.re_staff_guard();

-- Every new account from this app gets a staff row:
--   the owner's e-mail → active admin ; anyone else → inactive secretary (waits for approval).
create or replace function public.re_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_owner boolean;
begin
  begin
    select exists (select 1 from public.re_config where lower(owner_email) = lower(coalesce(new.email, ''))) into is_owner;
    if not is_owner and coalesce(new.raw_user_meta_data ->> 'app', '') <> 'sweet-house-immo' then
      return new; -- account of another app sharing this project
    end if;
    insert into public.re_staff (id, full_name, email, role, active)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
      coalesce(new.email, ''),
      case when is_owner then 'admin' else 'secretary' end,
      is_owner
    )
    on conflict (id) do nothing;
  exception when others then
    null; -- never block account creation for any app using this project
  end;
  return new;
end $$;

drop trigger if exists re_on_auth_user_created on auth.users;
create trigger re_on_auth_user_created
  after insert on auth.users
  for each row execute function public.re_handle_new_user();

-- A signed-in account without a team row (created before these tables, or in the Supabase
-- dashboard) joins the team on its first sign-in:
--   the owner's e-mail above → active admin ; anyone else → inactive, waits for the owner's approval.
create or replace function public.re_join() returns public.re_staff
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_owner boolean := false;
  v_row public.re_staff;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  select * into v_row from public.re_staff where id = v_uid;
  if found then
    return v_row;
  end if;
  select u.email, coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(u.email, ''), '@', 1))
    into v_email, v_name
  from auth.users u where u.id = v_uid;
  select exists (select 1 from public.re_config where lower(owner_email) = lower(coalesce(v_email, ''))) into v_owner;
  insert into public.re_staff (id, full_name, email, role, active)
  values (v_uid, coalesce(v_name, ''), coalesce(v_email, ''), case when v_owner then 'admin' else 'secretary' end, v_owner)
  on conflict (id) do nothing;
  select * into v_row from public.re_staff where id = v_uid;
  return v_row;
end $$;
revoke execute on function public.re_join() from public, anon;
grant execute on function public.re_join() to authenticated;

-- ---------------------------------------------------------------------
-- Website settings (public content, edited by the owner)
-- ---------------------------------------------------------------------
create table if not exists public.re_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------
create table if not exists public.re_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null default '',
  whatsapp text,
  email text,
  kind text not null default 'buyer' check (kind in ('buyer', 'tenant', 'owner', 'investor')),
  source text not null default 'phone',
  budget_min numeric,
  budget_max numeric,
  wants_purpose text check (wants_purpose in ('sale', 'rent')),
  wants_types text[] not null default '{}',
  wants_neighborhoods text[] not null default '{}',
  wants_rooms_min int,
  lang text not null default 'ar' check (lang in ('ar', 'fr', 'es')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------
create table if not exists public.re_properties (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  title text not null,
  title_fr text,
  title_es text,
  description text not null default '',
  description_fr text,
  description_es text,
  type text not null default 'apartment',
  purpose text not null default 'sale' check (purpose in ('sale', 'rent')),
  price numeric not null default 0 check (price >= 0),
  area numeric,
  land_area numeric,
  rooms int,
  bedrooms int,
  bathrooms int,
  floor int,
  floors int,
  year_built int,
  furnished boolean not null default false,
  features text[] not null default '{}',
  neighborhood text not null default '',
  city text not null default 'تطوان',
  address text,
  lat double precision,
  lng double precision,
  images text[] not null default '{}',
  video_url text,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'rented', 'draft')),
  featured boolean not null default false,
  published boolean not null default true,
  views int not null default 0,
  owner_client_id uuid references public.re_clients (id) on delete set null,
  private_notes text, -- never exposed to the public website
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists re_properties_public_idx on public.re_properties (published, status);

-- ---------------------------------------------------------------------
-- Leads (requests from the website, phone, WhatsApp…)
-- ---------------------------------------------------------------------
create table if not exists public.re_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 6 and 30),
  email text check (email is null or char_length(email) <= 160),
  message text check (message is null or char_length(message) <= 3000),
  notes text,
  kind text not null default 'inquiry' check (kind in ('inquiry', 'visit', 'sell', 'valuation', 'callback', 'contact', 'booking')),
  property_id uuid references public.re_properties (id) on delete set null,
  property_ref text check (property_ref is null or char_length(property_ref) <= 30),
  source text not null default 'website',
  status text not null default 'new' check (status in ('new', 'contacted', 'visit', 'negotiation', 'won', 'lost')),
  assigned_to uuid,
  client_id uuid references public.re_clients (id) on delete set null,
  preferred_at timestamptz,
  lang text not null default 'ar' check (lang in ('ar', 'fr', 'es')),
  meta jsonb check (meta is null or pg_column_size(meta) < 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists re_leads_status_idx on public.re_leads (status, created_at desc);

-- ---------------------------------------------------------------------
-- Appointments, tasks, calls, deals, activity log
-- ---------------------------------------------------------------------
create table if not exists public.re_appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'visit' check (kind in ('visit', 'meeting', 'call', 'signing')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  property_id uuid references public.re_properties (id) on delete set null,
  client_id uuid references public.re_clients (id) on delete set null,
  lead_id uuid references public.re_leads (id) on delete set null,
  assigned_to uuid,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled', 'noshow')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists re_appointments_start_idx on public.re_appointments (starts_at);

create table if not exists public.re_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'done')),
  assigned_to uuid,
  related_type text check (related_type in ('property', 'client', 'lead')),
  related_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.re_calls (
  id uuid primary key default gen_random_uuid(),
  caller_name text not null default '',
  phone text not null default '',
  direction text not null default 'in' check (direction in ('in', 'out')),
  subject text not null default '',
  outcome text,
  client_id uuid references public.re_clients (id) on delete set null,
  lead_id uuid references public.re_leads (id) on delete set null,
  logged_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.re_deals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.re_properties (id) on delete set null,
  client_id uuid references public.re_clients (id) on delete set null,
  kind text not null default 'sale' check (kind in ('sale', 'rent')),
  amount numeric not null default 0,
  commission numeric not null default 0,
  notes text,
  closed_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.re_activity (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  actor_name text,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists re_activity_created_idx on public.re_activity (created_at desc);

-- ---------------------------------------------------------------------
-- Partners network: brokers, partner agencies, referrers, developers
-- agreement_mode: side = the customary share of the side he brought (split with the other
-- brokers of that side) ; percent = agreement_value % of the commission ; fixed = dirhams per deal
-- ---------------------------------------------------------------------
create table if not exists public.re_brokers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null default '',
  whatsapp text,
  email text,
  kind text not null default 'broker' check (kind in ('broker', 'agency', 'referrer', 'developer')),
  company text,
  zones text[] not null default '{}',
  specialties text[] not null default '{}',
  agreement_mode text not null default 'side' check (agreement_mode in ('side', 'percent', 'fixed')),
  agreement_value numeric not null default 0 check (agreement_value >= 0),
  rating int check (rating between 1 and 5),
  active boolean not null default true,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- who brought a property / a client (never shown on the website)
alter table public.re_properties add column if not exists broker_id uuid references public.re_brokers (id) on delete set null;
alter table public.re_clients add column if not exists broker_id uuid references public.re_brokers (id) on delete set null;

-- commission of each party and its sharing with partners (the rest is the agency's)
alter table public.re_deals add column if not exists commission_seller numeric not null default 0;
alter table public.re_deals add column if not exists commission_buyer numeric not null default 0;
alter table public.re_deals add column if not exists shares jsonb not null default '[]'::jsonb;
alter table public.re_deals add column if not exists received numeric not null default 0;

-- internal settings (commission sharing rules…): team only, never public
create table if not exists public.re_private (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Owners: mandates (authorisation to sell / rent), private documents,
-- price history, and a private follow-up link for each owner
-- ---------------------------------------------------------------------
create table if not exists public.re_mandates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.re_properties (id) on delete cascade,
  owner_client_id uuid references public.re_clients (id) on delete set null,
  kind text not null default 'simple' check (kind in ('exclusive', 'simple')),
  purpose text not null default 'sale' check (purpose in ('sale', 'rent')),
  start_date date not null default current_date,
  end_date date,
  price numeric check (price >= 0),
  net_price numeric check (net_price >= 0),
  min_price numeric check (min_price >= 0),
  -- paid by the owner: % of the price for a sale, months of rent for a rental, or a fixed amount
  commission_rate numeric check (commission_rate >= 0),
  commission_amount numeric check (commission_amount >= 0),
  keys text not null default 'owner' check (keys in ('agency', 'owner', 'concierge', 'none')),
  keys_notes text,
  visit_terms text,
  signed boolean not null default false,
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists re_mandates_property_idx on public.re_mandates (property_id);

-- files live in the PRIVATE storage bucket «property-docs»; this table describes them
create table if not exists public.re_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.re_clients (id) on delete cascade,
  property_id uuid references public.re_properties (id) on delete cascade,
  kind text not null default 'other' check (kind in ('title', 'plan', 'id', 'mandate', 'contract', 'permit', 'tax', 'other')),
  title text not null default '',
  path text not null,
  file_name text not null default '',
  mime text,
  size int,
  expires_at date,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint re_documents_owner_check check (client_id is not null or property_id is not null)
);

-- every price change of a property, written by a trigger
create table if not exists public.re_price_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.re_properties (id) on delete cascade,
  old_price numeric,
  new_price numeric not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists re_price_history_property_idx on public.re_price_history (property_id, created_at);

create or replace function public.re_track_price() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.re_price_history (property_id, old_price, new_price, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.price end, new.price, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists re_track_price on public.re_properties;
create trigger re_track_price
  after insert or update of price on public.re_properties
  for each row execute function public.re_track_price();

-- the starting price of properties added before the history existed
insert into public.re_price_history (property_id, old_price, new_price, created_at)
select p.id, null, p.price, p.created_at
from public.re_properties p
where not exists (select 1 from public.re_price_history h where h.property_id = p.id);

-- private follow-up link of an owner, and when he last received a report
alter table public.re_clients add column if not exists share_token uuid unique;
alter table public.re_clients add column if not exists last_report_at timestamptz;

-- ---------------------------------------------------------------------
-- Offers from buyers / tenants, and what visitors thought of a visit
-- ---------------------------------------------------------------------
create table if not exists public.re_offers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.re_properties (id) on delete cascade,
  client_id uuid references public.re_clients (id) on delete set null,
  amount numeric not null check (amount >= 0),
  financing text not null default 'cash' check (financing in ('cash', 'loan', 'mixed')),
  conditions text,
  status text not null default 'pending' check (status in ('pending', 'countered', 'accepted', 'rejected', 'withdrawn')),
  counter_amount numeric check (counter_amount >= 0),
  valid_until date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists re_offers_property_idx on public.re_offers (property_id);

alter table public.re_appointments add column if not exists feedback_interest text check (feedback_interest in ('hot', 'warm', 'cold'));
alter table public.re_appointments add column if not exists feedback_price text check (feedback_price in ('low', 'fair', 'high'));
alter table public.re_appointments add column if not exists feedback_note text;

-- ---------------------------------------------------------------------
-- Deal file (stages, checklist), invoices, receipts and agency expenses
-- ---------------------------------------------------------------------
-- a deal is followed from the agreement to the signature; only «done» deals count as revenue
alter table public.re_deals add column if not exists stage text not null default 'done';
alter table public.re_deals add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.re_deals add column if not exists deposit numeric check (deposit >= 0);
alter table public.re_deals add column if not exists notary text;
do $$
begin
  alter table public.re_deals add constraint re_deals_stage_check check (stage in ('agreement', 'paperwork', 'signing', 'done', 'cancelled'));
exception when duplicate_object then null;
end $$;

-- one gap-free number series per year: F = invoice, AV = credit note, R = receipt
create table if not exists public.re_counters (
  key text primary key,
  n integer not null default 0
);

create table if not exists public.re_invoices (
  id uuid primary key default gen_random_uuid(),
  no text not null unique,
  kind text not null default 'invoice' check (kind in ('invoice', 'credit')),
  deal_id uuid references public.re_deals (id) on delete set null,
  client_id uuid references public.re_clients (id) on delete set null,
  party text not null default 'buyer' check (party in ('seller', 'buyer', 'other')),
  bill_name text not null check (length(trim(bill_name)) > 0),
  bill_ice text,
  bill_address text,
  -- [{label, qty, unit}] unit price before VAT
  lines jsonb not null default '[]'::jsonb,
  vat_rate numeric not null default 0 check (vat_rate >= 0 and vat_rate <= 30),
  total_ht numeric not null default 0,
  total_vat numeric not null default 0,
  total_ttc numeric not null default 0,
  issued_at date not null default current_date,
  due_at date,
  status text not null default 'issued' check (status in ('issued', 'paid', 'cancelled')),
  paid numeric not null default 0,
  -- a credit note points to the invoice it cancels
  ref_invoice_id uuid references public.re_invoices (id) on delete set null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists re_invoices_deal_idx on public.re_invoices (deal_id);

create table if not exists public.re_payments (
  id uuid primary key default gen_random_uuid(),
  no text not null unique,
  deal_id uuid references public.re_deals (id) on delete set null,
  invoice_id uuid references public.re_invoices (id) on delete set null,
  client_id uuid references public.re_clients (id) on delete set null,
  party text not null default 'buyer' check (party in ('seller', 'buyer', 'other')),
  payer_name text not null check (length(trim(payer_name)) > 0),
  amount numeric not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'transfer', 'cheque', 'card', 'other')),
  reference text,
  received_at date not null default current_date,
  status text not null default 'valid' check (status in ('valid', 'cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists re_payments_deal_idx on public.re_payments (deal_id);

create table if not exists public.re_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_at date not null default current_date,
  category text not null default 'other' check (category in ('rent', 'salaries', 'ads', 'photo', 'transport', 'phone', 'utilities', 'taxes', 'fees', 'office', 'other')),
  label text not null check (length(trim(label)) > 0),
  amount numeric not null check (amount >= 0),
  method text check (method in ('cash', 'transfer', 'cheque', 'card', 'other')),
  vendor text,
  property_id uuid references public.re_properties (id) on delete set null,
  deal_id uuid references public.re_deals (id) on delete set null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists re_expenses_spent_idx on public.re_expenses (spent_at);

-- the number is given by the database in the same transaction as the row: no gap, no duplicate
create or replace function public.re_number_doc() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  series text;
  day date;
  k text;
  v integer;
begin
  if tg_table_name = 're_invoices' then
    -- saving an existing invoice again keeps its number
    if exists (select 1 from public.re_invoices where id = new.id) then return new; end if;
    series := case when new.kind = 'credit' then 'AV' else 'F' end;
    day := coalesce(new.issued_at, current_date);
  elsif tg_table_name = 're_rent_payments' then
    if exists (select 1 from public.re_rent_payments where id = new.id) then return new; end if;
    series := 'Q';
    day := coalesce(new.paid_at, current_date);
  else
    if exists (select 1 from public.re_payments where id = new.id) then return new; end if;
    series := 'R';
    day := coalesce(new.received_at, current_date);
  end if;
  k := series || '-' || extract(year from day)::int;
  insert into public.re_counters as c (key, n) values (k, 1)
  on conflict (key) do update set n = c.n + 1
  returning c.n into v;
  new.no := k || '-' || lpad(v::text, 4, '0');
  return new;
end $$;

drop trigger if exists re_number_invoice on public.re_invoices;
create trigger re_number_invoice before insert on public.re_invoices for each row execute function public.re_number_doc();
drop trigger if exists re_number_payment on public.re_payments;
create trigger re_number_payment before insert on public.re_payments for each row execute function public.re_number_doc();

-- an issued invoice or receipt is never rewritten: it is cancelled (an invoice by a credit note)
create or replace function public.re_lock_doc() returns trigger
language plpgsql as $$
declare
  free text[] := array['status', 'paid', 'notes', 'due_at', 'deal_id', 'client_id', 'invoice_id', 'booking_id', 'remitted_at', 'updated_at'];
begin
  if (to_jsonb(old) - free) is distinct from (to_jsonb(new) - free) then
    raise exception 'document_locked: cancel it and issue a new one' using errcode = 'check_violation';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'document_locked: a cancelled document stays cancelled' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists re_lock_invoice on public.re_invoices;
create trigger re_lock_invoice before update on public.re_invoices for each row execute function public.re_lock_doc();
drop trigger if exists re_lock_payment on public.re_payments;
create trigger re_lock_payment before update on public.re_payments for each row execute function public.re_lock_doc();

-- ---------------------------------------------------------------------
-- Rental management (law 67-12): leases, rents and their receipts
-- ---------------------------------------------------------------------
create table if not exists public.re_leases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.re_properties (id) on delete set null,
  owner_client_id uuid references public.re_clients (id) on delete set null,
  tenant_client_id uuid references public.re_clients (id) on delete set null,
  -- housing: revision up to 8 % every 3 years ; professional: up to 10 % (art. 33-34)
  usage text not null default 'housing' check (usage in ('housing', 'professional')),
  start_date date not null,
  -- empty: renewed by tacit agreement
  end_date date,
  rent numeric not null check (rent >= 0),
  charges numeric not null default 0 check (charges >= 0),
  charges_note text,
  pay_day int not null default 1 check (pay_day between 1 and 28),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'transfer', 'cheque', 'card', 'other')),
  -- at most two months of rent (art. 20)
  deposit numeric not null default 0 check (deposit >= 0),
  deposit_holder text not null default 'owner' check (deposit_holder in ('owner', 'agency')),
  deposit_returned_at date,
  -- the agency collects the rent for the owner and keeps a fee
  managed boolean not null default false,
  management_rate numeric not null default 0 check (management_rate >= 0 and management_rate <= 100),
  -- [{from: 'yyyy-mm', rent, charges, note}]
  revisions jsonb not null default '[]'::jsonb,
  equipment text,
  obligations text,
  -- state of the premises at entry and exit (art. 7-8)
  inventory jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  ended_at date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists re_leases_property_idx on public.re_leases (property_id);

-- each rent received, with its receipt (art. 11: rent and charges shown apart)
create table if not exists public.re_rent_payments (
  id uuid primary key default gen_random_uuid(),
  no text not null unique,
  lease_id uuid not null references public.re_leases (id) on delete restrict,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  rent numeric not null default 0 check (rent >= 0),
  charges numeric not null default 0 check (charges >= 0),
  method text not null default 'cash' check (method in ('cash', 'transfer', 'cheque', 'card', 'other')),
  reference text,
  paid_at date not null default current_date,
  status text not null default 'valid' check (status in ('valid', 'cancelled')),
  -- managed lease: when the owner received his share
  remitted_at date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint re_rent_payments_amount_check check (rent + charges > 0)
);
create index if not exists re_rent_payments_lease_idx on public.re_rent_payments (lease_id, period);

drop trigger if exists re_number_rent on public.re_rent_payments;
create trigger re_number_rent before insert on public.re_rent_payments for each row execute function public.re_number_doc();
drop trigger if exists re_lock_rent on public.re_rent_payments;
create trigger re_lock_rent before update on public.re_rent_payments for each row execute function public.re_lock_doc();

-- ---------------------------------------------------------------------
-- Seasonal rentals (summer…): nightly rates on a property, stays that never overlap,
-- guests' details for their form and the online declaration of stays (law 80-14, art. 36-38)
-- ---------------------------------------------------------------------
alter table public.re_properties add column if not exists seasonal boolean not null default false;
alter table public.re_properties add column if not exists season jsonb not null default '{}'::jsonb;

-- website booking requests arrive as requests of their own kind
alter table public.re_leads drop constraint if exists re_leads_kind_check;
alter table public.re_leads add constraint re_leads_kind_check check (kind in ('inquiry', 'visit', 'sell', 'valuation', 'callback', 'contact', 'booking'));

create table if not exists public.re_bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.re_properties (id) on delete restrict,
  client_id uuid references public.re_clients (id) on delete set null,
  lead_id uuid references public.re_leads (id) on delete set null,
  -- a request does not hold the dates; blocked = the owner's own use
  status text not null default 'request' check (status in ('request', 'confirmed', 'checked_in', 'completed', 'cancelled', 'blocked')),
  source text not null default 'phone' check (source in ('website', 'phone', 'whatsapp', 'walkin', 'airbnb', 'booking', 'owner', 'other')),
  check_in date not null,
  -- departure day (not a night)
  check_out date not null,
  guests int not null default 1 check (guests between 1 and 50),
  guest_name text not null default '',
  guest_phone text,
  guest_lang text not null default 'ar' check (guest_lang in ('ar', 'fr', 'es')),
  guest_id_type text check (guest_id_type in ('cin', 'passport', 'residence', 'other')),
  guest_id_no text,
  guest_nationality text,
  guest_birth date,
  guest_address text,
  declared_at timestamptz,
  rent numeric not null default 0 check (rent >= 0),
  cleaning numeric not null default 0 check (cleaning >= 0),
  deposit numeric not null default 0 check (deposit >= 0),
  caution numeric not null default 0 check (caution >= 0),
  caution_status text not null default 'none' check (caution_status in ('none', 'held', 'returned', 'kept')),
  paid numeric not null default 0,
  commission_rate numeric not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  owner_paid_at date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint re_bookings_dates_check check (check_out > check_in)
);
create index if not exists re_bookings_property_idx on public.re_bookings (property_id, check_in);

-- two stays never share a night on the same property (checked one at a time per property)
create or replace function public.re_booking_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('confirmed', 'checked_in', 'completed', 'blocked') then
    perform pg_advisory_xact_lock(hashtext('re_bookings:' || new.property_id::text));
    if exists (
      select 1 from public.re_bookings b
      where b.property_id = new.property_id
        and b.id <> new.id
        and b.status in ('confirmed', 'checked_in', 'completed', 'blocked')
        and daterange(b.check_in, b.check_out) && daterange(new.check_in, new.check_out)
    ) then
      raise exception 'booking_overlap: these nights are already taken' using errcode = 'exclusion_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists re_booking_guard on public.re_bookings;
create trigger re_booking_guard before insert or update on public.re_bookings for each row execute function public.re_booking_guard();

-- receipts for the money of a stay
alter table public.re_payments add column if not exists booking_id uuid references public.re_bookings (id) on delete set null;

-- the website shows when seasonal properties are taken: dates only, never who
create or replace function public.re_seasonal_busy()
returns table (property_id uuid, check_in date, check_out date)
language sql stable security definer set search_path = public as $$
  select b.property_id, b.check_in, b.check_out
  from public.re_bookings b
  join public.re_properties p on p.id = b.property_id
  where p.published and p.seasonal and p.status <> 'draft'
    and b.status in ('confirmed', 'checked_in', 'completed', 'blocked')
    and b.check_out >= current_date
    and b.check_in <= current_date + 400
  order by b.property_id, b.check_in
$$;
revoke execute on function public.re_seasonal_busy() from public;
grant execute on function public.re_seasonal_busy() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Trash: every deleted record is kept 30 days and can be restored
-- ---------------------------------------------------------------------
create table if not exists public.re_trash (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  label text,
  data jsonb not null,
  deleted_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists re_trash_created_idx on public.re_trash (created_at desc);
create index if not exists re_trash_row_idx on public.re_trash (row_id);

create or replace function public.re_to_trash() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(old);
begin
  insert into public.re_trash (table_name, row_id, label, data, deleted_by)
  values (tg_table_name, old.id, coalesce(j ->> 'ref', j ->> 'full_name', j ->> 'name', j ->> 'title', j ->> 'caller_name', j ->> 'label', ''), j, auth.uid());
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['re_properties', 're_clients', 're_leads', 're_appointments', 're_tasks', 're_calls', 're_deals', 're_brokers', 're_mandates', 're_documents', 're_offers', 're_expenses', 're_leases', 're_bookings'] loop
    execute format('drop trigger if exists re_trash_%1$s on public.%1$s', t);
    execute format('create trigger re_trash_%1$s before delete on public.%1$s for each row execute function public.re_to_trash()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- updated_at (a page view does not count as an edit)
-- ---------------------------------------------------------------------
create or replace function public.re_touch() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 're_properties'
     and (to_jsonb(new) - 'views' - 'updated_at') = (to_jsonb(old) - 'views' - 'updated_at') then
    return new;
  end if;
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists re_touch_properties on public.re_properties;
create trigger re_touch_properties before update on public.re_properties for each row execute function public.re_touch();
drop trigger if exists re_touch_clients on public.re_clients;
create trigger re_touch_clients before update on public.re_clients for each row execute function public.re_touch();
drop trigger if exists re_touch_leads on public.re_leads;
create trigger re_touch_leads before update on public.re_leads for each row execute function public.re_touch();
drop trigger if exists re_touch_brokers on public.re_brokers;
create trigger re_touch_brokers before update on public.re_brokers for each row execute function public.re_touch();
drop trigger if exists re_touch_mandates on public.re_mandates;
create trigger re_touch_mandates before update on public.re_mandates for each row execute function public.re_touch();
drop trigger if exists re_touch_offers on public.re_offers;
create trigger re_touch_offers before update on public.re_offers for each row execute function public.re_touch();
drop trigger if exists re_touch_invoices on public.re_invoices;
create trigger re_touch_invoices before update on public.re_invoices for each row execute function public.re_touch();
drop trigger if exists re_touch_expenses on public.re_expenses;
create trigger re_touch_expenses before update on public.re_expenses for each row execute function public.re_touch();
drop trigger if exists re_touch_leases on public.re_leases;
create trigger re_touch_leases before update on public.re_leases for each row execute function public.re_touch();
drop trigger if exists re_touch_bookings on public.re_bookings;
create trigger re_touch_bookings before update on public.re_bookings for each row execute function public.re_touch();

-- ---------------------------------------------------------------------
-- Anti-spam: at most 3 website requests per phone number every 10 minutes
-- ---------------------------------------------------------------------
create or replace function public.re_leads_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'website' and (
    select count(*) from public.re_leads
    where phone = new.phone and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'rate_limited';
  end if;
  return new;
end $$;
drop trigger if exists re_leads_rate_limit on public.re_leads;
create trigger re_leads_rate_limit before insert on public.re_leads for each row execute function public.re_leads_rate_limit();

-- ---------------------------------------------------------------------
-- Public website: published properties WITHOUT private columns, and a view counter
-- ---------------------------------------------------------------------
drop view if exists public.re_public_properties;
-- its columns changed (seasonal rates): the function is replaced as a whole
drop function if exists public.re_public_properties(text);

create or replace function public.re_public_properties(p_ref text default null)
returns table (
  id uuid, ref text, title text, title_fr text, title_es text, description text, description_fr text, description_es text,
  type text, purpose text, price numeric, area numeric, land_area numeric, rooms int, bedrooms int, bathrooms int,
  floor int, floors int, year_built int, furnished boolean, features text[], neighborhood text, city text, address text,
  lat double precision, lng double precision, images text[], video_url text, status text, featured boolean,
  published boolean, views int, created_at timestamptz, updated_at timestamptz, seasonal boolean, season jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, p.ref, p.title, p.title_fr, p.title_es, p.description, p.description_fr, p.description_es,
         p.type, p.purpose, p.price, p.area, p.land_area, p.rooms, p.bedrooms, p.bathrooms,
         p.floor, p.floors, p.year_built, p.furnished, p.features, p.neighborhood, p.city, p.address,
         p.lat, p.lng, p.images, p.video_url, p.status, p.featured,
         p.published, p.views, p.created_at, p.updated_at, p.seasonal, p.season
  from public.re_properties p
  where p.published and p.status <> 'draft'
    and (p_ref is null or p.ref = p_ref or p.id::text = p_ref)
  order by p.featured desc, p.created_at desc
$$;
grant execute on function public.re_public_properties(text) to anon, authenticated;

-- What an owner sees through his private link: his properties and their activity
-- (counts only: never the names or phones of visitors, never private notes).
create or replace function public.re_owner_report(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_client public.re_clients;
  v_props jsonb;
begin
  if p_token is null then
    return null;
  end if;
  select * into v_client from public.re_clients where share_token = p_token;
  if not found then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'ref', p.ref,
      'title', p.title,
      'purpose', p.purpose,
      'type', p.type,
      'status', p.status,
      'published', p.published,
      'price', p.price,
      'image', p.images[1],
      'views', p.views,
      'created_at', p.created_at,
      'leads', (select count(*) from public.re_leads l where l.property_id = p.id),
      'visits_done', (select count(*) from public.re_appointments a where a.property_id = p.id and a.kind = 'visit' and a.status = 'done'),
      'visits_planned', (select count(*) from public.re_appointments a where a.property_id = p.id and a.kind = 'visit' and a.status = 'scheduled' and a.starts_at > now()),
      'last_visit', (select max(a.starts_at) from public.re_appointments a where a.property_id = p.id and a.kind = 'visit' and a.status = 'done'),
      'prices', (select coalesce(jsonb_agg(jsonb_build_object('price', h.new_price, 'at', h.created_at) order by h.created_at), '[]'::jsonb) from public.re_price_history h where h.property_id = p.id),
      'mandate', (select jsonb_build_object('kind', m.kind, 'start_date', m.start_date, 'end_date', m.end_date) from public.re_mandates m where m.property_id = p.id and m.status = 'active' order by m.start_date desc limit 1),
      'offers', (select count(*) from public.re_offers o where o.property_id = p.id and o.status <> 'withdrawn'),
      'feedback', (select jsonb_build_object(
          'hot', count(*) filter (where a.feedback_interest = 'hot'),
          'warm', count(*) filter (where a.feedback_interest = 'warm'),
          'cold', count(*) filter (where a.feedback_interest = 'cold'),
          'price_high', count(*) filter (where a.feedback_price = 'high'),
          'price_fair', count(*) filter (where a.feedback_price = 'fair'),
          'price_low', count(*) filter (where a.feedback_price = 'low'))
        from public.re_appointments a where a.property_id = p.id and a.kind = 'visit' and a.status = 'done')
    ) order by p.created_at desc), '[]'::jsonb)
  into v_props
  from public.re_properties p
  where p.owner_client_id = v_client.id;
  return jsonb_build_object(
    'name', split_part(v_client.full_name, ' ', 1),
    'lang', v_client.lang,
    'generated_at', now(),
    'properties', v_props
  );
end $$;
revoke execute on function public.re_owner_report(uuid) from public;
grant execute on function public.re_owner_report(uuid) to anon, authenticated;

create or replace function public.re_increment_views(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.re_properties set views = views + 1 where id = p_id and published;
$$;
grant execute on function public.re_increment_views(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.re_staff enable row level security;
alter table public.re_settings enable row level security;
alter table public.re_clients enable row level security;
alter table public.re_properties enable row level security;
alter table public.re_leads enable row level security;
alter table public.re_appointments enable row level security;
alter table public.re_tasks enable row level security;
alter table public.re_calls enable row level security;
alter table public.re_deals enable row level security;
alter table public.re_activity enable row level security;
alter table public.re_brokers enable row level security;
alter table public.re_private enable row level security;
alter table public.re_mandates enable row level security;
alter table public.re_documents enable row level security;
alter table public.re_price_history enable row level security;
alter table public.re_trash enable row level security;
alter table public.re_offers enable row level security;
alter table public.re_counters enable row level security;
alter table public.re_invoices enable row level security;
alter table public.re_payments enable row level security;
alter table public.re_expenses enable row level security;
alter table public.re_leases enable row level security;
alter table public.re_rent_payments enable row level security;
alter table public.re_bookings enable row level security;

-- seasonal stays: the whole team takes bookings; deleting one needs «delete» (it goes to the trash)
drop policy if exists re_bookings_select on public.re_bookings;
create policy re_bookings_select on public.re_bookings for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_bookings_insert on public.re_bookings;
create policy re_bookings_insert on public.re_bookings for insert to authenticated with check ((select public.re_is_staff()));
drop policy if exists re_bookings_update on public.re_bookings;
create policy re_bookings_update on public.re_bookings for update to authenticated using ((select public.re_is_staff())) with check ((select public.re_is_staff()));
drop policy if exists re_bookings_delete on public.re_bookings;
create policy re_bookings_delete on public.re_bookings for delete to authenticated using ((select public.re_can('delete')));

-- rentals: the whole team follows leases and records rents; deleting a lease needs «delete»;
-- a rent receipt is never deleted (it is cancelled)
drop policy if exists re_leases_select on public.re_leases;
create policy re_leases_select on public.re_leases for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_leases_insert on public.re_leases;
create policy re_leases_insert on public.re_leases for insert to authenticated with check ((select public.re_is_staff()));
drop policy if exists re_leases_update on public.re_leases;
create policy re_leases_update on public.re_leases for update to authenticated using ((select public.re_is_staff())) with check ((select public.re_is_staff()));
drop policy if exists re_leases_delete on public.re_leases;
create policy re_leases_delete on public.re_leases for delete to authenticated using ((select public.re_can('delete')));
drop policy if exists re_rent_payments_select on public.re_rent_payments;
create policy re_rent_payments_select on public.re_rent_payments for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_rent_payments_insert on public.re_rent_payments;
create policy re_rent_payments_insert on public.re_rent_payments for insert to authenticated with check ((select public.re_is_staff()));
drop policy if exists re_rent_payments_update on public.re_rent_payments;
create policy re_rent_payments_update on public.re_rent_payments for update to authenticated using ((select public.re_is_staff())) with check ((select public.re_is_staff()));

-- invoices and receipts: the «deals» permission; never deleted (an invoice is cancelled by a credit note).
-- re_counters has no policy: only the numbering trigger touches it.
do $$
declare t text;
begin
  foreach t in array array['re_invoices', 're_payments', 're_expenses'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select public.re_can(''deals'')))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select public.re_can(''deals'')))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using ((select public.re_can(''deals''))) with check ((select public.re_can(''deals'')))', t);
  end loop;
end $$;
-- expenses: deleting also needs «delete» (they go to the trash)
drop policy if exists re_expenses_delete on public.re_expenses;
create policy re_expenses_delete on public.re_expenses for delete to authenticated using ((select public.re_can('deals')) and (select public.re_can('delete')));
-- receipts of a stay: the whole team, like the stays; other receipts keep needing «deals»
drop policy if exists re_payments_select on public.re_payments;
create policy re_payments_select on public.re_payments for select to authenticated using ((select public.re_can('deals')) or (booking_id is not null and (select public.re_is_staff())));
drop policy if exists re_payments_insert on public.re_payments;
create policy re_payments_insert on public.re_payments for insert to authenticated with check ((select public.re_can('deals')) or (booking_id is not null and (select public.re_is_staff())));
drop policy if exists re_payments_update on public.re_payments;
create policy re_payments_update on public.re_payments for update to authenticated using ((select public.re_can('deals')) or (booking_id is not null and (select public.re_is_staff()))) with check ((select public.re_can('deals')) or (booking_id is not null and (select public.re_is_staff())));

-- offers: every member reads, records and updates them; deleting needs «delete»
drop policy if exists re_offers_select on public.re_offers;
create policy re_offers_select on public.re_offers for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_offers_insert on public.re_offers;
create policy re_offers_insert on public.re_offers for insert to authenticated with check ((select public.re_is_staff()));
drop policy if exists re_offers_update on public.re_offers;
create policy re_offers_update on public.re_offers for update to authenticated using ((select public.re_is_staff())) with check ((select public.re_is_staff()));
drop policy if exists re_offers_delete on public.re_offers;
create policy re_offers_delete on public.re_offers for delete to authenticated using ((select public.re_can('delete')));

-- trash: seen, restored and emptied by members with the «delete» permission; filled only by the trigger
drop policy if exists re_trash_select on public.re_trash;
create policy re_trash_select on public.re_trash for select to authenticated using ((select public.re_can('delete')));
drop policy if exists re_trash_delete on public.re_trash;
create policy re_trash_delete on public.re_trash for delete to authenticated using ((select public.re_can('delete')));

-- mandates: every member reads; adding / editing needs «properties»; deleting needs «delete»
drop policy if exists re_mandates_select on public.re_mandates;
create policy re_mandates_select on public.re_mandates for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_mandates_insert on public.re_mandates;
create policy re_mandates_insert on public.re_mandates for insert to authenticated with check ((select public.re_can('properties')));
drop policy if exists re_mandates_update on public.re_mandates;
create policy re_mandates_update on public.re_mandates for update to authenticated using ((select public.re_can('properties'))) with check ((select public.re_can('properties')));
drop policy if exists re_mandates_delete on public.re_mandates;
create policy re_mandates_delete on public.re_mandates for delete to authenticated using ((select public.re_can('delete')));

-- documents: members read and add; the uploader or the «delete» permission removes
drop policy if exists re_documents_select on public.re_documents;
create policy re_documents_select on public.re_documents for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_documents_insert on public.re_documents;
create policy re_documents_insert on public.re_documents for insert to authenticated with check ((select public.re_is_staff()));
drop policy if exists re_documents_update on public.re_documents;
create policy re_documents_update on public.re_documents for update to authenticated using ((select public.re_is_staff())) with check ((select public.re_is_staff()));
drop policy if exists re_documents_delete on public.re_documents;
create policy re_documents_delete on public.re_documents for delete to authenticated using ((select public.re_is_staff()) and (uploaded_by = (select auth.uid()) or (select public.re_can('delete'))));

-- price history: members read; only the trigger writes
drop policy if exists re_price_history_select on public.re_price_history;
create policy re_price_history_select on public.re_price_history for select to authenticated using ((select public.re_is_staff()));

-- partners: every member reads and adds them; deleting needs the «delete» permission
drop policy if exists re_brokers_select on public.re_brokers;
create policy re_brokers_select on public.re_brokers for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_brokers_insert on public.re_brokers;
create policy re_brokers_insert on public.re_brokers for insert to authenticated with check ((select public.re_is_staff()));
drop policy if exists re_brokers_update on public.re_brokers;
create policy re_brokers_update on public.re_brokers for update to authenticated using ((select public.re_is_staff())) with check ((select public.re_is_staff()));
drop policy if exists re_brokers_delete on public.re_brokers;
create policy re_brokers_delete on public.re_brokers for delete to authenticated using ((select public.re_can('delete')));

-- internal settings: the team reads, the «settings» permission writes
drop policy if exists re_private_select on public.re_private;
create policy re_private_select on public.re_private for select to authenticated using ((select public.re_is_staff()));
drop policy if exists re_private_insert on public.re_private;
create policy re_private_insert on public.re_private for insert to authenticated with check ((select public.re_can('settings')));
drop policy if exists re_private_update on public.re_private;
create policy re_private_update on public.re_private for update to authenticated using ((select public.re_can('settings'))) with check ((select public.re_can('settings')));

-- staff: everyone in the team sees the team; only admins change roles, permissions and activation.
-- Log-ins (e-mail + password) are created by the Edge Function «re-staff» (supabase/functions).
drop policy if exists re_staff_select on public.re_staff;
create policy re_staff_select on public.re_staff for select to authenticated using ((select public.re_is_staff()) or id = (select auth.uid()));
drop policy if exists re_staff_insert on public.re_staff;
create policy re_staff_insert on public.re_staff for insert to authenticated with check ((select public.re_is_admin()));
drop policy if exists re_staff_update on public.re_staff;
create policy re_staff_update on public.re_staff for update to authenticated using ((select public.re_is_admin())) with check ((select public.re_is_admin()));
drop policy if exists re_staff_delete on public.re_staff;
create policy re_staff_delete on public.re_staff for delete to authenticated using ((select public.re_is_admin()) and id <> (select auth.uid()));

-- settings: public read ; written by admins and members with the «settings» permission
drop policy if exists re_settings_read on public.re_settings;
create policy re_settings_read on public.re_settings for select to anon, authenticated using (true);
drop policy if exists re_settings_insert on public.re_settings;
create policy re_settings_insert on public.re_settings for insert to authenticated with check ((select public.re_can('settings')));
drop policy if exists re_settings_update on public.re_settings;
create policy re_settings_update on public.re_settings for update to authenticated using ((select public.re_can('settings'))) with check ((select public.re_can('settings')));

-- team tables: every active member reads and writes;
-- adding / editing properties needs the «properties» permission
do $$
declare t text; w text;
begin
  foreach t in array array['re_clients', 're_properties', 're_leads', 're_appointments', 're_tasks', 're_calls'] loop
    w := case when t = 're_properties' then '(select public.re_can(''properties''))' else '(select public.re_is_staff())' end;
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select public.re_is_staff()))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (%2$s)', t, w);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (%2$s) with check (%2$s)', t, w);
  end loop;
end $$;

-- deleting clients, properties and leads: the «delete» permission ; appointments, tasks, calls: any member
do $$
declare t text;
begin
  foreach t in array array['re_clients', 're_properties', 're_leads'] loop
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select public.re_can(''delete'')))', t);
  end loop;
  foreach t in array array['re_appointments', 're_tasks', 're_calls'] loop
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select public.re_is_staff()))', t);
  end loop;
end $$;

-- website visitors may only CREATE a new request (never read, never change)
drop policy if exists re_leads_public_insert on public.re_leads;
create policy re_leads_public_insert on public.re_leads for insert to anon, authenticated
  with check (status = 'new' and source = 'website' and assigned_to is null and client_id is null and notes is null);

-- deals & commissions: admins and members with the «deals» permission
drop policy if exists re_deals_admin on public.re_deals;
create policy re_deals_admin on public.re_deals for all to authenticated using ((select public.re_can('deals'))) with check ((select public.re_can('deals')));

-- activity log: members write their own entries ; admins and the «activity» permission read the log
drop policy if exists re_activity_insert on public.re_activity;
create policy re_activity_insert on public.re_activity for insert to authenticated with check ((select public.re_is_staff()) and actor = (select auth.uid()));
drop policy if exists re_activity_select on public.re_activity;
create policy re_activity_select on public.re_activity for select to authenticated using ((select public.re_can('activity')));

-- ---------------------------------------------------------------------
-- Phone notifications (web push). Each member turns them on per device in the
-- dashboard; a request sent from the website reaches every active member's
-- phone at once through the Edge Function «re-push» (supabase/functions/re-push).
-- The message is encrypted for the device: nobody in between can read it.
-- ---------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net is not available: phone notifications stay off';
end $$;

create table if not exists public.re_push_subs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.re_staff (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  device text check (device is null or char_length(device) <= 120),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists re_push_subs_staff_idx on public.re_push_subs (staff_id);
alter table public.re_push_subs enable row level security;
-- a member sees and removes his own devices; admins see the whole team's
drop policy if exists re_push_subs_select on public.re_push_subs;
create policy re_push_subs_select on public.re_push_subs for select to authenticated
  using (((select auth.uid()) = staff_id and (select public.re_is_staff())) or (select public.re_is_admin()));
drop policy if exists re_push_subs_delete on public.re_push_subs;
create policy re_push_subs_delete on public.re_push_subs for delete to authenticated
  using (((select auth.uid()) = staff_id and (select public.re_is_staff())) or (select public.re_is_admin()));

-- Keys of the service: written by the Edge Function, read by the trigger below.
-- No policy at all: neither visitors nor members can read it.
create table if not exists public.re_push_config (
  id int primary key default 1 check (id = 1),
  hook_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  vapid_public text,
  vapid_private jsonb,
  fn_url text,
  fn_key text,
  updated_at timestamptz not null default now()
);
alter table public.re_push_config enable row level security;
revoke all on public.re_push_config from anon, authenticated;
insert into public.re_push_config (id) values (1) on conflict (id) do nothing;

-- this device, for the signed-in member (a phone that changes hands follows its new user)
create or replace function public.re_push_register(p_endpoint text, p_p256dh text, p_auth text, p_device text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.re_is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  insert into public.re_push_subs (staff_id, endpoint, p256dh, auth, device)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_device, 120))
  on conflict (endpoint) do update
    set staff_id = excluded.staff_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device;
end $$;
revoke execute on function public.re_push_register(text, text, text, text) from public, anon;
grant execute on function public.re_push_register(text, text, text, text) to authenticated;

create or replace function public.re_push_unregister(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.re_push_subs where endpoint = p_endpoint and public.re_is_staff();
$$;
revoke execute on function public.re_push_unregister(text) from public, anon;
grant execute on function public.re_push_unregister(text) to authenticated;

-- A request from the website: ask the Edge Function to notify the team. The call leaves
-- after the request is saved (pg_net) and can never make the visitor's request fail.
create or replace function public.re_notify_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.re_push_config%rowtype;
begin
  if new.source is distinct from 'website' then
    return new;
  end if;
  select * into c from public.re_push_config where id = 1;
  if c.fn_url is null or c.fn_key is null or not exists (select 1 from public.re_push_subs) then
    return new;
  end if;
  begin
    perform net.http_post(
      url := c.fn_url,
      body := jsonb_build_object('action', 'lead', 'id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || c.fn_key, 'apikey', c.fn_key, 'x-hook-secret', c.hook_secret),
      timeout_milliseconds := 8000
    );
  exception when others then
    raise notice 're_notify_lead: %', sqlerrm;
  end;
  return new;
end $$;
revoke execute on function public.re_notify_lead() from public, anon, authenticated;
drop trigger if exists re_notify_lead on public.re_leads;
create trigger re_notify_lead after insert on public.re_leads for each row execute function public.re_notify_lead();

-- ---------------------------------------------------------------------
-- Photos: public bucket ; members with the «properties» permission upload / delete
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists re_images_insert on storage.objects;
create policy re_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'property-images' and (select public.re_can('properties')));
drop policy if exists re_images_update on storage.objects;
create policy re_images_update on storage.objects for update to authenticated using (bucket_id = 'property-images' and (select public.re_can('properties')));
drop policy if exists re_images_delete on storage.objects;
create policy re_images_delete on storage.objects for delete to authenticated using (bucket_id = 'property-images' and (select public.re_can('properties')));

-- Documents: PRIVATE bucket (never public); the team reads with short-lived signed links
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-docs', 'property-docs', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists re_docs_select on storage.objects;
create policy re_docs_select on storage.objects for select to authenticated using (bucket_id = 'property-docs' and (select public.re_is_staff()));
drop policy if exists re_docs_insert on storage.objects;
create policy re_docs_insert on storage.objects for insert to authenticated with check (bucket_id = 'property-docs' and (select public.re_is_staff()));
drop policy if exists re_docs_delete on storage.objects;
create policy re_docs_delete on storage.objects for delete to authenticated using (bucket_id = 'property-docs' and (select public.re_is_staff()) and (owner = (select auth.uid()) or (select public.re_can('delete'))));

-- ---------------------------------------------------------------------
-- Existing accounts need nothing more: on their first sign-in to /admin the app calls re_join().
-- To make an existing account admin by hand:
--   update public.re_staff set role = 'admin', active = true where email = 'OWNER_EMAIL@example.com';
-- ---------------------------------------------------------------------
