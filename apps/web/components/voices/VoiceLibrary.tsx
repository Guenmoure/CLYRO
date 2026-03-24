'use client'

// components/voices/VoiceLibrary.tsx
// Bibliothèque de voix CLYRO — Wizard étape voix
// ──────────────────────────────────────────────────────────────
// Fonctionnalités :
//   - Onglets Publique / Mes voix (clonées)
//   - Recherche par nom
//   - Filtres : genre, accent, usage
//   - Preview audio (play/stop inline)
//   - Favoris (toggle)
//   - Sélection + callback onSelect
// ──────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────

interface Voice {
  id:          string
  name:        string
  previewUrl:  string
  category:    'public' | 'cloned'
  gender?:     string
  accent?:     string
  age?:        string
  useCase?:    string
  description?: string
  isFavorite?: boolean
  localId?:    string
  createdAt?:  string
}

interface VoiceFilters {
  genders:  string[]
  accents:  string[]
  useCases: string[]
}

interface VoiceLibraryProps {
  selectedVoiceId?: string
  onSelect:         (voice: Voice) => void
  apiUrl?:          string
}

// ── Labels FR ─────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  male:   'Homme',
  female: 'Femme',
}

const USE_CASE_LABELS: Record<string, string> = {
  narration:     'Narration',
  news:          'Actualités',
  'video games': 'Jeux vidéo',
  meditation:    'Méditation',
  'social media': 'Réseaux sociaux',
  conversational: 'Conversation',
  characters:    'Personnage',
}

