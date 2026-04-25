export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          email?: string
          phone?: string
          notes?: string
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
          scheduled_at?: string
          duration_minutes?: number
          notes?: string
          google_calendar_event_id?: string
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
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
