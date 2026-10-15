import { useState } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { color, focusRing, tokens, typeStyle } from '@/theme'
import { Text } from './Text'

// Champ texte avec libellé, aide, erreur et compteur optionnel.
export function Field({ label, hint, error, counter, multiline, style, onFocus, onBlur, ...rest }: TextInputProps & { label: string; hint?: string; error?: string; counter?: boolean }) {
  const [focused, setFocused] = useState(false)
  const len = String(rest.value ?? '').length
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
          {
            minHeight: multiline ? 96 : 52, paddingHorizontal: 16, paddingVertical: multiline ? 12 : 0, borderRadius: tokens.radius.md, borderWidth: 1,
            borderColor: error ? color('danger') : focused ? color('accent') : color('border-input'), color: color('text'), backgroundColor: color('bg'),
            textAlignVertical: multiline ? 'top' : 'center', outlineStyle: 'none',
          } as object,
          focused && (focusRing as object),
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
