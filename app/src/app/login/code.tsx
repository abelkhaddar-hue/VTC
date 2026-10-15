import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { account, auth, DEMO_CODE } from '@/data/api'
import { useAction } from '@/data/hooks'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner } from '@/ui/primitives'
import { CodeInput, formatMoroccanPhone } from '@/ui/forms'

// S03 — Code SMS. Vérifie tout seul quand les 6 chiffres sont saisis.
export default function Code() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(45)
  const verify = useAction(auth.verifyCode)
  const resend = useAction(auth.sendCode)

  useEffect(() => {
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const submit = async (c: string) => {
    const s = await verify.run(phone, c)
    if (!s) { setCode(''); return }
    const p = await account.profile()
    if (p.status === 'blocked') router.replace('/blocked')
    else if (s.isNew || !p.firstName) router.replace('/login/profile')
    else router.replace('/')
  }

  return (
    <Screen title="Code reçu par SMS" footer={
      <Button label={resendIn ? `Renvoyer le code (0:${String(resendIn).padStart(2, '0')})` : 'Renvoyer le code'} variant="ghost" disabled={resendIn > 0}
        loading={resend.busy} onPress={async () => { if (await resend.run(phone)) { setResendIn(45); verify.setError(undefined) } }} />
    }>
      <Text tone="muted">Envoyé au +212 {formatMoroccanPhone(phone).replace(/^0/, '')}.</Text>
      <Banner kind="info" title={`Version de démonstration : le code est ${DEMO_CODE}`} />
      <CodeInput value={code} error={verify.error}
        onChange={(v) => { setCode(v); verify.setError(undefined); if (v.length === 6) submit(v) }} />
      {verify.busy ? <Text tone="muted" center accessibilityLiveRegion="polite">Vérification…</Text> : null}
      <Text tone="accent" weight={600} accessibilityRole="button" onPress={() => router.back()}>Changer de numéro</Text>
    </Screen>
  )
}
