import { z } from 'zod'

export const patientContactSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(['phone', 'email']),
  label: z.string().max(50).optional().or(z.literal('')),
  value: z
    .string()
    .min(1, 'Il valore è obbligatorio')
    .refine((v) => v.length > 0, 'Il valore è obbligatorio'),
})

export type PatientContactFormData = z.infer<typeof patientContactSchema>

export const familyMemberSchema = z.object({
  id: z.string().optional(),
  relationship: z.string().min(1, 'Specifica la relazione'),
  full_name: z.string().max(100).optional().or(z.literal('')),
  age: z.number().int().min(0).max(130).nullable().optional(),
  alive: z.boolean(),
  relationship_quality: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type FamilyMemberFormData = z.infer<typeof familyMemberSchema>

export const patientSchema = z.object({
  first_name: z.string().min(1, 'Il nome è obbligatorio').max(100),
  last_name: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  group_id: z.string().optional().or(z.literal('')),
  group_role: z.string().max(50).optional().or(z.literal('')),
  contacts: z.array(patientContactSchema).optional(),
  family_members: z.array(familyMemberSchema).optional(),
})

export type PatientFormData = z.infer<typeof patientSchema>

export const patientGroupSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio').max(100),
  type: z.enum(['couple', 'family', 'other']),
  notes: z.string().optional().or(z.literal('')),
})

export type PatientGroupFormData = z.infer<typeof patientGroupSchema>

export const clinicalNoteSchema = z.object({
  patient_id: z.string().min(1, 'Il paziente è obbligatorio'),
  session_id: z.string().optional().or(z.literal('')),
  title: z.string().max(200).optional().or(z.literal('')),
  content: z.string().min(1, 'La nota non può essere vuota'),
  note_date: z.string().min(1, 'La data è obbligatoria'),
})

export type ClinicalNoteFormData = z.infer<typeof clinicalNoteSchema>

export const serviceTypeSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio').max(100),
  duration_minutes: z
    .number({ message: 'Inserisci una durata valida' })
    .int()
    .min(1, 'La durata deve essere maggiore di 0')
    .max(600, 'La durata non può superare 10 ore'),
  price: z
    .number({ message: 'Inserisci un prezzo valido' })
    .min(0, 'Il prezzo non può essere negativo'),
  type: z.enum(['private', 'package']),
})

export type ServiceTypeFormData = z.infer<typeof serviceTypeSchema>

export const structureSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio').max(200),
  notes: z.string().optional().or(z.literal('')),
})

export type StructureFormData = z.infer<typeof structureSchema>

export const packageAgreementSchema = z.object({
  structure_id: z.string().min(1, 'La struttura è obbligatoria'),
  total_sessions: z
    .number({ message: 'Inserisci un numero valido' })
    .int()
    .min(1, 'Il numero di sedute deve essere maggiore di 0'),
  total_price: z
    .number({ message: 'Inserisci un prezzo valido' })
    .min(0, 'Il prezzo non può essere negativo'),
  start_date: z.string().min(1, 'La data di inizio è obbligatoria'),
  end_date: z.string().optional().or(z.literal('')),
})

export type PackageAgreementFormData = z.infer<typeof packageAgreementSchema>

export const recurrenceSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'custom']),
  interval_value: z.number().int().min(1).max(365),
  interval_unit: z.enum(['day', 'week', 'month']),
  days_of_week: z.array(z.number().int().min(0).max(6)),
  end_type: z.enum(['count', 'until', 'never']),
  end_count: z.number().int().min(1).max(365).optional(),
  end_date: z.string().optional(),
})

export type RecurrenceFormData = z.infer<typeof recurrenceSchema>

export const sessionSchema = z
  .object({
    patient_id: z.string().optional().or(z.literal('')),
    group_id: z.string().optional().or(z.literal('')),
    session_type: z.enum(['individuale', 'coppia', 'familiare']),
    service_type_id: z.string().min(1, 'Il tipo di prestazione è obbligatorio'),
    scheduled_at: z.string().min(1, 'La data è obbligatoria'),
    duration_minutes: z
      .number({ message: 'Inserisci una durata valida' })
      .int()
      .min(1, 'La durata deve essere maggiore di 0'),
    notes: z.string().optional().or(z.literal('')),
    recurrence: recurrenceSchema.optional(),
  })
  .refine(
    (data) => data.patient_id || data.group_id,
    {
      message: 'Seleziona un paziente o un gruppo',
      path: ['patient_id'],
    }
  )

export type SessionFormData = z.infer<typeof sessionSchema>

export const paymentSchema = z.object({
  patient_id: z.string().optional().or(z.literal('')),
  session_id: z.string().optional().or(z.literal('')),
  service_type_id: z.string().optional().or(z.literal('')),
  amount: z
    .number({ message: 'Inserisci un importo valido' })
    .min(0.01, 'L\'importo deve essere maggiore di 0'),
  payment_date: z.string().min(1, 'La data è obbligatoria'),
  payment_method: z.enum(['cash', 'bank_transfer', 'credit_card', 'other']),
  notes: z.string().optional().or(z.literal('')),
})

export type PaymentFormData = z.infer<typeof paymentSchema>

export const patientTagSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio').max(50),
  color: z.string().min(1, 'Seleziona un colore'),
  icon: z.string().min(1, 'Seleziona un\'icona'),
})

export type PatientTagFormData = z.infer<typeof patientTagSchema>
