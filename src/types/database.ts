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
          last_name: string
          email?: string
          phone?: string
          notes?: string
          group_id?: string | null
          group_role?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name: string
          last_name: string
          email?: string
          phone?: string
          notes?: string
          group_id?: string | null
          group_role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          email?: string
          phone?: string
          notes?: string
          group_id?: string | null
          group_role?: string | null
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          duration_minutes?: number
          price?: number
          type?: 'private' | 'package'
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          patient_id: string
          service_type_id: string
          series_id?: string | null
          scheduled_at: string
          duration_minutes: number
          notes?: string
          google_calendar_event_id?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id: string
          service_type_id: string
          series_id?: string | null
          scheduled_at: string
          duration_minutes: number
          notes?: string
          google_calendar_event_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string
          service_type_id?: string
          series_id?: string | null
          scheduled_at?: string
          duration_minutes?: number
          notes?: string
          google_calendar_event_id?: string
          updated_at?: string
        }
      }
      session_series: {
        Row: {
          id: string
          user_id: string
          patient_id: string
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
          patient_id: string
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
          patient_id?: string
          session_id?: string
          amount: number
          payment_date: string
          payment_method: string
          notes?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          patient_id?: string
          session_id?: string
          amount: number
          payment_date: string
          payment_method: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string
          session_id?: string
          amount?: number
          payment_date?: string
          payment_method?: string
          notes?: string
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
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
