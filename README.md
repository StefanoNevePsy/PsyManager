# PsyManager

Gestionale completo e gratuito per psicologi e terapeuti - Funziona su PC, Tablet e Mobile Android.

## Caratteristiche

- 📱 **Multi-dispositivo**: PWA + Capacitor per Android nativo
- 👥 **Gestione Pazienti**: Anagrafe completa con contatti
- 📅 **Calendario Integrato**: Sincronizzazione bidirezionale con Google Calendar
- 💰 **Gestione Pagamenti**: Registrazione pagamenti, arretrati, crediti
- 📊 **Report e Proiezioni**: Analisi guadagni, proiezioni entro una data
- 🔒 **Sicurezza**: Autenticazione Supabase + RLS
- 🌓 **Tema Dinamico**: Light/Dark mode + estensibile per altri temi
- 💾 **Sincronizzazione**: Sincronizzazione in real-time tra dispositivi
- 🆓 **Completamente Gratuito**: Stack open-source, hosting gratuito

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Mobile**: Capacitor (Android/iOS)
- **UI**: Tailwind CSS + Lucide Icons
- **Backend**: Supabase (PostgreSQL + Auth)
- **State Management**: Zustand + React Query
- **Forms**: React Hook Form + Zod
- **Calendar**: Google Calendar API

## Guida Installazione

### Prerequisiti

- Node.js 18+
- npm o yarn
- Account Supabase (gratuito)
- Account Google Cloud (per Google Calendar API)

### Setup Locale

1. **Clone il repository**
   ```bash
   git clone https://github.com/StefanoNevePsy/PsyManager.git
   cd PsyManager
   ```

2. **Installa le dipendenze**
   ```bash
   npm install
   ```

3. **Configura le variabili di ambiente**
   ```bash
   cp .env.example .env.local
   ```
   Compila il file `.env.local` con:
   - URL e chiave anonima di Supabase
   - Credenziali Google Calendar API
   - URL dell'app

4. **Avvia il dev server**
   ```bash
   npm run dev
   ```
   L'app sarà disponibile su `http://localhost:3000`

## Configurazione Supabase

### 1. Crea un progetto Supabase
- Vai su https://app.supabase.com
- Crea un nuovo progetto
- Copia URL e chiave anonima nel `.env.local`

### 2. Esegui le migrazioni del database

Copia e incolla il contenuto di `database.sql` nell'editor SQL di Supabase per creare le tabelle.

### 3. Configura l'autenticazione
- Abilita Email/Password authentication
- Configura i redirect URLs:
  - `http://localhost:3000/` (dev)
  - `https://stefanonevepsy.github.io/PsyManager/` (production)

## Configurazione Google Calendar API

1. Vai a https://console.cloud.google.com
2. Crea un nuovo progetto
3. Abilita Google Calendar API
4. Crea credenziali OAuth 2.0
5. Aggiungi gli authorized redirect URIs
6. Copia Client ID e API Key nel `.env.local`

## Build e Deployment

### Build per Web (GitHub Pages)
```bash
npm run build
```

### Build per Android (Capacitor)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npm run build
npx cap copy
npx cap open android
```

## Struttura del Progetto

```
src/
├── components/          # Componenti riutilizzabili
├── pages/              # Pagine principali
├── hooks/              # Custom React hooks
├── lib/                # Utility e configurazioni
├── types/              # TypeScript types
├── stores/             # Zustand stores
├── styles/             # CSS globali
└── utils/              # Funzioni utility
```

## Features Implementate

- ✅ Setup base React + TypeScript + Vite
- ✅ Tailwind CSS con tema light/dark
- ✅ Layout con Sidebar e Header
- ✅ Pagine placeholder per tutte le sezioni
- ✅ Configurazione Supabase
- ✅ TypeScript types per database
- ⏳ Autenticazione completa
- ⏳ CRUD Pazienti
- ⏳ CRUD Tipi di Prestazione
- ⏳ Calendario e sync Google Calendar
- ⏳ Gestione Pagamenti
- ⏳ Report e Proiezioni
- ⏳ Capacitor per Android
- ⏳ PWA (offline-first)

## Roadmap

### Fase 2: Autenticazione
- Login/Signup
- Password recovery
- 2FA opzionale

### Fase 3: Gestione Anagrafe
- CRUD Pazienti completo
- Tipi di prestazione personalizzabili
- Gestione strutture/centri

### Fase 4: Calendario
- Google Calendar sync (lettura/scrittura)
- Vista calendario (giorno/settimana/mese)
- Drag & drop sedute

### Fase 5: Pagamenti
- Registrazione pagamenti
- Calcolo arretrati/crediti
- Report per paziente

### Fase 6: Report Avanzati
- Dashboard con KPI
- Proiezione guadagni
- Export PDF/Excel

### Fase 7: Mobile
- Build Capacitor
- Testing Android
- PWA manifesto

## Contribuire

Se vuoi contribuire, apri una issue o una pull request!

## Licenza

MIT - Vedi LICENSE per i dettagli.

## Support

Per problemi o domande: https://github.com/StefanoNevePsy/PsyManager/issues
