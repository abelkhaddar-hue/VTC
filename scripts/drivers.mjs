// Chauffeurs de test (fictifs). Numéros dans une plage de test, jamais de vraies personnes.
export const testDrivers = [
  { phone: '+212700000001', firstName: 'Karim', ratingSum: 1529, ratingCount: 312, vehicle: { make: 'Dacia', model: 'Logan', color: 'blanche', plate: '12345-A-6' } },
  { phone: '+212700000002', firstName: 'Youssef', ratingSum: 414, ratingCount: 88, vehicle: { make: 'Hyundai', model: 'Accent', color: 'grise', plate: '6789-B-1' } },
  { phone: '+212700000003', firstName: 'Salma', ratingSum: 0, ratingCount: 0, vehicle: { make: 'Peugeot', model: '301', color: 'noire', plate: '4521-D-6' } },
  { phone: '+212700000004', firstName: 'Hamza', ratingSum: 5779, ratingCount: 1204, vehicle: { make: 'Toyota', model: 'Corolla', color: 'bleue', plate: '30981-H-6' } },
  { phone: '+212700000005', firstName: 'Nadia', ratingSum: 3168, ratingCount: 640, vehicle: { make: 'Kia', model: 'Picanto', color: 'rouge', plate: '7714-A-6' } },
]
export const CASABLANCA = '00000000-0000-0000-0000-00000000ca5a'

export function env() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Il manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans scripts/.env (voir .env.example).')
    process.exit(1)
  }
  return { url, key }
}
