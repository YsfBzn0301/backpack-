/**
 * Help Center (/help). Renders a tutorial card for every entry in
 * featuresRegistry — new features and agents appear here automatically.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, PlayCircle, Search, WifiOff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AGENT_COLOR } from '@/agents/host'
import { hasKey, tx } from '@/i18n'
import { closeHelp, goTab, openScreen, ui } from '@/lib/ui'
import { haptic } from '@/lib/haptics'
import { FEATURE_GROUPS, featuresRegistry, type FeatureEntry, type FeatureGroup, type OpenTarget } from './featuresRegistry'
import { HelpDemo } from './HelpDemos'

/** Localised text with the registry's English fallback for untranslated entries. */
export function featureText(f: FeatureEntry) {
  const k = (s: string) => `help.f.${f.id}.${s}`
  const pick = (key: string, fallback: string) => (hasKey(k(key)) ? tx(k(key)) : fallback)
  return {
    title: pick('title', f.fallback.title),
    summary: pick('summary', f.fallback.summary),
    steps: f.fallback.steps.map((s, i) => pick(`s${i + 1}`, s)),
  }
}

function openTarget(target: OpenTarget) {
  closeHelp()
  setTimeout(() => {
    if ('tab' in target) {
      goTab(target.tab)
      if (target.mapMode) ui.set({ mapMode: target.mapMode })
      if (target.mapFilter) ui.set({ mapFilter: target.mapFilter })
    } else if ('screen' in target) openScreen(target.screen)
    else ui.set(target.overlay === 'sos' ? { sosOpen: true } : target.overlay === 'camera' ? { cameraOpen: true } : { scannerOpen: true })
  }, 50)
}

export function FeatureHelpCenter() {
  const { t } = useTranslation()
  const focus = ui.use((s) => s.helpFocus)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<FeatureGroup | 'all'>('all')
  const focused = useRef<HTMLElement | null>(null)

  const entries = useMemo(() => {
    const s = q.trim().toLowerCase()
    return featuresRegistry
      .map((f) => ({ f, text: featureText(f) }))
      .filter(({ f, text }) => (group === 'all' || f.group === group) && (!s || `${text.title} ${text.summary} ${text.steps.join(' ')}`.toLowerCase().includes(s)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, group, t])

  useEffect(() => {
    if (focus) setTimeout(() => focused.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
  }, [focus])

  return (
    <motion.div className="fixed inset-0 z-[65] overflow-y-auto bg-ink-900" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} data-no-swipe>
      <div className="mx-auto max-w-xl px-4 pb-16">
        <header className="safe-top sticky top-0 z-10 -mx-4 bg-ink-900/95 px-4 pb-3 backdrop-blur">
          <div className="flex items-center gap-2 pt-1">
            <button onClick={closeHelp} className="grid h-10 w-10 place-items-center rounded-full bg-veil/[0.06]" aria-label={t('common.back')}>
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">{t('help.title')}</h1>
            <span className="ml-auto text-[11px] text-fog-500">{t('help.count', { count: featuresRegistry.length })}</span>
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-2xl bg-ink-800 px-3.5 py-2.5 hairline border">
            <Search size={16} className="text-fog-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('help.search')} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fog-500" />
          </label>
          <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
            {(['all', ...FEATURE_GROUPS] as const).map((g) => (
              <button key={g} onClick={() => setGroup(g)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${group === g ? 'bg-fog-100 text-ink-900' : 'bg-veil/[0.05] text-fog-400'}`}>
                {t(`help.group.${g}`)}
              </button>
            ))}
          </div>
        </header>

        <p className="mt-2 text-sm leading-relaxed text-fog-400">{t('help.intro')}</p>
        <button onClick={() => ui.set({ tourOpen: true })} className="mt-3 flex items-center gap-2 text-sm font-medium text-ember-400">
          <PlayCircle size={16} /> {t('help.replayTour')}
        </button>

        <ul className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {entries.map(({ f, text }, i) => (
              <motion.li
                key={f.id}
                layout
                ref={f.id === focus ? (el) => void (focused.current = el) : undefined}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03 }}
                className={`card overflow-hidden p-4 ${f.id === focus ? 'ring-1 ring-ember-500/50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${f.color}1f`, color: f.color }}>
                    <f.Icon size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="text-[15px] font-semibold text-fog-50">{text.title}</h2>
                      {f.agent && f.group !== 'agents' && (
                        <span className="rounded-full px-1.5 py-px text-[10px] font-medium" style={{ background: `${AGENT_COLOR[f.agent]}22`, color: AGENT_COLOR[f.agent] }}>
                          {t('feed.agentName', { name: t(`agents.name.${f.agent}`) })}
                        </span>
                      )}
                      {f.offline && (
                        <span className="flex items-center gap-0.5 rounded-full bg-veil/[0.06] px-1.5 py-px text-[10px] text-fog-400">
                          <WifiOff size={9} /> {t('help.offline')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-fog-400">{text.summary}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <HelpDemo id={f.demo} color={f.color} />
                </div>
                <ol className="mt-3 space-y-1.5">
                  {text.steps.map((s, k) => (
                    <li key={k} className="flex gap-2.5 text-[13px] text-fog-300">
                      <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-veil/[0.07] text-[10px] font-semibold text-fog-400">{k + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                {f.open && (
                  <button
                    onClick={() => {
                      haptic('select')
                      openTarget(f.open!)
                    }}
                    className="mt-3 inline-flex items-center gap-1 rounded-full bg-veil/[0.06] px-3 py-1.5 text-xs font-medium text-fog-100"
                  >
                    {t('help.tryIt')} <ArrowUpRight size={13} />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {!entries.length && <p className="mt-6 text-center text-sm text-fog-500">{t('help.noResults')}</p>}
      </div>
    </motion.div>
  )
}
