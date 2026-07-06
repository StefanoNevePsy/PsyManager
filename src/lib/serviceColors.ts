// Deterministic color mapping for service types so each one renders with a
// distinct, stable color across the calendar and lists.
//
// The mapping is hash-based on the service_type id, so it stays consistent
// between sessions and devices without needing a DB column — unless the
// service type has an explicit `color` (hex '#rrggbb'), in which case that
// takes priority.

const PALETTE = [
  { hex: '#3b82f6', name: 'blue' },     // blue
  { hex: '#a855f7', name: 'purple' },   // purple
  { hex: '#22c55e', name: 'green' },    // green
  { hex: '#f97316', name: 'orange' },   // orange
  { hex: '#ec4899', name: 'pink' },     // pink
  { hex: '#14b8a6', name: 'teal' },     // teal
  { hex: '#f59e0b', name: 'amber' },    // amber
  { hex: '#06b6d4', name: 'cyan' },     // cyan
  { hex: '#8b5cf6', name: 'violet' },   // violet
  { hex: '#10b981', name: 'emerald' },  // emerald
] as const

/** Hex values of the app palette, exposed for swatch pickers in forms. */
export const SERVICE_PALETTE: string[] = PALETTE.map((entry) => entry.hex)

const hashString = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

const isValidHex = (value: string | null | undefined): value is string =>
  !!value && HEX_RE.test(value)

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

export interface ServiceColor {
  hex: string
  /** Inline style for the colored "pill" (calendar event, list badge). */
  pillStyle: { backgroundColor: string; color: string; borderColor: string }
  /** Inline style for hover background (slightly more saturated). */
  pillHoverStyle: { backgroundColor: string }
}

// Google Calendar event colorIds (1-11 fixed palette), matched to the
// closest app palette entry above, index-aligned with PALETTE:
// blue→Blueberry, purple→Grape, green→Sage, orange→Tangerine, pink→Flamingo,
// teal→Peacock, amber→Banana, cyan→Peacock, violet→Lavender, emerald→Basil
const GOOGLE_COLOR_IDS = ['9', '3', '2', '6', '4', '7', '5', '7', '1', '10'] as const

// Google Calendar's fixed colorId palette, used to find the nearest match
// for a custom hex color.
const GOOGLE_COLOR_REFERENCE: Record<string, string> = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6c026',
  '6': '#f5511d',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#d60000',
}

const nearestGoogleColorId = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex)
  let bestId = '1'
  let bestDistance = Infinity
  for (const [id, refHex] of Object.entries(GOOGLE_COLOR_REFERENCE)) {
    const [rr, rg, rb] = hexToRgb(refHex)
    const distance = (r - rr) ** 2 + (g - rg) ** 2 + (b - rb) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestId = id
    }
  }
  return bestId
}

/**
 * Google Calendar colorId for a service type — same hash as getServiceColor,
 * so the Google event color matches the in-app color of the service.
 *
 * When `customColor` is a valid hex, the nearest Google palette color (by
 * RGB distance) is returned instead of the hash-based mapping.
 */
export const getGoogleColorId = (
  id: string | null | undefined,
  customColor?: string | null
): string => {
  if (isValidHex(customColor)) {
    return nearestGoogleColorId(customColor)
  }
  const seed = id || 'default'
  return GOOGLE_COLOR_IDS[hashString(seed) % GOOGLE_COLOR_IDS.length]
}

const buildServiceColor = (hex: string): ServiceColor => ({
  hex,
  pillStyle: {
    backgroundColor: `${hex}1a`, // ~10% opacity
    color: hex,
    borderColor: `${hex}33`, // ~20% opacity
  },
  pillHoverStyle: {
    backgroundColor: `${hex}33`, // ~20% opacity on hover
  },
})

/**
 * Color for a service type. When `customColor` is a valid hex it is used
 * directly; otherwise a stable color is derived by hashing the service
 * type id against the app palette.
 */
export const getServiceColor = (
  id: string | null | undefined,
  customColor?: string | null
): ServiceColor => {
  if (isValidHex(customColor)) {
    return buildServiceColor(customColor)
  }
  const seed = id || 'default'
  const entry = PALETTE[hashString(seed) % PALETTE.length]
  return buildServiceColor(entry.hex)
}
