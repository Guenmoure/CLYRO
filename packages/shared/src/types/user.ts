export type UserPlan = 'free' | 'starter' | 'studio'

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  plan: UserPlan
  credits: number
  created_at: string
}

export interface AuthUser {
  id: string
  email: string
  profile: Profile
}
