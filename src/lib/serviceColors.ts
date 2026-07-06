// Deterministic color mapping for service types so each one renders with a
// distinct, stable color across the calendar and lists.
//
// The mapping is hash-based on the service_type id, so it stays consistent
// between sessions and devices without needing a DB column.

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

const hashString = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

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

/**
 * Google Calendar colorId for a service type — same hash as getServiceColor,
 * so the Google event color matches the in-app color of the service.
 */
export const getGoogleColorId = (id: string | null | undefined): string => {
  const seed = id || 'default'
  return GOOGLE_COLOR_IDS[hashString(seed) % GOOGLE_COLOR_IDS.length]
}

export const getServiceColor = (id: string | null | undefined): ServiceColor => {
  const seed = id || 'default'
  const entry = PALETTE[hashString(seed) % PALETTE.length]
  return {
    hex: entry.hex,
    pillStyle: {
      backgroundColor: `${entry.hex}1a`, // ~10% opacity
      color: entry.hex,
      borderColor: `${entry.hex}33`, // ~20% opacity
    },
    pillHoverStyle: {
      backgroundColor: `${entry.hex}33`, // ~20% opacity on hover
    },
  }
}
