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
  kind text not null default 'inquiry' check (kind in ('inquiry', 'visit', 'sell', 'valuation', 'callback', 'contact')),
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

create or replace function public.re_public_properties(p_ref text default null)
returns table (
  id uuid, ref text, title text, title_fr text, title_es text, description text, description_fr text, description_es text,
  type text, purpose text, price numeric, area numeric, land_area numeric, rooms int, bedrooms int, bathrooms int,
  floor int, floors int, year_built int, furnished boolean, features text[], neighborhood text, city text, address text,
  lat double precision, lng double precision, images text[], video_url text, status text, featured boolean,
  published boolean, views int, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.ref, p.title, p.title_fr, p.title_es, p.description, p.description_fr, p.description_es,
         p.type, p.purpose, p.price, p.area, p.land_area, p.rooms, p.bedrooms, p.bathrooms,
         p.floor, p.floors, p.year_built, p.furnished, p.features, p.neighborhood, p.city, p.address,
         p.lat, p.lng, p.images, p.video_url, p.status, p.featured,
         p.published, p.views, p.created_at, p.updated_at
  from public.re_properties p
  where p.published and p.status <> 'draft'
    and (p_ref is null or p.ref = p_ref or p.id::text = p_ref)
  order by p.featured desc, p.created_at desc
$$;
grant execute on function public.re_public_properties(text) to anon, authenticated;

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

-- ---------------------------------------------------------------------
-- Existing accounts need nothing more: on their first sign-in to /admin the app calls re_join().
-- To make an existing account admin by hand:
--   update public.re_staff set role = 'admin', active = true where email = 'OWNER_EMAIL@example.com';
-- ---------------------------------------------------------------------
