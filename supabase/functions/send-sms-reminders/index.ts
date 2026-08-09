// supabase/functions/send-sms-reminders/index.ts
//
// Scheduled job: sends SMS appointment reminders for every user who has
// opted in (reminder_settings.sms_enabled = true). Invoked by an external
// scheduler (pg_cron + pg_net, or a GitHub Actions cron) — see
// docs/SMS_REMINDERS.md for both setup options.
//
// This function runs with the SERVICE ROLE key and therefore bypasses RLS
// ON PURPOSE: it must read across every user's sessions/patients to do its
// job, something no single user's session could do. Access to the endpoint
// itself is gated by a shared secret (x-cron-secret), never by a Supabase
// user JWT — deploy it with `--no-verify-jwt` (see docs).
//
// Safety properties this file is built around:
//  - reminder_deliveries has a UNIQUE(session_id, channel) constraint. We
//    INSERT the 'pending' row before sending, so a second overlapping run
//    (or a retried cron tick) gets a unique-violation and backs off instead
//    of sending twice.
//  - One user's error (bad settings, provider outage, ...) is caught and
//    logged without aborting the other users. Same for one session's error
//    within a user's batch.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { getProvider, estimateSegments } from "./providers.ts"
import { renderTemplate, normalizePhone, TemplateSession } from "../_shared/template.ts"

const ROME_TZ = "Europe/Rome"

interface ReminderSettingsRow {
  user_id: string
  sms_enabled: boolean
  sms_provider: string
  sms_sender: string
  sms_advance_minutes: number
  sms_template: string
  sms_quiet_start: number
  sms_quiet_end: number
  sms_rule: "all" | "first" | "no_show" | "manual"
}

interface PatientRow {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  sms_consent: boolean | null
}

interface SessionRow extends TemplateSession {
  id: string
  user_id: string
  patient_id: string | null
  group_id: string | null
  status: string
  patients: PatientRow | null
}

interface Summary {
  processed: number
  sent: number
  failed: number
  skipped: number
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

/**
 * Is `hour` (0-23, Europe/Rome local time) inside the [start, end) quiet
 * window? The window wraps midnight when start > end (e.g. 21 -> 8 means
 * "quiet from 21:00 to 07:59"). start === end means no quiet window at all.
 */
const isQuietHour = (hour: number, start: number, end: number): boolean => {
  if (start === end) return false
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end
}

const currentRomeHour = (): number => {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date())
  return parseInt(formatted, 10)
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const cronSecret = Deno.env.get("CRON_SECRET")
  const providedSecret = req.headers.get("x-cron-secret")
  if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("send-sms-reminders: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const summary: Summary = { processed: 0, sent: 0, failed: 0, skipped: 0 }

  const { data: settingsRows, error: settingsError } = await supabase
    .from("reminder_settings")
    .select(
      "user_id, sms_enabled, sms_provider, sms_sender, sms_advance_minutes, sms_template, sms_quiet_start, sms_quiet_end, sms_rule"
    )
    .eq("sms_enabled", true)

  if (settingsError) {
    console.error("send-sms-reminders: failed to load reminder_settings", settingsError)
    return jsonResponse({ error: "Failed to load reminder_settings" }, 500)
  }

  if (!settingsRows || settingsRows.length === 0) {
    return jsonResponse({ sent: 0 })
  }

  const nowHour = currentRomeHour()

  for (const settings of settingsRows as ReminderSettingsRow[]) {
    try {
      await processUser(supabase, settings, nowHour, summary)
    } catch (err) {
      // A single user must never take the whole run down.
      console.error(`send-sms-reminders: user ${settings.user_id} failed`, err)
    }
  }

  console.log("send-sms-reminders: run complete", summary)
  return jsonResponse(summary)
})

async function processUser(
  supabase: SupabaseClient,
  settings: ReminderSettingsRow,
  nowHour: number,
  summary: Summary
): Promise<void> {
  if (settings.sms_rule === "manual") {
    // Nothing to do automatically for this user; SMS only go out via a
    // manual, per-patient action elsewhere in the app.
    return
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + settings.sms_advance_minutes * 60_000)

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      `id, user_id, patient_id, group_id, status, scheduled_at, duration_minutes, session_type,
       patients(id, first_name, last_name, phone, sms_consent),
       patient_groups(name),
       service_types(name)`
    )
    .eq("user_id", settings.user_id)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", windowEnd.toISOString())
    .not("status", "in", "(cancelled,no_show)")

  if (sessionsError) {
    console.error(`send-sms-reminders: failed to load sessions for user ${settings.user_id}`, sessionsError)
    return
  }

  for (const session of (sessions ?? []) as SessionRow[]) {
    summary.processed++
    try {
      const outcome = await processSession(supabase, settings, session, nowHour)
      summary[outcome]++
    } catch (err) {
      console.error(`send-sms-reminders: session ${session.id} failed`, err)
      summary.failed++
    }
  }
}

