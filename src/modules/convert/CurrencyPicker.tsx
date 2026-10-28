import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { CURRENCIES } from '@/data/currencies'
import { flag } from '@/data/countries'
import { useTranslation } from 'react-i18next'
import { haptic } from '@/lib/haptics'
import { loc } from '@/i18n/format'

export function CurrencyPicker({ open, onClose, onPick, highlight }: { open: boolean; onClose: () => void; onPick: (code: string) => void; highlight: string[] }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const names = useMemo(() => new Intl.DisplayNames([loc()], { type: 'currency' }), [])
  const nameOf = (code: string, fallback: string) => {
    try {
      return names.of(code) ?? fallback
    } catch {
      return fallback
    }
  }
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const filtered = s ? CURRENCIES.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || nameOf(c.code, c.name).toLowerCase().includes(s)) : CURRENCIES
    return [...filtered].sort((a, b) => Number(highlight.includes(b.code)) - Number(highlight.includes(a.code)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, highlight])
  return (
    <Sheet open={open} onClose={onClose} title={<h2 className="text-lg font-semibold">{t('money.currency')}</h2>}>
      <label className="sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-2xl bg-ink-900 px-4 py-3 hairline border">
        <Search size={16} className="text-fog-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('money.searchCurrencies')} className="w-full bg-transparent outline-none placeholder:text-fog-500" />
      </label>
      <ul>
        {list.map((c) => (
          <li key={c.code}>
            <button
              onClick={() => {
                haptic('select')
                onPick(c.code)
                setQ('')
                onClose()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-veil/5"
            >
              <span className="text-xl">{c.region === 'EU' ? '🇪🇺' : flag(c.region)}</span>
              <span className="w-12 font-mono text-sm font-medium">{c.code}</span>
              <span className="flex-1 truncate text-sm text-fog-400">{nameOf(c.code, c.name)}</span>
              {highlight.includes(c.code) && <span className="text-[10px] text-ember-400">{t('money.suggested')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
