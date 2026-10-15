-- Données de départ : Casablanca et ses gammes. Mêmes valeurs que app/src/data/seed.ts.
insert into cities (id, name, country_code, currency, timezone, service_area, payment_methods, emergency_numbers, search_radius_m)
values ('00000000-0000-0000-0000-00000000ca5a', 'Casablanca', 'MA', 'MAD', 'Africa/Casablanca',
        st_multi(st_makeenvelope(-7.75, 33.45, -7.45, 33.65, 4326))::geography,
        '{cash,card}', '{"police":"19","ambulance":"15"}', 3000)
on conflict (id) do nothing;

insert into ride_types (city_id, code, name, seats_max, base_fare_cents, per_km_cents, per_min_cents, min_fare_cents, sort_order, is_active)
values
  ('00000000-0000-0000-0000-00000000ca5a', 'economy', 'Course', 4, 700, 350, 50, 1500, 1, true),
  ('00000000-0000-0000-0000-00000000ca5a', 'comfort', 'Confort', 4, 1000, 450, 60, 2200, 2, true),
  ('00000000-0000-0000-0000-00000000ca5a', 'xl', 'XL', 6, 1200, 500, 70, 2500, 3, true),
  ('00000000-0000-0000-0000-00000000ca5a', 'moto', 'Moto', 1, 500, 250, 30, 1000, 4, false)
on conflict (city_id, code) do nothing;
