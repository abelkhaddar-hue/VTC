import { ApiError } from './types'

// Codes métier (ceux des fonctions SQL et des Edge Functions) → phrases pour l'utilisateur.
const messages: Record<string, string> = {
  network: 'Connexion impossible. Vérifiez votre réseau.',
  not_configured: 'Le serveur n’est pas configuré (voir app/.env.example).',
  not_authenticated: 'Votre session a expiré. Reconnectez-vous.',
  forbidden: 'Action non autorisée.',
  invalid_input: 'Certaines informations sont invalides.',
  server_error: 'Une erreur est survenue. Réessayez.',
  invalid_phone: 'Ce numéro n’est pas un mobile marocain.',
  invalid_code: 'Code incorrect ou expiré.',
  sms_rate_limited: 'Attendez quelques secondes avant de redemander un code.',
  sms_failed: 'L’envoi du SMS a échoué. Réessayez dans un instant.',
  sms_disabled: 'La connexion par SMS n’est pas encore activée sur le serveur.',
  first_name_required: 'Indiquez votre prénom.',
  first_name_too_long: '60 caractères maximum.',
  name_required: 'Indiquez un nom.',
  too_many_contacts: '5 contacts maximum.',
  contact_exists: 'Ce numéro est déjà enregistré.',
  account_restricted: 'Votre compte est limité pour le moment.',
  pickup_outside_service_area: 'Ce départ est hors de la zone desservie.',
  dropoff_outside_service_area: 'Cette arrivée est hors de la zone desservie.',
  too_short: 'Le départ et l’arrivée sont trop proches.',
  ride_type_unavailable: 'Ce service n’est pas encore disponible ici.',
  too_many_passengers: 'Trop de passagers pour ce service.',
  payment_method_unavailable: 'Ce moyen de paiement n’est pas disponible dans cette ville.',
  fare_below_recommended: 'Ce prix est sous le minimum pour ce trajet.',
  ride_requests_one_searching: 'Vous avez déjà une demande en cours.',
  request_not_found: 'Demande introuvable.',
  request_not_raisable: 'Le nouveau prix doit être plus haut.',
  request_not_cancellable: 'Cette demande ne peut plus être annulée.',
  request_closed: 'Cette demande est déjà terminée.',
  offer_not_found: 'Cette offre n’est plus disponible.',
  offer_expired: 'Cette offre vient d’expirer.',
  offer_not_declinable: 'Cette offre n’est plus disponible.',
  driver_busy: 'Ce chauffeur vient de prendre une autre course.',
  ride_not_found: 'Course introuvable.',
  ride_not_cancellable: 'La course a déjà commencé.',
  reason_required: 'Dites-nous en quelques mots ce qui se passe.',
  ride_not_rateable: 'Cette course ne peut pas être notée.',
  rating_window_closed: 'Le délai pour noter cette course est passé.',
  ratings_ride_id_author_id_key: 'Vous avez déjà noté cette course.',
  ride_not_shareable: 'Le partage n’est possible que pendant la course.',
  chat_closed: 'La messagerie est fermée pour cette course.',
  message_required: 'Décrivez votre problème.',
  location_denied: 'Localisation refusée : choisissez votre départ à la main.',
}

export const messageFor = (code: string) => messages[code] ?? messages.server_error

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  const err = e as { message?: string; code?: string } | undefined
  const msg = err?.message ?? ''
  let code: string
  if (/ride_requests_one_searching/.test(msg)) code = 'ride_requests_one_searching'
  else if (/ratings_ride_id_author_id_key/.test(msg)) code = 'ratings_ride_id_author_id_key'
  else if (/emergency_contacts_user_id_phone_key/.test(msg)) code = 'contact_exists'
  else if (/row-level security|permission denied/i.test(msg) || err?.code === '42501') code = 'forbidden'
  else if (/fetch|network|timeout/i.test(msg)) code = 'network'
  else code = msg.match(/^[a-z_]+$/)?.[0] ?? msg.match(/^([a-z_]+)\b/)?.[1] ?? 'server_error'
  if (!(code in messages)) code = 'server_error'
  return new ApiError(code, messageFor(code))
}
