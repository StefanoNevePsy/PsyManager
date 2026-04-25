# PsyManager - Developer Guide

## Project Overview

PsyManager è un gestionale completo e gratuito per psicologi e terapeuti. Progressive Web App (PWA) costruita con React + TypeScript, con build nativo Android via Capacitor.

## Branch Strategy

- `main`: produzione, deploy automatico su GitHub Pages
- `develop`: sviluppo attivo, feature branch da merger qui
- `claude/*`: branch generati da AI per feature/fix specifici

## Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite 8
- **UI**: Tailwind CSS 3 + Lucide React icons
- **Routing**: React Router DOM 7
- **State**: Zustand (global) + TanStack Query (server)
- **Forms**: React Hook Form + Zod
- **Date utilities**: date-fns con locale italiano
- **PWA**: vite-plugin-pwa con Workbox

### Backend
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (email/password)
- **API**: Supabase REST/Realtime
- **External**: Google Calendar API (OAuth 2.0 client-side)

### Mobile
- **Framework**: Capacitor 8
- **Plugins**: @capacitor/app, @capacitor/splash-screen

### Deployment
- **Web**: GitHub Pages (basename `/PsyManager/`)
- **Android**: APK/AAB via Capacitor + Android Studio

## Project Structure

```
src/
├── components/
│   ├── ui/                    # Componenti base: Button, Input, Modal, Card, Select, Textarea, EmptyState, PageHeader, ConfirmDialog
│   ├── patients/              # PatientForm
│   ├── service-types/         # ServiceTypeForm
│   ├── structures/            # StructureForm, PackageAgreementForm
│   ├── sessions/              # SessionForm, CalendarView, SessionsList, GoogleCalendarSync
│   ├── payments/              # PaymentForm
│   ├── Header.tsx             # Top bar con tema toggle e dropdown utente
│   ├── Sidebar.tsx            # Nav laterale (responsive)
│   ├── Layout.tsx             # Wrapper principale
│   ├── ProtectedRoute.tsx     # HOC per route autenticate
│   └── PWAUpdatePrompt.tsx    # Notifica aggiornamento PWA
├── pages/
│   ├── LoginPage.tsx          # Login/Signup/Reset password
│   ├── DashboardPage.tsx      # Stats + sedute oggi/prossime + pagamenti recenti
│   ├── PatientsPage.tsx       # CRUD pazienti
│   ├── SessionsPage.tsx       # Calendario + lista sedute + Google sync
│   ├── ServiceTypesPage.tsx   # CRUD tipi prestazione
│   ├── StructuresPage.tsx     # CRUD strutture + pacchetti
│   ├── PaymentsPage.tsx       # CRUD pagamenti + saldi pazienti
│   ├── ReportsPage.tsx        # Report con filtri e export CSV
│   └── SettingsPage.tsx       # Profilo, Google Calendar, sicurezza
├── hooks/
│   ├── useAuth.ts             # Wrapper authStore
│   ├── useTheme.ts            # Toggle tema
│   ├── usePatients.ts         # CRUD via React Query
│   ├── useServiceTypes.ts
│   ├── useStructures.ts       # Strutture + pacchetti
│   ├── useSessions.ts
│   ├── usePayments.ts         # Pagamenti + balances
│   ├── useDashboardStats.ts   # KPI dashboard
│   ├── useReports.ts          # Aggregazioni per report + CSV export
│   └── useGoogleCalendarSync.ts  # Sync bidirezionale
├── stores/
│   ├── authStore.ts           # User, session, signIn/signUp/signOut
│   └── googleCalendarStore.ts # OAuth token + connect/disconnect
├── lib/
│   ├── supabase.ts            # Client Supabase
│   ├── googleCalendar.ts      # API wrapper Google Calendar
│   ├── schemas.ts             # Zod schemas (validazione form)
│   └── themes.ts              # Definizione temi (estensibile)
├── types/
│   ├── database.ts            # Types tabelle DB (manuali)
│   └── theme.ts
├── styles/
│   └── globals.css            # Tailwind directives + CSS variables tema
├── App.tsx                    # Routing + providers
├── main.tsx                   # Entry point
└── vite-env.d.ts              # ImportMetaEnv types
```

## Key Design Decisions

### 1. Tema (CSS Variables, classes)
- Light/dark via `dark` class su root + `<html>` toggle
- CSS variables per ogni colore (background, foreground, primary, etc.)
- **Aggiungere nuovo tema**: aggiungi entry in `src/lib/themes.ts` + classe in `globals.css`

### 2. Database (Supabase)
- **Multi-tenancy**: `user_id` foreign key + RLS policies (`auth.uid() = user_id`)
- **Tabelle**: users, patients, service_types, sessions, structures, package_agreements, payments
- **Indici**: su `user_id`, foreign keys, e date di scheduling/payment
- **Triggers**: auto-update `updated_at` su ogni update
- **Types**: in `src/types/database.ts` (sincronizzati a mano col SQL)

