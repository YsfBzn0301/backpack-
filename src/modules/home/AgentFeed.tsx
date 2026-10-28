import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowUpRight, Info, Sparkles, Tag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AGENT_COLOR, AGENT_NAMES, agents, useAgents } from '@/agents/host'
import type { Insight } from '@/agents/protocol'
import { runAction } from '@/lib/actions'
import { relativeTime } from '@/i18n/format'
import { useMsg } from '@/i18n/msg'
import { haptic } from '@/lib/haptics'
import { SectionTitle } from '@/components/ui/SectionTitle'

const KIND_ICON = { suggestion: Sparkles, alert: AlertTriangle, info: Info, deal: Tag }

/** Live ticker: newest insight headlines scrolling across the dashboard. */
export function AgentTicker() {
  const { t } = useTranslation()
  const render = useMsg()
  const { insights } = useAgents()
  const items = insights.slice(0, 6)
  if (!items.length) return null
  const loop = [...items, ...items]
  return (
    <div className="relative overflow-hidden rounded-full bg-ink-850 py-2 hairline border" data-no-swipe aria-hidden>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-ink-850 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-ink-850 to-transparent" />
      <div className="flex w-max gap-8 pl-4 whitespace-nowrap" style={{ animation: `ticker ${Math.max(18, items.length * 9)}s linear infinite` }}>
        {loop.map((i, idx) => (
          <span key={`${i.id}-${idx}`} className="flex items-center gap-2 text-xs text-fog-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: AGENT_COLOR[i.agent] }} />
            <span className="font-medium text-fog-500">{t(`agents.name.${i.agent}`)}</span>
            {render(i.title)}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AgentStatusStrip() {
  const { t } = useTranslation()
  const { statuses } = useAgents()
  return (
    <div className="flex items-center gap-3 px-1">
      {AGENT_NAMES.map((a) => {
        const s = statuses[a]
        return (
          <div key={a} className="flex items-center gap-1.5 text-[11px] text-fog-500" title={`${t(`agents.role.${a}`)} · ${t(`agents.status.${s}`)}`}>
            <span className="relative flex h-2 w-2">
              {s === 'thinking' && <span className="absolute inset-0 animate-ping rounded-full opacity-70" style={{ background: AGENT_COLOR[a] }} />}
              <span className="relative h-2 w-2 rounded-full" style={{ background: s === 'error' ? '#6e7681' : AGENT_COLOR[a], opacity: s === 'booting' ? 0.35 : 1 }} />
            </span>
            <span className="hidden min-[400px]:inline">{t(`agents.name.${a}`)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function InsightList({ limit = 5 }: { limit?: number }) {
  const { t } = useTranslation()
  const { insights } = useAgents()
  const shown = insights.slice(0, limit)
  return (
    <section>
      <SectionTitle right={<AgentStatusStrip />}>{t('feed.title')}</SectionTitle>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((i) => (
            <InsightCard key={i.key} insight={i} />
          ))}
        </AnimatePresence>
        {!shown.length && <div className="card px-4 py-5 text-sm text-fog-500">{t('feed.empty')}</div>}
      </div>
    </section>
  )
}

function InsightCard({ insight: i }: { insight: Insight }) {
  const { t } = useTranslation()
  const render = useMsg()
  const Icon = KIND_ICON[i.kind]
  const color = AGENT_COLOR[i.agent]
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.5, right: 0.05 }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -90) {
          haptic('tap')
          agents.dismiss(i.key)
        }
      }}
      data-no-swipe
      className={`card relative overflow-hidden p-4 ${i.priority >= 3 ? 'ring-1 ring-alert-500/40' : ''}`}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color, opacity: 0.8 }} />
      <div className="flex gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-fog-500">
            <span className="font-medium" style={{ color }}>
              {t('feed.agentName', { name: t(`agents.name.${i.agent}`) })}
            </span>
            <span>·</span>
            <span>{relativeTime(i.ts)}</span>
          </div>
          <h3 className="mt-0.5 text-[15px] leading-snug font-medium text-fog-50">{render(i.title)}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-fog-400">{render(i.body)}</p>
          {i.action && (
            <button
              onClick={() => {
                haptic('select')
                runAction(i.action!)
              }}
              className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-veil/[0.06] px-3 py-1.5 text-xs font-medium text-fog-100 hover:bg-veil/10"
            >
              {render(i.action.label)} <ArrowUpRight size={13} />
            </button>
          )}
        </div>
        <button onClick={() => agents.dismiss(i.key)} className="-mt-1 -mr-1 h-7 w-7 shrink-0 rounded-full text-fog-500 hover:bg-veil/5 hover:text-fog-300" aria-label={t('feed.dismiss')}>
          <X size={14} className="mx-auto" />
        </button>
      </div>
    </motion.article>
  )
}
