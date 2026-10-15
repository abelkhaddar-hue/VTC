import { useRef, useState } from 'react'
import { TextInput, View } from 'react-native'
import { Check, Send, Star } from 'lucide-react-native'
import { color, focusRing, tokens, typeStyle } from '@/theme'
import { Text } from './Text'
import { Touchable } from './Pressable'
import { Chip } from './primitives'

// ───────── choix ─────────

export function ChoiceList<T extends string>({ mode, options, value, onChange }: {
  mode: 'single' | 'multiple'; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void
}) {
  return (
    <View accessibilityRole={mode === 'single' ? 'radiogroup' : undefined} style={{ gap: 4 }}>
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <Touchable
            key={o.value}
            onPress={() => onChange(mode === 'single' ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: tokens.radius.md, backgroundColor: pressed ? color('surface') : 'transparent' })}
          >
            <View style={{
              width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
              borderRadius: mode === 'single' ? 11 : 6,
              borderColor: on ? color('accent') : color('border-input'),
              backgroundColor: on && mode === 'multiple' ? color('accent') : 'transparent',
            }}>
              {on ? (mode === 'single'
                ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color('accent') }} />
                : <Check size={14} color={color('on-accent')} strokeWidth={3} />) : null}
            </View>
            <Text style={{ flex: 1 }}>{o.label}</Text>
          </Touchable>
        )
      })}
    </View>
  )
}

// ───────── note ─────────

const tagsByStars: Record<number, string[]> = {
  5: ['Conduite douce', 'Très ponctuel', 'Voiture propre', 'Agréable'],
  4: ['Conduite douce', 'Voiture propre', 'Ponctuel'],
  3: ['Un peu en retard', 'Itinéraire long', 'Voiture à nettoyer'],
  2: ['En retard', 'Conduite brusque', 'Itinéraire long'],
  1: ['Conduite dangereuse', 'A demandé plus', 'Impoli'],
}

