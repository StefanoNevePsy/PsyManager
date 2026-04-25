import { ThemeDefinition } from '@/types/theme'

export const themes: Record<string, ThemeDefinition> = {
  light: {
    name: 'Light',
    colors: {
      background: '0 0% 100%',
      foreground: '0 0% 3.6%',
      border: '0 0% 89.8%',
      input: '0 0% 89.8%',
      ring: '210 40% 96%',
      primary: '210 40% 50%',
      primaryForeground: '210 40% 98%',
      secondary: '210 14% 97%',
      secondaryForeground: '210 40% 50%',
      destructive: '0 84% 60%',
      destructiveForeground: '210 40% 98%',
      muted: '210 14% 97%',
      mutedForeground: '210 11% 36%',
      accent: '210 40% 50%',
      accentForeground: '210 40% 98%',
      popover: '0 0% 100%',
      popoverForeground: '0 0% 3.6%',
      card: '0 0% 100%',
      cardForeground: '0 0% 3.6%',
    },
  },
  dark: {
    name: 'Dark',
    colors: {
      background: '217 33% 17%',
      foreground: '210 40% 96%',
      border: '217 33% 27%',
      input: '217 33% 27%',
      ring: '212 35% 15%',
      primary: '210 40% 60%',
      primaryForeground: '217 33% 17%',
      secondary: '217 33% 27%',
      secondaryForeground: '210 40% 96%',
      destructive: '0 84% 60%',
      destructiveForeground: '217 33% 17%',
      muted: '217 33% 27%',
      mutedForeground: '210 40% 80%',
      accent: '210 40% 60%',
      accentForeground: '217 33% 17%',
      popover: '217 33% 17%',
      popoverForeground: '210 40% 96%',
      card: '217 33% 20%',
      cardForeground: '210 40% 96%',
    },
  },
  // Aggiungi altri temi qui in futuro
}

export const themeNames = Object.keys(themes) as Array<keyof typeof themes>
