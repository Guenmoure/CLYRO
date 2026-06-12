'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Users, Crown, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { createBrowserClient } from '@/lib/supabase'

// ── Types ───────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  email: string
  name: string
  role: 'Owner' | 'Admin' | 'Member'
  avatarInitials: string
  joinedAt: string
}

// ── Tooltip wrapper (no external dep) ──────────────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span
        className={[
          'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
          'whitespace-nowrap rounded-xl bg-muted border border-border px-2.5 py-1',
          'font-mono text-[10px] uppercase tracking-widest text-[--text-secondary]',
          'opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150',
        ].join(' ')}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSession() {
      try {
        const supabase = createBrowserClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user) {
          setOwnerEmail(session.user.email ?? null)
          const meta = session.user.user_metadata as Record<string, string> | undefined
          setOwnerName(meta?.full_name ?? meta?.name ?? null)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [])

  // Derive display values
  const displayEmail = ownerEmail ?? 'you@example.com'
  const displayName = ownerName ?? displayEmail.split('@')[0]
  const initials = displayName
    .split(' ')
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')

  const members: Member[] = [
    {
      id: 'owner',
      email: displayEmail,
      name: displayName,
      role: 'Owner',
      avatarInitials: initials || 'ME',
      joinedAt: 'Owner',
    },
  ]

  const onlyOwner = members.length === 1

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto">
      <div className="space-y-8 animate-fade-in">

        {/* Back link */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 font-body text-sm text-[--text-secondary] hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Settings
        </Link>

        <PageHeader
          eyebrow="Settings"
          title="Team & Seats"
          description="Manage your team members and collaboration access"
          action={
            <Tooltip label="Coming soon">
              <Button
                variant="primary"
                size="md"
                disabled
                leftIcon={<UserPlus size={15} />}
              >
                Invite member
              </Button>
            </Tooltip>
          }
        />

        {/* Members card */}
        <Card padding="none" className="overflow-hidden">
          <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
              <Users size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-foreground">Members</h2>
              <p className="font-body text-xs text-[--text-secondary]">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
            </div>
          </header>

          <div className="divide-y divide-border">
            {/* Owner row — always shown */}
            {loading ? (
              <div className="px-6 py-4">
                <div className="h-10 bg-muted animate-pulse rounded-xl" />
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="px-6 py-4 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-violet-500 flex items-center justify-center shrink-0">
                    <span className="font-display font-bold text-xs text-white">
                      {member.avatarInitials}
                    </span>
                  </div>
                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-foreground text-sm truncate">
                      {member.name}
                    </p>
                    <p className="font-body text-xs text-[--text-secondary] truncate">
                      {member.email}
                    </p>
                  </div>
                  {/* Role badge */}
                  <Badge variant="info" icon={<Crown size={10} />}>
                    {member.role}
                  </Badge>
                </div>
              ))
            )}

            {/* Empty state when only owner exists */}
            {!loading && onlyOwner && (
              <div className="px-6 pb-6 pt-2">
                <EmptyState
                  icon={Users}
                  title="No team members yet"
                  description="Invite your team to collaborate on projects, share assets, and review videos together."
                  accent="blue"
                  size="sm"
                  action={
                    <Tooltip label="Coming soon">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled
                        leftIcon={<UserPlus size={13} />}
                      >
                        Send an invite
                      </Button>
                    </Tooltip>
                  }
                />
              </div>
            )}
          </div>
        </Card>

        {/* Upgrade info card */}
        <Card variant="gradient" padding="md">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={16} className="text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-foreground">
                Team features require Pro or Studio
              </h3>
              <p className="font-body text-sm text-[--text-secondary] mt-1">
                Upgrade your plan to invite collaborators, assign roles, and manage shared workspaces.
              </p>
              <div className="mt-4">
                <Button variant="primary" size="sm" asChild>
                  <Link href="/pricing">View plans</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
