import { motion } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CATEGORIES, PHRASES, PHRASEBOOK, phraseLabel, type PhraseCategory } from '@/data/phrasebook'
import { LANG_BY_CODE } from '@/data/languages'
import { langName } from '@/i18n/format'
import { settings } from '@/lib/settings'
import { Segmented } from '@/components/ui/Segmented'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { speak } from '@/hooks/useSpeech'
import { haptic } from '@/lib/haptics'

export function Phrasebook({ lang, onShow, initialCategory = 'basics' }: { lang: string; onShow: (text: string, phonetic?: string) => void; initialCategory?: PhraseCategory }) {
  const { t } = useTranslation()
  const uiLang = settings.use((s) => s.uiLang)
  const [cat, setCat] = useState<PhraseCategory>(initialCategory)
  const book = PHRASEBOOK[lang]
  const tag = LANG_BY_CODE[lang]?.speech ?? lang
  return (
    <section>
      <SectionTitle right={<span className="text-[11px] text-moss-400">{book ? t('phrasebook.offline') : ''}</span>}>{t('phrasebook.title', { lang: langName(lang) })}</SectionTitle>
      <Segmented size="sm" value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c.id, label: t(`phrasebook.cat.${c.id}`) }))} />
      {!book ? (
        <p className="card mt-3 p-4 text-sm text-fog-400">{t('phrasebook.none', { lang: langName(lang) })}</p>
      ) : (
        <motion.ul key={cat} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-1.5">
          {PHRASES.filter((p) => p.category === cat).map((p) => {
            const [text, phonetic] = book[p.id]
            const label = phraseLabel(uiLang, p.id)
            return (
              <li key={p.id} className="card flex items-center gap-3 p-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => onShow(text, phonetic)}>
                  <span className="block text-xs text-fog-500">{label}</span>
                  <span className="block text-[17px] leading-snug text-fog-50" dir={LANG_BY_CODE[lang]?.rtl ? 'rtl' : undefined} lang={lang}>
                    {text}
                  </span>
                  {phonetic && <span className="block text-xs text-fog-400 italic">{phonetic}</span>}
                </button>
                <button
                  onClick={() => {
                    haptic('tap')
                    speak(text, tag)
                  }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-veil/[0.05] text-fog-300 hover:text-ember-400"
                  aria-label={t('phrasebook.play', { phrase: label })}
                >
                  <Volume2 size={17} />
                </button>
              </li>
            )
          })}
        </motion.ul>
      )}
    </section>
  )
}
