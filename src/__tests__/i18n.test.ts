import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en'
import de from '@/i18n/locales/de'
import tr from '@/i18n/locales/tr'
import ru from '@/i18n/locales/ru'
import { featuresRegistry } from '@/help/featuresRegistry'

type Tree = { [k: string]: string | Tree }
const flat = (o: Tree, p = ''): Record<string, string> =>
  Object.entries(o).reduce<Record<string, string>>((a, [k, v]) => (typeof v === 'string' ? { ...a, [p + k]: v } : { ...a, ...flat(v, `${p}${k}.`) }), {})
const vars = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort()

describe('locales', () => {
  const E = flat(en as Tree)
  for (const [name, loc] of Object.entries({ de, tr, ru })) {
    it(`${name} has every key with the same variables`, () => {
      const L = flat(loc as Tree)
      for (const k of Object.keys(E)) {
        expect(L, `${name}: ${k}`).toHaveProperty([k])
        if (!k.endsWith('_zero')) expect(vars(L[k]), `${name}: ${k}`).toEqual(vars(E[k]))
      }
    })
  }
  it('documents every registered feature in English', () => {
    const E2 = flat(en as Tree)
    for (const f of featuresRegistry) for (const s of ['title', 'summary', 's1', 's2', 's3']) expect(E2, f.id).toHaveProperty([`help.f.${f.id}.${s}`])
  })
})
