import { create } from 'zustand'
import type { Language } from '@/types'

const STORAGE_KEY = 'site-language'

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  const saved = localStorage.getItem(STORAGE_KEY) as Language | null
  if (saved === 'zh' || saved === 'en') return saved
  return 'zh'
}

interface LanguageState {
  language: Language
  toggleLanguage: () => void
  setLang: (lang: Language) => void
}

export const useLanguage = create<LanguageState>((set) => ({
  language: getInitialLanguage(),
  toggleLanguage: () =>
    set((state) => {
      const next = state.language === 'zh' ? 'en' : 'zh'
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next)
        document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
      }
      return { language: next }
    }),
  setLang: (lang) =>
    set(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang)
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
      }
      return { language: lang }
    }),
}))

// Initialize document lang on module load
if (typeof document !== 'undefined') {
  const lang = getInitialLanguage()
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}
