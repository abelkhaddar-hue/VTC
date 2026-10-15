// Dates affichées dans le fuseau du Maroc (attention : UTC+0 pendant le Ramadan, géré par Intl).
export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('fr-MA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })
