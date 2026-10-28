import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ImageUp, Loader2, ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '@/components/ui/Sheet'
import { agents } from '@/agents/host'
import type { PriceCheck } from '@/agents/budget.worker'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { settings } from '@/lib/settings'
import { ui } from '@/lib/ui'
import { fmtMoney } from '@/i18n/format'
import { useMsg } from '@/i18n/msg'
import { haptic } from '@/lib/haptics'

interface Extracted {
  label: string
  amount: number
  currency: string
  converted: number
  check: PriceCheck
}

/**
 * Price scanner: photo → on-device OCR (Tesseract, loaded on demand) →
 * BudgetAgent extracts prices, converts them and flags anything overpriced.
 */
export function ScannerSheet() {
  const { t } = useTranslation()
  const render = useMsg()
  const open = ui.use((s) => s.scannerOpen)
  const handoff = ui.use((s) => s.scanFile)
  const close = () => ui.set({ scannerOpen: false })
  const home = settings.use((s) => s.homeCurrency)
  const { localCurrency } = useExchangeRates()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [results, setResults] = useState<Extracted[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (open) return
    if (image) URL.revokeObjectURL(image)
    setImage(null)
    setResults(null)
    setErr(null)
    setProgress(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Photo handed over from the camera.
  useEffect(() => {
    if (open && handoff) {
      ui.set({ scanFile: null })
      scan(handoff)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, handoff])

  const extract = async (text: string) => {
    const r = await agents.run<Extracted[]>('budget', 'extract', { text, currency: localCurrency ?? home })
    setResults(r)
    if (!r.length) setErr(t('scanner.noPrices'))
    else haptic(r.some((x) => x.check.verdict === 'steep') ? 'warn' : 'success')
  }

  const scan = async (file: File) => {
    setErr(null)
    setResults(null)
    setImage(URL.createObjectURL(file))
    setProgress(0)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => m.status === 'recognizing text' && setProgress(m.progress),
      })
      const { data } = await worker.recognize(file)
      await worker.terminate()
      await extract(data.text)
    } catch {
      setErr(navigator.onLine ? t('scanner.readFail') : t('scanner.needsDownload'))
    } finally {
      setProgress(null)
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) scan(f)
  }

  return (
    <Sheet open={open} onClose={close} title={<h2 className="text-lg font-semibold">{t('scanner.title')}</h2>}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-900 hairline border">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-fog-500">
            <ScanLine size={30} className="text-moss-400" />
            {t('scanner.hint')}
          </div>
        )}
        {progress != null && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/60 backdrop-blur-sm">
            <motion.div className="absolute inset-x-0 h-0.5 bg-moss-400 shadow-[0_0_12px_#5fd39a]" animate={{ top: ['10%', '90%', '10%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
            <span className="flex items-center gap-2 text-sm">
              <Loader2 size={15} className="animate-spin" /> {t('scanner.reading', { pct: Math.round(progress * 100) })}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => camera.current?.click()} className="flex items-center justify-center gap-2 rounded-full bg-moss-400 py-3 text-sm font-semibold text-onaccent">
          <Camera size={16} /> {t('scanner.camera')}
        </button>
        <button onClick={() => gallery.current?.click()} className="flex items-center justify-center gap-2 rounded-full bg-veil/[0.06] py-3 text-sm font-medium">
          <ImageUp size={16} /> {t('scanner.photo')}
        </button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={onFile} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) extract(manual)
        }}
        className="mt-3 flex gap-2"
      >
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('scanner.typePlaceholder')} className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2.5 text-sm outline-none hairline border" />
        <button className="rounded-xl bg-fog-100 px-4 text-sm font-medium text-ink-900">{t('scanner.go')}</button>
      </form>

      {err && <p className="mt-3 text-sm text-amber-glow">{err}</p>}
      <AnimatePresence>
        {results && results.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-1.5 pb-2">
            {results.map((r, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-veil/[0.03] px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fog-100">{r.label}</span>
                  <span className="block text-[11px] text-fog-500">{r.check.verdict !== 'unknown' ? render(r.check.message) : fmtMoney(r.amount, r.currency)}</span>
                </span>
                <span className="tabular text-right">
                  <span className="block text-sm font-medium text-fog-50">{fmtMoney(r.converted, home)}</span>
                  <span className="block text-[11px] text-fog-500">{fmtMoney(r.amount, r.currency)}</span>
                </span>
                {r.check.verdict !== 'unknown' && <span className={`h-2 w-2 shrink-0 rounded-full ${r.check.verdict === 'steep' ? 'bg-alert-500' : r.check.verdict === 'high' ? 'bg-amber-glow' : 'bg-moss-400'}`} title={t(`money.verdict.${r.check.verdict}`)} />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </Sheet>
  )
}
