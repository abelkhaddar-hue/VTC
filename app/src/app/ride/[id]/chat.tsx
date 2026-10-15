import { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { rides, type Message, type RideView } from '@/data/api'
import { useLoad } from '@/data/hooks'
import { Screen } from '@/ui/layout'
import { Banner } from '@/ui/primitives'
import { ChatBubble, Composer } from '@/ui/forms'
import { Skeleton } from '@/ui/layout'

// S12 — Messagerie avec le chauffeur, sans échanger de numéros.
export default function Chat() {
  const { id, call } = useLocalSearchParams<{ id: string; call?: string }>()
  const ride = useLoad<RideView>(() => rides.ride(id), [id], (set) => rides.onRide(id, set))
  const msgs = useLoad<Message[]>(() => rides.messages(id), [id], (set) => rides.onMessages(id, set))
  const [failed, setFailed] = useState<{ text: string }[]>([])
  const [error, setError] = useState<string>()
  const scroll = useRef<ScrollView>(null)
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50) }, [msgs.data?.length, failed.length])

  const open = ride.data && ['driver_en_route', 'driver_arrived', 'in_progress'].includes(ride.data.status)
  const send = async (text: string) => {
    setError(undefined)
    try { await rides.sendMessage(id, text) }
    catch (e) { setFailed((f) => [...f, { text }]); setError(e instanceof Error ? e.message : undefined) }
  }

  return (
    <Screen title={ride.data ? ride.data.driver.firstName : 'Messages'} scroll={false}
      footer={open ? <Composer onSend={send} /> : <Banner kind="info" title="La messagerie est fermée" body="Elle reste ouverte jusqu’à la fin de la course." />}>
      {call ? <Banner kind="info" title="Appel masqué bientôt disponible" body="En attendant, écrivez au chauffeur : votre numéro n’est jamais partagé." /> : null}
      {error ? <Banner kind="danger" title={error} /> : null}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        {msgs.loading && !msgs.data ? <View style={{ gap: 8 }}><Skeleton height={44} /><Skeleton height={44} /></View> : null}
        {(msgs.data ?? []).map((m) => <ChatBubble key={m.id} from={m.from === 'driver' ? 'them' : m.from} text={m.text} status={m.status === 'sent' ? undefined : m.status} />)}
        {failed.map((m, i) => <ChatBubble key={`f${i}`} from="me" text={m.text} status="failed" />)}
      </ScrollView>
    </Screen>
  )
}
