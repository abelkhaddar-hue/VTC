-- Ce dont l'app passager a besoin en plus de la migration initiale.
-- Chaque fonction ici correspond à une fonction de app/src/data/fake.ts (mêmes règles, mêmes erreurs).

-- ─────────────────────────── téléphone au format +212… ───────────────────────────

-- Supabase Auth stocke le numéro sans « + » : on le normalise dans le profil.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into profiles (id, phone, email)
  values (new.id,
          case when coalesce(new.phone, '') = '' then null
               when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end,
          nullif(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- ─────────────────────────── contacts d'urgence : 5 maximum ───────────────────────────

create or replace function emergency_contacts_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from emergency_contacts where user_id = new.user_id) >= 5 then
    raise exception 'too_many_contacts' using hint = '5 contacts maximum.';
  end if;
  return new;
end $$;
create trigger emergency_contacts_limit before insert on emergency_contacts
  for each row execute function emergency_contacts_limit();

-- ─────────────────────────── adresses : nom + précision ───────────────────────────

-- L'app affiche « Morocco Mall » puis « Boulevard de l'Océan… » : on garde les deux.
alter table ride_requests add column pickup_detail text not null default '';
alter table ride_requests add column dropoff_detail text not null default '';

drop function create_ride_request(uuid, uuid, double precision, double precision, text,
  double precision, double precision, text, integer, integer, text, integer, text, smallint, jsonb, text);

-- Appelée par l'Edge Function create-request (clé service), après calcul de l'itinéraire.
create or replace function create_ride_request(
  p_passenger uuid, p_ride_type uuid,
  p_pickup_lng double precision, p_pickup_lat double precision, p_pickup_address text, p_pickup_detail text,
  p_dropoff_lng double precision, p_dropoff_lat double precision, p_dropoff_address text, p_dropoff_detail text,
  p_distance_m integer, p_duration_s integer, p_route_polyline text,
  p_offered_fare_cents integer, p_payment_method text,
  p_passengers_count smallint default 1, p_options jsonb default '{}', p_comment text default null)
returns ride_requests language plpgsql security definer set search_path = public, extensions as $$
declare
  v_type ride_types; v_city cities; v_pickup geography; v_rec integer; v_row ride_requests; v_status text; v_until timestamptz;
begin
  select status, restricted_until into v_status, v_until from profiles where id = p_passenger;
  if v_status in ('blocked', 'deleted') or (v_status = 'restricted' and v_until > now()) then
    raise exception 'account_restricted';
  end if;
  select * into v_type from ride_types where id = p_ride_type and is_active;
  if not found then raise exception 'ride_type_unavailable'; end if;
  select * into v_city from cities where id = v_type.city_id and is_active;
  v_pickup := st_setsrid(st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::geography;
  if not st_covers(v_city.service_area, v_pickup) then raise exception 'pickup_outside_service_area'; end if;
  if not st_covers(v_city.service_area, st_setsrid(st_makepoint(p_dropoff_lng, p_dropoff_lat), 4326)::geography) then
    raise exception 'dropoff_outside_service_area';
  end if;
  if not (p_payment_method = any (v_city.payment_methods)) then raise exception 'payment_method_unavailable'; end if;
  if p_passengers_count > v_type.seats_max then raise exception 'too_many_passengers'; end if;
  v_rec := compute_recommended_fare(p_ride_type, p_distance_m, p_duration_s);
  if p_offered_fare_cents < v_rec then raise exception 'fare_below_recommended'; end if;

  insert into ride_requests (passenger_id, city_id, ride_type_id, pickup, pickup_address, pickup_detail,
    dropoff, dropoff_address, dropoff_detail, route_polyline, distance_m, duration_s, currency,
    recommended_fare_cents, offered_fare_cents, payment_method, passengers_count,
    options, comment, expires_at)
  values (p_passenger, v_city.id, p_ride_type, v_pickup, left(p_pickup_address, 200), left(coalesce(p_pickup_detail, ''), 200),
    st_setsrid(st_makepoint(p_dropoff_lng, p_dropoff_lat), 4326)::geography, left(p_dropoff_address, 200), left(coalesce(p_dropoff_detail, ''), 200),
    p_route_polyline, p_distance_m, p_duration_s, v_city.currency,
    v_rec, p_offered_fare_cents, p_payment_method, p_passengers_count,
    coalesce(p_options, '{}'), nullif(trim(p_comment), ''), now() + interval '10 minutes')
  returning * into v_row;
  return v_row;
end $$;

-- Lecture d'une demande par son passager, avec les coordonnées (S09).
create or replace function request_view(p_request uuid)
returns table (request_id uuid, status text, service text,
               pickup_name text, pickup_detail text, pickup_lng double precision, pickup_lat double precision,
               dropoff_name text, dropoff_detail text, dropoff_lng double precision, dropoff_lat double precision,
               distance_m integer, duration_s integer, route_polyline text, recommended_fare_cents integer,
               offered_fare_cents integer, payment_method text, options jsonb, passengers_count smallint, comment text,
               created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select q.id, q.status, t.code, q.pickup_address, q.pickup_detail, st_x(q.pickup::geometry), st_y(q.pickup::geometry),
         q.dropoff_address, q.dropoff_detail, st_x(q.dropoff::geometry), st_y(q.dropoff::geometry),
         q.distance_m, q.duration_s, q.route_polyline, q.recommended_fare_cents, q.offered_fare_cents,
         q.payment_method, q.options, q.passengers_count, q.comment, q.created_at, q.expires_at
  from ride_requests q join ride_types t on t.id = q.ride_type_id
  where q.id = p_request and q.passenger_id = auth.uid()
$$;

-- ─────────────────────────── vue d'une course, version complète ───────────────────────────

drop function ride_view(uuid);
create or replace function ride_view(p_ride uuid)
returns table (ride_id uuid, request_id uuid, status text, fare_cents integer, currency char(3), payment_method text,
               pickup_name text, pickup_detail text, pickup_lng double precision, pickup_lat double precision,
               dropoff_name text, dropoff_detail text, dropoff_lng double precision, dropoff_lat double precision,
               route_polyline text, distance_m integer, duration_s integer,
               accepted_at timestamptz, arrived_at timestamptz, started_at timestamptz, completed_at timestamptz,
               cancelled_at timestamptz, cancelled_by text, cancel_reason text,
               counterpart_id uuid, counterpart_first_name text, counterpart_photo_path text,
               counterpart_rating numeric, counterpart_rides integer,
               vehicle_make text, vehicle_model text, vehicle_color text, vehicle_plate text,
               driver_lng double precision, driver_lat double precision, driver_heading smallint, rated boolean)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.request_id, r.status, r.fare_cents, r.currency, r.payment_method,
         q.pickup_address, q.pickup_detail, st_x(q.pickup::geometry), st_y(q.pickup::geometry),
         q.dropoff_address, q.dropoff_detail, st_x(q.dropoff::geometry), st_y(q.dropoff::geometry),
         q.route_polyline, q.distance_m, q.duration_s,
         r.accepted_at, r.arrived_at, r.started_at, r.completed_at, r.cancelled_at, r.cancelled_by, r.cancel_reason,
         cp.id, cp.first_name, cp.photo_path, round(cp.rating_sum::numeric / nullif(cp.rating_count, 0), 2),
         (select count(*)::integer from rides x where x.driver_id = r.driver_id and x.status = 'completed'),
         v.make, v.model, v.color, v.plate,
         case when r.status in ('driver_en_route','driver_arrived','in_progress') then st_x(d.location::geometry) end,
         case when r.status in ('driver_en_route','driver_arrived','in_progress') then st_y(d.location::geometry) end,
         case when r.status in ('driver_en_route','driver_arrived','in_progress') then d.heading end,
         exists (select 1 from ratings g where g.ride_id = r.id and g.author_id = auth.uid())
  from rides r
  join ride_requests q on q.id = r.request_id
  join vehicles v on v.id = r.vehicle_id
  join drivers d on d.id = r.driver_id
  join profiles cp on cp.id = case when auth.uid() = r.passenger_id then r.driver_id else r.passenger_id end
  where r.id = p_ride and auth.uid() in (r.passenger_id, r.driver_id)
$$;

-- ─────────────────────────── historique, récents, reprise ───────────────────────────

-- S18 : courses terminées ou annulées du passager.
create or replace function my_rides(p_limit integer default 50)
returns table (ride_id uuid, at timestamptz, pickup text, dropoff text, fare_cents integer, status text,
               driver_name text, vehicle text, payment_method text, distance_m integer, duration_s integer, my_stars smallint)
language sql stable security definer set search_path = public, extensions as $$
  select r.id, r.accepted_at, q.pickup_address, q.dropoff_address, r.fare_cents, r.status,
         p.first_name, v.make || ' ' || v.model || ' ' || v.color, r.payment_method, q.distance_m, q.duration_s,
         (select g.stars from ratings g where g.ride_id = r.id and g.author_id = auth.uid())
  from rides r
  join ride_requests q on q.id = r.request_id
  join profiles p on p.id = r.driver_id
  join vehicles v on v.id = r.vehicle_id
  where r.passenger_id = auth.uid() and r.status in ('completed', 'cancelled')
  order by r.accepted_at desc
  limit least(greatest(p_limit, 1), 200)
$$;

-- S06 : dernières arrivées choisies (sans doublon).
create or replace function my_recent_places(p_limit integer default 4)
returns table (name text, detail text, lng double precision, lat double precision)
language sql stable security definer set search_path = public, extensions as $$
  select name, detail, lng, lat from (
    select distinct on (q.dropoff_address) q.dropoff_address as name, q.dropoff_detail as detail,
           st_x(q.dropoff::geometry) as lng, st_y(q.dropoff::geometry) as lat, q.created_at
    from ride_requests q where q.passenger_id = auth.uid()
    order by q.dropoff_address, q.created_at desc
  ) x order by created_at desc limit least(greatest(p_limit, 1), 10)
$$;

-- Au lancement : où reprendre (course en cours, course à noter, demande en recherche).
create or replace function my_active_state()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'rideId', (select id from rides where passenger_id = auth.uid()
               and status in ('driver_en_route','driver_arrived','in_progress') limit 1),
    'rideToRate', (select r.id from rides r where r.passenger_id = auth.uid() and r.status = 'completed'
                   and r.completed_at > now() - interval '7 days'
                   and not exists (select 1 from ratings g where g.ride_id = r.id and g.author_id = auth.uid())
                   order by r.completed_at desc limit 1),
    'requestId', (select id from ride_requests where passenger_id = auth.uid()
                  and status = 'searching' and expires_at > now() limit 1)))
$$;

-- ─────────────────────────── lien partagé : avec les points du trajet ───────────────────────────

drop function shared_ride(text);
create or replace function shared_ride(p_token text)
returns table (status text, driver_first_name text, vehicle_make text, vehicle_model text,
               vehicle_color text, vehicle_plate text, dropoff_address text,
               driver_lng double precision, driver_lat double precision, updated_at timestamptz,
               pickup_lng double precision, pickup_lat double precision,
               dropoff_lng double precision, dropoff_lat double precision)
language sql stable security definer set search_path = public, extensions as $$
  select r.status, p.first_name, v.make, v.model, v.color, v.plate, q.dropoff_address,
         case when r.status not in ('completed', 'cancelled') then st_x(d.location::geometry) end,
         case when r.status not in ('completed', 'cancelled') then st_y(d.location::geometry) end,
         d.location_updated_at,
         st_x(q.pickup::geometry), st_y(q.pickup::geometry), st_x(q.dropoff::geometry), st_y(q.dropoff::geometry)
  from share_links s
  join rides r on r.id = s.ride_id
  join ride_requests q on q.id = r.request_id
  join drivers d on d.id = r.driver_id
  join profiles p on p.id = r.driver_id
  join vehicles v on v.id = r.vehicle_id
  where s.token = p_token and s.revoked_at is null and s.expires_at > now()
    and (r.completed_at is null or r.completed_at > now() - interval '1 hour')
$$;

-- ─────────────────────────── position : un point toutes les 3 s ───────────────────────────

-- Le passager suit la voiture par les insertions dans ride_locations (temps réel filtré par RLS).
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
       where ride_id = v_ride and recorded_at > now() - interval '3 seconds') then
    insert into ride_locations (ride_id, location, heading)
    values (v_ride, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_heading);
  end if;
