import { ChevronDown, ExternalLink, KeyRound, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keys, settings } from '@/lib/settings'
import { openSettings } from '@/lib/ui'

export type KeyService = 'google' | 'openweather' | 'audd' | 'oxr'

const SERVICES: Record<KeyService, { signup: string; focus: string; isSet: () => boolean }> = {
  google: { signup: 'https://console.cloud.google.com/google/maps-apis/start', focus: 'google', isSet: () => Boolean(keys.googleMaps()) },
  openweather: { signup: 'https://home.openweathermap.org/users/sign_up', focus: 'openweather', isSet: () => Boolean(keys.openWeather()) },
  audd: { signup: 'https://dashboard.audd.io/', focus: 'audd', isSet: () => Boolean(keys.audd()) },
  oxr: { signup: 'https://openexchangerates.org/signup/free', focus: 'oxr', isSet: () => Boolean(keys.oxr()) },
}

const STORE_KEY = 'bp:keyhelp-dismissed'

function readDismissed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function writeDismissed(list: string[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list))
  } catch {
    /* private mode: the tip simply comes back next visit */
  }
}

/**
 * Friendly "get a free key" banner. `compact` sits below a feature and can be
 * dismissed; `inline` lives in Settings above the field (always shown, no paste button).
 */
export function KeyHelp({ service, variant = 'compact', onDismiss }: { service: KeyService; variant?: 'inline' | 'compact'; onDismiss?: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => readDismissed().includes(service))
  const panelId = useId()
  const cfg = SERVICES[service]
  // Re-render when the user saves a key.
  const isSet = settings.use(() => cfg.isSet())
  const inline = variant === 'inline'

  if (!inline && (isSet || dismissed)) return null

  const dismiss = () => {
    writeDismissed([...new Set([...readDismissed(), service])])
    setDismissed(true)
    onDismiss?.()
  }
  const provider = t(`keyHelp.${service}.provider`)

  return (
    <aside className={`${inline ? 'rounded-xl' : 'rounded-2xl'} border border-ember-500/20 bg-ember-500/[0.06] p-3 text-left`} aria-label={provider}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ember-500/15 text-ember-400">
          <KeyRound size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug font-medium text-fog-100">{t(`keyHelp.${service}.title`)}</p>
          <p className="mt-1 text-xs leading-relaxed text-fog-400">{t(`keyHelp.${service}.benefit`)}</p>
          <span className="mt-2 inline-block rounded-full bg-moss-400/15 px-2 py-0.5 text-[11px] font-medium text-moss-400">{t(`keyHelp.${service}.badge`)}</span>
        </div>
        {!inline && (
          <button onClick={dismiss} className="-mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-fog-500 hover:text-fog-100" aria-label={t('keyHelp.dismiss')}>
            <X size={14} />
          </button>
        )}
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="mt-2 flex min-h-8 items-center gap-1 text-xs font-medium text-ember-400 hover:text-ember-500"
      >
        {open ? t('keyHelp.hide') : t('keyHelp.show')}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={panelId} className="mt-1 space-y-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-fog-500 uppercase">{t('keyHelp.stepsTitle')}</p>
            <ol className="mt-1.5 space-y-2">
              {(['s1', 's2', 's3'] as const).map((s, i) => (
                <li key={s} className="flex gap-2.5 text-xs leading-relaxed text-fog-300">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-veil/[0.08] text-[11px] font-medium text-fog-100">{i + 1}</span>
                  <span>{t(`keyHelp.${service}.${s}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-fog-500 uppercase">{t('keyHelp.watchTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-fog-300">{t(`keyHelp.${service}.watch`)}</p>
            <p className="mt-1 text-xs leading-relaxed text-fog-300">{t('keyHelp.privacy')}</p>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={cfg.signup}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ember-500 px-4 text-xs font-medium text-onaccent"
        >
          <ExternalLink size={13} /> {t('keyHelp.signup', { provider })}
        </a>
        {!inline && (
          <button onClick={() => openSettings(cfg.focus)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-veil/[0.07] px-4 text-xs font-medium text-fog-100 hover:bg-veil/10">
            <KeyRound size={13} /> {t('keyHelp.paste')}
          </button>
        )}
      </div>
    </aside>
  )
}
