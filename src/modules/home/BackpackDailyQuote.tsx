import { AnimatePresence, motion } from 'framer-motion'
import { Quote as QuoteIcon, Share2, Shuffle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QUOTES, quoteOfDay, type Quote, type QuoteCategory } from '@/data/quotes'
import { settings } from '@/lib/settings'
import { haptic } from '@/lib/haptics'

const CAT_COLOR: Record<QuoteCategory, string> = {
  humorous: '#ffb347',
  motivational: '#5fd39a',
  adventurous: '#ff6b4a',
  witty: '#6cb6ff',
}

/** "Backpack Daily": one quote per calendar day, shuffle for another. */
export function BackpackDailyQuote() {
  const { t } = useTranslation()
  const lang = settings.use((s) => s.uiLang)
  const [quote, setQuote] = useState<Quote>(() => quoteOfDay())
  const isToday = quote.id === quoteOfDay().id

  const shuffle = () => {
    haptic('select')
    const pool = QUOTES.filter((q) => q.id !== quote.id)
    setQuote(pool[Math.floor(Math.random() * pool.length)])
  }
  const share = () => {
    const text = `“${quote.text[lang]}” — ${quote.author}`
    if (navigator.share) navigator.share({ text }).catch(() => {})
    else navigator.clipboard?.writeText(text)
  }

  return (
    <section className="card relative overflow-hidden px-4 pt-3.5 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-fog-500 uppercase">
          <QuoteIcon size={12} className="text-ember-500" /> {t('daily.title')}
          <span className="rounded-full px-1.5 py-px text-[10px] tracking-normal normal-case" style={{ background: `${CAT_COLOR[quote.cat]}22`, color: CAT_COLOR[quote.cat] }}>
            {t(`daily.cat.${quote.cat}`)}
          </span>
          {!isToday && <span className="text-[10px] tracking-normal normal-case">· {t('daily.shuffled')}</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={shuffle} className="grid h-8 w-8 place-items-center rounded-full text-fog-500 hover:bg-veil/5 hover:text-fog-100" aria-label={t('daily.shuffle')}>
            <Shuffle size={14} />
          </button>
          <button onClick={share} className="grid h-8 w-8 place-items-center rounded-full text-fog-500 hover:bg-veil/5 hover:text-fog-100" aria-label={t('common.share')}>
            <Share2 size={14} />
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.figure key={`${quote.id}-${lang}`} initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.35 }} className="mt-1.5">
          <blockquote className="text-[15px] leading-snug text-fog-50" lang={lang}>
            “{quote.text[lang]}”
          </blockquote>
          <figcaption className="mt-1.5 text-xs text-fog-500">
            — {quote.author}
            {quote.attributed ? ` (${t('daily.attributed')})` : ''}
          </figcaption>
        </motion.figure>
      </AnimatePresence>
    </section>
  )
}
