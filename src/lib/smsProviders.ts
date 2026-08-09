/**
 * SMS provider presets.
 *
 * These exist so the user configuring `sms_credentials` (see
 * `SmsCredentialsCard`) never has to hand-write a JSON/form body or guess an
 * endpoint URL — picking a preset fills the form, which stays fully
 * editable afterwards.
 *
 * IMPORTANT: the endpoint URLs, auth schemes and body templates below are a
 * best-effort starting point captured at the time this file was written.
 * Providers change their REST APIs without notice — before relying on a
 * preset in production, verify the exact field names, auth method and
 * endpoint against that provider's *current* official documentation (the
 * `docsHint` on each preset is a pointer, not a guarantee).
 */

export type SmsAuthType = 'basic' | 'bearer' | 'none'
export type SmsBodyFormat = 'json' | 'form'

export interface SmsProviderPreset {
  id: string
  label: string
  /** Short pointer to where to double-check the current API contract. */
  docsHint: string
  endpoint_url: string
  auth_type: SmsAuthType
  body_format: SmsBodyFormat
  body_template: string
  credentialLabels: {
    /** Label for the "user"/key field, or '—' if the provider doesn't use one. */
    user: string
    secret: string
  }
}

export const SMS_PROVIDER_PRESETS: SmsProviderPreset[] = [
  {
    id: 'smshosting',
    label: 'SMSHosting (Italia)',
    docsHint: 'Verifica i campi correnti su api.smshosting.it/docs prima dell’uso.',
    endpoint_url: 'https://api.smshosting.it/rest/api/sms/send',
    auth_type: 'basic',
    body_format: 'json',
    body_template: '{"from":"{{sender}}","to":"{{to}}","text":"{{text}}"}',
    credentialLabels: { user: 'Auth Key', secret: 'Auth Secret' },
  },
  {
    id: 'twilio',
    label: 'Twilio',
    docsHint:
      'Sostituisci ACCOUNT_SID nell’URL con il tuo Account SID (visibile nella Twilio Console).',
    endpoint_url: 'https://api.twilio.com/2010-04-01/Accounts/ACCOUNT_SID/Messages.json',
    auth_type: 'basic',
    body_format: 'form',
    body_template: 'From={{sender}}&To=%2B{{to}}&Body={{text}}',
    credentialLabels: { user: 'Account SID', secret: 'Auth Token' },
  },
  {
    id: 'aruba',
    label: 'Aruba SMS',
    docsHint: 'Verifica i campi correnti sulla documentazione REST di Aruba SMS.',
    endpoint_url: 'https://adminsms.aruba.it/API/v1.0/REST/sms',
    auth_type: 'bearer',
    body_format: 'json',
    body_template:
      '{"message":"{{text}}","recipient":["+{{to}}"],"sender":"{{sender}}","message_type":"N"}',
    credentialLabels: { user: '—', secret: 'Token' },
  },
  {
    id: 'custom',
    label: 'Altro provider',
    docsHint: 'Compila i campi seguendo la documentazione del tuo provider SMS.',
    endpoint_url: '',
    auth_type: 'none',
    body_format: 'json',
    body_template: '',
    credentialLabels: { user: 'Utente / Chiave', secret: 'Password / Token' },
  },
]

export const getSmsProviderPreset = (id: string): SmsProviderPreset | undefined =>
  SMS_PROVIDER_PRESETS.find((p) => p.id === id)

/** Placeholders usable inside `body_template`, explained for the settings UI. */
export const PLACEHOLDER_HELP: { placeholder: string; description: string }[] = [
  {
    placeholder: '{{to}}',
    description: 'Numero di destinazione in formato internazionale, senza "+" (es. 393331234567).',
  },
  {
    placeholder: '{{text}}',
    description: 'Testo del messaggio da inviare.',
  },
  {
    placeholder: '{{sender}}',
    description: 'Nome o numero mittente, come registrato presso il provider.',
  },
]
