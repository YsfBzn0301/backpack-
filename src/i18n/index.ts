import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { settings, type UiLang } from '@/lib/settings'
import en from './locales/en'

export const UI_LANGS: { code: UiLang; native: string }[] = [
  { code: 'en', native: 'English' },
  { code: 'de', native: 'Deutsch' },
  { code: 'tr', native: 'Türkçe' },
  { code: 'ru', native: 'Русский' },
]

// English ships in the main bundle as the fallback; other languages load on demand.
const loaders: Record<Exclude<UiLang, 'en'>, () => Promise<{ default: typeof en }>> = {
  de: () => import('./locales/de'),
  tr: () => import('./locales/tr'),
  ru: () => import('./locales/ru'),
}

async function ensureLoaded(lang: UiLang) {
  if (lang === 'en' || i18n.hasResourceBundle(lang, 'translation')) return
  const mod = await loaders[lang]()
  i18n.addResourceBundle(lang, 'translation', mod.default, true, true)
}

async function switchTo(lang: UiLang) {
  await ensureLoaded(lang).catch(() => {})
  await i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

/** Resolve before first render so the UI never flashes in the wrong language. */
export async function initI18n() {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  await switchTo(settings.get().uiLang)
  settings.subscribe(() => {
    const l = settings.get().uiLang
    if (i18n.language !== l) switchTo(l)
  })
}

/** Untyped lookup for keys built at runtime (agent messages, registry entries). */
export const tx = (key: string, opts?: Record<string, unknown>): string => (i18n.t as unknown as (k: string, o?: object) => string)(key, opts)
export const hasKey = (key: string) => i18n.exists(key)

export default i18n
