import { AnimatePresence, motion } from 'framer-motion'
import { FileText, Image as ImageIcon, KeyRound, Loader2, Lock, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { addDoc, deleteDoc, isVaultSetUp, listDocs, openDoc, setupVault, unlockVault, type DocInfo, type DocLabel } from '@/lib/vault'
import { haptic } from '@/lib/haptics'
import { relativeTime } from '@/i18n/format'
import { useTranslation } from 'react-i18next'
import { Pressable } from '@/components/ui/Pressable'
import { useScrollFade } from '@/hooks/useScrollFade'

const LABELS: DocLabel[] = ['passport', 'visa', 'insurance', 'booking', 'other']
const AUTO_LOCK_MS = 5 * 60_000

// The key lives only in memory, for this tab, until locked.
let sessionKey: CryptoKey | null = null

export function DocumentVault() {
  const { t } = useTranslation()
  const [setUp, setSetUp] = useState<boolean | null>(null)
  const [key, setKey] = useState<CryptoKey | null>(sessionKey)
  const [docs, setDocs] = useState<DocInfo[]>([])
  const [viewing, setViewing] = useState<{ info: DocInfo; url: string } | null>(null)
  const lastActive = useRef(Date.now())

  useEffect(() => {
    isVaultSetUp().then(setSetUp)
  }, [])

  const lock = useCallback(() => {
    sessionKey = null
    setKey(null)
    setDocs([])
    setViewing((v) => {
      if (v) URL.revokeObjectURL(v.url)
      return null
    })
  }, [])

  useEffect(() => {
    if (!key) return
    sessionKey = key
    listDocs(key).then(setDocs)
    const onHide = () => document.visibilityState === 'hidden' && lock()
    const touch = () => (lastActive.current = Date.now())
    const id = setInterval(() => Date.now() - lastActive.current > AUTO_LOCK_MS && lock(), 15_000)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pointerdown', touch)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pointerdown', touch)
    }
  }, [key, lock])

  if (setUp === null) return <div className="card h-40 animate-pulse" />
  if (!key) return <Unlock setUp={setUp} onKey={(k) => { setSetUp(true); setKey(k) }} />

  const view = async (d: DocInfo) => {
    const blob = await openDoc(key, d)
    setViewing({ info: d, url: URL.createObjectURL(blob) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-moss-400/10 px-4 py-2.5 text-xs text-moss-400">
        <span className="flex items-center gap-2">
          <ShieldCheck size={15} /> {t('vault.unlocked')}
        </span>
        <button onClick={lock} className="flex items-center gap-1 font-medium text-fog-100">
          <Lock size={13} /> {t('vault.lock')}
        </button>
      </div>

      <AddDoc onAdd={async (file, label) => setDocs([await addDoc(key, file, label), ...docs])} />

      {docs.length === 0 ? (
        <p className="card p-4 text-sm text-fog-400">{t('vault.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="card flex items-center gap-3 p-3">
              <button onClick={() => view(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-veil/5 text-fog-300">
                  {d.type.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-fog-50">{d.name}</span>
                  <span className="block text-xs text-fog-500">
                    {t(`vault.label.${d.label}`)} · {d.size < 1024 ? `${d.size} B` : d.size < 1024 ** 2 ? `${Math.round(d.size / 1024)} KB` : `${(d.size / 1024 ** 2).toFixed(1)} MB`} · {relativeTime(d.addedAt)}
                  </span>
                </span>
              </button>
              <button
                onClick={async () => {
                  if (!confirm(t('vault.deleteConfirm', { name: d.name }))) return
                  await deleteDoc(d.id)
                  setDocs(docs.filter((x) => x.id !== d.id))
                  haptic('warn')
                }}
                className="grid h-9 w-9 place-items-center rounded-full text-fog-500 hover:bg-alert-500/10 hover:text-alert-500"
                aria-label={t('vault.deleteLabel', { name: d.name })}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {viewing && (
          <motion.div className="fixed inset-0 z-[70] flex flex-col bg-ink-950/95" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-no-swipe>
            <div className="safe-top flex items-center justify-between px-4 pb-3">
              <span className="truncate text-sm font-medium">{viewing.info.name}</span>
              <button
                onClick={() => {
                  URL.revokeObjectURL(viewing.url)
                  setViewing(null)
                }}
                className="grid h-10 w-10 place-items-center rounded-full bg-veil/10"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {viewing.info.type.startsWith('image/') ? (
                <img src={viewing.url} alt={viewing.info.name} className="mx-auto max-h-full rounded-xl object-contain" />
              ) : viewing.info.type === 'application/pdf' ? (
                <iframe src={viewing.url} title={viewing.info.name} className="h-full w-full rounded-xl bg-white" />
              ) : (
                <a href={viewing.url} download={viewing.info.name} className="text-ember-400 underline">
                  {t('vault.download', { name: viewing.info.name })}
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Unlock({ setUp, onKey }: { setUp: boolean; onKey: (k: CryptoKey) => void }) {
  const { t } = useTranslation()
  const [pass, setPass] = useState('')
  const [confirmPass, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!setUp) {
      if (pass.length < 6) return setErr(t('vault.tooShort'))
      if (pass !== confirmPass) return setErr(t('vault.mismatch'))
    }
    setBusy(true)
    try {
      const k = setUp ? await unlockVault(pass) : await setupVault(pass)
      haptic('success')
      onKey(k)
    } catch (e) {
      haptic('warn')
      setErr(e instanceof Error && e.message === 'Wrong passphrase' ? t('vault.wrong') : t('vault.unlockFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ember-500/15 text-ember-500">
        <KeyRound size={22} />
      </span>
      <h3 className="mt-4 text-lg font-medium">{setUp ? t('vault.unlockTitle') : t('vault.createTitle')}</h3>
      <p className="mt-1 text-sm text-fog-400">
        {setUp ? t('vault.unlockBody') : t('vault.createBody')}
      </p>
      <input
        type="password"
        autoComplete={setUp ? 'current-password' : 'new-password'}
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder={t('vault.passphrase')}
        className="mt-4 w-full rounded-xl bg-ink-900 px-4 py-3 outline-none hairline border focus:border-ember-500/40"
      />
      {!setUp && (
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPass}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t('vault.repeat')}
          className="mt-2 w-full rounded-xl bg-ink-900 px-4 py-3 outline-none hairline border focus:border-ember-500/40"
        />
      )}
      {err && <p className="mt-2 text-sm text-alert-500">{err}</p>}
      <button disabled={busy || !pass} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-fog-100 py-3 text-sm font-semibold text-ink-900 disabled:opacity-40">
        {busy && <Loader2 size={15} className="animate-spin" />}
        {setUp ? t('vault.unlock') : t('vault.create')}
      </button>
    </form>
  )
}

function AddDoc({ onAdd }: { onAdd: (file: File, label: DocLabel) => Promise<void> }) {
  const fadeRef = useScrollFade()
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [label, setLabel] = useState<DocLabel>('passport')
  const [busy, setBusy] = useState(false)
  return (
    <div className="card p-3">
      <div ref={fadeRef} className="scroll-fade no-scrollbar flex gap-1.5 overflow-x-auto" data-no-swipe>
        {LABELS.map((l) => (
          <button key={l} onClick={() => setLabel(l)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${label === l ? 'bg-fog-100 text-ink-900' : 'bg-veil/5 text-fog-400'}`}>
            {t(`vault.label.${l}`)}
          </button>
        ))}
      </div>
      <Pressable
        onClick={() => input.current?.click()}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-veil/15 py-3 text-sm text-fog-300"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {t('vault.add')}
      </Pressable>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (!files.length) return
          setBusy(true)
          try {
            for (const f of files) await onAdd(f, label)
            haptic('success')
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}
