import { useEffect, useState } from 'react'
import { ar } from './ar'
import { de } from './de'
import { en, type TranslationKey, type Translations } from './en'
import { fr } from './fr'
import { ja } from './ja'
import { ko } from './ko'
import { ru } from './ru'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'
import { pt } from './pt'
import { es } from './es'

const STORAGE_KEY = 'opentypeless.locale'

export const LOCALES = [
  { code: 'en', nativeName: 'English' },
  { code: 'zh-CN', nativeName: '简体中文' },
  { code: 'zh-TW', nativeName: '繁體中文' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'ko', nativeName: '한국어' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'ar', nativeName: 'العربية' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'es', nativeName: 'Español' },
] as const

export type Locale = (typeof LOCALES)[number]['code']

const dictionaries: Record<Locale, Translations> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
  fr,
  de,
  ar,
  ru,
  pt,
  es,
}

const localeSet = new Set<Locale>(LOCALES.map((entry) => entry.code))
const listeners = new Set<() => void>()

const isLocale = (value: string): value is Locale => {
  return localeSet.has(value as Locale)
}

const readStoredLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && isLocale(stored)) {
    return stored
  }

  return 'en'
}

let currentLocale: Locale = readStoredLocale()

const notifyLocaleChange = () => {
  listeners.forEach((listener) => listener())
}

export const getLocale = (): Locale => currentLocale

export const setLocale = (locale: Locale) => {
  if (locale === currentLocale) {
    return
  }

  currentLocale = locale

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale)
  }

  notifyLocaleChange()
}

export const t = (key: TranslationKey): string => {
  return dictionaries[currentLocale][key] ?? en[key]
}

const subscribeLocale = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useLocale = () => {
  const [locale, setLocaleState] = useState<Locale>(getLocale)

  useEffect(() => {
    return subscribeLocale(() => {
      setLocaleState(getLocale())
    })
  }, [])

  return {
    locale,
    setLocale,
  }
}
