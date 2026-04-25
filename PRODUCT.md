# PsyManager Product Brief

## Overview
PsyManager è un gestionale completo e gratuito per psicologi e terapeuti. PWA costruita con React + TypeScript, sincronizzabile su più dispositivi (PC, tablet, Android) con backend Supabase.

## Users

### Primary
- **Psicologi e psicoterapeuti liberi professionisti** in Italia
- Età: 30–65, tech-savvy moderato (sanno usare browser/smartphone)
- Uso: quotidiano, durante sedute (consultazione rapida) e fuori sedute (amministrazione)
- Ambiente: studio professionale (scrivania) e movimento (casa, bar, viaggio)
- Pain points: disorganizzazione pazienti, mancato tracking arretrati/crediti, Google Calendar isolato, paura di perdere dati

### Secondary
- **Assistenti/segretari** in studi condivisi (feature: lettura pazienti, nessuna modifica)
- **Pazienti** accedendo al proprio profilo per consultare appuntamenti (futura)

## Product Purpose

**"Single source of truth per la pratica terapeutica."** Centralizza pazienti, sedute, pagamenti, tipi prestazione in un'unica app, con sync real-time tra dispositivi e integrazione Google Calendar, eliminando spreadsheet e carta.

## Brand Tone

- **Professionale ma accessible**: non ostile, non burocratico, confidenza senza pressione
- **Efficienza first**: ogni azione è intenzionale, niente rumore
- **Italiana**: UI in italiano, date/numeri in formato locale, comprensione degli usi professionali italiani
- **Trustworthy**: l'app maneggia dati sensibili (pazienti); trasparenza su come vengono usati
- **Anti-patterns**: niente cheerfulness falsa, niente gamification, niente dark patterns

## Strategic Principles

1. **Data ownership**: tutto rimane dell'utente; niente tracking/vendita dati
2. **Offline-first**: PWA con service worker; funziona anche senza rete (sync automatico)
3. **Multi-device**: stessa app su PC/tablet/telefono/Android nativo; stato sempre sincronizzato
4. **Estensibilità moderata**: aggiungere nuove prestazioni, strutture, terapie senza codice
5. **Gratuità non è scusa**: lo stack è gratuito, ma l'UX non deve sentirsi cheap

## Register
**product** (design SERVES la gestione clinica, non è il prodotto stesso)

## Color Strategy
**Restrained + clinical**: tinted neutrals (grigio con hint di blu), un accent primario (blu confidente per CTA e success), rosso solo per delete/error, verde per positive states.

## Typography
- Body: Geist Sans (sans-serif moderno, già in uso)
- Heading: Geist Sans con weight 600–700
- Monospace: per sessione ID, patient code
- Line length: 65–75ch su body text; dashboard può essere più stretta

## Spacing / Rhythm
- Base unit: 4px
- Padding card: 24px (non omogeneo ovunque, variare per ritmo)
- Gap between sections: 32–48px
- Sidebar width (desktop): 240px

## Light / Dark Theme
- **Physical scene**: psicologo in studio durante giorno (luce naturale), consultazione da casa la sera (luce artificiale), input notturno (schedature da casa)
- **Verdict**: entrambi necessari; default light se sessione nuova, memorizzare preferenza

## Motion
- Transizioni: 150–200ms, ease-out-quart
- No layout animations (no height/width morph)
- Progressive disclosure: form steps, collapse/expand, tooltip

## Component Palette
- Button: primary (blue), secondary (ghost), danger (red)
- Card: subtle border, no shadow (trust, non elevation)
- Modal: per conferme distruttive; inline form per CRUD non-critico
- Empty state: illustrazione + copy chiari, CTA visible
- List: hover state chiaro, no stripe
- Form: label sopra, error inline, validation on blur

## Accessibility
- WCAG AA minimum
- Keyboard nav: sidebar, form, list
- Focus visible su tutti i focusable
- Color non è l'unico modo per comunicare stato (icon + colore)
- Alt text su pazienti profile image (se presenti)

## Missteps to Avoid
- ❌ Hero metric template (big KPI number + stats)
- ❌ Side-stripe colored borders
- ❌ Identical card grids
- ❌ Glassmorphism
- ❌ Jargon medico senza spiegazione
- ❌ Form validation aggressiva (on keystroke)
- ❌ Assumere che l'utente conosca il sistema (onboarding chiaro)
