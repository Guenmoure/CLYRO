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
          plan: 'free' | 'starter' | 'pro' | 'creator' | 'studio'
          credits: number
          monthly_credits: number
          subscription_renewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'starter' | 'pro' | 'creator' | 'studio'
          credits?: number
          monthly_credits?: number
          subscription_renewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'starter' | 'pro' | 'creator' | 'studio'
          credits?: number
          monthly_credits?: number
          subscription_renewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          id: string
          user_id: string
          module: 'faceless' | 'motion' | 'motion_design' | 'brand' | 'studio'
          style: string
          title: string
          status: 'draft' | 'pending' | 'processing' | 'generating' | 'storyboard' | 'visuals' | 'audio' | 'animation' | 'assembly' | 'done' | 'completed' | 'error' | 'cancelled'
          output_url: string | null
          video_url: string | null
          metadata: Json
          thumbnail_url: string | null
          duration_seconds: number | null
          created_by: string | null
          animation_mode: 'storyboard' | 'fast' | 'pro'
          animation_overrides: Json
          wizard_step: number
          wizard_state: Json
          draft_expires_at: string | null
          folder_id: string | null
          share_token: string | null
          share_token_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          module: 'faceless' | 'motion' | 'motion_design' | 'brand' | 'studio'
          style?: string
          title?: string
          status?: 'draft' | 'pending' | 'processing' | 'generating' | 'storyboard' | 'visuals' | 'audio' | 'animation' | 'assembly' | 'done' | 'completed' | 'error' | 'cancelled'
          output_url?: string | null
          video_url?: string | null
          metadata?: Json
          thumbnail_url?: string | null
          duration_seconds?: number | null
          created_by?: string | null
          animation_mode?: 'storyboard' | 'fast' | 'pro'
          animation_overrides?: Json
          wizard_step?: number
          wizard_state?: Json
          draft_expires_at?: string | null
          folder_id?: string | null
          share_token?: string | null
          share_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          module?: 'faceless' | 'motion' | 'motion_design' | 'brand' | 'studio'
          style?: string
          title?: string
          status?: 'draft' | 'pending' | 'processing' | 'generating' | 'storyboard' | 'visuals' | 'audio' | 'animation' | 'assembly' | 'done' | 'completed' | 'error' | 'cancelled'
          output_url?: string | null
          video_url?: string | null
          metadata?: Json
          thumbnail_url?: string | null
          duration_seconds?: number | null
          created_by?: string | null
          animation_mode?: 'storyboard' | 'fast' | 'pro'
          animation_overrides?: Json
          wizard_step?: number
          wizard_state?: Json
          draft_expires_at?: string | null
          folder_id?: string | null
          share_token?: string | null
          share_token_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
        }
        Relationships: []
      }
      voice_favorites: {
        Row: {
          user_id: string
          voice_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          voice_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          voice_id?: string
          created_at?: string
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          id: string
          user_id: string
          name: string
          logo_url: string | null
          primary_color: string
          secondary_color: string | null
          font_family: string | null
          is_default: boolean
          url: string | null
          tagline: string | null
          brand_values: string[]
          brand_aesthetic: string[]
          brand_tone_of_voice: string[]
          business_overview: string | null
          location: string | null
          phone: string | null
          business_hours: string | null
          keywords: string[]
          social_links: Json
          cta_links: Json
          testimonials: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          font_family?: string | null
          is_default?: boolean
          url?: string | null
          tagline?: string | null
          brand_values?: string[]
          brand_aesthetic?: string[]
          brand_tone_of_voice?: string[]
          business_overview?: string | null
          location?: string | null
          phone?: string | null
          business_hours?: string | null
          keywords?: string[]
          social_links?: Json
          cta_links?: Json
          testimonials?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          font_family?: string | null
          is_default?: boolean
          url?: string | null
          tagline?: string | null
          brand_values?: string[]
          brand_aesthetic?: string[]
          brand_tone_of_voice?: string[]
          business_overview?: string | null
          location?: string | null
          phone?: string | null
          business_hours?: string | null
          keywords?: string[]
          social_links?: Json
          cta_links?: Json
          testimonials?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_projects: {
        Row: {
          id: string
          user_id: string
          title: string
          input_type: 'script' | 'youtube_url'
          input_value: string
          input_language: string
          original_script: string | null
          improved_script: string | null
          avatar_id: string | null
          voice_id: string | null
          format: '16_9' | '9_16' | 'both'
          background_color: string | null
          music_track: string | null
          status: 'draft' | 'analyzing' | 'generating' | 'editing' | 'rendering' | 'done' | 'error'
          final_video_url: string | null
          final_video_9_16_url: string | null
          total_duration: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          input_type: 'script' | 'youtube_url'
          input_value: string
          input_language?: string
          original_script?: string | null
          improved_script?: string | null
          avatar_id?: string | null
          voice_id?: string | null
          format?: '16_9' | '9_16' | 'both'
          background_color?: string | null
          music_track?: string | null
          status?: 'draft' | 'analyzing' | 'generating' | 'editing' | 'rendering' | 'done' | 'error'
          final_video_url?: string | null
          final_video_9_16_url?: string | null
          total_duration?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          input_type?: 'script' | 'youtube_url'
          input_value?: string
          input_language?: string
          original_script?: string | null
          improved_script?: string | null
          avatar_id?: string | null
          voice_id?: string | null
          format?: '16_9' | '9_16' | 'both'
          background_color?: string | null
          music_track?: string | null
          status?: 'draft' | 'analyzing' | 'generating' | 'editing' | 'rendering' | 'done' | 'error'
          final_video_url?: string | null
          final_video_9_16_url?: string | null
          total_duration?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_assets: {
        Row: {
          id: string
          brand_kit_id: string
          user_id: string
          type: 'logo' | 'social_post' | 'banner' | 'thumbnail'
          platform: string | null
          prompt: string
          image_url: string
          created_at: string
        }
        Insert: {
          id?: string
          brand_kit_id: string
          user_id: string
          type: 'logo' | 'social_post' | 'banner' | 'thumbnail'
          platform?: string | null
          prompt: string
          image_url: string
          created_at?: string
        }
        Update: {
          id?: string
          brand_kit_id?: string
          user_id?: string
          type?: 'logo' | 'social_post' | 'banner' | 'thumbnail'
          platform?: string | null
          prompt?: string
          image_url?: string
          created_at?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
