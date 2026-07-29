import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Search,
  User,
  Users,
  Calendar,
  BookOpen,
  LayoutDashboard,
  Bell,
  CreditCard,
  BarChart3,
  Briefcase,
  Building2,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { usePatients } from '@/hooks/usePatients'
import { usePatientGroups } from '@/hooks/usePatientGroups'
import { useSessions } from '@/hooks/useSessions'
import { useClinicalNotes } from '@/hooks/useClinicalNotes'
import { patientFullName, sessionDisplayName } from '@/lib/sessionDisplay'

/** Custom event name the Header search button dispatches to open the palette
 * without prop drilling — the palette listens for it globally. */
export const OPEN_COMMAND_PALETTE_EVENT = 'psymanager:open-search'

const MAX_RESULTS_PER_CATEGORY = 8
const SESSION_WINDOW_DAYS = 60
const EMPTY_QUERY_HINT = 'Cerca pazienti, sedute, note…'

interface ResultItem {
  id: string
  label: string
  sub: string
  icon: LucideIcon
  onSelect: () => void
}

interface ResultGroup {
  category: string
  items: ResultItem[]
}

const STATIC_PAGES: { label: string; path: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Pazienti', path: '/patients', icon: Users },
  { label: 'Sedute', path: '/sessions', icon: Calendar },
  { label: 'Promemoria', path: '/reminders', icon: Bell },
  { label: 'Diario clinico', path: '/clinical-notes', icon: BookOpen },
  { label: 'Pagamenti', path: '/payments', icon: CreditCard },
  { label: 'Report', path: '/reports', icon: BarChart3 },
  { label: 'Tipi prestazione', path: '/service-types', icon: Briefcase },
  { label: 'Strutture', path: '/structures', icon: Building2 },
  { label: 'Impostazioni', path: '/settings', icon: Settings },
]

/** Case-insensitive, accent-stripped normalization for "fuzzy-ish" substring search. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const patientGroupTypeLabel = (type: string): string => {
  switch (type) {
    case 'couple':
      return 'Coppia'
    case 'family':
      return 'Famiglia'
    default:
      return 'Gruppo'
  }
}

/**
 * Global command palette (Ctrl+K / Cmd+K). Self-contained: mounted once in
 * Header, it also listens for a custom window event so any button anywhere
 * can open it without passing callbacks down the tree.
 */
