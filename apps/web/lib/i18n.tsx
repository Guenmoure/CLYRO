'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './translations'

export type Language = 'en' | 'fr' | 'es' | 'de' | 'pt'

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')
  const [hydrated, setHydrated] = useState(false)

  // Load language from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('clyro_language') as Language | null
    if (saved && ['en', 'fr', 'es', 'de', 'pt'].includes(saved)) {
      setLangState(saved)
    }
    setHydrated(true)
  }, [])

  function setLang(newLang: Language) {
    setLangState(newLang)
    localStorage.setItem('clyro_language', newLang)
  }

  function t(key: string): string {
    const dict = translations[lang] || translations.en
    const value = (dict as Record<string, string>)[key]
    if (value !== undefined) return value

    // Fallback to English
    const fallback = (translations.en as Record<string, string>)[key]
    return fallback ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

// Default fallback — used during SSR before LanguageProvider mounts
const DEFAULT_CONTEXT: LanguageContextType = {
  lang: 'en',
  setLang: () => {},
  t: (key: string) => {
    return (translations.en as Record<string, string>)[key] ?? key
  },
}

export function useLanguage(): LanguageContextType {
  return useContext(LanguageContext) ?? DEFAULT_CONTEXT
}
