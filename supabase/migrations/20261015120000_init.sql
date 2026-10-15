-- Schéma v1 : course en ville côté passager (+ le minimum chauffeur).
-- Cible : Supabase (Postgres 15+, PostGIS, RLS). Première migration.
--
-- Règles :
--   * heures en timestamptz (UTC), affichage en Africa/Casablanca côté app
--   * argent en centimes (integer) + devise
--   * les clients LISENT les tables via RLS ; toute écriture qui change un statut
--     passe par une fonction SQL (security definer) ou une Edge Function.
--     Aucune policy insert/update directe sauf messages, contacts d'urgence,
--     jetons push et profil (colonnes limitées par trigger).

create extension if not exists postgis with schema extensions;

-- PostGIS est installé dans le schéma « extensions » : on le rend visible pour ce fichier.
set search_path = public, extensions;


-- ─────────────────────────── utilitaires ───────────────────────────

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────── référentiel ───────────────────────────

create table cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code char(2) not null default 'MA',
  currency char(3) not null default 'MAD',
  timezone text not null default 'Africa/Casablanca',
  service_area geography(MultiPolygon, 4326) not null,
  payment_methods text[] not null default '{cash}'
    check (payment_methods <@ array['cash','card','wallet']::text[]),
  emergency_numbers jsonb not null default '{}',     -- {"police":"19","ambulance":"15"}
  search_radius_m integer not null default 3000 check (search_radius_m between 500 and 20000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on cities using gist (service_area);
create trigger cities_updated before update on cities for each row execute function set_updated_at();

create table ride_types (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references cities(id) on delete cascade,
  code text not null check (code in ('economy','comfort','xl','moto')),
  name text not null,
  seats_max smallint not null check (seats_max between 1 and 8),
  base_fare_cents integer not null check (base_fare_cents >= 0),
  per_km_cents integer not null check (per_km_cents >= 0),
  per_min_cents integer not null check (per_min_cents >= 0),
  min_fare_cents integer not null check (min_fare_cents >= 0),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, code)
);
create index on ride_types (city_id, sort_order);
create trigger ride_types_updated before update on ride_types for each row execute function set_updated_at();

-- ─────────────────────────── comptes ───────────────────────────

-- 1 ligne par compte Supabase Auth. Le téléphone vient de auth.users (vérifié par SMS).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,                             -- null pour un compte admin par e-mail
  email text,
  first_name text not null default '' check (length(first_name) <= 60),
  photo_path text,                               -- bucket "avatars"
  locale text not null default 'fr' check (locale in ('fr','ar','en')),
  city_id uuid references cities(id) on delete set null,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  status text not null default 'active' check (status in ('active','restricted','blocked','deleted')),
  restricted_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profiles (city_id);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- Empêche un utilisateur de modifier lui-même sa note, son statut ou son téléphone.
create or replace function profiles_guard() returns trigger
language plpgsql as $$
begin
  -- appel direct depuis l'app (rôle authenticated) ; les fonctions security definer passent
  if current_user = 'authenticated' then
    new.id := old.id; new.phone := old.phone;
    new.rating_sum := old.rating_sum; new.rating_count := old.rating_count;
    new.status := old.status; new.restricted_until := old.restricted_until;
    new.deleted_at := old.deleted_at; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function profiles_guard();