type SessionOutcome = "sent" | "failed" | "skipped"

async function processSession(
  supabase: SupabaseClient,
  settings: ReminderSettingsRow,
  session: SessionRow,
  nowHour: number
): Promise<SessionOutcome> {
  // Group sessions have no single recipient phone — no automatic SMS for them.
  if (session.group_id || !session.patient_id) return "skipped"

  const patient = session.patients
  if (!patient || !patient.sms_consent) return "skipped"

  const phone = normalizePhone(patient.phone)
  if (!phone) return "skipped"

  // Idempotency check: has this (session, sms) already been claimed/sent?
  const { data: existingDelivery, error: existingError } = await supabase
    .from("reminder_deliveries")
    .select("id, status")
    .eq("session_id", session.id)
    .eq("channel", "sms")
    .maybeSingle()

  if (existingError) throw existingError
  if (existingDelivery && ["sent", "delivered", "pending"].includes(existingDelivery.status)) {
    return "skipped"
  }

  // sms_rule filtering. 'all' needs no extra query. 'first' and 'no_show'
  // each cost one small indexed query per session (patient_id + user_id are
  // indexed) — acceptable here since this only runs for sessions that
  // already passed consent/phone checks, i.e. the sessions actually worth
  // sending to.
  if (settings.sms_rule === "first") {
    const { data: earliest, error: earliestError } = await supabase
      .from("sessions")
      .select("id")
      .eq("user_id", settings.user_id)
      .eq("patient_id", session.patient_id)
      .not("status", "in", "(cancelled,no_show)")
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (earliestError) throw earliestError
    if (!earliest || earliest.id !== session.id) return "skipped"
  } else if (settings.sms_rule === "no_show") {
    const { data: pastNoShow, error: noShowError } = await supabase
      .from("sessions")
      .select("id")
      .eq("user_id", settings.user_id)
      .eq("patient_id", session.patient_id)
      .eq("status", "no_show")
      .lt("scheduled_at", new Date().toISOString())
      .limit(1)
      .maybeSingle()

    if (noShowError) throw noShowError
    if (!pastNoShow) return "skipped"
  }
  // 'all' falls through with no extra query.

  // Quiet hours: hold off silently, no delivery row written, so the next
  // run (still inside the send window) re-evaluates and sends it once the
  // window opens.
  if (isQuietHour(nowHour, settings.sms_quiet_start, settings.sms_quiet_end)) {
    return "skipped"
  }

  const message = renderTemplate(settings.sms_template, session)
  const { encoding, segments, chars } = estimateSegments(message)
  console.log(
    `send-sms-reminders: session ${session.id} -> ${chars} chars, ${encoding}, ${segments} segment(s)`
  )

  // Claim the send: insert the 'pending' row first. The UNIQUE(session_id,
  // channel) constraint is the real lock — if another overlapping run beat
  // us here, this insert fails with 23505 and we back off cleanly.
  const { data: claimed, error: claimError } = await supabase
    .from("reminder_deliveries")
    .insert({
      user_id: settings.user_id,
      session_id: session.id,
      channel: "sms",
      status: "pending",
      provider: settings.sms_provider,
      recipient: phone,
      scheduled_for: session.scheduled_at,
    })
    .select("id")
    .single()

  if (claimError) {
    if (claimError.code === "23505") return "skipped" // already claimed by another run
    throw claimError
  }

  try {
    const provider = getProvider(settings.sms_provider)
    const result = await provider.send(phone, message, settings.sms_sender)

    const sentAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from("reminder_deliveries")
      .update({
        status: "sent",
        provider_message_id: result.id ?? null,
        sent_at: sentAt,
      })
      .eq("id", claimed.id)
    if (updateError) throw updateError

    const { error: sessionUpdateError } = await supabase
      .from("sessions")
      .update({ reminder_sent_at: sentAt })
      .eq("id", session.id)
    if (sessionUpdateError) {
      // The SMS is already out; failing to stamp reminder_sent_at only
      // affects the in-app "handled" indicator, not delivery correctness.
      console.error(`send-sms-reminders: sent but failed to stamp session ${session.id}`, sessionUpdateError)
    }

    return "sent"
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : String(sendError)
    await supabase
      .from("reminder_deliveries")
      .update({ status: "failed", error: message.slice(0, 2000) })
      .eq("id", claimed.id)
    console.error(`send-sms-reminders: send failed for session ${session.id}`, message)
    return "failed"
  }
}
