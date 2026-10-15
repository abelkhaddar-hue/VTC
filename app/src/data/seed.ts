import type { City, EmergencyContact, Place, RideSummary } from './types'

// Données de démonstration : Casablanca, lieux publics connus, chauffeurs fictifs.

export const casablanca: City = {
  id: 'casa',
  name: 'Casablanca',
  currency: 'MAD',
  paymentMethods: ['cash', 'card'],
  emergency: { police: '19', ambulance: '15' },
  rideTypes: [
    { code: 'economy', name: 'Course', seatsMax: 4, available: true },
    { code: 'comfort', name: 'Confort', seatsMax: 4, available: true },
    { code: 'xl', name: 'XL', seatsMax: 6, available: true },
    { code: 'moto', name: 'Moto', seatsMax: 1, available: false },
  ],
}

// Zone desservie (rectangle simplifié du Grand Casablanca).
export const serviceArea = { minLng: -7.75, maxLng: -7.45, minLat: 33.45, maxLat: 33.65 }

// Grille tarifaire, identique à ride_types dans schema.sql (centimes).
export const fares = {
  economy: { base: 700, perKm: 350, perMin: 50, min: 1500 },
  comfort: { base: 1000, perKm: 450, perMin: 60, min: 2200 },
  xl: { base: 1200, perKm: 500, perMin: 70, min: 2500 },
  moto: { base: 500, perKm: 250, perMin: 30, min: 1000 },
} as const

export const myPosition = { lng: -7.6322, lat: 33.5951 } // près de la place Mohammed V

export const places: Place[] = [
  { id: 'p1', name: 'Mosquée Hassan II', detail: 'Boulevard de la Corniche, Casablanca', point: { lng: -7.6327, lat: 33.6084 }, kind: 'landmark' },
  { id: 'p2', name: 'Morocco Mall', detail: 'Boulevard de l’Océan Atlantique, Aïn Diab', point: { lng: -7.7065, lat: 33.5765 }, kind: 'mall' },
  { id: 'p3', name: 'Gare Casa-Voyageurs', detail: 'Boulevard Ba Hmad, Casablanca', point: { lng: -7.5905, lat: 33.5891 }, kind: 'station' },
  { id: 'p4', name: 'Gare Casa-Port', detail: 'Boulevard des Almohades, Casablanca', point: { lng: -7.6136, lat: 33.6013 }, kind: 'station' },
  { id: 'p5', name: 'Place Mohammed V', detail: 'Centre-ville, Casablanca', point: { lng: -7.6186, lat: 33.5937 }, kind: 'landmark' },
  { id: 'p6', name: 'Marina Shopping Center', detail: 'Boulevard des Almohades, Casablanca', point: { lng: -7.6205, lat: 33.6052 }, kind: 'mall' },
  { id: 'p7', name: 'Anfa Place', detail: 'Boulevard de la Corniche, Aïn Diab', point: { lng: -7.6702, lat: 33.6007 }, kind: 'mall' },
  { id: 'p8', name: 'Parc de la Ligue Arabe', detail: 'Boulevard Moulay Youssef, Casablanca', point: { lng: -7.6292, lat: 33.5839 }, kind: 'landmark' },
  { id: 'p9', name: 'Twin Center', detail: 'Boulevard Zerktouni, Maârif', point: { lng: -7.6327, lat: 33.5862 }, kind: 'landmark' },
  { id: 'p10', name: 'Quartier des Habous', detail: 'Nouvelle Médina, Casablanca', point: { lng: -7.6047, lat: 33.5755 }, kind: 'landmark' },
  { id: 'p11', name: 'Casa Finance City', detail: 'Boulevard Al Qods, Hay Hassani', point: { lng: -7.6639, lat: 33.5502 }, kind: 'landmark' },
  { id: 'p12', name: 'Université Hassan II — Aïn Chock', detail: 'Route d’El Jadida, Casablanca', point: { lng: -7.6544, lat: 33.5458 }, kind: 'landmark' },
  { id: 'p13', name: 'Rue Tata, Maârif', detail: 'Maârif, Casablanca', point: { lng: -7.6375, lat: 33.5825 }, kind: 'street' },
  // Hors zone, pour l'état d'erreur « départ hors zone ».
  { id: 'p14', name: 'Aéroport Mohammed V', detail: 'Nouaceur — hors de la zone desservie', point: { lng: -7.5899, lat: 33.3675 }, kind: 'station' },
]

export const drivers = [
  { id: 'd1', firstName: 'Karim', rating: 4.9, rides: 312, vehicle: { make: 'Dacia', model: 'Logan', color: 'blanche', plate: '12345-A-6' } },
  { id: 'd2', firstName: 'Youssef', rating: 4.7, rides: 88, vehicle: { make: 'Hyundai', model: 'Accent', color: 'grise', plate: '6789-B-1' } },
  { id: 'd3', firstName: 'Salma', rating: null, rides: 2, vehicle: { make: 'Peugeot', model: '301', color: 'noire', plate: '4521-D-6' } },
  { id: 'd4', firstName: 'Hamza', rating: 4.8, rides: 1204, vehicle: { make: 'Toyota', model: 'Corolla', color: 'bleue', plate: '30981-H-6' } },
  { id: 'd5', firstName: 'Nadia', rating: 4.95, rides: 640, vehicle: { make: 'Kia', model: 'Picanto', color: 'rouge', plate: '7714-A-6' } },
] as const

export const seedHistory: RideSummary[] = [
  { id: 'h1', at: '2026-10-12T18:40:00Z', pickup: 'Twin Center', dropoff: 'Gare Casa-Voyageurs', fareCents: 3200, status: 'completed', driverName: 'Hamza', vehicle: 'Toyota Corolla bleue', payment: 'cash', distanceM: 5300, durationS: 1080, myStars: 5 },
  { id: 'h2', at: '2026-10-09T08:15:00Z', pickup: 'Place Mohammed V', dropoff: 'Casa Finance City', fareCents: 4500, status: 'completed', driverName: 'Nadia', vehicle: 'Kia Picanto rouge', payment: 'cash', distanceM: 7900, durationS: 1500, myStars: 4 },
  { id: 'h3', at: '2026-10-02T21:05:00Z', pickup: 'Anfa Place', dropoff: 'Quartier des Habous', fareCents: 3800, status: 'cancelled', driverName: 'Karim', vehicle: 'Dacia Logan blanche', payment: 'cash', distanceM: 7000, durationS: 1260 },
]

export const seedContacts: EmergencyContact[] = [
  { id: 'c1', name: 'Maman', phone: '+212612345678' },
]