create table admins (
  user_id uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

create table drivers (
  id uuid primary key references profiles(id) on delete cascade,
  city_id uuid not null references cities(id) on delete restrict,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','approved','rejected','suspended')),
  verified_at timestamptz,
  verified_by uuid references profiles(id) on delete set null,
  documents jsonb not null default '{}',          -- chemins dans le bucket privé "driver-docs"
  is_online boolean not null default false,
  location geography(Point, 4326),
  heading smallint check (heading between 0 and 359),
  location_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on drivers (city_id);
create index drivers_online_location on drivers using gist (location)
  where is_online and verification_status = 'approved';
create trigger drivers_updated before update on drivers for each row execute function set_updated_at();

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  make text not null,
  model text not null,
  color text not null,
  plate text not null,
  year smallint check (year between 1990 and 2100),
  ride_type_codes text[] not null default '{economy}'
    check (ride_type_codes <@ array['economy','comfort','xl','moto']::text[]),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vehicles (driver_id);
create unique index vehicles_plate_active on vehicles (upper(replace(plate, ' ', ''))) where is_active;
create unique index vehicles_one_active_per_driver on vehicles (driver_id) where is_active;
create trigger vehicles_updated before update on vehicles for each row execute function set_updated_at();

-- ─────────────────────────── demandes et offres ───────────────────────────

create table ride_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references profiles(id) on delete cascade,
  city_id uuid not null references cities(id) on delete restrict,
  ride_type_id uuid not null references ride_types(id) on delete restrict,
  pickup geography(Point, 4326) not null,
  pickup_address text not null,
  dropoff geography(Point, 4326) not null,
  dropoff_address text not null,
  route_polyline text,                            -- renvoyé par l'API Routes, pour l'affichage
  distance_m integer not null check (distance_m > 0),
  duration_s integer not null check (duration_s > 0),
  currency char(3) not null default 'MAD',
  recommended_fare_cents integer not null check (recommended_fare_cents > 0),
  offered_fare_cents integer not null,
  payment_method text not null check (payment_method in ('cash','card','wallet')),
  passengers_count smallint not null default 1 check (passengers_count between 1 and 8),
  options jsonb not null default '{}',            -- {"child_seat":true,"luggage":true,"pet":false}
  comment text check (length(comment) <= 280),
  status text not null default 'searching'
    check (status in ('searching','matched','cancelled','expired')),
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fare_at_least_recommended check (offered_fare_cents >= recommended_fare_cents)
);
create index on ride_requests (passenger_id, created_at desc);
create index on ride_requests (city_id);
create index on ride_requests (ride_type_id);
create index ride_requests_searching_pickup on ride_requests using gist (pickup) where status = 'searching';
create index ride_requests_searching_expiry on ride_requests (expires_at) where status = 'searching';
-- un passager n'a qu'une demande en recherche à la fois
create unique index ride_requests_one_searching on ride_requests (passenger_id) where status = 'searching';
create trigger ride_requests_updated before update on ride_requests for each row execute function set_updated_at();

create table offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references ride_requests(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete restrict,
  fare_cents integer not null check (fare_cents > 0),
  kind text not null check (kind in ('accept','counter')),
  eta_s integer not null check (eta_s >= 0),
  distance_m integer not null check (distance_m >= 0),
  status text not null default 'sent'
    check (status in ('sent','accepted','declined','expired','withdrawn')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on offers (request_id, status);
create index on offers (driver_id, created_at desc);
create index on offers (vehicle_id);
create index offers_sent_expiry on offers (expires_at) where status = 'sent';
-- un chauffeur n'a qu'une offre vivante par demande (une nouvelle remplace l'ancienne)
create unique index offers_one_live_per_driver on offers (request_id, driver_id) where status = 'sent';
create trigger offers_updated before update on offers for each row execute function set_updated_at();

-- ─────────────────────────── courses ───────────────────────────

create table rides (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references ride_requests(id) on delete restrict,
  offer_id uuid not null unique references offers(id) on delete restrict,
  passenger_id uuid not null references profiles(id) on delete restrict,
  driver_id uuid not null references drivers(id) on delete restrict,
  vehicle_id uuid not null references vehicles(id) on delete restrict,
  fare_cents integer not null check (fare_cents > 0),   -- figé à l'acceptation
  currency char(3) not null default 'MAD',
  payment_method text not null check (payment_method in ('cash','card','wallet')),
  status text not null default 'driver_en_route'
    check (status in ('driver_en_route','driver_arrived','in_progress','completed','cancelled')),
  accepted_at timestamptz not null default now(),
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('passenger','driver','system')),
  cancel_reason text check (cancel_reason in
    ('driver_late','driver_asked_cancel','wrong_vehicle','changed_mind','price_dispute',
     'passenger_no_show','passenger_unreachable','safety','other')),
  cancel_comment text check (length(cancel_comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cancel_fields check ((status = 'cancelled') = (cancelled_at is not null))
);
create index on rides (passenger_id, created_at desc);
create index on rides (driver_id, created_at desc);
create index on rides (vehicle_id);
-- un chauffeur et un passager n'ont qu'une course active à la fois
create unique index rides_one_active_driver on rides (driver_id)
  where status in ('driver_en_route','driver_arrived','in_progress');
create unique index rides_one_active_passenger on rides (passenger_id)
  where status in ('driver_en_route','driver_arrived','in_progress');
create trigger rides_updated before update on rides for each row execute function set_updated_at();

-- Trace GPS de la course (gros volume : identifiant bigint, purge à 90 jours).
-- La position en direct passe par Realtime Broadcast ; ici un point toutes les ~10 s.
create table ride_locations (
  id bigint generated always as identity primary key,
  ride_id uuid not null references rides(id) on delete cascade,
  location geography(Point, 4326) not null,
  heading smallint check (heading between 0 and 359),
  recorded_at timestamptz not null default now()
);
create index on ride_locations (ride_id, recorded_at);
create index on ride_locations (recorded_at);

create table messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on messages (ride_id, created_at);
create index on messages (sender_id);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  comment text check (length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ride_id, author_id),
  constraint not_self check (author_id <> target_id)
);
create index on ratings (target_id, created_at desc);
create index on ratings (author_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete restrict,
  payer_id uuid not null references profiles(id) on delete restrict,
  method text not null check (method in ('cash','card','wallet')),
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'MAD',
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','refunded','cash_declared')),
  provider text,                                  -- 'cmi', ... null pour les espèces
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on payments (ride_id);
create index on payments (payer_id, created_at desc);
create unique index payments_provider_ref on payments (provider, provider_ref) where provider_ref is not null;
create trigger payments_updated before update on payments for each row execute function set_updated_at();

create sequence receipt_number_seq;
create table receipts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references rides(id) on delete restrict,
  user_id uuid not null references profiles(id) on delete cascade,
  number bigint not null unique default nextval('receipt_number_seq'),
  pdf_path text,                                  -- bucket privé "receipts", généré à la demande
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on receipts (user_id);

-- ─────────────────────────── sécurité ───────────────────────────

create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phone)
);
create index on emergency_contacts (user_id);
create trigger emergency_contacts_updated before update on emergency_contacts for each row execute function set_updated_at();

create table share_links (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on share_links (ride_id);
create index on share_links (created_by);

-- ─────────────────────────── support ───────────────────────────

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ride_id uuid references rides(id) on delete set null,
  category text not null check (category in
    ('lost_item','price_dispute','safety','account','payment','app_problem','other')),
  status text not null default 'open' check (status in ('open','waiting_user','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on support_tickets (user_id, created_at desc);
create index on support_tickets (ride_id);
create index on support_tickets (status, created_at);
create trigger support_tickets_updated before update on support_tickets for each row execute function set_updated_at();

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  is_staff boolean not null default false,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on support_messages (ticket_id, created_at);
create index on support_messages (sender_id);

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android','ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on push_tokens (user_id);
create trigger push_tokens_updated before update on push_tokens for each row execute function set_updated_at();

-- ─────────────────────────── règles d'accès (RLS) ───────────────────────────

alter table cities enable row level security;
alter table ride_types enable row level security;
alter table profiles enable row level security;
alter table admins enable row level security;
alter table drivers enable row level security;
alter table vehicles enable row level security;
alter table ride_requests enable row level security;
alter table offers enable row level security;
alter table rides enable row level security;
alter table ride_locations enable row level security;
alter table messages enable row level security;
alter table ratings enable row level security;
alter table payments enable row level security;
alter table receipts enable row level security;
alter table emergency_contacts enable row level security;
alter table share_links enable row level security;
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table push_tokens enable row level security;

create or replace function is_ride_party(p_ride uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from rides r
                 where r.id = p_ride and auth.uid() in (r.passenger_id, r.driver_id))
$$;

create policy cities_read on cities for select to authenticated using (is_active);
create policy ride_types_read on ride_types for select to authenticated using (is_active);

create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy admins_read on admins for select to authenticated using (user_id = auth.uid());

create policy drivers_self_read on drivers for select to authenticated using (id = auth.uid() or is_admin());
create policy vehicles_self_read on vehicles for select to authenticated using (driver_id = auth.uid() or is_admin());

-- Le passager voit ses demandes. Le chauffeur voit les demandes proches via
-- la fonction driver_nearby_requests(), jamais la table entière.
create policy requests_passenger_read on ride_requests for select to authenticated
  using (passenger_id = auth.uid() or is_admin());

-- Offres : le passager voit celles reçues sur ses demandes, le chauffeur les siennes.
-- (Realtime "postgres_changes" respecte ces règles : sert de signal, puis l'app
--  appelle request_offers() pour avoir nom, photo, note, véhicule.)
create policy offers_read on offers for select to authenticated using (
  driver_id = auth.uid()
  or exists (select 1 from ride_requests q where q.id = request_id and q.passenger_id = auth.uid())
  or is_admin());

create policy rides_read on rides for select to authenticated
  using (auth.uid() in (passenger_id, driver_id) or is_admin());

create policy ride_locations_read on ride_locations for select to authenticated
  using (is_ride_party(ride_id) or is_admin());

create policy messages_read on messages for select to authenticated using (is_ride_party(ride_id));
create policy messages_send on messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from rides r where r.id = ride_id
              and auth.uid() in (r.passenger_id, r.driver_id)
              and r.status in ('driver_en_route','driver_arrived','in_progress')));

create policy ratings_read on ratings for select to authenticated using (author_id = auth.uid() or is_admin());
create policy payments_read on payments for select to authenticated using (payer_id = auth.uid() or is_admin());
create policy receipts_read on receipts for select to authenticated using (user_id = auth.uid());

create policy emergency_contacts_own on emergency_contacts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy share_links_read on share_links for select to authenticated using (created_by = auth.uid());

create policy tickets_read on support_tickets for select to authenticated using (user_id = auth.uid() or is_admin());
create policy tickets_create on support_tickets for insert to authenticated with check (
  user_id = auth.uid() and status = 'open'
  and (ride_id is null or is_ride_party(ride_id)));
create policy support_messages_read on support_messages for select to authenticated using (
  is_admin() or exists (select 1 from support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy support_messages_send on support_messages for insert to authenticated with check (
  sender_id = auth.uid() and not is_staff
  and exists (select 1 from support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));

create policy push_tokens_own on push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────── logique métier (fonctions) ───────────────────────────

-- Prix recommandé = max(minimum, base + km + minute), arrondi au dirham supérieur.
create or replace function compute_recommended_fare(p_ride_type uuid, p_distance_m integer, p_duration_s integer)
returns integer language sql stable set search_path = public, extensions as $$
  select (ceil(greatest(t.min_fare_cents,
                        t.base_fare_cents
                        + t.per_km_cents * p_distance_m / 1000.0
                        + t.per_min_cents * p_duration_s / 60.0) / 100.0) * 100)::integer
  from ride_types t where t.id = p_ride_type
$$;

create or replace function assert_active_user() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from profiles p where p.id = auth.uid()
             and (p.status in ('blocked','deleted')
                  or (p.status = 'restricted' and p.restricted_until > now()))) then
    raise exception 'account_restricted' using errcode = '42501';
  end if;
end $$;

-- Appelée par l'Edge Function create-request (clé service), après calcul de
-- l'itinéraire par l'API Routes. Le client ne peut pas l'appeler.
create or replace function create_ride_request(
  p_passenger uuid, p_ride_type uuid,
  p_pickup_lng double precision, p_pickup_lat double precision, p_pickup_address text,
  p_dropoff_lng double precision, p_dropoff_lat double precision, p_dropoff_address text,
  p_distance_m integer, p_duration_s integer, p_route_polyline text,
  p_offered_fare_cents integer, p_payment_method text,
  p_passengers_count smallint default 1, p_options jsonb default '{}', p_comment text default null)
returns ride_requests language plpgsql security definer set search_path = public, extensions as $$
declare
  v_type ride_types; v_city cities; v_pickup geography; v_rec integer; v_row ride_requests;
begin
  select * into v_type from ride_types where id = p_ride_type and is_active;
  if not found then raise exception 'ride_type_unavailable'; end if;
  select * into v_city from cities where id = v_type.city_id and is_active;
  v_pickup := st_setsrid(st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::geography;
  if not st_covers(v_city.service_area, v_pickup) then raise exception 'pickup_outside_service_area'; end if;
  if not (p_payment_method = any (v_city.payment_methods)) then raise exception 'payment_method_unavailable'; end if;
  if p_passengers_count > v_type.seats_max then raise exception 'too_many_passengers'; end if;
  v_rec := compute_recommended_fare(p_ride_type, p_distance_m, p_duration_s);
  if p_offered_fare_cents < v_rec then raise exception 'fare_below_recommended'; end if;

  insert into ride_requests (passenger_id, city_id, ride_type_id, pickup, pickup_address,
    dropoff, dropoff_address, route_polyline, distance_m, duration_s, currency,
    recommended_fare_cents, offered_fare_cents, payment_method, passengers_count,
    options, comment, expires_at)
  values (p_passenger, v_city.id, p_ride_type, v_pickup, p_pickup_address,
    st_setsrid(st_makepoint(p_dropoff_lng, p_dropoff_lat), 4326)::geography, p_dropoff_address,
    p_route_polyline, p_distance_m, p_duration_s, v_city.currency,
    v_rec, p_offered_fare_cents, p_payment_method, p_passengers_count,
    coalesce(p_options, '{}'), p_comment, now() + interval '10 minutes')
  returning * into v_row;
  return v_row;
end $$;

-- Le passager augmente son prix pendant la recherche (F03). Les offres
-- "accept" au prix d'avant restent valables ; la recherche est prolongée.
create or replace function raise_fare(p_request uuid, p_new_fare_cents integer)
returns ride_requests language plpgsql security definer set search_path = public, extensions as $$
declare v_row ride_requests;
begin
  perform assert_active_user();
  update ride_requests set offered_fare_cents = p_new_fare_cents,
         expires_at = greatest(expires_at, now() + interval '5 minutes')
   where id = p_request and passenger_id = auth.uid() and status = 'searching'
     and p_new_fare_cents > offered_fare_cents
  returning * into v_row;
  if not found then raise exception 'request_not_raisable'; end if;
  return v_row;
end $$;

create or replace function cancel_request(p_request uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update ride_requests set status = 'cancelled', cancelled_at = now()
   where id = p_request and passenger_id = auth.uid() and status = 'searching';
  if not found then raise exception 'request_not_cancellable'; end if;
  update offers set status = 'expired' where request_id = p_request and status = 'sent';
end $$;

-- Demandes visibles par un chauffeur en ligne, autour de lui.
create or replace function driver_nearby_requests()
returns table (request_id uuid, pickup_address text, dropoff_address text,
               distance_m integer, offered_fare_cents integer, currency char(3),
               payment_method text, passengers_count smallint, options jsonb, comment text,
               passenger_first_name text, passenger_rating numeric, distance_to_pickup_m integer,
               expires_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select q.id, q.pickup_address, q.dropoff_address, q.distance_m, q.offered_fare_cents, q.currency,
         q.payment_method, q.passengers_count, q.options, q.comment,
         p.first_name, round(p.rating_sum::numeric / nullif(p.rating_count, 0), 2),
         st_distance(q.pickup, d.location)::integer, q.expires_at
  from drivers d
  join cities c on c.id = d.city_id
  join vehicles v on v.driver_id = d.id and v.is_active
  join ride_requests q on q.status = 'searching' and q.expires_at > now()
                       and st_dwithin(q.pickup, d.location, c.search_radius_m)
  join ride_types t on t.id = q.ride_type_id and t.code = any (v.ride_type_codes)
  join profiles p on p.id = q.passenger_id
  where d.id = auth.uid() and d.is_online and d.verification_status = 'approved'
    and not exists (select 1 from rides r where r.driver_id = d.id
                    and r.status in ('driver_en_route','driver_arrived','in_progress'))
  order by st_distance(q.pickup, d.location)
  limit 30
$$;

-- Le chauffeur accepte le prix (p_fare_cents null) ou fait une contre-offre plus haute.
create or replace function driver_make_offer(p_request uuid, p_fare_cents integer default null, p_eta_s integer default null)
returns offers language plpgsql security definer set search_path = public, extensions as $$
declare v_driver drivers; v_vehicle vehicles; v_req ride_requests; v_fare integer; v_dist integer; v_row offers;
begin
  perform assert_active_user();
  select * into v_driver from drivers where id = auth.uid()
     and is_online and verification_status = 'approved';
  if not found then raise exception 'driver_not_available'; end if;
  select * into v_vehicle from vehicles where driver_id = v_driver.id and is_active;
  if not found then raise exception 'no_active_vehicle'; end if;
  select * into v_req from ride_requests where id = p_request
     and status = 'searching' and expires_at > now() for share;
  if not found then raise exception 'request_closed'; end if;
  if not exists (select 1 from ride_types t where t.id = v_req.ride_type_id
                 and t.code = any (v_vehicle.ride_type_codes)) then
    raise exception 'vehicle_not_eligible';
  end if;
  v_dist := st_distance(v_req.pickup, v_driver.location)::integer;
  if v_dist > (select search_radius_m from cities where id = v_req.city_id) then
    raise exception 'too_far';
  end if;
  v_fare := coalesce(p_fare_cents, v_req.offered_fare_cents);
  if v_fare < v_req.offered_fare_cents then raise exception 'counter_must_be_higher'; end if;

  -- une nouvelle offre remplace la précédente de ce chauffeur
  update offers set status = 'withdrawn'
   where request_id = p_request and driver_id = v_driver.id and status = 'sent';
  insert into offers (request_id, driver_id, vehicle_id, fare_cents, kind, eta_s, distance_m, expires_at)
  values (p_request, v_driver.id, v_vehicle.id, v_fare,
          case when v_fare = v_req.offered_fare_cents then 'accept' else 'counter' end,
          coalesce(p_eta_s, (v_dist / 6)::integer),   -- ~22 km/h en ville si l'app n'envoie rien
          v_dist, now() + interval '45 seconds')
  returning * into v_row;
  return v_row;
end $$;

-- Offres vivantes d'une demande, avec ce que le passager doit voir (S10).
create or replace function request_offers(p_request uuid)
returns table (offer_id uuid, fare_cents integer, kind text, eta_s integer, distance_m integer,
               expires_at timestamptz, driver_first_name text, driver_photo_path text,
               driver_rating numeric, driver_rides_count integer,
               vehicle_make text, vehicle_model text, vehicle_color text)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.fare_cents, o.kind, o.eta_s, o.distance_m, o.expires_at,
         p.first_name, p.photo_path, round(p.rating_sum::numeric / nullif(p.rating_count, 0), 2),
         (select count(*)::integer from rides r where r.driver_id = o.driver_id and r.status = 'completed'),
         v.make, v.model, v.color
  from offers o
  join ride_requests q on q.id = o.request_id
  join profiles p on p.id = o.driver_id
  join vehicles v on v.id = o.vehicle_id
  where o.request_id = p_request and q.passenger_id = auth.uid()
    and o.status = 'sent' and o.expires_at > now()
  order by o.fare_cents, o.eta_s
$$;

create or replace function decline_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update offers o set status = 'declined'
    from ride_requests q
   where o.id = p_offer and q.id = o.request_id and q.passenger_id = auth.uid() and o.status = 'sent';
  if not found then raise exception 'offer_not_declinable'; end if;
end $$;

-- Accepter une offre : tout ou rien. Le verrou sur la demande sérialise deux
-- acceptations simultanées ; l'unicité de rides.request_id est le filet de sécurité.
create or replace function accept_offer(p_offer uuid) returns rides
language plpgsql security definer set search_path = public, extensions as $$
declare v_offer offers; v_req ride_requests; v_ride rides;
begin
  perform assert_active_user();
  select * into v_offer from offers where id = p_offer;
  if not found then raise exception 'offer_not_found'; end if;
  select * into v_req from ride_requests where id = v_offer.request_id
     and passenger_id = auth.uid() for update;
  if not found then raise exception 'offer_not_found'; end if;
  if v_req.status <> 'searching' then raise exception 'request_closed'; end if;
  select * into v_offer from offers where id = p_offer for update;
  if v_offer.status <> 'sent' or v_offer.expires_at <= now() then raise exception 'offer_expired'; end if;
  if exists (select 1 from rides where driver_id = v_offer.driver_id
             and status in ('driver_en_route','driver_arrived','in_progress')) then
    raise exception 'driver_busy';
  end if;

  update offers set status = 'accepted' where id = p_offer;
  update offers set status = 'expired' where request_id = v_req.id and id <> p_offer and status = 'sent';
  -- le chauffeur retenu retire ses offres sur les autres demandes
  update offers set status = 'withdrawn' where driver_id = v_offer.driver_id and id <> p_offer and status = 'sent';
  update ride_requests set status = 'matched' where id = v_req.id;

  insert into rides (request_id, offer_id, passenger_id, driver_id, vehicle_id, fare_cents, currency, payment_method)
  values (v_req.id, p_offer, v_req.passenger_id, v_offer.driver_id, v_offer.vehicle_id,
          v_offer.fare_cents, v_req.currency, v_req.payment_method)
  returning * into v_ride;
  return v_ride;
end $$;

-- Vue d'une course pour l'un des deux participants (S11, S14, S18).
create or replace function ride_view(p_ride uuid)
returns table (ride_id uuid, status text, fare_cents integer, currency char(3), payment_method text,
               pickup_address text, dropoff_address text, pickup_lng double precision, pickup_lat double precision,
               dropoff_lng double precision, dropoff_lat double precision, route_polyline text,
               accepted_at timestamptz, started_at timestamptz, completed_at timestamptz,
               counterpart_id uuid, counterpart_first_name text, counterpart_photo_path text, counterpart_rating numeric,
               vehicle_make text, vehicle_model text, vehicle_color text, vehicle_plate text,
               driver_lng double precision, driver_lat double precision, driver_heading smallint)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.status, r.fare_cents, r.currency, r.payment_method,
         q.pickup_address, q.dropoff_address,
         st_x(q.pickup::geometry), st_y(q.pickup::geometry), st_x(q.dropoff::geometry), st_y(q.dropoff::geometry),
         q.route_polyline, r.accepted_at, r.started_at, r.completed_at,
         cp.id, cp.first_name, cp.photo_path, round(cp.rating_sum::numeric / nullif(cp.rating_count, 0), 2),
         v.make, v.model, v.color, v.plate,
         case when r.status in ('driver_en_route','driver_arrived','in_progress') then st_x(d.location::geometry) end,
         case when r.status in ('driver_en_route','driver_arrived','in_progress') then st_y(d.location::geometry) end,
         case when r.status in ('driver_en_route','driver_arrived','in_progress') then d.heading end
  from rides r
  join ride_requests q on q.id = r.request_id
  join vehicles v on v.id = r.vehicle_id
  join drivers d on d.id = r.driver_id
  join profiles cp on cp.id = case when auth.uid() = r.passenger_id then r.driver_id else r.passenger_id end
  where r.id = p_ride and auth.uid() in (r.passenger_id, r.driver_id)
$$;

-- Le chauffeur fait avancer la course. Transitions autorisées uniquement.
create or replace function driver_advance_ride(p_ride uuid, p_to text) returns rides
language plpgsql security definer set search_path = public, extensions as $$
declare v_ride rides;
begin
  select * into v_ride from rides where id = p_ride and driver_id = auth.uid() for update;
  if not found then raise exception 'ride_not_found'; end if;
  if (v_ride.status, p_to) not in (('driver_en_route','driver_arrived'),
                                   ('driver_arrived','in_progress'),
                                   ('in_progress','completed')) then
    raise exception 'invalid_transition % -> %', v_ride.status, p_to;
  end if;
  update rides set status = p_to,
         arrived_at   = case when p_to = 'driver_arrived' then now() else arrived_at end,
         started_at   = case when p_to = 'in_progress'    then now() else started_at end,
         completed_at = case when p_to = 'completed'      then now() else completed_at end
   where id = p_ride returning * into v_ride;
  if p_to = 'completed' and v_ride.payment_method = 'cash' then
    insert into payments (ride_id, payer_id, method, amount_cents, currency, status)
    values (v_ride.id, v_ride.passenger_id, 'cash', v_ride.fare_cents, v_ride.currency, 'cash_declared');
  end if;
  return v_ride;
end $$;

-- Annulation par le passager ou le chauffeur (F04). Après acceptation, motif obligatoire ;
-- plus de 3 annulations passager en 24 h => restriction 2 h (règle à ajuster).
create or replace function cancel_ride(p_ride uuid, p_reason text, p_comment text default null) returns rides
language plpgsql security definer set search_path = public, extensions as $$
declare v_ride rides; v_by text; v_count integer;
begin
  select * into v_ride from rides where id = p_ride
     and auth.uid() in (passenger_id, driver_id) for update;
  if not found then raise exception 'ride_not_found'; end if;
  if v_ride.status not in ('driver_en_route','driver_arrived') then raise exception 'ride_not_cancellable'; end if;
  if p_reason is null then raise exception 'reason_required'; end if;
  v_by := case when auth.uid() = v_ride.passenger_id then 'passenger' else 'driver' end;
  update rides set status = 'cancelled', cancelled_at = now(), cancelled_by = v_by,
         cancel_reason = p_reason, cancel_comment = p_comment
   where id = p_ride returning * into v_ride;
  if v_by = 'passenger' then
    select count(*) into v_count from rides
     where passenger_id = v_ride.passenger_id and cancelled_by = 'passenger'
       and cancelled_at > now() - interval '24 hours';
    if v_count > 3 then
      update profiles set status = 'restricted', restricted_until = now() + interval '2 hours'
       where id = v_ride.passenger_id and status = 'active';
    end if;
  end if;
  return v_ride;
end $$;

-- Note de fin de course (S15). Met à jour la moyenne de la personne notée.
create or replace function rate_ride(p_ride uuid, p_stars smallint, p_tags text[] default '{}', p_comment text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_ride rides; v_target uuid;
begin
  select * into v_ride from rides where id = p_ride and status = 'completed'
     and auth.uid() in (passenger_id, driver_id);
  if not found then raise exception 'ride_not_rateable'; end if;
  if v_ride.completed_at < now() - interval '7 days' then raise exception 'rating_window_closed'; end if;
  v_target := case when auth.uid() = v_ride.passenger_id then v_ride.driver_id else v_ride.passenger_id end;
  insert into ratings (ride_id, author_id, target_id, stars, tags, comment)
  values (p_ride, auth.uid(), v_target, p_stars, coalesce(p_tags, '{}'), p_comment);
  update profiles set rating_sum = rating_sum + p_stars, rating_count = rating_count + 1
   where id = v_target;
end $$;

-- Lien de suivi pour un proche (S13 -> S21). Valable jusqu'à 1 h après la fin.
create or replace function create_share_link(p_ride uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not exists (select 1 from rides where id = p_ride and passenger_id = auth.uid()
                 and status in ('driver_en_route','driver_arrived','in_progress')) then
    raise exception 'ride_not_shareable';
  end if;
  insert into share_links (ride_id, created_by, expires_at)
  values (p_ride, auth.uid(), now() + interval '6 hours')
  returning token into v_token;
  return v_token;
end $$;

-- Lecture publique d'un lien partagé (page web S21, sans compte).
create or replace function shared_ride(p_token text)
returns table (status text, driver_first_name text, vehicle_make text, vehicle_model text,
               vehicle_color text, vehicle_plate text, dropoff_address text,
               driver_lng double precision, driver_lat double precision, updated_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select r.status, p.first_name, v.make, v.model, v.color, v.plate, q.dropoff_address,
         case when r.status <> 'completed' and r.status <> 'cancelled' then st_x(d.location::geometry) end,
         case when r.status <> 'completed' and r.status <> 'cancelled' then st_y(d.location::geometry) end,
         d.location_updated_at
  from share_links s
  join rides r on r.id = s.ride_id
  join ride_requests q on q.id = r.request_id
  join drivers d on d.id = r.driver_id
  join profiles p on p.id = r.driver_id
  join vehicles v on v.id = r.vehicle_id
  where s.token = p_token and s.revoked_at is null and s.expires_at > now()
    and (r.completed_at is null or r.completed_at > now() - interval '1 hour')
$$;

-- Position du chauffeur (appelée toutes les ~5 s par l'app chauffeur).
create or replace function driver_update_location(p_lng double precision, p_lat double precision, p_heading smallint default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_ride uuid;
begin
  update drivers set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         heading = p_heading, location_updated_at = now()
   where id = auth.uid() and verification_status = 'approved';
  if not found then raise exception 'driver_not_found'; end if;
  select id into v_ride from rides where driver_id = auth.uid()
     and status in ('driver_en_route','driver_arrived','in_progress');
  if v_ride is not null and not exists (select 1 from ride_locations
       where ride_id = v_ride and recorded_at > now() - interval '10 seconds') then
    insert into ride_locations (ride_id, location, heading)
    values (v_ride, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_heading);
  end if;
end $$;

create or replace function driver_set_online(p_online boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_active_user();
  update drivers set is_online = p_online
   where id = auth.uid() and verification_status = 'approved';
  if not found then raise exception 'driver_not_approved'; end if;
end $$;

-- Tâche planifiée (pg_cron, chaque minute) : ferme ce qui a expiré.
create or replace function expire_stale() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update offers set status = 'expired' where status = 'sent' and expires_at <= now();
  update ride_requests set status = 'expired' where status = 'searching' and expires_at <= now();
  update drivers set is_online = false
   where is_online and location_updated_at < now() - interval '2 minutes';
end $$;

-- Crée le profil à l'inscription (déclencheur sur auth.users).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into profiles (id, phone, email) values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────── droits d'exécution ───────────────────────────

revoke execute on all functions in schema public from public, anon;
grant execute on function
  is_admin(), is_ride_party(uuid), compute_recommended_fare(uuid, integer, integer),
  raise_fare(uuid, integer), cancel_request(uuid), driver_nearby_requests(),
  driver_make_offer(uuid, integer, integer), request_offers(uuid), decline_offer(uuid),
  accept_offer(uuid), ride_view(uuid), driver_advance_ride(uuid, text),
  cancel_ride(uuid, text, text), rate_ride(uuid, smallint, text[], text),
  create_share_link(uuid), driver_update_location(double precision, double precision, smallint),
  driver_set_online(boolean)
to authenticated;
grant execute on function shared_ride(text) to anon, authenticated;
-- create_ride_request, expire_stale, handle_new_user : service_role uniquement.
grant execute on function create_ride_request(uuid, uuid, double precision, double precision, text,
  double precision, double precision, text, integer, integer, text, integer, text, smallint, jsonb, text)
to service_role;
grant execute on function expire_stale() to service_role;

-- Temps réel : diffuser les changements de ces tables (filtrés par RLS)
-- alter publication supabase_realtime add table offers, rides, ride_requests, messages;

-- Planification (Supabase : extension pg_cron activée dans le tableau de bord)
-- select cron.schedule('expire-stale', '* * * * *', 'select public.expire_stale()');
-- select cron.schedule('purge-locations', '15 3 * * *',
--   $$delete from public.ride_locations where recorded_at < now() - interval '90 days'$$);
