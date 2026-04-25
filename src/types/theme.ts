export interface ThemeColors {
  background: string
  foreground: string
  border: string
  input: string
  ring: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  destructive: string
  destructiveForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  popover: string
  popoverForeground: string
  card: string
  cardForeground: string
}

export interface ThemeDefinition {
  name: string
  colors: ThemeColors
}

export type ThemeName = 'light' | 'dark' | 'auto'
