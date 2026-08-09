// SMS provider adapters for send-sms-reminders.
//
// All credentials come from Edge Function secrets (`supabase secrets set`),
// never from the database — reminder_settings only stores the provider NAME
// and the alphanumeric sender, both non-secret.

export interface SmsProvider {
  send(to: string, text: string, sender: string): Promise<{ id?: string }>
}

// -----------------------------------------------------------------------------
// Segment estimator (GSM-7 vs UCS-2)
// -----------------------------------------------------------------------------

/**
 * GSM 03.38 default alphabet, single-septet characters. Anything outside
 * this set (and outside GSM_7_EXTENDED below) forces the whole message into
 * UCS-2, which is a much smaller 70-char budget per segment — an accented
 * word or a smart-quote apostrophe pasted from Word is the classic way a
 * "short" SMS silently turns into 3 billed segments.
 */
const GSM_7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

/**
 * Extended GSM-7 characters: still GSM-7, but each costs 2 septets because
 * it's sent as an ESC + code pair.
 */
const GSM_7_EXTENDED = '^{}\\[~]|€'

const GSM_7_BASIC_SET = new Set(GSM_7_BASIC)
const GSM_7_EXTENDED_SET = new Set(GSM_7_EXTENDED)

export interface SegmentEstimate {
  encoding: 'GSM-7' | 'UCS-2'
  segments: number
  chars: number
}

/**
 * Estimate the SMS encoding and segment count for a message body.
 * This is an approximation (real providers do the authoritative count) but
 * it's accurate enough to catch "this template is going to bill 2x" before
 * it ships, and we log it per send so cost regressions show up in logs.
 */
export const estimateSegments = (text: string): SegmentEstimate => {
  let isGsm7 = true
  let effectiveLength = 0

  for (const ch of text) {
    if (GSM_7_BASIC_SET.has(ch)) {
      effectiveLength += 1
    } else if (GSM_7_EXTENDED_SET.has(ch)) {
      effectiveLength += 2
    } else {
      isGsm7 = false
      break
    }
  }

  if (isGsm7) {
    const singleSegmentLimit = 160
    const multiSegmentLimit = 153 // 7 septets reserved for the UDH when concatenated
    const segments =
      effectiveLength <= singleSegmentLimit ? 1 : Math.ceil(effectiveLength / multiSegmentLimit)
    return { encoding: 'GSM-7', segments, chars: text.length }
  }

  const singleSegmentLimit = 70
  const multiSegmentLimit = 67
  const segments =
    text.length <= singleSegmentLimit ? 1 : Math.ceil(text.length / multiSegmentLimit)
  return { encoding: 'UCS-2', segments, chars: text.length }
}

// -----------------------------------------------------------------------------
// Skebby (https://developers.skebby.it) — most common Italian SMS gateway
// -----------------------------------------------------------------------------

interface SkebbySession {
  userKey: string
  sessionKey: string
}

// Cached for the lifetime of this function instance only (Deno isolates are
// recycled by the platform; a cold start just logs in again). Skebby session
// keys are valid for a while, so within one invocation batch (many sessions,
// same login) this avoids re-authenticating on every SMS.
let skebbySessionCache: SkebbySession | null = null

const skebbyLogin = async (): Promise<SkebbySession> => {
  const username = Deno.env.get('SKEBBY_USERNAME')
  const password = Deno.env.get('SKEBBY_PASSWORD')
  if (!username || !password) {
    throw new Error(
      'Skebby non configurato: impostare i secrets SKEBBY_USERNAME e SKEBBY_PASSWORD (supabase secrets set ...).'
    )
  }

  const url = new URL('https://api.skebby.it/API/v1.0/REST/login')
  url.searchParams.set('username', username)
  url.searchParams.set('password', password)

  const res = await fetch(url, { method: 'GET' })
  const body = (await res.text()).trim()

  if (!res.ok) {
    throw new Error(`Skebby login fallito (HTTP ${res.status}): ${body}`)
  }

  // Skebby's REST login returns a plain-text "<user_key>;<session_key>" body.
  const [userKey, sessionKey] = body.split(';').map((s) => s.trim())
  if (!userKey || !sessionKey) {
    throw new Error(`Skebby login: risposta inattesa "${body}"`)
  }

  return { userKey, sessionKey }
}

