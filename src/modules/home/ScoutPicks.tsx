import { Navigation, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAgentState } from '@/agents/host'
import type { ScoutState } from '@/agents/scout.worker'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { directionsUrl, walkMinutes } from '@/lib/geo'
import { cap, fmtDistance } from '@/i18n/format'
import { goTab } from '@/lib/ui'

export function ScoutPicks() {
  const { t } = useTranslation()
  const scout = useAgentState<ScoutState>('scout')
  const picks = scout?.picks.slice(0, 5) ?? []
  if (!picks.length) return null
  return (
    <section>
      <SectionTitle
        right={
          <button onClick={() => goTab('map')} className="text-[11px] font-medium text-ember-400">
            {t('picks.seeMap')}
          </button>
        }
      >
        {t('picks.title', { intents: scout?.intents.map((i) => t(`intent.${i.id}`)).join(', ') })}
      </SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1" data-no-swipe>
        {picks.map((p) => (
          <a key={p.id} href={directionsUrl(p, 'walking', p.source === 'google' ? p.id : undefined)} target="_blank" rel="noopener" className="card w-56 shrink-0 snap-start p-3.5 transition-transform active:scale-[0.98]">
            <div className="flex items-center justify-between text-[11px] text-fog-500">
              <span>{cap(t(`kind.${p.kind}`))}</span>
              {p.rating && (
                <span className="flex items-center gap-0.5 text-amber-glow">
                  <Star size={11} fill="currentColor" /> {p.rating.toFixed(1)}
                </span>
              )}
            </div>
            <h3 className="mt-1 truncate text-sm font-medium text-fog-50">{p.name || cap(t(`kind.${p.kind}`))}</h3>
            <p className="mt-1 text-[11px] text-fog-400">
              {fmtDistance(p.distance)} · {t('map.minWalk', { n: walkMinutes(p.distance) })}
              {p.openNow ? ` · ${t('map.openNow')}` : ''}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-ember-400">
              <Navigation size={11} /> {t('map.walkThere')}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
