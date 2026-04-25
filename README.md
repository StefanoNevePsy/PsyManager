# PsyManager

> Gestionale completo e gratuito per psicologi e terapeuti, disponibile come PWA web e app Android nativa.

## Caratteristiche

- 📱 **Multi-dispositivo**: PWA (PC, tablet, mobile) + Capacitor per Android nativo
- 👥 **Gestione Pazienti**: Anagrafe completa con contatti e note
- 📅 **Calendario Integrato**: Sincronizzazione bidirezionale con Google Calendar
- 💼 **Tipi di Prestazione Personalizzabili**: Individuale, coppia, famiglia, gruppi, etc.
- 🏥 **Strutture e Pacchetti**: Gestione lavoro a forfait con i centri
- 💰 **Pagamenti & Saldi**: Tracking arretrati e crediti per ogni paziente
- 📊 **Report e Proiezioni**: Analytics, trend mensili, export CSV
- 🔒 **Sicurezza**: Autenticazione Supabase + Row Level Security
- 🌓 **Tema Chiaro/Scuro**: Estensibile per altri temi
- 💾 **Sync Real-time**: Multi-device con Supabase Realtime
- 🆓 **Completamente Gratuito**: Stack open-source con free tier

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS 3 + Lucide Icons
- **State**: Zustand + TanStack Query
- **Forms**: React Hook Form + Zod
- **Mobile**: Capacitor 8 (Android/iOS)
- **PWA**: Vite Plugin PWA + Workbox
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Calendar**: Google Calendar API (OAuth 2.0)

## Installazione

### Prerequisiti

