import { useState } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { color, tokens, typeStyle } from '@/theme'
import { inputFrame } from './inputFrame'
import { Text } from './Text'

// Champ texte avec libellé, aide, erreur et compteur optionnel.
export function Field({ label, hint, error, counter, multiline, style, onFocus, onBlur, ...rest }: TextInputProps & { label: string; hint?: string; error?: string; counter?: boolean }) {
  const [focused, setFocused] = useState(false)
  const len = String(rest.value ?? '').length
  // la bordure noire 2 px tient lieu d'indicateur de focus (contraste 21:1)
  const frame = inputFrame({ focused, error: !!error, disabled: rest.editable === false })
  return (
    <View style={{ gap: 6 }}>
      <Text variant="sm" weight={500}>{label}</Text>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={color('text-subtle')}
        multiline={multiline}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        style={[
          typeStyle('base'),
          frame.style,
          {
            minHeight: multiline ? 96 : tokens.size.input, paddingHorizontal: 14 + frame.inset, paddingVertical: multiline ? 10 + frame.inset : 0,
            color: color(rest.editable === false ? 'disabled-text' : 'text'), textAlignVertical: multiline ? 'top' : 'center', outlineStyle: 'none',
          } as object,
          style,
        ]}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {error ? <Text variant="sm" tone="danger" style={{ flex: 1 }}>{error}</Text> : hint ? <Text variant="sm" tone="subtle" style={{ flex: 1 }}>{hint}</Text> : <View />}
        {counter && rest.maxLength ? <Text variant="xs" tone="subtle">{len}/{rest.maxLength}</Text> : null}
      </View>
    </View>
  )
}