// ─────────────────────────────────────────────────────────────
//  COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function VoiceLibrary({
  selectedVoiceId,
  onSelect,
  apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
}: VoiceLibraryProps) {

  // ── State ──────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<'public' | 'cloned'>('public')
  const [publicVoices, setPublicVoices] = useState<Voice[]>([])
  const [clonedVoices, setClonedVoices] = useState<Voice[]>([])
  const [filters,      setFilters]      = useState<VoiceFilters>({ genders: [], accents: [], useCases: [] })
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filterAccent, setFilterAccent] = useState('')
  const [filterUse,    setFilterUse]    = useState('')
  const [playingId,    setPlayingId]    = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ── Fetch voix publiques ───────────────────────────────────
  const fetchPublicVoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search',  search)
      if (filterGender) params.set('gender',  filterGender)
      if (filterAccent) params.set('accent',  filterAccent)
      if (filterUse)    params.set('useCase', filterUse)

      const res = await fetch(`${apiUrl}/api/v1/voices/public?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setPublicVoices(data.voices ?? [])
    } catch (e) {
      console.error('Failed to fetch public voices', e)
    } finally {
      setLoading(false)
    }
  }, [search, filterGender, filterAccent, filterUse, apiUrl])

  // ── Fetch voix clonées ─────────────────────────────────────
  const fetchClonedVoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/v1/voices/cloned`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setClonedVoices(data.voices ?? [])
    } catch (e) {
      console.error('Failed to fetch cloned voices', e)
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  // ── Fetch filtres disponibles ──────────────────────────────
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/voices/filters`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json()
      setFilters(data)
    } catch (e) {
      console.error('Failed to fetch filters', e)
    }
  }, [apiUrl])

  // ── Effets ─────────────────────────────────────────────────
  useEffect(() => { fetchFilters() }, [fetchFilters])

  useEffect(() => {
    if (activeTab === 'public') fetchPublicVoices()
    else fetchClonedVoices()
  }, [activeTab, fetchPublicVoices, fetchClonedVoices])

  // ── Preview audio ──────────────────────────────────────────
  const handlePreview = (voice: Voice) => {
    if (playingId === voice.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(voice.previewUrl)
    audioRef.current = audio
    audio.play()
    setPlayingId(voice.id)
    audio.onended = () => setPlayingId(null)
  }

  // ── Toggle favori ──────────────────────────────────────────
  const handleFavorite = async (voice: Voice) => {
    const action = voice.isFavorite ? 'remove' : 'add'
    try {
      await fetch(`${apiUrl}/api/v1/voices/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ voiceId: voice.id, action }),
      })
      // Mettre à jour localement
      setPublicVoices(prev =>
        prev.map(v => v.id === voice.id ? { ...v, isFavorite: !v.isFavorite } : v)
      )
    } catch (e) {
      console.error('Failed to update favorite', e)
    }
  }

  const voices = activeTab === 'public' ? publicVoices : clonedVoices

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={styles.container}>

      {/* ── TABS ─────────────────────────────────────────── */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'public' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('public')}
        >
          🌍 Bibliothèque publique
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'cloned' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('cloned')}
        >
          🎙️ Mes voix ({clonedVoices.length})
        </button>
      </div>

      {/* ── BARRE DE RECHERCHE + FILTRES ─────────────────── */}
      {activeTab === 'public' && (
        <div style={styles.searchBar}>
          <input
            type="text"
            placeholder="🔍 Rechercher une voix..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={filterGender}
            onChange={e => setFilterGender(e.target.value)}
            style={styles.select}
          >
            <option value="">Genre</option>
            {filters.genders.map(g => (
              <option key={g} value={g}>{GENDER_LABELS[g] ?? g}</option>
            ))}
          </select>
          <select
            value={filterAccent}
            onChange={e => setFilterAccent(e.target.value)}
            style={styles.select}
          >
            <option value="">Accent</option>
            {filters.accents.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={filterUse}
            onChange={e => setFilterUse(e.target.value)}
            style={styles.select}
          >
            <option value="">Usage</option>
            {filters.useCases.map(u => (
              <option key={u} value={u}>{USE_CASE_LABELS[u] ?? u}</option>
            ))}
          </select>
          {(search || filterGender || filterAccent || filterUse) && (
            <button
              style={styles.resetBtn}
              onClick={() => { setSearch(''); setFilterGender(''); setFilterAccent(''); setFilterUse('') }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* ── VOIX CLONÉES — CTA AJOUT ─────────────────────── */}
      {activeTab === 'cloned' && (
        <div style={styles.cloneInfo}>
          <p style={styles.cloneInfoText}>
            Clone ta propre voix pour garder ton identité sonore sur toutes tes vidéos.
            Uploade un sample audio de <strong>30 secondes minimum</strong>.
          </p>
          <button style={styles.cloneBtn}>+ Cloner ma voix</button>
        </div>
      )}

      {/* ── GRILLE DES VOIX ──────────────────────────────── */}
      {loading ? (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>Chargement des voix...</span>
        </div>
      ) : voices.length === 0 ? (
        <div style={styles.empty}>
          {activeTab === 'cloned'
            ? '🎙️ Tu n\'as pas encore de voix clonées.'
            : '🔍 Aucune voix ne correspond à ta recherche.'}
        </div>
      ) : (
        <div style={styles.grid}>
          {voices.map(voice => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              isSelected={selectedVoiceId === voice.id}
              isPlaying={playingId === voice.id}
              onSelect={onSelect}
              onPreview={handlePreview}
              onFavorite={activeTab === 'public' ? handleFavorite : undefined}
            />
          ))}
        </div>
      )}

      {/* ── COMPTEUR ─────────────────────────────────────── */}
      {!loading && voices.length > 0 && (
        <p style={styles.count}>{voices.length} voix disponibles</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  VOICE CARD
// ─────────────────────────────────────────────────────────────

function VoiceCard({
  voice, isSelected, isPlaying, onSelect, onPreview, onFavorite,
}: {
  voice:       Voice
  isSelected:  boolean
  isPlaying:   boolean
  onSelect:    (voice: Voice) => void
  onPreview:   (voice: Voice) => void
  onFavorite?: (voice: Voice) => void
}) {
  return (
    <div style={{
      ...styles.card,
      ...(isSelected ? styles.cardSelected : {}),
    }}>

      {/* ── HEADER CARD ────────────────────────────────── */}
      <div style={styles.cardHeader}>
        {/* Avatar initial */}
        <div style={{
          ...styles.avatar,
          background: voice.gender === 'female'
            ? 'linear-gradient(135deg, #9B5CF6, #38E8FF)'
            : 'linear-gradient(135deg, #3B8EF0, #38E8FF)',
        }}>
          {voice.name.charAt(0).toUpperCase()}
        </div>

        <div style={styles.cardInfo}>
          <span style={styles.cardName}>{voice.name}</span>
          {voice.description && (
            <span style={styles.cardDesc}>{voice.description}</span>
          )}
        </div>

        {/* Favori */}
        {onFavorite && (
          <button
            style={styles.favoriteBtn}
            onClick={e => { e.stopPropagation(); onFavorite(voice) }}
            title={voice.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {voice.isFavorite ? '⭐' : '☆'}
          </button>
        )}
      </div>

      {/* ── TAGS ─────────────────────────────────────── */}
      <div style={styles.tags}>
        {voice.gender && (
          <span style={styles.tag}>
            {voice.gender === 'female' ? '♀' : '♂'} {GENDER_LABELS[voice.gender] ?? voice.gender}
          </span>
        )}
        {voice.accent && <span style={styles.tag}>{voice.accent}</span>}
        {voice.useCase && (
          <span style={{ ...styles.tag, ...styles.tagUseCase }}>
            {USE_CASE_LABELS[voice.useCase] ?? voice.useCase}
          </span>
        )}
        {voice.category === 'cloned' && (
          <span style={{ ...styles.tag, ...styles.tagCloned }}>Ma voix</span>
        )}
      </div>

      {/* ── ACTIONS ──────────────────────────────────── */}
      <div style={styles.cardActions}>
        <button
          style={{
            ...styles.previewBtn,
            ...(isPlaying ? styles.previewBtnPlaying : {}),
          }}
          onClick={e => { e.stopPropagation(); onPreview(voice) }}
        >
          {isPlaying ? '⏸ Stop' : '▶ Écouter'}
        </button>

        <button
          style={{
            ...styles.selectBtn,
            ...(isSelected ? styles.selectBtnActive : {}),
          }}
          onClick={() => onSelect(voice)}
        >
          {isSelected ? '✓ Sélectionnée' : 'Utiliser'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  STYLES (inline — compatible sans Tailwind configuré)
// ─────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '16px',
    maxHeight:     '600px',
    overflow:      'hidden',
  },
  tabs: {
    display:         'flex',
    gap:             '4px',
    background:      '#0F1427',
    borderRadius:    '10px',
    padding:         '4px',
    border:          '1px solid rgba(255,255,255,0.06)',
  },
  tab: {
    flex:           1,
    padding:        '8px 16px',
    borderRadius:   '7px',
    border:         'none',
    cursor:         'pointer',
    fontFamily:     "'Syne', sans-serif",
    fontWeight:     700,
    fontSize:       '0.84rem',
    color:          'rgba(255,255,255,0.5)',
    background:     'transparent',
    transition:     'all .2s',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #3B8EF0, #9B5CF6)',
    color:      '#fff',
    boxShadow:  '0 2px 12px rgba(59,142,240,0.3)',
  },
  searchBar: {
    display:   'flex',
    gap:       '8px',
    flexWrap:  'wrap',
    alignItems: 'center',
  },
  searchInput: {
    flex:        1,
    minWidth:    '160px',
    padding:     '8px 12px',
    background:  '#0F1427',
    border:      '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color:       '#fff',
    fontSize:    '0.88rem',
    fontFamily:  "'DM Sans', sans-serif",
    outline:     'none',
  },
  select: {
    padding:     '8px 10px',
    background:  '#0F1427',
    border:      '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color:       '#fff',
    fontSize:    '0.82rem',
    cursor:      'pointer',
    outline:     'none',
  },
  resetBtn: {
    padding:     '8px 12px',
    background:  'transparent',
    border:      '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color:       'rgba(255,255,255,0.5)',
    fontSize:    '0.8rem',
    cursor:      'pointer',
  },
  cloneInfo: {
    background:   'rgba(59,142,240,0.06)',
    border:       '1px solid rgba(59,142,240,0.18)',
    borderRadius: '10px',
    padding:      '14px 16px',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'space-between',
    gap:          '12px',
    flexWrap:     'wrap',
  },
  cloneInfoText: {
    fontSize: '0.84rem',
    color:    'rgba(255,255,255,0.6)',
    margin:   0,
    flex:     1,
  },
  cloneBtn: {
    padding:     '8px 16px',
    background:  'linear-gradient(135deg, #3B8EF0, #9B5CF6)',
    border:      'none',
    borderRadius: '8px',
    color:       '#fff',
    fontFamily:  "'Syne', sans-serif",
    fontWeight:  700,
    fontSize:    '0.84rem',
    cursor:      'pointer',
    whiteSpace:  'nowrap',
  },
  loading: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '10px',
    padding:        '40px',
    color:          'rgba(255,255,255,0.4)',
    fontSize:       '0.88rem',
  },
  spinner: {
    width:           '18px',
    height:          '18px',
    border:          '2px solid rgba(59,142,240,0.3)',
    borderTopColor:  '#3B8EF0',
    borderRadius:    '50%',
    animation:       'spin 0.8s linear infinite',
  },
  empty: {
    textAlign:      'center',
    padding:        '40px',
    color:          'rgba(255,255,255,0.35)',
    fontSize:       '0.9rem',
  },
  grid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap:                 '12px',
    overflowY:           'auto',
    maxHeight:           '420px',
    paddingRight:        '4px',
  },
  count: {
    textAlign:  'center',
    fontSize:   '0.75rem',
    color:      'rgba(255,255,255,0.25)',
    fontFamily: "'JetBrains Mono', monospace",
    margin:     0,
  },
  card: {
    background:   '#0F1427',
    border:       '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding:      '14px',
    cursor:       'pointer',
    transition:   'all .2s',
    display:      'flex',
    flexDirection: 'column',
    gap:          '10px',
  },
  cardSelected: {
    border:     '1px solid #3B8EF0',
    background: 'rgba(59,142,240,0.08)',
    boxShadow:  '0 0 16px rgba(59,142,240,0.15)',
  },
  cardHeader: {
    display:    'flex',
    alignItems: 'center',
    gap:        '10px',
  },
  avatar: {
    width:          '36px',
    height:         '36px',
    borderRadius:   '9px',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontFamily:     "'Syne', sans-serif",
    fontWeight:     800,
    fontSize:       '1rem',
    color:          '#fff',
    flexShrink:     0,
  },
  cardInfo: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    gap:           '2px',
    minWidth:      0,
  },
  cardName: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize:   '0.9rem',
    color:      '#fff',
  },
  cardDesc: {
    fontSize: '0.75rem',
    color:    'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  favoriteBtn: {
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    fontSize:   '1.1rem',
    lineHeight: 1,
    padding:    '2px',
    flexShrink: 0,
  },
  tags: {
    display:  'flex',
    flexWrap: 'wrap',
    gap:      '4px',
  },
  tag: {
    padding:      '2px 8px',
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: '5px',
    fontSize:     '0.72rem',
    color:        'rgba(255,255,255,0.5)',
    fontFamily:   "'JetBrains Mono', monospace",
    textTransform: 'lowercase',
  },
  tagUseCase: {
    background: 'rgba(59,142,240,0.1)',
    border:     '1px solid rgba(59,142,240,0.2)',
    color:      '#60B0FF',
  },
  tagCloned: {
    background: 'rgba(155,92,246,0.12)',
    border:     '1px solid rgba(155,92,246,0.25)',
    color:      '#B57BFF',
  },
  cardActions: {
    display: 'flex',
    gap:     '6px',
  },
  previewBtn: {
    flex:         1,
    padding:      '7px',
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: '7px',
    color:        'rgba(255,255,255,0.7)',
    fontSize:     '0.8rem',
    cursor:       'pointer',
    fontFamily:   "'DM Sans', sans-serif",
    transition:   'all .15s',
  },
  previewBtnPlaying: {
    background:  'rgba(59,142,240,0.15)',
    borderColor: 'rgba(59,142,240,0.3)',
    color:       '#60B0FF',
  },
  selectBtn: {
    flex:         1,
    padding:      '7px',
    background:   'linear-gradient(135deg, #3B8EF0, #9B5CF6)',
    border:       'none',
    borderRadius: '7px',
    color:        '#fff',
    fontSize:     '0.8rem',
    cursor:       'pointer',
    fontFamily:   "'Syne', sans-serif",
    fontWeight:   700,
    transition:   'all .15s',
  },
  selectBtnActive: {
    background: 'linear-gradient(135deg, #38E8FF, #3B8EF0)',
    boxShadow:  '0 0 12px rgba(56,232,255,0.3)',
  },
}

// ── Helper : récupérer le JWT Supabase ────────────────────────
function getToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const storage = Object.entries(localStorage).find(([k]) => k.includes('supabase'))
    if (storage) {
      const session = JSON.parse(storage[1])
      return session?.access_token ?? ''
    }
  } catch { /* ignore */ }
  return ''
}