### 3. Google Calendar Sync
- **Auth**: OAuth 2.0 client-side via Google Identity Services
- **Token**: salvato in localStorage (scadenza ~1h)
- **Mapping**: `sessions.google_calendar_event_id` collega seduta locale a evento Calendar
- **Strategia**:
  - Sedute create in app → push su Calendar via `pushSessionToCalendar`
  - Eventi Calendar non collegati → mostrati come `unmappedEvents` (importazione manuale)
  - Modifiche orario su Calendar → pulled da `fullSync`
- **Tag eventi**: `extendedProperties.private` con `appId: 'psymanager'`, `sessionId`, `patientId`, `serviceTypeId`

### 4. Forms
- React Hook Form + Zod resolver
- Schemi centralizzati in `src/lib/schemas.ts`
- Pattern: form component generic con `initialData`, `onSubmit`, `onCancel`, `loading`

### 5. Caching (TanStack Query)
- `staleTime: 5min`, `retry: 1`
- Query keys: `['entityName', userId]` o `['entityName', userId, filters]`
- Mutations invalidano le query correlate

## Development Workflow

```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npm run type-check   # TypeScript check
npm run preview      # Preview production build

# Capacitor
npm run cap:add:android  # Add Android platform (first time)
npm run cap:sync         # Build web + sync to native
npm run cap:open:android # Open in Android Studio
```

## Adding New Features

### Add a new database table

1. Aggiungi SQL in `database.sql` (CREATE TABLE + RLS + indexes + triggers)
2. Esegui in Supabase SQL Editor
3. Aggiungi types in `src/types/database.ts`
4. Crea hook in `src/hooks/useXxx.ts` con React Query
5. Crea schema Zod in `src/lib/schemas.ts`
6. Crea form component in `src/components/xxx/XxxForm.tsx`
7. Crea page in `src/pages/XxxPage.tsx`
8. Aggiungi route in `src/App.tsx`
9. Aggiungi voce in `src/components/Sidebar.tsx`

### Add a new theme

1. Aggiungi colors in `src/styles/globals.css` con classe (es. `.theme-ocean`)
2. Aggiungi entry in `src/lib/themes.ts`
3. Aggiorna `src/hooks/useTheme.ts` per supportare la nuova classe

## Coding Conventions

- **Components**: PascalCase, default export
- **Hooks**: `use` prefix, named export
- **Types**: PascalCase, interface preferito a type
- **CSS**: Tailwind classes, evita `style={}` inline
- **Imports**: alias `@/` per src; ordine: external → internal → types
- **Lingua UI**: italiano
- **Lingua codice/commenti**: inglese

## Common Pitfalls

- ⚠️ **`--legacy-peer-deps`** necessario per Tailwind 3 + altri pacchetti recenti
- ⚠️ **PWA in dev**: disabilitato; testare con `npm run preview`
- ⚠️ **Supabase types**: il client usa `any` (non `Database` generic) per evitare conflitti TypeScript con versioni recenti
- ⚠️ **GitHub Pages routing**: `basename: '/PsyManager'` solo in production; `404.html` redirect per SPA
- ⚠️ **Capacitor Android scheme**: `https` (non `http`) per evitare blocchi Mixed Content
- ⚠️ **Google OAuth redirect**: deve combaciare esattamente con quello in Google Cloud Console

## Database Setup Quick Reference

Vedi `database.sql` per lo schema completo. Riassunto tabelle:

| Tabella | Descrizione | Chiavi |
|---------|-------------|--------|
| `users` | Profili utenti (collegati a auth.users) | id (FK auth.users) |
| `patients` | Anagrafe pazienti | user_id |
| `service_types` | Tipi prestazione (private/package) | user_id |
| `sessions` | Sedute terapia | user_id, patient_id, service_type_id |
| `structures` | Strutture/centri | user_id |
| `package_agreements` | Accordi forfait | user_id, structure_id |
| `payments` | Pagamenti registrati | user_id, patient_id, session_id |

Tutti hanno `created_at`, `updated_at`, RLS attivo.

## Environment Variables

Vedi `.env.example` per il template. Loca in `.env.local` (gitignored).

In produzione, configura come **GitHub Secrets** per il workflow CI/CD.

## Testing Strategy

🚧 **TODO**: Setup Vitest + React Testing Library

Suggerimento iniziale:
- Unit test per `src/lib/schemas.ts` (Zod schemas)
- Component test per form (mock React Query)
- Integration test per i flow critici (login, create patient)

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)

---

In caso di dubbi, apri una issue su GitHub.
