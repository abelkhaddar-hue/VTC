import { useState, type ReactNode } from 'react'
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { Navigation } from 'lucide-react-native'
import { color, shadow, tokens } from '@/theme'

type LngLat = { lng: number; lat: number }

// Carte de démonstration : projette les coordonnées dans la vue, sans fond de carte réel.
// La vraie carte (Google Maps, react-native-maps) la remplacera avec les mêmes props.
export function FakeMap({ pickup, dropoff, driver, me, route, children, label = 'Carte', onPick, pin }: {
  pickup?: LngLat | null; dropoff?: LngLat | null; driver?: (LngLat & { heading?: number }) | null; me?: LngLat | null
  route?: LngLat[] | null; children?: ReactNode; label?: string
  onPick?: (p: LngLat) => void; pin?: LngLat | null
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })

  // le pin ne recadre pas la carte : elle reste immobile pendant qu'on le place
  const pts = [pickup, dropoff, driver, me, ...(route ?? [])].filter(Boolean) as LngLat[]
  const pad = 56
  let minLng = Math.min(...pts.map((p) => p.lng)), maxLng = Math.max(...pts.map((p) => p.lng))
  let minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat))
  const span = 0.012
  if (!pts.length) { minLng = -7.64; maxLng = -7.62; minLat = 33.58; maxLat = 33.6 }
  if (maxLng - minLng < span) { const c = (minLng + maxLng) / 2; minLng = c - span / 2; maxLng = c + span / 2 }
  if (maxLat - minLat < span) { const c = (minLat + maxLat) / 2; minLat = c - span / 2; maxLat = c + span / 2 }
  // garder des proportions réalistes (1° de longitude ≈ 0,83° de latitude ici)
  const w = Math.max(1, size.w - pad * 2), h = Math.max(1, size.h - pad * 2)
  const k = Math.min(w / ((maxLng - minLng) * 0.83), h / (maxLat - minLat))
  const cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2
  const xy = (p: LngLat) => ({ x: size.w / 2 + (p.lng - cx) * 0.83 * k, y: size.h / 2 - (p.lat - cy) * k })

  const unproject = (x: number, y: number): LngLat => ({ lng: cx + (x - size.w / 2) / (0.83 * k), lat: cy - (y - size.h / 2) / k })
  const pick = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent
    if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return
    onPick?.(unproject(locationX, locationY))
  }

  const segments = (route ?? []).slice(1).map((p, i) => {
    const a = xy(route![i]), b = xy(p)
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    return { left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - 2, width: len, ang }
  })

  const dot = (p: LngLat, role: 'marker-pickup' | 'marker-dropoff' | 'accent', d = 18) => {
    const { x, y } = xy(p)
    return <View style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: color(role), borderWidth: 3, borderColor: color('bg'), ...shadow('card') }} />
  }

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={label} style={{ flex: 1, backgroundColor: color('surface-2'), overflow: 'hidden' }}>
      {size.w > 0 && (
        <>
          {Array.from({ length: Math.ceil(size.h / 40) }).map((_, i) => (
            <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: i * 40, height: i % 3 ? 1 : 6, backgroundColor: i % 3 ? color('border') : color('bg') }} />
          ))}
          {Array.from({ length: Math.ceil(size.w / 40) }).map((_, i) => (
            <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 40, width: i % 4 ? 1 : 6, backgroundColor: i % 4 ? color('border') : color('bg') }} />
          ))}
          {segments.map((s, i) => (
            <View key={i} style={{ position: 'absolute', left: s.left, top: s.top, width: s.width, height: 4, borderRadius: 2, backgroundColor: color('route'), transform: [{ rotate: `${s.ang}deg` }] }} />
          ))}
          {me && !pickup ? (
            <>
              <View style={{ position: 'absolute', left: xy(me).x - 28, top: xy(me).y - 28, width: 56, height: 56, borderRadius: 28, backgroundColor: color('accent'), opacity: 0.12 }} />
              {dot(me, 'accent', 18)}
            </>
          ) : null}
          {pickup ? dot(pickup, 'marker-pickup') : null}
          {dropoff ? dot(dropoff, 'marker-dropoff') : null}
          {pin ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: xy(pin).x - 14, top: xy(pin).y - 40, alignItems: 'center' }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color('text'), borderWidth: 4, borderColor: color('bg') }} />
              <View style={{ width: 3, height: 14, backgroundColor: color('text') }} />
            </View>
          ) : null}
          {driver ? (
            <View style={{ position: 'absolute', left: xy(driver).x - 18, top: xy(driver).y - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: color('bg'), alignItems: 'center', justifyContent: 'center', ...shadow('pop') }}>
              <Navigation size={18} color={color('text')} fill={color('text')} style={{ transform: [{ rotate: `${(driver.heading ?? 0) - 45}deg` }] }} />
            </View>
          ) : null}
        </>
      )}
      {onPick ? (
        // Événements tactiles bruts : ils donnent la position du doigt sur le web comme sur mobile.
        <View onStartShouldSetResponder={() => true} onResponderRelease={pick}
          accessibilityRole="button" accessibilityLabel="Toucher la carte pour placer le point"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      ) : null}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>{children}</View>
    </View>
  )
}

export const mapInset = tokens.layout.gutter
