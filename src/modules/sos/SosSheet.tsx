import { Ambulance, Building2, Flame, Loader2, Navigation, Phone, RefreshCw, Share2, ShieldAlert, Siren, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { agents, useAgentState } from '@/agents/host'
import type { Medical, SafetyState } from '@/agents/safety.worker'
import type { Place } from '@/agents/protocol'
import { FALLBACK_COUNTRY, flag, getCountry } from '@/data/countries'
import { getPhrase } from '@/data/phrasebook'
import { LANG_BY_CODE } from '@/data/languages'
import { countryName, fmtDistance, langName, relativeTime } from '@/i18n/format'
import { useTranslation } from 'react-i18next'
import { activeCoords, location } from '@/lib/location'
import { settings } from '@/lib/settings'
import { ui } from '@/lib/ui'
import { directionsUrl } from '@/lib/geo'
import { haptic } from '@/lib/haptics'
import { speak } from '@/hooks/useSpeech'
import { SectionTitle } from '@/components/ui/SectionTitle'

export function SosSheet() {
  const { t } = useTranslation()
  const open = ui.use((s) => s.sosOpen)
  const close = () => ui.set({ sosOpen: false })
  const safety = useAgentState<SafetyState>('safety')
  const country = safety?.country ?? FALLBACK_COUNTRY
  const home = settings.use((s) => s.homeCountry)
  const loc = location.use()
  const { coords } = activeCoords(loc)
  const [embassies, setEmbassies] = useState<(Place & { distance: number; match: boolean })[] | null>(null)
  const [loadingEmb, setLoadingEmb] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const call = (n: string) => {
    haptic('heavy')
    window.location.href = `tel:${n}`
  }

  const share = async () => {
    const c = loc.gps ?? coords
    if (!c) return
    const url = `https://maps.google.com/?q=${c.lat.toFixed(6)},${c.lng.toFixed(6)}`
    const text = t('sos.shareText', { url })
    haptic('select')
    if (navigator.share) await navigator.share({ title: t('sos.myLocation'), text, url }).catch(() => {})
    else await navigator.clipboard?.writeText(text)
  }

  const findEmbassy = async () => {
    setLoadingEmb(true)
    try {
      setEmbassies(await agents.run('safety', 'embassies', { homeCountry: home }))
    } catch {
      setEmbassies([])
    } finally {
      setLoadingEmb(false)
    }
  }

  const homeName = getCountry(home) ? countryName(home) : t('sos.yourCountry')
  const here = countryName(country.code, country.name)
  const lines = [
    { label: t('sos.police'), n: country.police, Icon: ShieldAlert },
    { label: t('sos.ambulance'), n: country.ambulance, Icon: Ambulance },
    { label: t('sos.fire'), n: country.fire, Icon: Flame },
  ]
  const phraseLang = getPhrase(country.lang, 'doctor') ? country.lang : null

  return (
    <Sheet
      open={open}
      onClose={close}
      tone="alert"
      title={
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-alert-500/15 text-alert-500">
            <Siren size={22} />
          </span>
          <div>
            <h2 className="text-lg leading-tight font-semibold">
              {country.code !== 'XX' && flag(country.code)} {here}
            </h2>
            <p className="text-xs text-fog-500">
              {t(`sos.source.${safety?.countrySource ?? 'none'}`)} · {t('sos.worksOffline')}
            </p>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {lines.map(({ label, n, Icon }) => (
          <button key={label} onClick={() => call(n)} className="flex flex-col items-center gap-1 rounded-2xl bg-alert-500/10 px-2 py-4 ring-1 ring-alert-500/25 active:scale-95">
            <Icon size={20} className="text-alert-500" />
            <span className="tabular text-2xl font-semibold text-fog-50">{n}</span>
            <span className="text-[11px] text-fog-400">{label}</span>
          </button>
        ))}
      </div>
      {(country.general || country.tourist) && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {country.general && (
            <button onClick={() => call(country.general!)} className="flex items-center justify-between rounded-2xl bg-veil/[0.04] px-4 py-3">
              <span className="text-xs text-fog-400">{t('sos.all')}</span>
              <span className="tabular text-lg font-semibold">{country.general}</span>
            </button>
          )}
          {country.tourist && (
            <button onClick={() => call(country.tourist!)} className="flex items-center justify-between rounded-2xl bg-veil/[0.04] px-4 py-3">
              <span className="text-xs text-fog-400">{t('sos.tourist')}</span>
              <span className="tabular text-lg font-semibold">{country.tourist}</span>
            </button>
          )}
        </div>
      )}
      {country.note && <p className="mt-2 text-xs leading-relaxed text-fog-500">{t(`sos.note.${country.note}`)}</p>}

      <button onClick={share} disabled={!coords} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-fog-100 py-3 text-sm font-semibold text-ink-900 disabled:opacity-40">
        <Share2 size={16} /> {t('sos.share')}
      </button>

      <section className="mt-5">
        <SectionTitle
          right={
            <button
              onClick={async () => {
                setRefreshing(true)
                await agents.run('safety', 'medical').catch(() => {})
                setRefreshing(false)
              }}
              className="flex items-center gap-1 text-[11px] text-fog-500"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              {safety?.medicalAt ? relativeTime(safety.medicalAt) : t('common.refresh')}
            </button>
          }
        >
          {t('sos.medical')}
        </SectionTitle>
        {safety?.medical.length ? (
          <ul className="space-y-1.5">
            {safety.medical.slice(0, 6).map((m) => (
              <MedicalRow key={m.id} m={m} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-veil/[0.03] p-3 text-xs text-fog-500">
            {coords ? t('sos.medicalSearching') : t('sos.medicalNeedLocation')}
          </p>
        )}
      </section>

      {phraseLang && (
        <section className="mt-5">
          <SectionTitle>{t('sos.sayIt', { lang: langName(phraseLang) })}</SectionTitle>
          <ul className="space-y-1.5">
            {['ambulance', 'doctor', 'hospital', 'allergy', 'pharmacy'].map((id) => {
              const p = getPhrase(phraseLang, id)!
              return (
                <li key={id}>
                  <button onClick={() => speak(p.text, LANG_BY_CODE[phraseLang]?.speech ?? phraseLang)} className="flex w-full items-center gap-3 rounded-2xl bg-veil/[0.03] px-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-base text-fog-50" lang={phraseLang}>
                        {p.text}
                      </span>
                      {p.phonetic && <span className="block text-xs text-fog-500 italic">{p.phonetic}</span>}
                    </span>
                    <Volume2 size={16} className="shrink-0 text-fog-400" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-5 mb-2">
        <SectionTitle>{t('sos.embassy', { country: homeName })}</SectionTitle>
        {embassies === null ? (
          <button onClick={findEmbassy} disabled={!coords || loadingEmb} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-veil/[0.04] py-3 text-sm disabled:opacity-40">
            {loadingEmb ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />} {t('sos.findEmbassy')}
          </button>
        ) : (
          <ul className="space-y-1.5">
            {embassies.slice(0, 5).map((e) => (
              <li key={e.id}>
                <a href={directionsUrl(e, 'transit', e.source === 'google' ? e.id : undefined)} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-2xl bg-veil/[0.03] px-3 py-2.5">
                  <Building2 size={16} className={e.match ? 'text-ember-400' : 'text-fog-500'} />
                  <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
                  <span className="text-xs text-fog-500">{fmtDistance(e.distance)}</span>
                </a>
              </li>
            ))}
            <li>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(t('sos.embassyQuery', { home: homeName, here }))}`}
                target="_blank"
                rel="noopener"
                className="block px-3 py-2 text-xs text-ember-400"
              >
                {t('sos.searchEmbassy')}
              </a>
            </li>
          </ul>
        )}
      </section>
    </Sheet>
  )
}

function MedicalRow({ m }: { m: Medical }) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-veil/[0.03] px-3 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold ${m.kind === 'hospital' ? 'bg-alert-500/15 text-alert-500' : 'bg-teal-400/15 text-teal-500'}`}>
        {m.kind === 'hospital' ? 'H' : 'Rx'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fog-100">{m.name}</span>
        <span className="block text-[11px] text-fog-500">
          {fmtDistance(m.distance)}
          {m.openNow ? ` · ${t('map.openNow')}` : ''}
        </span>
      </span>
      {m.phone && (
        <a href={`tel:${m.phone}`} className="grid h-8 w-8 place-items-center rounded-full bg-veil/5" aria-label={t('sos.call', { name: m.name })}>
          <Phone size={14} />
        </a>
      )}
      <a href={directionsUrl(m, 'driving', m.source === 'google' ? m.id : undefined)} target="_blank" rel="noopener" className="grid h-8 w-8 place-items-center rounded-full bg-veil/5" aria-label={t('sos.directionsTo', { name: m.name })}>
        <Navigation size={14} />
      </a>
    </li>
  )
}
