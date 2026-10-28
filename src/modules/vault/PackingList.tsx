import { motion } from 'framer-motion'
import { Check, Plus, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { createStore } from '@/lib/store'
import { uid } from '@/lib/format'
import { haptic } from '@/lib/haptics'
import { SectionTitle } from '@/components/ui/SectionTitle'

interface Item {
  id: string
  text: string
  group: string
  done: boolean
}

const DEFAULTS: [string, string[]][] = [
  ['Documents', ['Passport', 'Visa / e-visa printout', 'Travel insurance policy', 'Bank cards (2, kept apart)', 'Emergency cash in USD']],
  ['Tech', ['Phone + charger', 'Universal adapter', 'Power bank', 'Earplugs + eye mask', 'Offline maps downloaded']],
  ['Health', ['Prescription meds', 'Mini first-aid kit', 'Sunscreen', 'Insect repellent', 'Rehydration salts']],
  ['Gear', ['Quick-dry towel', 'Padlock for lockers', 'Reusable water bottle', 'Rain shell', 'Packing cubes']],
]

const seed = (): Item[] => DEFAULTS.flatMap(([group, items]) => items.map((text) => ({ id: uid(), text, group, done: false })))
const packing = createStore<{ items: Item[] }>({ items: seed() }, 'backpack:packing')

export function PackingList() {
  const { items } = packing.use()
  const [text, setText] = useState('')
  const done = items.filter((i) => i.done).length
  const pct = items.length ? done / items.length : 0
  const groups = [...new Set(items.map((i) => i.group))]

  const toggle = (id: string) => {
    haptic('select')
    packing.set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) }))
  }

  return (
    <div className="space-y-4">
      <section className="card flex items-center gap-4 p-4">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r="23" stroke="rgba(255,255,255,0.07)" strokeWidth="6" fill="none" />
          <motion.circle cx="28" cy="28" r="23" stroke="var(--color-ember-500)" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 23} animate={{ strokeDashoffset: 2 * Math.PI * 23 * (1 - pct) }} />
        </svg>
        <div className="flex-1">
          <div className="text-lg font-medium">
            {done} of {items.length} packed
          </div>
          <div className="text-xs text-fog-500">{pct === 1 ? 'All set. Go.' : 'Tap items as they go in the bag.'}</div>
        </div>
        <button
          onClick={() => packing.set((s) => ({ items: s.items.map((i) => ({ ...i, done: false })) }))}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-fog-400"
          aria-label="Unpack all"
          title="Reset for the next trip"
        >
          <RotateCcw size={15} />
        </button>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          packing.set((s) => ({ items: [...s.items, { id: uid(), text: text.trim(), group: 'Mine', done: false }] }))
          setText('')
        }}
        className="flex gap-2"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item" className="min-w-0 flex-1 rounded-xl bg-ink-800 px-3 py-2.5 text-sm outline-none hairline border" />
        <button className="grid w-11 place-items-center rounded-xl bg-fog-100 text-ink-900" aria-label="Add item">
          <Plus size={17} />
        </button>
      </form>

      {groups.map((g) => (
        <section key={g}>
          <SectionTitle>{g}</SectionTitle>
          <ul className="card divide-y divide-white/5">
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button onClick={() => toggle(i.id)} className="flex flex-1 items-center gap-3 text-left">
                    <motion.span
                      animate={{ scale: i.done ? [1, 1.2, 1] : 1 }}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${i.done ? 'border-ember-500 bg-ember-500 text-ink-900' : 'border-white/20'}`}
                    >
                      {i.done && <Check size={13} strokeWidth={3} />}
                    </motion.span>
                    <span className={`text-sm transition-colors ${i.done ? 'text-fog-500 line-through' : 'text-fog-100'}`}>{i.text}</span>
                  </button>
                  <button onClick={() => packing.set((s) => ({ items: s.items.filter((x) => x.id !== i.id) }))} className="text-fog-500 hover:text-fog-300" aria-label={`Remove ${i.text}`}>
                    <X size={14} />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
