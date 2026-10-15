import { useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { support, type SupportTicket } from '@/data/api'
import { useAction, useLoad } from '@/data/hooks'
import { Screen } from '@/ui/layout'
import { Text } from '@/ui/Text'
import { Button } from '@/ui/Button'
import { Banner, Card } from '@/ui/primitives'
import { ChatBubble, ChoiceList } from '@/ui/forms'
import { Field } from '@/ui/Field'
import { formatWhen } from '@/ui/format'

type Category = SupportTicket['category']
const categories: { value: Category; label: string }[] = [
  { value: 'lost_item', label: 'J’ai oublié un objet dans la voiture' },
  { value: 'price_dispute', label: 'On m’a demandé un autre prix' },
  { value: 'safety', label: 'Un problème de sécurité' },
  { value: 'payment', label: 'Paiement ou reçu' },
  { value: 'account', label: 'Mon compte' },
  { value: 'app_problem', label: 'L’application ne marche pas bien' },
  { value: 'other', label: 'Autre chose' },
]

// S20 — Aide : ouvrir une demande et suivre les réponses de l'équipe.
export default function Support() {
  const params = useLocalSearchParams<{ ride?: string; category?: Category }>()
  const tickets = useLoad<SupportTicket[]>(() => support.tickets(), [], (set) => support.onTickets(set))
  const [category, setCategory] = useState<Category[]>(params.category ? [params.category] : [])
  const [text, setText] = useState('')
  const open = useAction(support.open)

  return (
    <Screen title="Aide" tone="surface">
      {params.category === 'safety' ? <Banner kind="danger" title="Danger immédiat ? Appelez le 19." body="L’équipe vous répond ici, mais la police intervient plus vite." /> : null}
      <Card style={{ gap: 12 }}>
        <Text weight={600}>De quoi s’agit-il ?</Text>
        <ChoiceList mode="single" value={category} onChange={setCategory} options={categories} />
        <Field label="Décrivez ce qui s’est passé" hint={params.ride ? 'La course concernée est jointe automatiquement.' : 'Un seul message détaillé nous aide à répondre vite.'}
          value={text} onChangeText={setText} multiline maxLength={2000} counter />
        {open.error ? <Banner kind="danger" title={open.error} /> : null}
        <Button label="Envoyer" loading={open.busy} disabled={!category[0] || !text.trim()}
          onPress={async () => { if (await open.run(category[0], text, params.ride)) { setText(''); setCategory([]) } }} />
      </Card>
      {tickets.data?.map((t) => (
        <Card key={t.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text weight={600}>{categories.find((c) => c.value === t.category)?.label}</Text>
            <Text variant="xs" tone={t.status === 'resolved' ? 'success' : 'subtle'}>{t.status === 'open' ? 'Envoyée' : t.status === 'waiting_user' ? 'Réponse reçue' : 'Résolue'}</Text>
          </View>
          <Text variant="xs" tone="subtle">{formatWhen(t.createdAt)}</Text>
          {t.messages.map((m, i) => <ChatBubble key={i} from={m.from === 'me' ? 'me' : 'them'} text={m.text} />)}
        </Card>
      ))}
    </Screen>
  )
}
