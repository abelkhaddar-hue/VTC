-- Nombre d'avis du chauffeur, pour le badge « Nouveau » (moins de 5 avis) : jusqu'ici l'app
-- comptait les courses terminées, ce qui affichait « Nouveau » pour un chauffeur noté 312 fois.
set search_path = public, extensions;

drop function request_offers(uuid);
create or replace function request_offers(p_request uuid)
returns table (offer_id uuid, fare_cents integer, kind text, eta_s integer, distance_m integer,
               expires_at timestamptz, driver_first_name text, driver_photo_path text,
               driver_rating numeric, driver_rides_count integer, driver_rating_count integer,
               vehicle_make text, vehicle_model text, vehicle_color text)
language sql stable security definer set search_path = public, extensions as $$
  select o.id, o.fare_cents, o.kind, o.eta_s, o.distance_m, o.expires_at,
         p.first_name, p.photo_path, round(p.rating_sum::numeric / nullif(p.rating_count, 0), 2),
         (select count(*)::integer from rides r where r.driver_id = o.driver_id and r.status = 'completed'),
         p.rating_count,
         v.make, v.model, v.color
  from offers o
  join ride_requests q on q.id = o.request_id
  join profiles p on p.id = o.driver_id
  join vehicles v on v.id = o.vehicle_id
  where o.request_id = p_request and q.passenger_id = auth.uid()
    and o.status = 'sent' and o.expires_at > now()
  order by o.fare_cents, o.eta_s
$$;

drop function ride_view(uuid);
create or replace function ride_view(p_ride uuid)
returns table (ride_id uuid, request_id uuid, status text, fare_cents integer, currency char(3), payment_method text,
               pickup_name text, pickup_detail text, pickup_lng double precision, pickup_lat double precision,
               dropoff_name text, dropoff_detail text, dropoff_lng double precision, dropoff_lat double precision,
               route_polyline text, distance_m integer, duration_s integer,
               accepted_at timestamptz, arrived_at timestamptz, started_at timestamptz, completed_at timestamptz,
               cancelled_at timestamptz, cancelled_by text, cancel_reason text,
               counterpart_id uuid, counterpart_first_name text, counterpart_photo_path text,
               counterpart_rating numeric, counterpart_rides integer, counterpart_rating_count integer,
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
         cp.rating_count,
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

revoke execute on function request_offers(uuid), ride_view(uuid) from public, anon;
grant execute on function request_offers(uuid), ride_view(uuid) to authenticated, service_role;
