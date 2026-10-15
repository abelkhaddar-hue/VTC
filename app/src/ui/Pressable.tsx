import { useState, type ReactNode } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { focusRing } from '@/theme'

type State = { pressed: boolean; focused: boolean }

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((s: State) => StyleProp<ViewStyle>)
  children?: ReactNode | ((s: State) => ReactNode)
}

// Pressable avec anneau de focus clavier, partagé par tous les éléments cliquables.
export function Touchable({ style, children, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false)
  return (
    <Pressable
      onFocus={(e) => { setFocused(true); onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); onBlur?.(e) }}
      // Sur le web, react-native-web fournit `focused` ; ailleurs on garde notre état.
      style={(s) => {
        const f = (s as { focused?: boolean }).focused ?? focused
        return [typeof style === 'function' ? style({ pressed: s.pressed, focused: f }) : style, f && (focusRing as ViewStyle)]
      }}
      {...rest}
    >
      {(s) => (typeof children === 'function' ? children({ pressed: s.pressed, focused: (s as { focused?: boolean }).focused ?? focused }) : children)}
    </Pressable>
  )
}