export function StarRating({ value, onChange, tags, onTags }: { value: number; onChange: (n: number) => void; tags: string[]; onTags: (t: string[]) => void }) {
  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Note de la course"
        accessibilityValue={{ min: 0, max: 5, now: value, text: value ? `${value} étoiles sur 5` : 'Pas encore notée' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(1, Math.min(5, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        style={{ flexDirection: 'row', gap: 4 }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Touchable key={n} onPress={() => { onChange(n); onTags([]) }} accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`} style={{ padding: 4, borderRadius: tokens.radius.pill }}>
            <Star size={40} color={n <= value ? color('star') : color('border-input')} fill={n <= value ? color('star') : 'transparent'} />
          </Touchable>
        ))}
      </View>
      {value ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {tagsByStars[value].map((t) => (
            <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => onTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

// ───────── téléphone ─────────

export const formatMoroccanPhone = (digits: string) =>
  digits.replace(/\D/g, '').slice(0, 10).replace(/(\d{2})(?=\d)/g, '$1 ').trim()

export const isMoroccanMobile = (digits: string) => /^0[67]\d{8}$/.test(digits.replace(/\D/g, ''))

export function PhoneInput({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error?: string; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Text variant="sm" weight={500}>Numéro de téléphone</Text>
      <View style={[
        { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: tokens.radius.md, borderWidth: 1, backgroundColor: color('bg'), opacity: disabled ? 0.5 : 1,
          borderColor: error ? color('danger') : focused ? color('accent') : color('border-input') },
        focused && (focusRing as object),
      ]}>
        <View style={{ paddingHorizontal: 16, height: '100%', justifyContent: 'center', borderRightWidth: 1, borderRightColor: color('border') }}>
          <Text weight={600} accessibilityLabel="Indicatif Maroc, plus 2 1 2">+212</Text>
        </View>
        <TextInput
          value={formatMoroccanPhone(value)}
          onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 10))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          placeholderTextColor={color('text-subtle')}
          accessibilityLabel="Numéro de téléphone"
          accessibilityHint={error}
          style={[typeStyle('lg', 500), { flex: 1, paddingHorizontal: 16, color: color('text'), outlineStyle: 'none' } as object]}
        />
      </View>
      {error ? <Text variant="sm" tone="danger">{error}</Text> : null}
    </View>
  )
}

// Un seul vrai champ derrière les cases : l'autofill SMS et les lecteurs d'écran marchent.
export function CodeInput({ value, onChange, length = 6, error, resendIn }: { value: string; onChange: (v: string) => void; length?: number; error?: string; resendIn?: number }) {
  const input = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 12 }}>
      <Touchable onPress={() => input.current?.focus()} accessibilityRole="none" importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length }).map((_, i) => {
          const active = focused && i === Math.min(value.length, length - 1)
          return (
            <View key={i} style={{
              flex: 1, maxWidth: 48, height: 56, borderRadius: tokens.radius.md, borderWidth: active ? 2 : 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color('surface'),
              borderColor: error ? color('danger') : active ? color('accent') : color('border-input'),
            }}>
              <Text variant="xl" tabular>{value[i] ?? ''}</Text>
            </View>
          )
        })}
      </Touchable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        accessibilityLabel={`Code reçu par SMS, ${length} chiffres`}
        accessibilityHint={error}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      {error ? <Text variant="sm" tone="danger" center>{error}</Text> : null}
      {resendIn != null ? (
        <Text variant="sm" tone="muted" center>{resendIn > 0 ? `Renvoyer le code dans 0:${String(resendIn).padStart(2, '0')}` : 'Renvoyer le code'}</Text>
      ) : null}
    </View>
  )
}

// ───────── chat ─────────

export function ChatBubble({ from, text, status }: { from: 'me' | 'them' | 'system'; text: string; status?: 'sending' | 'sent' | 'failed' }) {
  if (from === 'system') return <Text variant="xs" tone="subtle" center style={{ paddingVertical: 4 }}>{text}</Text>
  const me = from === 'me'
  return (
    <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '80%', gap: 2 }}>
      <View style={{
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: tokens.radius.lg,
        borderBottomRightRadius: me ? tokens.radius.sm : tokens.radius.lg, borderBottomLeftRadius: me ? tokens.radius.lg : tokens.radius.sm,
        backgroundColor: me ? color('accent') : color('surface-2'),
      }}>
        <Text tone={me ? 'on-accent' : 'default'}>{text}</Text>
      </View>
      {status === 'failed' ? <Text variant="xs" tone="danger" style={{ alignSelf: 'flex-end' }}>Non envoyé · Réessayer</Text> : null}
      {status === 'sending' ? <Text variant="xs" tone="subtle" style={{ alignSelf: 'flex-end' }}>Envoi…</Text> : null}
    </View>
  )
}

export function Composer({ onSend, quick = ['J’arrive', 'Je suis devant', 'Pouvez-vous m’appeler ?'] }: { onSend: (t: string) => void; quick?: string[] }) {
  const [text, setText] = useState('')
  const send = (t: string) => { if (t.trim()) { onSend(t.trim()); setText('') } }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {quick.map((q) => <Chip key={q} label={q} onPress={() => send(q)} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message"
          placeholderTextColor={color('text-subtle')}
          accessibilityLabel="Message"
          onSubmitEditing={() => send(text)}
          style={[typeStyle('base'), { flex: 1, height: 48, paddingHorizontal: 20, borderRadius: tokens.radius.pill, backgroundColor: color('surface'), color: color('text'), borderWidth: 1, borderColor: color('border') }]}
        />
        <Touchable
          onPress={() => send(text)}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          accessibilityState={{ disabled: !text.trim() }}
          style={{ width: 48, height: 48, borderRadius: tokens.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color('accent'), opacity: text.trim() ? 1 : 0.4 }}
        >
          <Send size={20} color={color('on-accent')} />
        </Touchable>
      </View>
    </View>
  )
}
