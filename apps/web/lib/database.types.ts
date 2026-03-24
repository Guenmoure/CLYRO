/**
 * Types générés depuis le schéma Supabase.
 * À régénérer après chaque migration avec :
 *   supabase gen types typescript --linked > apps/web/lib/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          plan: 'free' | 'starter' | 'studio'
          credits: number
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'starter' | 'studio'
          credits?: number
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'starter' | 'studio'
          credits?: number
          created_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          user_id: string
          module: 'faceless' | 'motion'
          style: string
          title: string
          status: 'pending' | 'processing' | 'storyboard' | 'visuals' | 'audio' | 'assembly' | 'done' | 'error'
          output_url: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          module: 'faceless' | 'motion'
          style: string
          title: string
          status?: 'pending' | 'processing' | 'storyboard' | 'visuals' | 'audio' | 'assembly' | 'done' | 'error'
          output_url?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          module?: 'faceless' | 'motion'
          style?: string
          title?: string
          status?: 'pending' | 'processing' | 'storyboard' | 'visuals' | 'audio' | 'assembly' | 'done' | 'error'
          output_url?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      cloned_voices: {
        Row: {
          id: string
          user_id: string
          name: string
          elevenlabs_voice_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          elevenlabs_voice_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          elevenlabs_voice_id?: string
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          provider: 'stripe' | 'moneroo'
          amount: number
          currency: string
          status: 'pending' | 'success' | 'failed'
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: 'stripe' | 'moneroo'
          amount: number
          currency: string
          status?: 'pending' | 'success' | 'failed'
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'stripe' | 'moneroo'
          amount?: number
          currency?: string
          status?: 'pending' | 'success' | 'failed'
          metadata?: Json
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
