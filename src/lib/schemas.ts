import { z } from 'zod'

export const patientSchema = z.object({
  first_name: z.string().min(1, 'Il nome è obbligatorio').max(100),
  last_name: z.string().min(1, 'Il cognome è obbligatorio').max(100),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  group_id: z.string().optional().or(z.literal('')),
  group_role: z.string().max(50).optional().or(z.literal('')),
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

export const sessionSchema = z.object({
  patient_id: z.string().min(1, 'Il paziente è obbligatorio'),
  service_type_id: z.string().min(1, 'Il tipo di prestazione è obbligatorio'),
  scheduled_at: z.string().min(1, 'La data è obbligatoria'),
  duration_minutes: z
    .number({ message: 'Inserisci una durata valida' })
    .int()
    .min(1, 'La durata deve essere maggiore di 0'),
  notes: z.string().optional().or(z.literal('')),
})

export type SessionFormData = z.infer<typeof sessionSchema>

export const paymentSchema = z.object({
  patient_id: z.string().optional().or(z.literal('')),
  session_id: z.string().optional().or(z.literal('')),
  amount: z
    .number({ message: 'Inserisci un importo valido' })
    .min(0.01, 'L\'importo deve essere maggiore di 0'),
  payment_date: z.string().min(1, 'La data è obbligatoria'),
  payment_method: z.enum(['cash', 'bank_transfer', 'credit_card', 'other']),
  notes: z.string().optional().or(z.literal('')),
})

export type PaymentFormData = z.infer<typeof paymentSchema>
