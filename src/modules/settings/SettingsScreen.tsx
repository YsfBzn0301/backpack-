import { CircleHelp, HardDrive, KeyRound, Monitor, Moon, PlayCircle, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { settings, type UiLang } from '@/lib/settings'
import { CURRENCIES } from '@/data/currencies'
import { COUNTRIES } from '@/data/countries'
import { UI_LANGS } from '@/i18n'
import { countryName, fmtMoney } from '@/i18n/format'
import { openHelp, ui } from '@/lib/ui'
import { haptic } from '@/lib/haptics'
import { KeyHelp } from '@/components/KeyHelp'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Segmented } from '@/components/ui/Segmented'
import { AGENT_COLOR, AGENT_NAMES, useAgents } from '@/agents/host'

export function SettingsScreen() {
  const { t } = useTranslation()
  const s = settings.use()
  const { statuses } = useAgents()
  const [storage, setStorage] = useState<{ usage: number; persisted: boolean } | null>(null)

  useEffect(() => {
    ;(async () => {
      const est = await navigator.storage?.estimate?.()
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (est) setStorage({ usage: est.usage ?? 0, persisted })
    })()
  }, [])

  // Opened from another module to fix a specific key (e.g. Audio Scout → AudD).
  useEffect(() => {
    const focus = ui.get().settingsFocus
    if (!focus) return
    ui.set({ settingsFocus: null })
    const id = setTimeout(() => {
      const el = document.getElementById(`key-${focus}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus({ preventScroll: true })
    }, 350)
    return () => clearTimeout(id)
  }, [])

  const themes = [
    { id: 'system', Icon: Monitor },
    { id: 'dark', Icon: Moon },
    { id: 'light', Icon: Sun },
  ] as const

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <div className="grid grid-cols-4 gap-1.5">
          {UI_LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                haptic('select')
                settings.set({ uiLang: l.code as UiLang })
              }}
              className={`rounded-2xl px-2 py-3 text-center ${s.uiLang === l.code ? 'bg-fog-100 text-ink-900' : 'card text-fog-300'}`}
              aria-pressed={s.uiLang === l.code}
            >
              <span className="block text-xs font-bold tracking-wide uppercase">{l.code}</span>
              <span className="block truncate text-[11px] opacity-80">{l.native}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>{t('settings.theme')}</SectionTitle>
        <div className="grid grid-cols-3 gap-1.5">
          {themes.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => {
                haptic('select')
                settings.set({ theme: id })
              }}
              className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 ${s.theme === id ? 'bg-fog-100 text-ink-900' : 'card text-fog-300'}`}
              aria-pressed={s.theme === id}
            >
              <Icon size={18} />
              <span className="text-xs font-medium">{t(`settings.themeOpt.${id}`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>{t('settings.home')}</SectionTitle>
        <div className="card divide-y divide-veil/5">
          <Row label={t('settings.homeCurrency')}>
            <select value={s.homeCurrency} onChange={(e) => settings.set({ homeCurrency: e.target.value })} className="rounded-lg bg-ink-900 px-2 py-1.5 font-mono text-sm outline-none">
              {CURRENCIES.map((c) => (
                <option key={c.code}>{c.code}</option>
              ))}
            </select>
          </Row>
          <Row label={t('settings.passport')} hint={t('settings.passportHint')}>
            <select value={s.homeCountry} onChange={(e) => settings.set({ homeCountry: e.target.value })} className="max-w-40 rounded-lg bg-ink-900 px-2 py-1.5 text-sm outline-none">
              {Object.values(COUNTRIES)
                .map((c) => ({ code: c.code, name: countryName(c.code, c.name) }))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Row>
          <Row label={t('settings.units')}>
            <Segmented size="sm" value={s.units} onChange={(v) => settings.set({ units: v })} options={[{ value: 'metric', label: t('settings.metric') }, { value: 'imperial', label: t('settings.imperial') }]} />
          </Row>
          <Row label={t('settings.haptics')} hint={t('settings.hapticsHint')}>
            <Toggle on={s.haptics} onChange={(v) => settings.set({ haptics: v })} />
          </Row>
        </div>
      </section>

      <section>
        <SectionTitle>{t('settings.roadTrip')}</SectionTitle>
        <div className="card divide-y divide-veil/5">
          <Row label={t('settings.driving')} hint={t('settings.drivingHint')}>
            <Toggle on={s.driving} onChange={(v) => settings.set({ driving: v })} />
          </Row>
          <Row label={t('settings.vehicleHeight')} hint={t('settings.vehicleHeightHint')}>
            <Stepper value={s.vehicleHeightM} step={0.1} min={1.2} max={4} format={(v) => `${v.toFixed(1)} m`} onChange={(v) => settings.set({ vehicleHeightM: Math.round(v * 10) / 10 })} />
          </Row>
          <Row label={t('settings.parkingBudget')} hint={t('settings.parkingBudgetHint')}>
            <Stepper value={s.parkingBudgetDaily} step={5} min={0} max={200} format={(v) => fmtMoney(v, s.homeCurrency)} onChange={(v) => settings.set({ parkingBudgetDaily: v })} />
          </Row>
        </div>
      </section>

      <section>
        <SectionTitle>{t('settings.agents')}</SectionTitle>
        <div className="card divide-y divide-veil/5">
          {AGENT_NAMES.map((a) => (
            <div key={a} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ background: AGENT_COLOR[a] }} />
                <div>
                  <div className="text-sm font-medium">{t('feed.agentName', { name: t(`agents.name.${a}`) })}</div>
                  <div className="text-xs text-fog-500">
                    {t(`agents.role.${a}`)} · {t('settings.worker')}
                  </div>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${statuses[a] === 'error' ? 'bg-alert-500/15 text-alert-500' : statuses[a] === 'thinking' ? 'bg-amber-glow/15 text-amber-glow' : 'bg-moss-400/10 text-moss-400'}`}>
                {t(`agents.status.${statuses[a]}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>
          <span className="flex items-center gap-1.5">
            <KeyRound size={11} /> {t('settings.keys')}
          </span>
        </SectionTitle>
        <div className="card space-y-3 p-4">
          <p className="text-xs leading-relaxed text-fog-500">{t('settings.keysHint')}</p>
          <KeyHelp service="google" variant="inline" />
          <KeyInput id="key-google" label={t('settings.googleKey')} value={s.googleMapsKey} onChange={(v) => settings.set({ googleMapsKey: v })} note={t('settings.reloadNote')} />
          <KeyHelp service="openweather" variant="inline" />
          <KeyInput id="key-openweather" label={t('settings.owmKey')} value={s.openWeatherKey} onChange={(v) => settings.set({ openWeatherKey: v })} />
          <KeyHelp service="audd" variant="inline" />
          <KeyInput id="key-audd" label={t('settings.auddKey')} value={s.auddToken} onChange={(v) => settings.set({ auddToken: v })} />
          <KeyHelp service="oxr" variant="inline" />
          <KeyInput id="key-oxr" label={t('keyHelp.oxrLabel')} value={s.oxrAppId} onChange={(v) => settings.set({ oxrAppId: v })} />
          <KeyInput label={t('settings.translateEndpoint')} value={s.translateEndpoint} onChange={(v) => settings.set({ translateEndpoint: v })} type="url" />
        </div>
      </section>

      {storage && (
        <section>
          <SectionTitle>{t('settings.storage')}</SectionTitle>
          <div className="card flex items-center gap-3 p-4">
            <HardDrive size={18} className="text-fog-400" />
            <div className="flex-1 text-sm">
              {t('settings.used', { mb: (storage.usage / 1024 / 1024).toFixed(1) })}
              <div className="text-xs text-fog-500">{storage.persisted ? t('settings.persisted') : t('settings.notPersisted')}</div>
            </div>
            {!storage.persisted && (
              <button
                onClick={async () => {
                  const ok = await navigator.storage?.persist?.()
                  setStorage((st) => (st ? { ...st, persisted: Boolean(ok) } : st))
                }}
                className="rounded-full bg-veil/[0.06] px-3 py-1.5 text-xs font-medium"
              >
                {t('settings.keep')}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => ui.set({ tourOpen: true })} className="card flex items-center justify-center gap-2 py-3 text-sm font-medium text-fog-100">
          <PlayCircle size={16} /> {t('settings.tour')}
        </button>
        <button onClick={() => openHelp()} className="card flex items-center justify-center gap-2 py-3 text-sm font-medium text-fog-100">
          <CircleHelp size={16} /> {t('settings.help')}
        </button>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-fog-500">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-ember-500' : 'bg-ink-600'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-fog-50 shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

function Stepper({ value, step, min, max, format, onChange }: { value: number; step: number; min: number; max: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-ink-900 p-1 hairline border">
      <button onClick={() => onChange(Math.max(min, value - step))} className="grid h-7 w-7 place-items-center rounded-full text-fog-300 hover:bg-veil/5" aria-label="−">
        −
      </button>
      <span className="tabular min-w-16 text-center text-xs text-fog-100">{format(value)}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} className="grid h-7 w-7 place-items-center rounded-full text-fog-300 hover:bg-veil/5" aria-label="+">
        +
      </button>
    </div>
  )
}

function KeyInput({ id, label, value, onChange, note, type = 'password' }: { id?: string; label: string; value: string; onChange: (v: string) => void; note?: string; type?: string }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  // Save shortly after typing/pasting too, so leaving the screen never loses a key.
  useEffect(() => {
    if (draft.trim() === value) return
    const timer = setTimeout(() => onChange(draft.trim()), 800)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])
  return (
    <label className="block">
      <span className="text-xs text-fog-400">{label}</span>
      <input
        id={id}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== value && onChange(draft.trim())}
        placeholder={t('settings.notSet')}
        autoComplete="off"
        spellCheck={false}
        className="mt-1 w-full rounded-xl bg-ink-900 px-3 py-2 font-mono text-xs outline-none hairline border focus:border-ember-500/40"
      />
      {note && <span className="mt-1 block text-[10px] text-fog-500">{note}</span>}
    </label>
  )
}
