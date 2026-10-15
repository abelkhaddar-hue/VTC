-- OUTIL DE DÉVELOPPEMENT — à n'installer QUE sur le projet de test, jamais en production.
-- Permet à scripts/simulate-drivers.mjs (clé service) d'agir « en tant que » un chauffeur de test,
-- en passant par les mêmes fonctions que la future app chauffeur (mêmes règles, mêmes contrôles).

create or replace function sim_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

create or replace function sim_driver_location(p_driver uuid, p_lng double precision, p_lat double precision, p_heading smallint default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform sim_as(p_driver);
  update drivers set is_online = true where id = p_driver and verification_status = 'approved';
  perform driver_update_location(p_lng, p_lat, p_heading);
end $$;

create or replace function sim_driver_offer(p_driver uuid, p_request uuid, p_fare_cents integer default null)
returns offers language plpgsql security definer set search_path = public, extensions as $$
begin
  perform sim_as(p_driver);
  return driver_make_offer(p_request, p_fare_cents);
end $$;

create or replace function sim_driver_advance(p_driver uuid, p_ride uuid, p_to text)
returns rides language plpgsql security definer set search_path = public, extensions as $$
begin
  perform sim_as(p_driver);
  return driver_advance_ride(p_ride, p_to);
end $$;

create or replace function sim_driver_message(p_driver uuid, p_ride uuid, p_body text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from rides where id = p_ride and driver_id = p_driver) then raise exception 'ride_not_found'; end if;
  insert into messages (ride_id, sender_id, body) values (p_ride, p_driver, p_body);
end $$;

revoke execute on function sim_as(uuid), sim_driver_location(uuid, double precision, double precision, smallint),
  sim_driver_offer(uuid, uuid, integer), sim_driver_advance(uuid, uuid, text), sim_driver_message(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function sim_driver_location(uuid, double precision, double precision, smallint),
  sim_driver_offer(uuid, uuid, integer), sim_driver_advance(uuid, uuid, text), sim_driver_message(uuid, uuid, text)
  to service_role;

-- Coordonnées et état d'une demande, lisibles par le simulateur (la colonne geography n'est pas du JSON).
create or replace function sim_request_info(p_request uuid)
returns table (status text, passenger_id uuid, pickup_lng double precision, pickup_lat double precision,
               dropoff_lng double precision, dropoff_lat double precision, offered_fare_cents integer, route_polyline text)
language sql stable security definer set search_path = public, extensions as $$
  select q.status, q.passenger_id, st_x(q.pickup::geometry), st_y(q.pickup::geometry),
         st_x(q.dropoff::geometry), st_y(q.dropoff::geometry), q.offered_fare_cents, q.route_polyline
  from ride_requests q where q.id = p_request
$$;
revoke execute on function sim_request_info(uuid) from public, anon, authenticated;
grant execute on function sim_request_info(uuid) to service_role;