- Node.js 18+ (consigliato 20.x)
- npm
- Account Supabase ([app.supabase.com](https://app.supabase.com))
- Account Google Cloud ([console.cloud.google.com](https://console.cloud.google.com)) - opzionale, per Calendar

### Setup Locale

```bash
# Clone
git clone https://github.com/StefanoNevePsy/PsyManager.git
cd PsyManager

# Install
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Start dev server
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

### Configurazione Supabase

1. Crea un nuovo progetto su [Supabase](https://app.supabase.com)
2. Copia URL e Anon Key in `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Apri **SQL Editor** in Supabase
4. Copia e incolla il contenuto di `database.sql`
5. Esegui lo script per creare schema, indexes, RLS policies e triggers
6. In **Authentication > Settings**, configura:
   - Site URL: `http://localhost:3000` (dev) o il tuo URL prod
   - Email confirmations (opzionale)

### Configurazione Google Calendar (opzionale)

1. Crea un progetto su [Google Cloud Console](https://console.cloud.google.com)
2. Abilita la **Google Calendar API**
3. Crea credenziali **OAuth 2.0 Client ID** (tipo "Web application")
4. Aggiungi gli **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `https://stefanonevepsy.github.io`
5. Copia il Client ID in `.env.local`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

## Build & Deploy

### Build per Web

```bash
npm run build
# Output in dist/
```

### Deploy su GitHub Pages

Il deploy è automatico su `push` al branch `main` tramite GitHub Actions.

**Setup iniziale:**

1. Vai su **Settings > Pages** del repo
2. **Source**: GitHub Actions
3. Vai su **Settings > Secrets and variables > Actions**
4. Aggiungi i secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_CLIENT_ID` (opzionale)
   - `VITE_GOOGLE_CALENDAR_API_KEY` (opzionale)
5. Push su `main`: il workflow buildare e deploya automaticamente

L'app sarà disponibile a `https://stefanonevepsy.github.io/PsyManager/`

### Build per Android (Capacitor)

**Prerequisiti**: [Android Studio](https://developer.android.com/studio) installato

```bash
# Aggiungi piattaforma Android (prima volta)
npm run cap:add:android

# Build & sync
npm run cap:sync

# Apri in Android Studio per generare APK/AAB
npm run cap:open:android
```

In Android Studio:
- **Build > Build Bundle(s) / APK(s) > Build APK(s)**
- L'APK sarà in `android/app/build/outputs/apk/debug/`

Per pubblicare su Google Play, genera un **signed App Bundle** (file .aab).

## Struttura del Progetto

```
src/
├── components/             # Componenti React
│   ├── ui/                 # Componenti base riutilizzabili
│   ├── patients/           # Form pazienti
│   ├── service-types/      # Form tipi prestazione
│   ├── structures/         # Form strutture e pacchetti
│   ├── sessions/           # Calendario, lista, sync Calendar
│   ├── payments/           # Form pagamenti
│   ├── Layout.tsx
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── ProtectedRoute.tsx
├── pages/                  # Pagine principali
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── PatientsPage.tsx
│   ├── SessionsPage.tsx
│   ├── ServiceTypesPage.tsx
│   ├── StructuresPage.tsx
│   ├── PaymentsPage.tsx
│   ├── ReportsPage.tsx
│   └── SettingsPage.tsx
├── hooks/                  # Custom hooks (React Query, Auth, etc.)
├── stores/                 # Zustand stores (auth, theme, calendar)
├── lib/                    # Supabase, Google Calendar, schemas Zod
├── types/                  # TypeScript types
├── styles/                 # CSS globali con CSS variables
└── App.tsx                 # Routing principale

public/                     # Assets statici (favicon, icone PWA)
.github/workflows/          # CI/CD GitHub Actions
database.sql                # Schema completo Supabase
capacitor.config.ts         # Config Capacitor
```

## Variabili Ambiente

| Nome | Descrizione | Obbligatorio |
|------|-------------|--------------|
| `VITE_SUPABASE_URL` | URL progetto Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase | ✅ |
| `VITE_GOOGLE_CLIENT_ID` | OAuth Client ID Google | ⚠️ Per Calendar sync |
| `VITE_GOOGLE_CALENDAR_API_KEY` | API key Google Calendar | ⚠️ Per Calendar sync |
| `VITE_APP_URL` | URL pubblico dell'app | Opzionale |

## Roadmap Features

### ✅ Implementate
- [x] Setup progetto + tema chiaro/scuro estensibile
- [x] Autenticazione Supabase (login/signup/reset)
- [x] Routing protetto + auto-redirect
- [x] CRUD Pazienti con ricerca e filtri
- [x] CRUD Tipi di Prestazione (privato/pacchetto)
- [x] CRUD Strutture e Pacchetti Forfait
- [x] CRUD Sedute con vista calendario e lista
- [x] Google Calendar bidirezionale (OAuth)
- [x] CRUD Pagamenti con arretrati/crediti
- [x] Dashboard con KPI reali
- [x] Report con grafici trend e export CSV
- [x] PWA con auto-update prompt
- [x] Capacitor config Android
- [x] CI/CD GitHub Pages

### 🔮 Future (post-MVP)
- [ ] Crittografia client-side note cliniche
- [ ] 2FA (TOTP)
- [ ] Notifiche push (sedute imminenti)
- [ ] Backup/restore JSON
- [ ] Multi-lingua (EN, FR, ES)
- [ ] Generazione fatture PDF
- [ ] Importazione CSV pazienti
- [ ] Tag e categorie pazienti
- [ ] Promemoria automatici via email

## Sicurezza

- **Autenticazione**: Email/password via Supabase Auth con bcrypt
- **Autorizzazione**: Row Level Security (RLS) - ogni utente vede solo i suoi dati
- **Trasmissione**: HTTPS/TLS obbligatorio
- **Sessioni**: JWT auto-refresh, scadenza configurabile
- **Best practice**: Mai commit di `.env.local`, secrets solo in GitHub Secrets

## Contribuire

PR e issue benvenuti! Per modifiche significative, apri prima una issue per discuterle.

## Licenza

MIT

## Supporto

- 🐛 Bug: [Issues](https://github.com/StefanoNevePsy/PsyManager/issues)
- 💬 Domande: Discussioni nel repo
