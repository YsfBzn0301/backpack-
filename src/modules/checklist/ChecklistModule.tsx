import { AnimatePresence, motion } from 'framer-motion'
import { Backpack, Car, Check, ChevronDown, FileText, Landmark, Pill, Plus, RotateCcw, ShoppingBag, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addItem, CHECKLIST_CATEGORIES, checklist, removeItem, resetCategory, restoreDefaults, toggleItem, type ChecklistCategory, type ChecklistItem } from '@/lib/checklist'
import { createStore } from '@/lib/store'
import { haptic } from '@/lib/haptics'
import { tx } from '@/i18n'

const CAT_META: Record<ChecklistCategory, { Icon: typeof Car; color: string }> = {
  activities: { Icon: Landmark, color: '#ffb347' },
  packing: { Icon: Backpack, color: '#ff6b4a' },
  shopping: { Icon: ShoppingBag, color: '#e57bb8' },
  documents: { Icon: FileText, color: '#6cb6ff' },
  health: { Icon: Pill, color: '#4fd1c5' },
  car: { Icon: Car, color: '#b38cff' },
}

const openState = createStore<{ open: ChecklistCategory[] }>({ open: ['packing'] }, 'backpack:checklist-open')

export function ChecklistModule() {
  const { t } = useTranslation()
  const { items, loaded } = checklist.use()
  const total = items.length
  const done = items.filter((i) => i.done).length
  const pct = total ? done / total : 0
  const R = 23
  const C = 2 * Math.PI * R

  if (!loaded) return <div className="card h-40 animate-pulse" />

  return (
    <div className="space-y-3">
      <section className="card flex items-center gap-4 p-4">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={R} stroke="currentColor" strokeOpacity={0.08} strokeWidth="6" fill="none" />
          <motion.circle cx="28" cy="28" r={R} stroke="var(--color-ember-500)" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - pct) }} />
        </svg>
        <div className="flex-1">
          <div className="text-lg font-medium">{t('checklist.progress', { done, total })}</div>
          <div className="text-xs text-fog-500">{pct === 1 ? t('checklist.allDone') : t('checklist.hint')}</div>
        </div>
        <button
          onClick={() => confirm(t('checklist.restoreConfirm')) && restoreDefaults()}
          className="grid h-9 w-9 place-items-center rounded-full bg-veil/5 text-fog-400"
          aria-label={t('checklist.restore')}
          title={t('checklist.restore')}
        >
          <RotateCcw size={15} />
        </button>
      </section>
      {CHECKLIST_CATEGORIES.map((cat) => (
        <Category key={cat} cat={cat} items={items.filter((i) => i.cat === cat)} />
      ))}
    </div>
  )
}

function Category({ cat, items }: { cat: ChecklistCategory; items: ChecklistItem[] }) {
  const { t } = useTranslation()
  const { open } = openState.use()
  const isOpen = open.includes(cat)
  const [text, setText] = useState('')
  const { Icon, color } = CAT_META[cat]
  const done = items.filter((i) => i.done).length
  const pct = items.length ? done / items.length : 0
  const label = (i: ChecklistItem) => i.text ?? tx(`checklist.seed.${i.seed}`)

  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => openState.set((s) => ({ open: isOpen ? s.open.filter((c) => c !== cat) : [...s.open, cat] }))}
        className="flex w-full items-center gap-3 p-3.5 text-left"
        aria-expanded={isOpen}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
          <Icon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between">
            <span className="text-sm font-medium text-fog-50">{t(`checklist.cat.${cat}`)}</span>
            <span className="tabular text-xs text-fog-500">
              {done}/{items.length}
            </span>
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-veil/[0.07]">
            <motion.span className="block h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-fog-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <ul className="divide-y divide-veil/5 border-t hairline">
              <AnimatePresence initial={false}>
                {items.map((i) => (
                  <motion.li key={i.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => {
                        haptic('select')
                        toggleItem(i.id)
                      }}
                      className="flex flex-1 items-center gap-3 text-left"
                      role="checkbox"
                      aria-checked={i.done}
                    >
                      <motion.span
                        animate={{ scale: i.done ? [1, 1.2, 1] : 1 }}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-md border"
                        style={i.done ? { background: color, borderColor: color, color: '#0d1117' } : { borderColor: 'color-mix(in oklab, var(--color-fog-100) 25%, transparent)' }}
                      >
                        {i.done && <Check size={13} strokeWidth={3} />}
                      </motion.span>
                      <span className={`text-sm transition-colors ${i.done ? 'text-fog-500 line-through' : 'text-fog-100'}`}>{label(i)}</span>
                    </button>
                    <button onClick={() => removeItem(i.id)} className="text-fog-500 hover:text-fog-300" aria-label={t('checklist.remove', { item: label(i) })}>
                      <X size={14} />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!text.trim()) return
                addItem(cat, text.trim())
                setText('')
                haptic('tap')
              }}
              className="flex gap-2 border-t p-3 hairline"
            >
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('checklist.addPlaceholder')} className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2 text-sm outline-none hairline border" />
              <button className="grid w-10 place-items-center rounded-xl bg-fog-100 text-ink-900" aria-label={t('common.add')}>
                <Plus size={16} />
              </button>
              {done > 0 && (
                <button type="button" onClick={() => resetCategory(cat)} className="grid w-10 place-items-center rounded-xl bg-veil/5 text-fog-400" aria-label={t('checklist.reset')} title={t('checklist.reset')}>
                  <RotateCcw size={14} />
                </button>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
