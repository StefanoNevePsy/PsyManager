export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export type SmsProvider = 'skebby' | 'twilio' | 'generic'

export type SmsRule = 'all' | 'first' | 'no_show' | 'manual'

export type DeliveryChannel = 'sms' | 'email' | 'whatsapp'

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped'

export type CalendarTitleFormat = 'full' | 'first_initial' | 'initials'

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'credit_card'
  | 'other'
  | 'my_invoice'
  | 'center_invoice'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          updated_at?: string
        }
      }
      patient_groups: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'couple' | 'family' | 'other'
          notes?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: 'couple' | 'family' | 'other'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          type?: 'couple' | 'family' | 'other'
          notes?: string | null
          updated_at?: string
        }
      }
      clinical_notes: {
        Row: {
          id: string
          user_id: string
          patient_id: string
          session_id?: string | null
          title?: string | null
          content: string
          note_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id: string
          session_id?: string | null
          title?: string | null
          content: string
          note_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string
          session_id?: string | null
          title?: string | null
          content?: string
          note_date?: string
          updated_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          user_id: string
          first_name: string
          last_name?: string | null
          email?: string
          phone?: string
          notes?: string
          group_id?: string | null
          group_role?: string | null
          sms_consent: boolean
          sms_consent_at?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name: string
          last_name?: string | null
          email?: string
          phone?: string
          notes?: string
          group_id?: string | null
          group_role?: string | null
          sms_consent?: boolean
          sms_consent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string | null
          email?: string
          phone?: string
          notes?: string
          group_id?: string | null
          group_role?: string | null
          sms_consent?: boolean
          sms_consent_at?: string | null
          updated_at?: string
        }
      }
      service_types: {
        Row: {
          id: string
          user_id: string
          name: string
          duration_minutes: number
          price: number
          type: 'private' | 'package'
          color?: string | null
          center_percentage: number
          default_payment_method?: PaymentMethod | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          duration_minutes: number
          price: number
          type: 'private' | 'package'
          color?: string | null
          center_percentage?: number
          default_payment_method?: PaymentMethod | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          duration_minutes?: number
          price?: number
          type?: 'private' | 'package'
          color?: string | null
          center_percentage?: number
          default_payment_method?: PaymentMethod | null
          updated_at?: string
        }
      }
      tax_settings: {
        Row: {
          id: string
          user_id: string
          coefficiente_redditivita: number
          imposta_sostitutiva_pct: number
          enpap_pct: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          coefficiente_redditivita?: number
          imposta_sostitutiva_pct?: number
          enpap_pct?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          coefficiente_redditivita?: number
          imposta_sostitutiva_pct?: number
          enpap_pct?: number
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          patient_id: string | null
          service_type_id: string
          group_id?: string | null
          session_type: 'individuale' | 'coppia' | 'familiare'
          status: SessionStatus
          series_id?: string | null
          scheduled_at: string
          duration_minutes: number
          reminder_sent_at?: string | null
          notes?: string | null
          google_calendar_event_id?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id?: string | null
          service_type_id: string
          group_id?: string | null
          session_type?: 'individuale' | 'coppia' | 'familiare'
          status?: SessionStatus
          series_id?: string | null
          scheduled_at: string
          duration_minutes: number
          notes?: string | null
          google_calendar_event_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string | null
          service_type_id?: string
          group_id?: string | null
          session_type?: 'individuale' | 'coppia' | 'familiare'
          status?: SessionStatus
          series_id?: string | null
          scheduled_at?: string
          duration_minutes?: number
          reminder_sent_at?: string | null
          notes?: string | null
          google_calendar_event_id?: string | null
          updated_at?: string
        }
      }
      session_series: {
        Row: {
          id: string
          user_id: string
          patient_id: string | null
          group_id?: string | null
          session_type: 'individuale' | 'coppia' | 'familiare'
          service_type_id: string
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          interval_value: number
          interval_unit: 'day' | 'week' | 'month'
          days_of_week: number[]
          end_type: 'count' | 'until' | 'never'
          end_count?: number | null
          end_date?: string | null
          start_at: string
          duration_minutes: number
          notes?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id?: string | null
          group_id?: string | null
          session_type?: 'individuale' | 'coppia' | 'familiare'
          service_type_id: string
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          interval_value?: number
          interval_unit?: 'day' | 'week' | 'month'
          days_of_week?: number[]
          end_type: 'count' | 'until' | 'never'
          end_count?: number | null
          end_date?: string | null
          start_at: string
          duration_minutes: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom'
          interval_value?: number
          interval_unit?: 'day' | 'week' | 'month'
          days_of_week?: number[]
          end_type?: 'count' | 'until' | 'never'
          end_count?: number | null
          end_date?: string | null
          start_at?: string
          duration_minutes?: number
          notes?: string | null
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          patient_id?: string | null
          group_id?: string | null
          session_id?: string | null
          amount: number
          payment_date: string
          payment_method: PaymentMethod
          notes?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id?: string | null
          group_id?: string | null
          session_id?: string | null
          amount: number
          payment_date: string
          payment_method: PaymentMethod
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string | null
          group_id?: string | null
          session_id?: string | null
          amount?: number
          payment_date?: string
          payment_method?: PaymentMethod
          notes?: string | null
          updated_at?: string
        }
      }
      structures: {
        Row: {
          id: string
          user_id: string
          name: string
          notes?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          notes?: string
          updated_at?: string
        }
      }
      package_agreements: {
        Row: {
          id: string
          user_id: string
          structure_id: string
          total_sessions: number
          completed_sessions: number
          total_price: number
          paid_amount: number
          start_date: string
          end_date?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          structure_id: string
          total_sessions: number
          completed_sessions?: number
          total_price: number
          paid_amount?: number
          start_date: string
          end_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          total_sessions?: number
          completed_sessions?: number
          total_price?: number
          paid_amount?: number
          end_date?: string
          updated_at?: string
        }
      }
      patient_tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          icon: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          color?: string
          icon?: string
          updated_at?: string
        }
      }
      patient_tag_assignments: {
        Row: {
          id: string
          patient_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          patient_id?: string
          tag_id?: string
        }
      }
      patient_contacts: {
        Row: {
          id: string
          patient_id: string
          kind: 'phone' | 'email'
          label: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          kind: 'phone' | 'email'
          label?: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          kind?: 'phone' | 'email'
          label?: string
          value?: string
          updated_at?: string
        }
      }
      patient_family_members: {
        Row: {
          id: string
          patient_id: string
          relationship: string
          full_name: string
          age: number | null
          alive: boolean
          relationship_quality: string | null
          notes: string | null
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          relationship: string
          full_name?: string
          age?: number | null
          alive?: boolean
          relationship_quality?: string | null
          notes?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          relationship?: string
          full_name?: string
          age?: number | null
          alive?: boolean
          relationship_quality?: string | null
          notes?: string | null
          display_order?: number
          updated_at?: string
        }
      }
      reminder_settings: {
        Row: {
          id: string
          user_id: string
          pre_session_enabled: boolean
          pre_session_minutes: number
          post_session_enabled: boolean
          post_session_minutes: number
          whatsapp_enabled: boolean
          whatsapp_template: string
          whatsapp_notify_minutes: number
          sms_enabled: boolean
          sms_provider: SmsProvider
          sms_sender: string
          sms_advance_minutes: number
          sms_template: string
          sms_quiet_start: number
          sms_quiet_end: number
          sms_rule: SmsRule
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pre_session_enabled?: boolean
          pre_session_minutes?: number
          post_session_enabled?: boolean
          post_session_minutes?: number
          whatsapp_enabled?: boolean
          whatsapp_template?: string
          whatsapp_notify_minutes?: number
          sms_enabled?: boolean
          sms_provider?: SmsProvider
          sms_sender?: string
          sms_advance_minutes?: number
          sms_template?: string
          sms_quiet_start?: number
          sms_quiet_end?: number
          sms_rule?: SmsRule
          created_at?: string
          updated_at?: string
        }
        Update: {
          pre_session_enabled?: boolean
          pre_session_minutes?: number
          post_session_enabled?: boolean
          post_session_minutes?: number
          whatsapp_enabled?: boolean
          whatsapp_template?: string
          whatsapp_notify_minutes?: number
          sms_enabled?: boolean
          sms_provider?: SmsProvider
          sms_sender?: string
          sms_advance_minutes?: number
          sms_template?: string
          sms_quiet_start?: number
          sms_quiet_end?: number
          sms_rule?: SmsRule
          updated_at?: string
        }
      }
      calendar_settings: {
        Row: {
          id: string
          user_id: string
          title_format: CalendarTitleFormat
          color_by_service: boolean
          include_notes: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title_format?: CalendarTitleFormat
          color_by_service?: boolean
          include_notes?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title_format?: CalendarTitleFormat
          color_by_service?: boolean
          include_notes?: boolean
          updated_at?: string
        }
      }
      reminder_deliveries: {
        Row: {
          id: string
          user_id: string
          session_id: string
          channel: DeliveryChannel
          status: DeliveryStatus
          provider_message_id?: string | null
          provider?: string | null
          recipient?: string | null
          error?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          channel: DeliveryChannel
          status?: DeliveryStatus
          provider_message_id?: string | null
          provider?: string | null
          recipient?: string | null
          error?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
        }
        Update: {
          status?: DeliveryStatus
          provider_message_id?: string | null
          error?: string | null
          sent_at?: string | null
          updated_at?: string
        }
      }
      receipts: {
        Row: {
          id: string
          user_id: string
          number: number
          year: number
          patient_id?: string | null
          group_id?: string | null
          recipient_name: string
          recipient_tax_code?: string | null
          recipient_address?: string | null
          issue_date: string
          description: string
          amount: number
          bollo_amount: number
          payment_method?: PaymentMethod | null
          notes?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          number: number
          year: number
          patient_id?: string | null
          group_id?: string | null
          recipient_name: string
          recipient_tax_code?: string | null
          recipient_address?: string | null
          issue_date?: string
          description?: string
          amount: number
          bollo_amount?: number
          payment_method?: PaymentMethod | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string | null
          group_id?: string | null
          recipient_name?: string
          recipient_tax_code?: string | null
          recipient_address?: string | null
          issue_date?: string
          description?: string
          amount?: number
          bollo_amount?: number
          payment_method?: PaymentMethod | null
          notes?: string | null
          updated_at?: string
        }
      }
      receipt_sessions: {
        Row: { id: string; receipt_id: string; session_id: string }
        Insert: { id?: string; receipt_id: string; session_id: string }
        Update: { receipt_id?: string; session_id?: string }
      }
      receipt_settings: {
        Row: {
          id: string
          user_id: string
          professional_name: string
          tax_code?: string | null
          vat_number?: string | null
          address?: string | null
          albo_registration?: string | null
          regime_note: string
          exempt_note: string
          bollo_threshold: number
          bollo_default_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          professional_name?: string
          tax_code?: string | null
          vat_number?: string | null
          address?: string | null
          albo_registration?: string | null
          regime_note?: string
          exempt_note?: string
          bollo_threshold?: number
          bollo_default_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          professional_name?: string
          tax_code?: string | null
          vat_number?: string | null
          address?: string | null
          albo_registration?: string | null
          regime_note?: string
          exempt_note?: string
          bollo_threshold?: number
          bollo_default_amount?: number
          updated_at?: string
        }
      }
      attachments: {
        Row: {
          id: string
          user_id: string
          owner_type: 'patient' | 'clinical_note'
          owner_id: string
          file_name: string
          mime_type: string
          size_bytes: number
          storage_path: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          owner_type: 'patient' | 'clinical_note'
          owner_id: string
          file_name: string
          mime_type: string
          size_bytes: number
          storage_path: string
          description?: string | null
          created_at?: string
        }
        Update: {
          file_name?: string
          description?: string | null
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
