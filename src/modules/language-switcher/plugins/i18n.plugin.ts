import { createI18n } from 'vue-i18n'

// Import language files
import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import de from '../locales/de.json'

// Define available locales
export const availableLocales = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch'
} as const

export type LocaleKey = keyof typeof availableLocales

// Get user's preferred locale from localStorage or browser
function getDefaultLocale(): LocaleKey {
  const savedLocale = localStorage.getItem('locale') as LocaleKey
  if (savedLocale && availableLocales[savedLocale]) {
    return savedLocale
  }
  
  // Fallback to browser language
  const browserLocale = navigator.language.split('-')[0] as LocaleKey
  if (availableLocales[browserLocale]) {
    return browserLocale
  }
  
  return 'en' // Default fallback
}

// Create i18n instance
const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    es,
    fr,
    de
  },
  globalInjection: true, // Automatically inject $t into components
  silentTranslationWarn: import.meta.env.PROD,
  missingWarn: !import.meta.env.PROD,
  fallbackWarn: !import.meta.env.PROD
})

// Language switcher utility
export function setLocale(locale: LocaleKey): void {
  if (!availableLocales[locale]) {
    console.warn(`Locale ${locale} is not available`)
    return
  }
  
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.lang = locale
  
  console.info(`Locale changed to ${locale}`)
}

// Get current locale
export function getCurrentLocale(): LocaleKey {
  return i18n.global.locale.value as LocaleKey
}

// Get available locales
export function getAvailableLocales() {
  return availableLocales
}

export default i18n 