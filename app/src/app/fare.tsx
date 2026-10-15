import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { account, rides, type PaymentMethod, type RideRequest } from '@/data/api'
import { draft } from '@/data/draft'
import { useAction } from '@/data/hooks'
import { formatMAD } from '@/theme'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner } from '@/ui/primitives'
import { FareInput, Keypad, PaymentPicker } from '@/ui/ride'

// S07 — Proposer son prix. Avec ?raise=<demande> : augmenter pendant la recherche (F03).
export default function Fare() {
  const { raise } = useLocalSearchParams<{ raise?: string }>()
  const d = draft.get()
  const [req, setReq] = useState<RideRequest>()
  const [cents, setCents] = useState<number | null>(raise ? null : d.offeredCents)
  const [pay, setPay] = useState<PaymentMethod>(d.payment)
  const [methods, setMethods] = useState<PaymentMethod[]>(['cash'])
  const raiseAction = useAction(rides.raiseFare)

  useEffect(() => {
    account.city().then((c) => setMethods(c.paymentMethods)).catch(() => {})
    if (raise) rides.request(raise).then((r) => { setReq(r); setCents(r.offeredCents + 500) }).catch(() => {})
  }, [raise])

  const minimum = raise ? (req ? req.offeredCents + 100 : Infinity) : d.quote?.recommendedCents ?? 0
  const recommended = raise ? req?.offeredCents ?? 0 : d.quote?.recommendedCents ?? 0

  const onKey = (k: string) => setCents((c) => {
    const mad = (c ?? 0) / 100
    if (k === 'del') { const n = Math.floor(mad / 10); return n ? n * 100 : null }
    if (k === '+5') return (mad + 5) * 100
    const n = mad * 10 + Number(k)
    return n > 9999 ? c : n * 100
  })

  if (!raise && !d.quote) {
    return <Screen title="Votre prix" close><Banner kind="warning" title="Choisissez d’abord votre arrivée" body="Le prix conseillé dépend du trajet." /></Screen>
  }

  const ok = cents != null && cents >= minimum
  return (
    <Screen title={raise ? 'Augmenter votre prix' : 'Votre prix'} close footer={
      <Button size="lg" label={raise ? `Proposer ${cents ? formatMAD(cents) : ''}` : 'Valider'} disabled={!ok} loading={raiseAction.busy}
        onPress={async () => {
          if (!cents) return
          if (raise) { if (await raiseAction.run(raise, cents)) router.back() }
          else { draft.set({ offeredCents: cents, payment: pay }); router.back() }
        }} />
    }>
      {raise ? <Text tone="muted" center>Actuellement {req ? formatMAD(req.offeredCents) : '…'}. Un prix plus haut intéresse plus de chauffeurs.</Text> : null}
      <FareInput cents={cents} recommendedCents={raise ? minimum : recommended} raising={!!raise} />
      {raiseAction.error ? <Banner kind="danger" title={raiseAction.error} /> : null}
      <Keypad onKey={onKey} />
      {!raise ? <PaymentPicker value={pay} onChange={setPay} available={methods} /> : null}
    </Screen>
  )
}