end $$;

-- Coordonnées lisibles pour l'app (la colonne geography n'est pas du JSON).
alter table ride_locations add column lng double precision generated always as (st_x(location::geometry)) stored;
alter table ride_locations add column lat double precision generated always as (st_y(location::geometry)) stored;

-- ─────────────────────────── droits ───────────────────────────

revoke execute on all functions in schema public from public, anon;
grant execute on function
  is_admin(), is_ride_party(uuid), compute_recommended_fare(uuid, integer, integer),
  raise_fare(uuid, integer), cancel_request(uuid), driver_nearby_requests(),
  driver_make_offer(uuid, integer, integer), request_offers(uuid), decline_offer(uuid),
  accept_offer(uuid), ride_view(uuid), request_view(uuid), driver_advance_ride(uuid, text),
  cancel_ride(uuid, text, text), rate_ride(uuid, smallint, text[], text),
  create_share_link(uuid), driver_update_location(double precision, double precision, smallint),
  driver_set_online(boolean), my_rides(integer), my_recent_places(integer), my_active_state()
to authenticated;
grant execute on function shared_ride(text) to anon, authenticated;
grant execute on function create_ride_request(uuid, uuid, double precision, double precision, text, text,
  double precision, double precision, text, text, integer, integer, text, integer, text, smallint, jsonb, text)
to service_role;
grant execute on function expire_stale() to service_role;

-- ─────────────────────────── temps réel ───────────────────────────

-- Les changements de ces tables sont diffusés, filtrés par les règles RLS de chaque abonné.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table offers, rides, ride_requests, messages, ride_locations, support_messages;
  end if;
end $$;

-- ─────────────────────────── tâches planifiées ───────────────────────────

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-stale', '* * * * *', 'select public.expire_stale()');
    perform cron.schedule('purge-locations', '15 3 * * *',
      $q$delete from public.ride_locations where recorded_at < now() - interval '90 days'$q$);
    perform cron.schedule('cleanup-share-links', '30 3 * * *',
      $q$delete from public.share_links where expires_at < now() - interval '7 days'$q$);
  end if;
end $$;
