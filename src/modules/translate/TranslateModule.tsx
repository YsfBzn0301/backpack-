import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, BookOpen, Copy, Database, Expand, Loader2, Mic, Square, Volume2, WifiOff, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { agents, useAgentState } from '@/agents/host'
import type { TranslateResult, TranslateState } from '@/agents/translate.worker'
import { LANG_BY_CODE } from '@/data/languages'
import { langName } from '@/i18n/format'
import { useTranslation } from 'react-i18next'
import { settings } from '@/lib/settings'
import { haptic } from '@/lib/haptics'
import { useOnline } from '@/hooks/useOnline'
import { hasVoice, speak, ttsSupported, useMicLevels, useSpeechRecognition } from '@/hooks/useSpeech'
import { Pressable } from '@/components/ui/Pressable'
import { LangPicker } from './LangPicker'
import { Phrasebook } from './Phrasebook'
import { ShowToLocal } from './ShowToLocal'
import { Waveform } from './Waveform'

const SOURCE_ICON: Record<TranslateResult['source'], typeof Zap> = {
  phrasebook: BookOpen,
  memory: Database,
  endpoint: Zap,
  mymemory: Zap,
  none: Zap,
}

export function TranslateModule() {
  const { t } = useTranslation()
  const s = settings.use()
  const tstate = useAgentState<TranslateState>('translate')
  const online = useOnline()
  // "Me" speaks speechLang; "they" speak targetLang. Direction flips for replies.
  const [direction, setDirection] = useState<'me' | 'them'>('me')
  const from = direction === 'me' ? s.speechLang : s.targetLang
  const to = direction === 'me' ? s.targetLang : s.speechLang
  const [text, setText] = useState('')
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [picker, setPicker] = useState<null | 'me' | 'them'>(null)
  const [show, setShow] = useState<{ text: string; phonetic?: string; lang: string } | null>(null)

  // Follow TranslateAgent's suggestion when you arrive in a new country.
  useEffect(() => {
    const sug = tstate?.suggestedLang
    if (sug && sug !== s.targetLang && sug !== s.speechLang) settings.set({ targetLang: sug })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tstate?.suggestedLang])

  const run = useCallback(
    async (input: string, f = from, target = to) => {
      const q = input.trim()
      if (!q) return
      setBusy(true)
      setErr(null)
      try {
        const r = await agents.run<TranslateResult>('translate', 'translate', { text: q, from: f, to: target })
        if (!r.translation) {
          setErr(online ? t('translate.noResult') : t('translate.offlineMiss'))
          setResult(null)
        } else {
          setResult(r)
          haptic('success')
        }
      } catch (e) {
        setErr(e instanceof Error && /quota/.test(e.message) ? t('translate.quota') : t('translate.failed'))
      } finally {
        setBusy(false)
      }
    },
    [from, to, online, t],
  )

  const speech = useSpeechRecognition(LANG_BY_CODE[from]?.speech ?? from, (finalText) => {
    setText(finalText)
    run(finalText)
  })
  const levels = useMicLevels(speech.listening)

  const toggleMic = () => {
    haptic('heavy')
    if (speech.listening) speech.stop()
    else {
      setResult(null)
      speech.start()
    }
  }

  const swap = () => {
    haptic('select')
    settings.set({ speechLang: s.targetLang, targetLang: s.speechLang })
    if (result) {
      setText(result.translation)
      setResult(null)
    }
  }

  const play = () => {
    if (!result) return
    const tag = LANG_BY_CODE[result.to]?.speech ?? result.to
    speak(result.translation, tag)
  }

  const outLang = LANG_BY_CODE[result?.to ?? to]
  const voiceMissing = ttsSupported && result && !hasVoice(outLang?.speech ?? to)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <LangButton label={t('translate.youSpeak')} code={s.speechLang} active={direction === 'me'} onClick={() => setPicker('me')} />
        <Pressable onClick={swap} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-800 text-fog-300 hairline border" aria-label={t('translate.swap')}>
          <ArrowLeftRight size={16} />
        </Pressable>
        <LangButton label={t('translate.theySpeak')} code={s.targetLang} active={direction === 'them'} onClick={() => setPicker('them')} />
      </div>

      <section className="card relative overflow-hidden p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex rounded-full bg-ink-900 p-0.5 text-[11px]">
            {(['me', 'them'] as const).map((d) => (
              <button
                key={d}
                onClick={() => {
                  haptic('select')
                  setDirection(d)
                  setResult(null)
                }}
                className={`rounded-full px-3 py-1 font-medium ${direction === d ? 'bg-fog-100 text-ink-900' : 'text-fog-500'}`}
              >
                {d === 'me' ? t('translate.iTalk') : t('translate.theyTalk')}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-fog-500">
            {langName(from)} → {langName(to)}
          </span>
        </div>
        <textarea
          value={speech.listening ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              run(text)
            }
          }}
          placeholder={speech.supported ? t('translate.placeholderMic') : t('translate.placeholderType')}
          rows={2}
          dir={LANG_BY_CODE[from]?.rtl ? 'rtl' : undefined}
          className="w-full resize-none bg-transparent text-xl leading-snug text-fog-50 outline-none placeholder:text-fog-500"
        />
        <Waveform levels={levels} active={speech.listening} color={direction === 'me' ? '#ff6b4a' : '#6cb6ff'} />
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => run(text)} disabled={!text.trim() || busy} className="rounded-full bg-veil/[0.06] px-4 py-2 text-sm font-medium text-fog-100 disabled:opacity-40">
            {t('translate.translate')}
          </button>
          <motion.button
            onClick={toggleMic}
            whileTap={{ scale: 0.9 }}
            disabled={!speech.supported}
            className={`relative grid h-16 w-16 place-items-center rounded-full text-onaccent shadow-lg disabled:opacity-40 ${speech.listening ? 'bg-alert-500' : 'bg-ember-500'}`}
            aria-label={speech.listening ? t('translate.stop') : t('translate.listen')}
          >
            {speech.listening && <motion.span className="absolute inset-0 rounded-full bg-alert-500" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
            {speech.listening ? <Square size={22} fill="currentColor" className="relative" /> : <Mic size={26} className="relative" />}
          </motion.button>
        </div>
        {(speech.error || !speech.supported) && <p className="mt-2 text-xs text-amber-glow">{t(`translate.err.${speech.error ?? 'notSupported'}` as 'translate.err.generic')}</p>}
      </section>

      <AnimatePresence mode="popLayout">
        {(busy || result || err) && (
          <motion.section
            key={result?.translation ?? (busy ? 'busy' : 'err')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="card p-4"
            style={{ boxShadow: result ? '0 24px 50px -36px rgba(255,107,74,0.6)' : undefined }}
          >
            {busy ? (
              <div className="flex items-center gap-2 text-sm text-fog-400">
                <Loader2 size={16} className="animate-spin" /> {t('translate.working')}
              </div>
            ) : err ? (
              <p className="flex items-start gap-2 text-sm text-fog-300">
                {!online && <WifiOff size={16} className="mt-0.5 shrink-0 text-amber-glow" />}
                {err}
              </p>
            ) : (
              result && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-fog-500">
                    <span className="flex items-center gap-1">
                      {(() => {
                        const Icon = SOURCE_ICON[result.source]
                        return result.source === 'none' ? null : (
                          <>
                            <Icon size={11} /> {t(`translate.source.${result.source}`)}
                          </>
                        )
                      })()}
                    </span>
                    <span>{langName(result.to)}</span>
                  </div>
                  <p className="mt-2 text-[26px] leading-tight font-medium text-fog-50" dir={outLang?.rtl ? 'rtl' : undefined} lang={result.to} data-selectable>
                    {result.translation}
                  </p>
                  {result.phonetic && <p className="mt-1.5 text-sm text-fog-400 italic">{result.phonetic}</p>}
                  {result.idiom && (
                    <p className="mt-2 text-xs text-fog-500">{t('translate.idiom', { original: result.idiom.original, meaning: result.idiom.meaning })}</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Pressable onClick={play} disabled={!ttsSupported} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ember-500 py-2.5 text-sm font-semibold text-onaccent disabled:opacity-40">
                      <Volume2 size={17} /> {t('translate.playAloud')}
                    </Pressable>
                    <Pressable onClick={() => setShow({ text: result.translation, phonetic: result.phonetic, lang: result.to })} className="grid w-11 place-items-center rounded-full bg-veil/[0.06] text-fog-100" aria-label={t('translate.fullScreen')}>
                      <Expand size={17} />
                    </Pressable>
                    <Pressable onClick={() => navigator.clipboard?.writeText(result.translation)} className="grid w-11 place-items-center rounded-full bg-veil/[0.06] text-fog-100" aria-label={t('translate.copy')}>
                      <Copy size={16} />
                    </Pressable>
                  </div>
                  {voiceMissing && <p className="mt-2 text-[11px] text-fog-500">{t('translate.noVoice', { lang: langName(result!.to) })}</p>}
                </>
              )
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <Phrasebook lang={s.targetLang} onShow={(t, ph) => setShow({ text: t, phonetic: ph, lang: s.targetLang })} />

      <LangPicker
        open={picker !== null}
        current={picker === 'me' ? s.speechLang : s.targetLang}
        onClose={() => setPicker(null)}
        onPick={(c) => {
          settings.set(picker === 'me' ? { speechLang: c } : { targetLang: c })
          setResult(null)
        }}
      />
      <ShowToLocal text={show?.text ?? null} phonetic={show?.phonetic} lang={show?.lang ?? to} onClose={() => setShow(null)} />
    </div>
  )
}

function LangButton({ label, code, active, onClick }: { label: string; code: string; active: boolean; onClick: () => void }) {
  const l = LANG_BY_CODE[code]
  const name = langName(code)
  return (
    <Pressable onClick={onClick} className={`card flex min-w-0 flex-1 flex-col items-start px-4 py-2.5 text-left ${active ? 'ring-1 ring-ember-500/30' : ''}`}>
      <span className="text-[10px] tracking-wider text-fog-500 uppercase">{label}</span>
      <span className="w-full truncate text-sm font-medium text-fog-50">
        {name} <span className="text-fog-500">{l && l.native !== name ? l.native : ''}</span>
      </span>
    </Pressable>
  )
}
