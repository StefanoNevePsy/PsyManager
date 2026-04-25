# PsyManager - Developer Guide

## Project Overview

PsyManager è un gestionale completo e gratuito per psicologi e terapeuti. È una Progressive Web App (PWA) costruita con React e TypeScript che funziona su PC, tablet e mobile Android via Capacitor.

## Architecture

### Frontend Stack
- **Framework**: React 19 + TypeScript + Vite
- **UI Framework**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **State Management**: Zustand + React Query
- **Forms**: React Hook Form + Zod
- **Mobile**: Capacitor (Android/iOS)

### Backend Stack
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Email/Password)
- **API**: REST via Supabase
- **External APIs**: Google Calendar API

### Deployment
- **Frontend**: GitHub Pages (static hosting)
- **Backend**: Supabase Cloud (serverless)
- **Mobile**: Capacitor → Android APK

## Project Structure

```
src/
├── components/
│   ├── Header.tsx          # Top navigation bar with theme toggle
│   ├── Sidebar.tsx         # Left navigation menu
│   └── Layout.tsx          # Main layout wrapper
├── pages/
│   ├── LoginPage.tsx       # Authentication page
│   ├── DashboardPage.tsx   # Main dashboard with stats
│   ├── PatientsPage.tsx    # Patient management
│   ├── SessionsPage.tsx    # Session calendar
│   ├── PaymentsPage.tsx    # Payment tracking
│   ├── ReportsPage.tsx     # Analytics and reports
│   └── SettingsPage.tsx    # User settings
├── hooks/
│   └── useTheme.ts         # Theme management hook
├── lib/
│   ├── supabase.ts         # Supabase client initialization
│   └── themes.ts           # Theme definitions (extensible)
├── types/
│   ├── database.ts         # Database type definitions
│   └── theme.ts            # Theme type definitions
├── stores/                 # Zustand stores (to be implemented)
├── utils/                  # Utility functions
├── styles/
│   └── globals.css         # Global styles with CSS variables
└── App.tsx                 # Main app component with routing

public/                      # Static assets
.github/workflows/
└── deploy.yml              # GitHub Actions CI/CD
```

## Key Design Decisions

### 1. Theme System
- **Approach**: CSS variables with class-based switching
- **Extensibility**: Easy to add new themes by defining them in `src/lib/themes.ts`
- **Currently Supported**: Light and Dark modes
- **Future**: Themes can include multiple color schemes, high contrast modes, etc.

### 2. Database Design
- **Multi-tenancy**: Each user owns all their data via RLS (Row Level Security)
- **Type Safety**: Full TypeScript types generated from database schema
- **Service Types**: Flexible "service_types" table allows users to create custom therapy types
- **Sessions**: Linked to patients and service types for complete tracking
- **Payments**: Supports both direct patient payments and package deals with structures

### 3. Google Calendar Sync
- **Bidirectional**: Changes in app sync to Calendar and vice versa
- **Storage**: Uses `extendedProperties` to store metadata without modifying event titles
- **Conflict Resolution**: Latest update wins (can be refined later)

### 4. Authentication Flow
- Supabase handles email verification and password management
- OAuth 2.0 for Google Calendar integration
- 2FA support available but optional

## Development Workflow

### Starting the Dev Server
```bash
npm run dev
```
Opens on `http://localhost:3000`

### Building for Production
```bash
npm run build
```
Creates optimized bundle in `dist/`

### Type Checking
```bash
npm run type-check
```

### Deploying to GitHub Pages
```bash
# Manual deployment
npm run build
# Files from dist/ are automatically deployed via GitHub Actions on push to main
```

### Building for Android
```bash
npm install @capacitor/core @capacitor/cli
npx cap init    # First time only
npx cap add android
npm run build
npx cap copy
npx cap open android  # Opens Android Studio
```

## Database Setup (Supabase)

1. Create a Supabase project at https://app.supabase.com
2. Copy the SQL schema from `database.sql` into Supabase SQL Editor
3. Enable Google OAuth provider in Authentication settings
4. Set environment variables in `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GOOGLE_CLIENT_ID=your-client-id
   VITE_GOOGLE_CALENDAR_API_KEY=your-api-key
   ```

## Component Guidelines

### Creating New Pages
1. Create file in `src/pages/[FeatureName]Page.tsx`
2. Export default React component
3. Use layout from `Layout.tsx` (auto-included)
4. Follow existing pattern for consistency

### Creating New Components
1. Create file in `src/components/[ComponentName].tsx`
2. Use TypeScript with proper prop types
3. Import icons from `lucide-react`
4. Use Tailwind classes for styling
5. Example:
   ```tsx
   import { Plus } from 'lucide-react'
   
   interface Props {
     label: string
     onClick: () => void
   }
   
   export default function Button({ label, onClick }: Props) {
     return (
       <button 
         onClick={onClick}
         className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90"
       >
         <Plus className="w-5 h-5 mr-2 inline" />
         {label}
       </button>
     )
   }
   ```

## Styling Guidelines

- Use Tailwind CSS utility classes
- For theme colors, use CSS variables defined in `src/styles/globals.css`
- Avoid inline styles
- Responsive design: use `md:`, `lg:` breakpoints
- Color precedence: Use semantic colors (primary, secondary, etc.) over raw colors

## State Management

### When to Use What
- **React State**: Component-local state, forms
- **Zustand**: Global app state, user preferences, theme
- **React Query**: Server state, API data caching
- **localStorage**: Persistent client data (theme preference)

## Next Steps / TODO

- [ ] Implement Supabase authentication (login/signup)
- [ ] Create patient management CRUD
- [ ] Implement service type customization
- [ ] Build calendar view with date selection
- [ ] Add Google Calendar OAuth flow
- [ ] Implement payment tracking
- [ ] Create report generation
- [ ] Add offline support (service workers)
- [ ] Build Capacitor Android app
- [ ] Setup PWA manifest

## Important Notes

- **Security**: Supabase RLS policies ensure users can only access their own data
- **Performance**: React Query handles caching; avoid unnecessary re-renders
- **Mobile**: Keep components responsive and touch-friendly
- **Accessibility**: Use semantic HTML, proper ARIA labels
- **Git**: Use feature branches, meaningful commit messages

## Testing

TODO: Set up testing framework (Jest + React Testing Library)

## Deployment Checklist

- [ ] Set all environment variables in GitHub repo secrets
- [ ] Update `homepage` in package.json for correct base path
- [ ] Configure custom domain (optional)
- [ ] Setup email verification in Supabase
- [ ] Test on actual mobile devices
- [ ] Setup analytics (optional)
- [ ] Privacy policy and terms of service

---

For questions or clarifications, refer to README.md or create an issue on GitHub.
