import { Sheet } from '@/components/ui/Sheet'
import { LANGUAGES } from '@/data/languages'
import { PHRASEBOOK_LANGS } from '@/data/phrasebook'
import { haptic } from '@/lib/haptics'

export function LangPicker({ open, onClose, onPick, allowAuto, current }: { open: boolean; onClose: () => void; onPick: (c: string) => void; allowAuto?: boolean; current: string }) {
  const list = allowAuto ? [{ code: 'auto', name: 'Detect language', native: 'Auto' }, ...LANGUAGES] : LANGUAGES
  return (
    <Sheet open={open} onClose={onClose} title={<h2 className="text-lg font-semibold">Language</h2>}>
      <ul className="grid grid-cols-2 gap-1.5">
        {list.map((l) => (
          <li key={l.code}>
            <button
              onClick={() => {
                haptic('select')
                onPick(l.code)
                onClose()
              }}
              className={`flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left ${current === l.code ? 'bg-ember-500/15 ring-1 ring-ember-500/40' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}
            >
              <span className="text-sm font-medium">{l.name}</span>
              <span className="flex w-full items-center justify-between text-xs text-fog-500">
                {l.native}
                {PHRASEBOOK_LANGS.includes(l.code) && <span className="text-[10px] text-moss-400">offline</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
