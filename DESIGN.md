# PsyManager Design System

## Color Palette (OKLCH)

### Neutrals (Tinted Blue-Gray)
- **Background**: `oklch(99% 0.008 240)` (#f9fafb) — off-white, faint blue tint
- **Surface**: `oklch(100% 0 0)` (#ffffff) — pure white for cards
- **Border**: `oklch(89% 0.005 240)` (#e5e7eb) — subtle line
- **Foreground (text)**: `oklch(15% 0.01 240)` (#0f1419) — near-black with blue tint
- **Muted**: `oklch(55% 0.01 240)` (#707580) — secondary text

### Primary (Clinical Blue)
- **Primary 50**: `oklch(97% 0.04 242)` (#f0f8ff)
- **Primary 500**: `oklch(60% 0.14 242)` (#2563eb) — primary CTA, active states
- **Primary 600**: `oklch(52% 0.16 242)` (#1d4ed8) — hover on primary button
- **Primary 900**: `oklch(25% 0.06 242)` (#1e3a8a) — dark variant for dark mode

### Semantic
- **Success**: `oklch(65% 0.12 142)` (#16a34a) — positive action, confirmed
- **Warning**: `oklch(70% 0.18 67)` (#d97706) — caution, incomplete
- **Error**: `oklch(58% 0.2 30)` (#dc2626) — deletion, critical fail
- **Info**: `oklch(60% 0.14 246)` (#3b82f6) — notification, neutral info

### Dark Mode Overrides
- Background dark: `oklch(12% 0.01 240)` (#0f1419)
- Surface dark: `oklch(18% 0.005 240)` (#1f2937)
- Border dark: `oklch(32% 0.005 240)` (#4b5563)
- Foreground dark: `oklch(95% 0.01 240)` (#f3f4f6)

## Typography

### Font Family
- **Geist Sans**: primary typeface (already in use, load from system)
- **Fallback**: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

### Scale (ratios 1.125 = minor third)
| Role | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|
| H1 | 32px | 700 | 1.2 | -0.5px |
| H2 | 28px | 600 | 1.3 | 0 |
| H3 | 24px | 600 | 1.4 | 0 |
| Body | 16px | 400 | 1.6 | 0 |
| Body small | 14px | 400 | 1.5 | 0 |
| Label | 12px | 500 | 1.4 | 0.2px |
| Code | 13px (monospace) | 400 | 1.5 | 0 |

### Hierarchy Rules
- H1 → Body = 2:1 ratio (32:16) ✓
- H2 → Body = 1.75:1 ratio (28:16) ✓
- Weight contrast: headings always ≥600, body 400
- Color: primary text on light bg = Primary 900 (#1e3a8a), muted = Muted (#707580)

## Spacing System

### Base Unit: 4px

| Token | Value | Use |
|---|---|---|
| xs | 4px | tight spacing, icon gaps |
| sm | 8px | padding inside small components |
| md | 12px | form padding, list item gap |
| lg | 16px | standard padding |
| xl | 24px | card padding, section padding |
| 2xl | 32px | section gap |
| 3xl | 48px | major section break |

### Grid & Layout
- **Max content width**: 1200px (no hard limit, responsive)
- **Sidebar width**: 240px fixed (desktop), 100% overlay on mobile
- **Gutter**: 24px between grid columns
- **Margin top/bottom**: alternate lg (16px) and xl (24px) for rhythm, never identical

## Components

### Button
```
Primary:
  - Background: Primary 500 (#2563eb)
  - Text: white
  - Padding: 10px 16px (h=40px)
  - Border: none
  - Hover: Primary 600 (#1d4ed8)
  - Active: Primary 700
  - Disabled: Muted (#707580), opacity 50%

Secondary (Ghost):
  - Background: transparent
  - Border: 1px Primary 500
  - Text: Primary 500
  - Hover: Primary 50 (#f0f8ff)
  - Disabled: Border Muted, text Muted

Danger:
  - Background: Error (#dc2626)
  - Text: white
  - Hover: Error dark
```

### Card
```
- Background: white (dark mode: Surface dark)
- Border: 1px Border (#e5e7eb)
- Border radius: 8px
- Padding: 20px
- Shadow: none (trust signal > elevation)
- Hover: Border becomes Primary 300 (subtle, optional)
```

### Input / Textarea
```
- Background: white / Surface dark
- Border: 1px Border
- Border radius: 6px
- Padding: 10px 12px
- Font: Body
- Focus: Border Primary 500, outline none
- Error border: Error (#dc2626)
- Label: Label style, above input, required indicator * in Error color
```

### Modal
```
- Overlay: rgba(0,0,0,0.5)
- Modal bg: white / Surface dark
- Border radius: 12px
- Padding: 32px
- Title: H2
- Actions (footer): gap lg between buttons, primary on right
- Close button: top-right, icon close (X)
```

### Empty State
```
- Icon: 64x64, Primary 200 tint
- Heading: H3
- Subtext: Body small, Muted
- CTA: Primary button
- Spacing: icon (bottom 16px) + heading (bottom 8px) + subtext (bottom 24px) + button
```

### Sidebar Navigation
```
- Width: 240px (desktop), full width overlay (mobile)
- Item height: 44px
- Padding: 12px 16px
- Icon + label
- Active: Background Primary 50, text Primary 500, left border 3px Primary 500
- Hover: Background Primary 50 (not active)
- Divider: Border top, margin lg
```

### List Item
```
- Padding: 12px 16px
- Flex: icon (16x16, gap 12px) | content | action
- Border-bottom: 1px Border
- Hover: Background Primary 50
- No stripe (avoid border-left accent)
```

## Interaction & Motion

### Transitions
- **Standard**: 150ms ease-out-quart (for color, opacity, position)
- **Slow**: 300ms ease-out-quart (for modals, sidebars)
- **CSS easing**: `cubic-bezier(0.165, 0.84, 0.44, 1)` = ease-out-quart

### Animations
- ❌ No layout morphing (height: auto → 500px)
- ✓ Use max-height for expand/collapse (safe with transitions)
- ✓ Scale + opacity for appear/disappear
- ✓ Slide from edge for sidebars/modals

### Feedback
- **Buttons**: active state (darker) on click, 100ms
- **Forms**: success checkmark (green, 300ms scale-in), error shake (100ms, -2px offset)
- **Skeleton**: pulse (opacity 0.5 → 1, 1.5s loop) while loading
- **Toast**: slide-in from bottom (200ms), auto-close after 4s

## Responsive Breakpoints

| Breakpoint | Width | Use |
|---|---|---|
| Mobile | < 640px | Sidebar overlay, full-width layout |
| Tablet | 640px–1024px | 2-column layout, sidebar visible |
| Desktop | > 1024px | 3+ column, full nav |

### Rules
- **Sidebar**: fixed desktop, overlay mobile (swipe gesture)
- **Cards**: 1 col mobile, 2 col tablet, 3 col desktop
- **Tables**: horizontal scroll on mobile, full table desktop
- **Font size**: no scaling needed (16px base is accessible)

## Accessibility

### WCAG AA Compliance
- **Contrast**: All text ≥ 4.5:1 (normal), ≥ 3:1 (large 18pt+)
- **Focus**: All interactive elements have visible focus ring (2px Primary 500)
- **Color**: Red/green never sole indicator (icon + text)
- **Labels**: `<label for="id">` on all inputs
- **ARIA**: `aria-label` for icon-only buttons, `aria-live="polite"` for toast

### Keyboard Navigation
- **Tab order**: logical (sidebar → main → footer)
- **Sidebar**: arrow keys to navigate, Enter to select
- **Modal**: Escape to close, Tab traps focus
- **Form**: Tab between fields, Enter submits (if single CTA)

### Reduced Motion
- Media query `prefers-reduced-motion: reduce` disables animations
- Fallback: instant transitions instead of slow

## Dark Mode

Toggle via Header component (moon/sun icon). Preference stored in `localStorage['theme']`.

### CSS Structure
```css
:root {
  --bg: oklch(99% 0.008 240);
  --surface: oklch(100% 0 0);
  /* etc */
}

html.dark {
  --bg: oklch(12% 0.01 240);
  --surface: oklch(18% 0.005 240);
  /* etc */
}
```

No separate CSS files; all colors via CSS variables in `src/styles/globals.css`.

## Future Themes

To add a new theme (e.g., "Ocean"):
1. Add new CSS class in `src/styles/globals.css`:
   ```css
   html.ocean {
     --primary-500: oklch(60% 0.16 210); /* more teal */
     --bg: oklch(99% 0.02 210);
     /* ... rest of palette */
   }
   ```
2. Add entry to `src/lib/themes.ts`:
   ```ts
   { id: 'ocean', label: 'Ocean', icon: Waves }
   ```
3. Update `src/hooks/useTheme.ts` to apply `.ocean` class

## Files & Locations

| Component | File |
|---|---|
| Colors / vars | `src/styles/globals.css` |
| Typography | `src/styles/globals.css` + `tailwind.config.ts` |
| Themes | `src/lib/themes.ts` |
| Theme hook | `src/hooks/useTheme.ts` |
| UI components | `src/components/ui/` |
| Page layouts | `src/pages/` |
| Tailwind config | `tailwind.config.ts` |

## Validation & Linting

- **Type check**: `npm run type-check`
- **Build**: `npm run build` (catches Tailwind errors)
- **Manual audit**: open app in light + dark, all screen sizes, keyboard-only nav