const skebbyGetSession = async (): Promise<SkebbySession> => {
  if (skebbySessionCache) return skebbySessionCache
  skebbySessionCache = await skebbyLogin()
  return skebbySessionCache
}

const skebbyProvider: SmsProvider = {
  async send(to, text, sender) {
    let session = await skebbyGetSession()

    const doSend = async (s: SkebbySession) =>
      fetch('https://api.skebby.it/API/v1.0/REST/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          user_key: s.userKey,
          Session_key: s.sessionKey,
        },
        body: JSON.stringify({
          message_type: 'GP', // "Good Priority" — high-quality route, delivery report available
          message: text,
          recipient: [`+${to}`],
          sender,
        }),
      })

    let res = await doSend(session)

    // Session key expired mid-batch: log in once more and retry a single time.
    if (res.status === 401 || res.status === 403) {
      skebbySessionCache = null
      session = await skebbyGetSession()
      res = await doSend(session)
    }

    const raw = await res.text()
    if (!res.ok) {
      throw new Error(`Skebby invio fallito (HTTP ${res.status}): ${raw}`)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }

    // Skebby's response shape has varied across API versions; take the first
    // id-like field we recognize and otherwise degrade gracefully (the send
    // itself already succeeded — an unmatched id only affects delivery-receipt
    // reconciliation, not whether the SMS went out).
    const id =
      (parsed && typeof parsed === 'object' &&
        ((parsed as Record<string, unknown>).order_id ||
          (parsed as Record<string, unknown>).message_id ||
          (parsed as Record<string, unknown>).id)) ||
      undefined

    return { id: id ? String(id) : undefined }
  },
}

// -----------------------------------------------------------------------------
// Twilio
// -----------------------------------------------------------------------------

const twilioProvider: SmsProvider = {
  async send(to, text, sender) {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    if (!accountSid || !authToken) {
      throw new Error(
        'Twilio non configurato: impostare i secrets TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN (supabase secrets set ...).'
      )
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const body = new URLSearchParams({ From: sender, To: `+${to}`, Body: text })
    const auth = btoa(`${accountSid}:${authToken}`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    const raw = await res.text()
    if (!res.ok) {
      throw new Error(`Twilio invio fallito (HTTP ${res.status}): ${raw}`)
    }

    let parsed: { sid?: string } = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      // leave parsed empty; send still succeeded per res.ok
    }

    return { id: parsed.sid }
  },
}

// -----------------------------------------------------------------------------
// Generic webhook — escape hatch for any other Italian SMS provider
// -----------------------------------------------------------------------------

const genericProvider: SmsProvider = {
  async send(to, text, sender) {
    const webhookUrl = Deno.env.get('SMS_WEBHOOK_URL')
    if (!webhookUrl) {
      throw new Error(
        'Provider "generic" non configurato: impostare il secret SMS_WEBHOOK_URL (e opzionalmente SMS_WEBHOOK_TOKEN).'
      )
    }
    const token = Deno.env.get('SMS_WEBHOOK_TOKEN')

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ to, text, sender }),
    })

    const raw = await res.text()
    if (!res.ok) {
      throw new Error(`Webhook SMS fallito (HTTP ${res.status}): ${raw}`)
    }

    let parsed: { id?: string } = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      // leave parsed empty; send still succeeded per res.ok
    }

    return { id: parsed.id }
  },
}

// -----------------------------------------------------------------------------

export const getProvider = (name: string): SmsProvider => {
  switch (name) {
    case 'skebby':
      return skebbyProvider
    case 'twilio':
      return twilioProvider
    case 'generic':
      return genericProvider
    default:
      throw new Error(`Provider SMS sconosciuto: "${name}"`)
  }
}
