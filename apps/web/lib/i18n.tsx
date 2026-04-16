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
    const keys = key.split('.')
    let value: any = translations[lang] || translations.en

    for (const k of keys) {
      value = value?.[k]
    }

    // Fallback to English if translation not found
    if (value === undefined) {
      value = key.split('.').reduce((obj: any, k: string) => obj?.[k], translations.en)
    }

    return value || key
  }

  if (!hydrated) return children

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
