import { HardDrive, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { settings } from '@/lib/settings'
import { CURRENCIES } from '@/data/currencies'
import { COUNTRIES } from '@/data/countries'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Segmented } from '@/components/ui/Segmented'
import { AGENT_META, useAgents } from '@/agents/host'
import type { AgentName } from '@/agents/protocol'

export function SettingsPanel() {
  const s = settings.use()
  const { statuses } = useAgents()
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null)

  useEffect(() => {
    ;(async () => {
      const est = await navigator.storage?.estimate?.()
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted })
    })()
  }, [])

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle>Home base</SectionTitle>
        <div className="card divide-y divide-white/5">
          <Row label="Home currency">
            <select value={s.homeCurrency} onChange={(e) => settings.set({ homeCurrency: e.target.value })} className="rounded-lg bg-ink-900 px-2 py-1.5 font-mono text-sm outline-none">
              {CURRENCIES.map((c) => (
                <option key={c.code}>{c.code}</option>
              ))}
            </select>
          </Row>
          <Row label="Passport country" hint="Used to find your embassy">
            <select value={s.homeCountry} onChange={(e) => settings.set({ homeCountry: e.target.value })} className="max-w-40 rounded-lg bg-ink-900 px-2 py-1.5 text-sm outline-none">
              {Object.values(COUNTRIES)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Row>
          <Row label="Units">
            <Segmented size="sm" value={s.units} onChange={(v) => settings.set({ units: v })} options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} />
          </Row>
          <Row label="Haptic feedback" hint="Android & supported browsers">
            <Toggle on={s.haptics} onChange={(v) => settings.set({ haptics: v })} />
          </Row>
        </div>
      </section>

      <section>
        <SectionTitle>Sub-agents</SectionTitle>
        <div className="card divide-y divide-white/5">
          {(Object.keys(AGENT_META) as AgentName[]).map((a) => (
            <div key={a} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{AGENT_META[a].label}Agent</div>
                <div className="text-xs text-fog-500">{AGENT_META[a].role} · Web Worker</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${statuses[a] === 'error' ? 'bg-alert-500/15 text-alert-500' : statuses[a] === 'thinking' ? 'bg-amber-glow/15 text-amber-glow' : 'bg-moss-400/10 text-moss-400'}`}>
                {statuses[a]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>
          <span className="flex items-center gap-1.5">
            <KeyRound size={11} /> API keys (optional)
          </span>
        </SectionTitle>
        <div className="card space-y-3 p-4">
          <p className="text-xs leading-relaxed text-fog-500">
            Backpack works without keys using Open-Meteo, OpenStreetMap and MyMemory. Add your own keys for Google Maps &amp; Places and OpenWeatherMap. Keys are saved only on this device.
          </p>
          <KeyInput label="Google Maps JavaScript + Places" value={s.googleMapsKey} onChange={(v) => settings.set({ googleMapsKey: v })} note="Reload after changing." />
          <KeyInput label="OpenWeatherMap" value={s.openWeatherKey} onChange={(v) => settings.set({ openWeatherKey: v })} />
          <KeyInput label="Translation endpoint (POST {text, from, to})" value={s.translateEndpoint} onChange={(v) => settings.set({ translateEndpoint: v })} type="url" />
        </div>
      </section>

      {storage && (
        <section>
          <SectionTitle>Offline storage</SectionTitle>
          <div className="card flex items-center gap-3 p-4">
            <HardDrive size={18} className="text-fog-400" />
            <div className="flex-1 text-sm">
              {(storage.usage / 1024 / 1024).toFixed(1)} MB used
              <div className="text-xs text-fog-500">{storage.persisted ? 'Protected from automatic cleanup' : 'The browser may clear this under storage pressure'}</div>
            </div>
            {!storage.persisted && (
              <button
                onClick={async () => {
                  const ok = await navigator.storage?.persist?.()
                  setStorage((st) => (st ? { ...st, persisted: Boolean(ok) } : st))
                }}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium"
              >
                Keep data
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-fog-500">{hint}</div>}
      </div>
      {children}
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

function KeyInput({ label, value, onChange, note, type = 'password' }: { label: string; value: string; onChange: (v: string) => void; note?: string; type?: string }) {
  const [draft, setDraft] = useState(value)
  return (
    <label className="block">
      <span className="text-xs text-fog-400">{label}</span>
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onChange(draft.trim())}
        placeholder="Not set"
        autoComplete="off"
        spellCheck={false}
        className="mt-1 w-full rounded-xl bg-ink-900 px-3 py-2 font-mono text-xs outline-none hairline border focus:border-ember-500/40"
      />
      {note && <span className="mt-1 block text-[10px] text-fog-500">{note}</span>}
    </label>
  )
}
