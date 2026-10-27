import { color, tokens } from '@/theme'

export type InputState = { focused?: boolean; error?: boolean; disabled?: boolean }

// Cadre commun à tous les champs, d'après Base Web (input) :
// fond gris clair au repos ; blanc + bordure noire 2 px au focus ; blanc + bordure rouge en erreur ; gris en désactivé.
// Écart voulu : au repos, Base met une bordure de la couleur du fond (invisible). On garde une bordure fine
// border-input (contraste ≥ 3:1) pour que le champ vide reste repérable (WCAG 1.4.11).
// `inset` compense l'épaisseur de bordure pour que le texte ne bouge pas quand elle passe de 1 à 2 px.
export function inputFrame({ focused, error, disabled }: InputState) {
  const strong = focused || error
  const borderWidth = strong ? 2 : 1
  return {
    style: {
      borderWidth,
      borderRadius: tokens.radius.md,
      borderColor: disabled ? color('disabled-bg') : error ? color('danger') : focused ? color('text') : color('border-input'),
      backgroundColor: disabled ? color('disabled-bg') : strong ? color('bg') : color('surface'),
    },
    inset: 2 - borderWidth,
  }
}