export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Data sources. Queries are cheap/cached by React Query, so keeping them
  // mounted whenever the palette exists (even closed) just reuses the cache.
  const { data: patients = [] } = usePatients()
  const { data: groups = [] } = usePatientGroups()
  const windowStart = useMemo(
    () => new Date(Date.now() - SESSION_WINDOW_DAYS * 24 * 60 * 60 * 1000),
    []
  )
  const windowEnd = useMemo(
    () => new Date(Date.now() + SESSION_WINDOW_DAYS * 24 * 60 * 60 * 1000),
    []
  )
  const { data: sessions = [] } = useSessions(windowStart, windowEnd)
  const { data: notes = [] } = useClinicalNotes()

  const close = () => {
    setIsOpen(false)
    setQuery('')
    setHighlightedIndex(0)
  }

  // Global open shortcuts: Ctrl+K / Cmd+K and the custom event from Header.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    const handleOpenEvent = () => setIsOpen(true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent)
    }
  }, [])

  // Escape closes + autofocus the input + lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    // Slight delay so the overlay is mounted before we try to focus it.
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 50)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
      clearTimeout(focusTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const normalizedQuery = normalize(query.trim())

  const groupedResults = useMemo<ResultGroup[]>(() => {
    const groups_: ResultGroup[] = []

    // Empty query: just the static pages, nothing else — avoids dumping
    // every patient/session/note on screen before the user types anything.
    if (normalizedQuery === '') {
      groups_.push({
        category: 'Pagine',
        items: STATIC_PAGES.map((page) => ({
          id: `page-${page.path}`,
          label: page.label,
          sub: 'Pagina',
          icon: page.icon,
          onSelect: () => navigate(page.path),
        })),
      })
      return groups_
    }

    const patientItems: ResultItem[] = patients
      .filter((p) => normalize(patientFullName(p)).includes(normalizedQuery))
      .slice(0, MAX_RESULTS_PER_CATEGORY)
      .map((p) => ({
        id: `patient-${p.id}`,
        label: patientFullName(p),
        sub: 'Paziente',
        icon: User,
        onSelect: () => navigate(`/patients/${p.id}`),
      }))
    if (patientItems.length > 0) {
      groups_.push({ category: 'Pazienti', items: patientItems })
    }

    const groupItems: ResultItem[] = groups
      .filter((g) => normalize(g.name).includes(normalizedQuery))
      .slice(0, MAX_RESULTS_PER_CATEGORY)
      .map((g) => ({
        id: `group-${g.id}`,
        label: g.name,
        sub: patientGroupTypeLabel(g.type),
        icon: Users,
        onSelect: () => navigate('/patients'),
      }))
    if (groupItems.length > 0) {
      groups_.push({ category: 'Gruppi', items: groupItems })
    }

    const sessionItems: ResultItem[] = sessions
      .filter((s) => {
        const haystack = `${sessionDisplayName(s)} ${s.service_types?.name ?? ''}`
        return normalize(haystack).includes(normalizedQuery)
      })
      .slice(0, MAX_RESULTS_PER_CATEGORY)
      .map((s) => ({
        id: `session-${s.id}`,
        label: `${sessionDisplayName(s)} · ${format(new Date(s.scheduled_at), "d MMM, HH:mm", { locale: it })}`,
        sub: s.service_types?.name ?? '',
        icon: Calendar,
        onSelect: () =>
          navigate('/sessions', {
            state: { editSessionId: s.id, editSessionDate: s.scheduled_at },
          }),
      }))
    if (sessionItems.length > 0) {
      groups_.push({ category: 'Sedute', items: sessionItems })
    }

    const noteItems: ResultItem[] = notes
      .filter((n) => {
        const haystack = `${n.title ?? ''} ${stripHtml(n.content)}`
        return normalize(haystack).includes(normalizedQuery)
      })
      .slice(0, MAX_RESULTS_PER_CATEGORY)
      .map((n) => ({
        id: `note-${n.id}`,
        label: n.title || stripHtml(n.content).slice(0, 60) || 'Nota senza titolo',
        sub: 'Nota',
        icon: BookOpen,
        onSelect: () => navigate('/clinical-notes', { state: { openNoteId: n.id } }),
      }))
    if (noteItems.length > 0) {
      groups_.push({ category: 'Note cliniche', items: noteItems })
    }

    const pageItems: ResultItem[] = STATIC_PAGES.filter((page) =>
      normalize(page.label).includes(normalizedQuery)
    ).map((page) => ({
      id: `page-${page.path}`,
      label: page.label,
      sub: 'Pagina',
      icon: page.icon,
      onSelect: () => navigate(page.path),
    }))
    if (pageItems.length > 0) {
      groups_.push({ category: 'Pagine', items: pageItems })
    }

    return groups_
  }, [normalizedQuery, patients, groups, sessions, notes, navigate])

  const flatResults = useMemo(
    () => groupedResults.flatMap((g) => g.items),
    [groupedResults]
  )

  // Reset the highlight whenever the query (and thus the result set) changes.
  useEffect(() => {
    setHighlightedIndex(0)
  }, [normalizedQuery])

  const activeIndex = Math.min(highlightedIndex, Math.max(flatResults.length - 1, 0))

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-result-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleSelect = (item: ResultItem) => {
    item.onSelect()
    close()
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatResults[activeIndex]
      if (item) handleSelect(item)
    }
  }

  if (!isOpen) return null

  let rowIndex = -1

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex justify-center items-start pt-[15vh] px-4 animate-fade-in"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ricerca globale"
        className="w-full max-w-xl bg-popover border border-border rounded-xl shadow-modal overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.85} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={EMPTY_QUERY_HINT}
            aria-label="Cerca"
            className="flex-1 h-12 bg-transparent border-0 outline-none text-sm text-popover-foreground placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border text-2xs text-muted-foreground font-medium flex-shrink-0">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {normalizedQuery !== '' && flatResults.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nessun risultato per &laquo;{query.trim()}&raquo;
            </p>
          )}

          {groupedResults.map((group) => (
            <div key={group.category} className="mb-1 last:mb-0">
              <p className="px-4 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.category}
              </p>
              {group.items.map((item) => {
                rowIndex += 1
                const index = rowIndex
                const Icon = item.icon
                const highlighted = index === activeIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-result-index={index}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      highlighted
                        ? 'bg-primary-soft text-primary'
                        : 'text-popover-foreground hover:bg-secondary/60'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        highlighted ? 'text-primary' : 'text-muted-foreground'
                      }`}
                      strokeWidth={1.85}
                    />
                    <span className="flex-1 min-w-0 truncate text-sm font-medium">
                      {item.label}
                    </span>
                    {item.sub && (
                      <span className="flex-shrink-0 text-2xs text-muted-foreground truncate max-w-[35%]">
                        {item.sub}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {normalizedQuery === '' && (
            <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground/70">{EMPTY_QUERY_HINT}</p>
          )}
        </div>
      </div>
    </div>
  )
}
