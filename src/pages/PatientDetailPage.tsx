import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { subMonths, addMonths, format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  ArrowLeft,
  Pencil,
  Plus,
  BookOpen,
  Phone,
  Mail,
  CalendarDays,
  Wallet,
  Users,
  UserRound,
  History,
  ChevronRight,
} from 'lucide-react'
import { usePatient } from '@/hooks/usePatients'
import { usePatientBalanceMap } from '@/hooks/usePayments'
import { useSessions, SessionWithRelations } from '@/hooks/useSessions'
import { useClinicalNotes } from '@/hooks/useClinicalNotes'
import { usePatientFamilyMembers } from '@/hooks/usePatientFamilyMembers'
import { Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui'
import AttachmentList from '@/components/attachments/AttachmentList'
import TagBadge from '@/components/patient-tags/TagBadge'
import { patientFullName, SESSION_STATUS_LABELS } from '@/lib/sessionDisplay'

const formatEuro = (n: number) =>
  `${n < 0 ? '-' : ''}€ ${Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Strip HTML tags for plain-text previews (clinical note content may be rich text). */
const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const statusBadgeClasses: Record<string, string> = {
  scheduled: 'bg-primary-soft text-primary',
  completed: 'bg-success-soft text-success',
  cancelled: 'bg-muted text-muted-foreground line-through',
  no_show: 'bg-destructive-soft text-destructive',
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: patient, isLoading: patientLoading } = usePatient(id)
  const balanceMap = usePatientBalanceMap()
  const { data: familyMembers = [] } = usePatientFamilyMembers(id)
  const { data: notes = [] } = useClinicalNotes(id)

  // 12 months back, 6 months forward is enough to cover "storico" and "prossime"
  const rangeStart = useMemo(() => subMonths(new Date(), 12), [])
  const rangeEnd = useMemo(() => addMonths(new Date(), 6), [])
  const { data: rangeSessions = [], isLoading: sessionsLoading } = useSessions(
    rangeStart,
    rangeEnd
  )

  const patientSessions = useMemo(
    () => rangeSessions.filter((s) => s.patient_id === id),
    [rangeSessions, id]
  )

  const nowMs = Date.now()

  const upcomingSessions = useMemo(
    () =>
      patientSessions
        .filter((s) => new Date(s.scheduled_at).getTime() > nowMs)
        .sort(
          (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        )
        .slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patientSessions]
  )

  const pastSessions = useMemo(
    () =>
      patientSessions
        .filter((s) => new Date(s.scheduled_at).getTime() <= nowMs)
        .sort(
          (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patientSessions]
  )

  const balance = id ? balanceMap.get(id) ?? 0 : 0
  const nextAppointment = upcomingSessions[0]

  const handleSessionClick = (session: SessionWithRelations) => {
    navigate('/sessions', {
      state: { editSessionId: session.id, editSessionDate: session.scheduled_at },
    })
  }

  const recentNotes = notes.slice(0, 5)

  const isLoading = patientLoading

  if (isLoading) {
    return (
      <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-40 bg-muted" />
        <Skeleton className="h-16 w-full bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full bg-muted" />
          ))}
        </div>
        <Skeleton className="h-64 w-full bg-muted" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="px-4 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">
        <Card variant="quiet">
          <EmptyState
            icon={UserRound}
            tone="neutral"
            title="Paziente non trovato"
            description="Il paziente cercato non esiste o è stato eliminato."
            action={
              <Link to="/patients">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4" strokeWidth={2.25} />
                  Torna ai pazienti
                </Button>
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const fullName = patientFullName(patient)
  const isDebit = balance > 0.005
  const isCredit = balance < -0.005

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Tutti i pazienti
      </Link>

      <PageHeader
        eyebrow="Scheda paziente"
        title={fullName}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/patients', { state: { editPatientId: patient.id } })}
            >
              <Pencil className="w-4 h-4" strokeWidth={2.25} />
              Modifica
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate('/clinical-notes', { state: { newNotePatientId: patient.id } })
              }
            >
              <BookOpen className="w-4 h-4" strokeWidth={2.25} />
              Nuova nota
            </Button>
            <Button
              onClick={() =>
                navigate('/sessions', { state: { newSessionPatientId: patient.id } })
              }
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              Nuova seduta
            </Button>
          </div>
        }
      />

      {patient.patient_tags && patient.patient_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-4">
          {patient.patient_tags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} color={tag.color} icon={tag.icon} size="sm" />
          ))}
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center ${
                isDebit
                  ? 'bg-warning-soft text-warning'
                  : isCredit
                    ? 'bg-primary-soft text-primary'
                    : 'bg-success-soft text-success'
              }`}
            >
              <Wallet className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                {isDebit ? 'Arretrato' : isCredit ? 'Credito' : 'Saldo'}
              </p>
              <p
                className={`text-lg font-semibold tabular-nums ${
                  isDebit ? 'text-warning' : isCredit ? 'text-primary' : 'text-success'
                }`}
              >
                {isDebit || isCredit ? formatEuro(Math.abs(balance)) : 'Saldato'}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center bg-secondary text-foreground">
              <History className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                Sedute svolte
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {sessionsLoading ? '—' : pastSessions.length}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center bg-primary-soft text-primary">
              <CalendarDays className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                Prossimo appuntamento
              </p>
              <p className="text-lg font-semibold text-foreground truncate">
                {sessionsLoading
                  ? '—'
                  : nextAppointment
                    ? format(new Date(nextAppointment.scheduled_at), "d MMM 'alle' HH:mm", {
                        locale: it,
                      })
                    : 'Nessuno'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Prossime sedute */}
          <Card padding="none">
            <div className="px-5 pt-5 pb-3">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                Prossime sedute
              </h2>
            </div>
            {sessionsLoading ? (
              <div className="px-5 pb-5 space-y-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-muted" />
                ))}
              </div>
            ) : upcomingSessions.length === 0 ? (
              <EmptyState
                size="sm"
                icon={CalendarDays}
                tone="neutral"
                title="Nessuna seduta in programma"
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcomingSessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => handleSessionClick(session)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {format(new Date(session.scheduled_at), "EEEE d MMMM yyyy 'alle' HH:mm", {
                            locale: it,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.service_types?.name}
                        </p>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-muted-foreground flex-shrink-0"
                        strokeWidth={2}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Storico sedute */}
          <Card padding="none">
            <div className="px-5 pt-5 pb-3">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                Storico sedute
              </h2>
            </div>
            {sessionsLoading ? (
              <div className="px-5 pb-5 space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-muted" />
                ))}
              </div>
            ) : pastSessions.length === 0 ? (
              <EmptyState
                size="sm"
                icon={History}
                tone="neutral"
                title="Nessuna seduta passata"
              />
            ) : (
              <ul className="divide-y divide-border">
                {pastSessions.slice(0, 10).map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => handleSessionClick(session)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {format(new Date(session.scheduled_at), 'd MMMM yyyy · HH:mm', {
                            locale: it,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.service_types?.name}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-2xs px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                          statusBadgeClasses[session.status] ||
                          'bg-secondary text-foreground'
                        }`}
                      >
                        {SESSION_STATUS_LABELS[session.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Diario clinico */}
          <Card padding="none">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                Diario clinico
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate('/clinical-notes', { state: { newNotePatientId: patient.id } })
                }
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                Nuova nota
              </Button>
            </div>
            {recentNotes.length === 0 ? (
              <EmptyState
                size="sm"
                icon={BookOpen}
                tone="neutral"
                title="Nessuna nota clinica"
              />
            ) : (
              <ul className="divide-y divide-border">
                {recentNotes.map((note) => {
                  const snippet = stripHtml(note.content || '')
                  return (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/clinical-notes', { state: { openNoteId: note.id } })
                        }
                        className="w-full text-left px-5 py-3 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold tabular-nums">
                            {format(new Date(note.note_date), 'd MMM yyyy', { locale: it })}
                          </p>
                          {note.title && (
                            <p className="text-sm font-medium text-foreground truncate">
                              {note.title}
                            </p>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {snippet || 'Nessun contenuto'}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Contatti */}
          <Card padding="md">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground mb-3">
              Contatti
            </h2>
            <ul className="space-y-2">
              {patient.phone && (
                <li>
                  <a
                    href={`tel:${patient.phone}`}
                    className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.85} />
                    <span className="tabular-nums truncate">{patient.phone}</span>
                  </a>
                </li>
              )}
              {patient.email && (
                <li>
                  <a
                    href={`mailto:${patient.email}`}
                    className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.85} />
                    <span className="truncate">{patient.email}</span>
                  </a>
                </li>
              )}
              {(patient.patient_contacts || []).map((contact) => (
                <li key={contact.id}>
                  <a
                    href={contact.kind === 'phone' ? `tel:${contact.value}` : `mailto:${contact.value}`}
                    className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                  >
                    {contact.kind === 'phone' ? (
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.85} />
                    ) : (
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.85} />
                    )}
                    <span className={`truncate ${contact.kind === 'phone' ? 'tabular-nums' : ''}`}>
                      {contact.value}
                    </span>
                    {contact.label && (
                      <span className="flex-shrink-0 text-2xs px-1.5 py-0.5 rounded bg-secondary text-foreground font-semibold">
                        {contact.label}
                      </span>
                    )}
                  </a>
                </li>
              ))}
              {!patient.phone &&
                !patient.email &&
                (patient.patient_contacts || []).length === 0 && (
                  <li className="text-sm text-muted-foreground italic">Nessun contatto</li>
                )}
            </ul>
          </Card>

          {/* Genogramma */}
          <Card padding="md">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4" strokeWidth={1.85} />
              Genogramma
            </h2>
            {familyMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nessun familiare registrato
              </p>
            ) : (
              <ul className="space-y-2.5">
                {familyMembers.map((member) => (
                  <li key={member.id} className="text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {member.full_name || member.relationship}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {member.relationship}
                        {member.age != null ? ` · ${member.age} anni` : ''}
                      </span>
                      {!member.alive && (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                          Deceduto/a
                        </span>
                      )}
                    </div>
                    {member.relationship_quality && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Rapporto: {member.relationship_quality}
                      </p>
                    )}
                    {member.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">{member.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Allegati */}
          <Card padding="md">
            <AttachmentList ownerType="patient" ownerId={patient.id} />
          </Card>
        </div>
      </div>
    </div>
  )
}
