/** Renders agent messages (keys + typed variables) in the current language. */
import { useTranslation } from 'react-i18next'
import type { Msg, MsgVar } from '@/agents/protocol'
import { tx } from './index'
import { countryName, fmtDistance, fmtDuration, fmtHoursSpec, fmtMoney, fmtTemp, fmtTimeAt, langName } from './format'

const isMsg = (v: unknown): v is Msg => typeof v === 'object' && v !== null && 'k' in v

export function renderVar(v: MsgVar): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (isMsg(v)) return renderMsg(v)
  switch (v.t) {
    case 'time':
      return fmtTimeAt(v.ts, v.off)
    case 'dist':
      return fmtDistance(v.m)
    case 'money':
      return fmtMoney(v.amount, v.cur)
    case 'country':
      return countryName(v.code)
    case 'lang':
      return langName(v.code)
    case 'temp':
      return fmtTemp(v.c)
    case 'dur':
      return fmtDuration(v.min)
    case 'hours':
      return fmtHoursSpec(v.spec)
    case 'list':
      return v.items.map(renderVar).filter(Boolean).join(' · ')
  }
}

export function renderMsg(m: Msg): string {
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(m.v ?? {})) vars[k] = renderVar(v)
  return tx(m.k, vars).replace(/\s+([.,])/g, '$1').replace(/\s{2,}/g, ' ').trim()
}

/** Re-renders when the language changes. */
export function useMsg() {
  useTranslation()
  return renderMsg
}
