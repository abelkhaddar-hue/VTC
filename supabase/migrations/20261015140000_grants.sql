-- PostGIS est installé dans le schéma « extensions » : on le rend visible pour ce fichier.
set search_path = public, extensions;

-- Accès explicites à l'API de données (les nouveaux projets Supabase ne les donnent plus par défaut).
-- Les règles RLS filtrent ensuite les lignes : un accès ici ne veut pas dire « tout voir ».

grant usage on schema public to anon, authenticated, service_role;

-- Lecture (filtrée par RLS)
grant select on cities, ride_types, profiles, admins, drivers, vehicles, ride_requests, offers, rides,
  ride_locations, messages, ratings, payments, receipts, emergency_contacts, share_links,
  support_tickets, support_messages, push_tokens
to authenticated;

-- Écritures directes autorisées (le reste passe par les fonctions SQL)
grant update (first_name, email, locale, city_id, photo_path) on profiles to authenticated;
grant insert on messages to authenticated;
grant insert, update, delete on emergency_contacts to authenticated;
grant insert on support_tickets, support_messages to authenticated;
grant insert, update, delete on push_tokens to authenticated;

-- Le visiteur sans compte (page de suivi partagée) ne lit aucune table : seulement shared_ride().
revoke all on all tables in schema public from anon;

-- Clé service : scripts d'administration et Edge Functions.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Sert aux Edge Functions quote et create-request : trouve la gamme et vérifie la zone desservie.
create or replace function quote_ride_type(p_code text,
  p_pickup_lng double precision, p_pickup_lat double precision,
  p_dropoff_lng double precision, p_dropoff_lat double precision)
returns uuid language plpgsql stable security definer set search_path = public, extensions as $$
declare v_city uuid; v_type uuid;
begin
  select id into v_city from cities
   where is_active and st_covers(service_area, st_setsrid(st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::geography)
   limit 1;
  if v_city is null then raise exception 'pickup_outside_service_area'; end if;
  if not exists (select 1 from cities where id = v_city
                 and st_covers(service_area, st_setsrid(st_makepoint(p_dropoff_lng, p_dropoff_lat), 4326)::geography)) then
    raise exception 'dropoff_outside_service_area';
  end if;
  select id into v_type from ride_types where city_id = v_city and code = p_code and is_active;
  if v_type is null then raise exception 'ride_type_unavailable'; end if;
  return v_type;
end $$;
revoke execute on function quote_ride_type(text, double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function quote_ride_type(text, double precision, double precision, double precision, double precision) to service_role;

-- La clé service (Edge Functions, scripts) peut appeler toutes les fonctions.
grant execute on all functions in schema public to service_role;
