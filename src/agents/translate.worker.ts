/**
 * TranslateAgent — speech/text translation with offline fallbacks.
 * Pipeline: detect language → rewrite idioms → phrasebook match → translation
 * memory → network (custom endpoint, then MyMemory) → romanize.
 */
import { get, set, createStore } from 'idb-keyval'
import { defineAgent, fetchJson } from './runtime'
import { LANGUAGES } from '@/data/languages'
import { PHRASEBOOK, PHRASES } from '@/data/phrasebook'
import { getCountry } from '@/data/countries'
import { romanize } from './translit'

export interface TranslateState {
  suggestedLang: string | null
  memorySize: number
  endpoint: string
}

export interface TranslateResult {
  translation: string
  from: string
  to: string
  source: 'phrasebook' | 'memory' | 'endpoint' | 'mymemory' | 'none'
  phonetic?: string
  idiom?: { original: string; meaning: string }
  confidence: number
}

const memory = createStore('backpack-translate', 'memory')

/** Common English idioms translate badly word-for-word; send the meaning instead. */
const IDIOMS: [RegExp, string][] = [
  [/\bbreak the bank\b/i, 'cost too much money'],
  [/\b(it'?s )?a rip[- ]?off\b/i, 'the price is too high'],
  [/\bcosts? an arm and a leg\b/i, 'is very expensive'],
  [/\bunder the weather\b/i, 'feeling sick'],
  [/\bon the house\b/i, 'free of charge'],
  [/\bcall it a night\b/i, 'go home to sleep'],
  [/\bhit the road\b/i, 'leave now'],
  [/\bkeep the change\b/i, 'you can keep the extra money'],
  [/\bno worries\b/i, 'it is not a problem'],
  [/\bi'?m starving\b/i, 'I am very hungry'],
  [/\bi'?m beat\b/i, 'I am very tired'],
  [/\bhow'?s it going\b/i, 'how are you'],
  [/\bwhat'?s up\b/i, 'hello, how are you'],
  [/\bgrab a bite\b/i, 'eat something'],
]

const STOPWORDS: Record<string, RegExp> = {
  en: /\b(the|is|are|you|where|what|how|please|thank|i|my|this)\b/gi,
  es: /\b(el|la|los|las|es|está|dónde|qué|por|favor|gracias|yo|una?)\b/gi,
  fr: /\b(le|la|les|est|où|que|vous|je|merci|une?|pas|c'est)\b/gi,
  de: /\b(der|die|das|ist|wo|ich|nicht|bitte|danke|eine?)\b/gi,
  it: /\b(il|lo|la|gli|è|dove|che|grazie|per|favore|non|una?)\b/gi,
  pt: /\b(o|a|os|as|é|onde|que|obrigad[oa]|por|favor|não|uma?)\b/gi,
  id: /\b(saya|apa|di|mana|ini|itu|terima|kasih|tidak|berapa|bisa)\b/gi,
  ms: /\b(saya|apa|di|mana|ini|itu|terima|kasih|tidak|berapa|boleh)\b/gi,
  tr: /\b(ve|bu|bir|ne|nerede|lütfen|teşekkür|değil|var)\b/gi,
  nl: /\b(de|het|een|is|waar|ik|niet|alstublieft|dank)\b/gi,
  tl: /\b(ang|ng|sa|ako|ikaw|salamat|po|saan|magkano)\b/gi,
  sw: /\b(na|ya|wa|ni|asante|tafadhali|wapi|ngapi|sana)\b/gi,
}

export function detect(text: string): { lang: string; confidence: number } {
  const t = text.trim()
  if (!t) return { lang: 'en', confidence: 0 }
  // Japanese uses kanji too, so check kana before Han.
  for (const code of ['ja', 'ko', 'th', 'lo', 'km', 'my', 'ar', 'he', 'hi', 'el', 'ru']) {
    const l = LANGUAGES.find((x) => x.code === code)
    if (l?.script?.test(t)) return { lang: code, confidence: 0.95 }
  }
  if (/[一-鿿]/.test(t)) return { lang: 'zh', confidence: 0.9 }
  for (const code of ['vi', 'tr', 'pl', 'es', 'pt']) {
    const l = LANGUAGES.find((x) => x.code === code)
    if (l?.script?.test(t)) return { lang: code, confidence: 0.8 }
  }
  let best = 'en'
  let bestScore = 0
  for (const [code, re] of Object.entries(STOPWORDS)) {
    const n = t.match(re)?.length ?? 0
    if (n > bestScore) {
      best = code
      bestScore = n
    }
  }
  const words = t.split(/\s+/).length
  return { lang: best, confidence: Math.min(0.85, 0.35 + bestScore / Math.max(words, 1)) }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[¿¡?!.,;:'"’“”。、！？]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Bigram (Dice) similarity, robust to small STT mistakes. */
function similarity(a: string, b: string) {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const grams = (s: string) => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }
  const ga = grams(a)
  const gb = grams(b)
  let hit = 0
  ga.forEach((n, g) => (hit += Math.min(n, gb.get(g) ?? 0)))
  return (2 * hit) / (a.length - 1 + b.length - 1)
}

function phrasebookText(lang: string, id: string) {
  if (lang === 'en') return PHRASES.find((p) => p.id === id)?.en
  return PHRASEBOOK[lang]?.[id]?.[0]
}

function phrasebookMatch(text: string, from: string, to: string) {
  const q = norm(text)
  let best: { id: string; score: number } | null = null
  for (const p of PHRASES) {
    const candidate = phrasebookText(from, p.id)
    if (!candidate) continue
    // Phrases with alternatives ("ครับ/ค่ะ", "vegetariano/a") match on any variant.
    const variants = [candidate, ...candidate.split('/')]
    for (const v of variants) {
      const s = similarity(q, norm(v))
      if (!best || s > best.score) best = { id: p.id, score: s }
    }
  }
  if (!best || best.score < 0.82) return null
  const target = to === 'en' ? { text: PHRASES.find((p) => p.id === best!.id)!.en } : PHRASEBOOK[to]?.[best.id] && { text: PHRASEBOOK[to][best.id][0], phonetic: PHRASEBOOK[to][best.id][1] }
  if (!target) return null
  return { ...target, confidence: best.score }
}

async function viaEndpoint(endpoint: string, text: string, from: string, to: string) {
  const r = await fetchJson<{ translation?: string; text?: string }>(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, from, to, hint: 'traveller talking to a local; keep it short, polite and natural' }),
  })
  return r.translation ?? r.text ?? ''
}

async function viaMyMemory(text: string, from: string, to: string) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
  const r = await fetchJson<{ responseData?: { translatedText?: string; match?: number }; responseStatus?: number }>(url)
  if (r.responseStatus && r.responseStatus !== 200) throw new Error('translation quota reached')
  const out = r.responseData?.translatedText ?? ''
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) throw new Error('translation quota reached')
  return { text: decodeEntities(out), match: r.responseData?.match ?? 0.6 }
}

const decodeEntities = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'")

async function translate(
  p: { text: string; from: string; to: string },
  api: { context: () => { online: boolean } | null; state: () => TranslateState; publish: (s: Partial<TranslateState>) => void },
): Promise<TranslateResult> {
  const text = p.text.trim()
  const from = p.from === 'auto' ? detect(text).lang : p.from
  const to = p.to
  if (!text) return { translation: '', from, to, source: 'none', confidence: 0 }
  if (from === to) return { translation: text, from, to, source: 'none', confidence: 1, phonetic: romanize(text, to) }

  let input = text
  let idiom: TranslateResult['idiom']
  if (from === 'en') {
    for (const [re, meaning] of IDIOMS) {
      const m = input.match(re)
      if (m) {
        idiom = { original: m[0], meaning }
        input = input.replace(re, meaning)
      }
    }
  }

  const pb = phrasebookMatch(input, from, to)
  if (pb) return { translation: pb.text, from, to, source: 'phrasebook', phonetic: pb.phonetic, idiom, confidence: pb.confidence }

  const memKey = `${from}|${to}|${norm(input)}`
  const remembered = await get<TranslateResult>(memKey, memory).catch(() => undefined)
  if (remembered) return { ...remembered, source: 'memory', idiom }

  if (!api.context()?.online) {
    return { translation: '', from, to, source: 'none', idiom, confidence: 0 }
  }

  let translation = ''
  let source: TranslateResult['source'] = 'mymemory'
  let confidence = 0.6
  const endpoint = api.state().endpoint
  if (endpoint) {
    try {
      translation = await viaEndpoint(endpoint, input, from, to)
      source = 'endpoint'
      confidence = 0.9
    } catch {
      /* fall through to MyMemory */
    }
  }
  if (!translation) {
    const r = await viaMyMemory(input, from, to)
    translation = r.text
    confidence = Math.max(0.3, Math.min(0.95, r.match))
  }
  const result: TranslateResult = { translation, from, to, source, phonetic: romanize(translation, to), confidence }
  set(memKey, result, memory)
    .then(() => api.publish({ memorySize: api.state().memorySize + 1 }))
    .catch(() => {})
  return { ...result, idiom }
}

defineAgent<TranslateState>({
  name: 'translate',
  initialState: { suggestedLang: null, memorySize: 0, endpoint: '' },
  onContext: (ctx, prev, api) => {
    const country = getCountry(ctx.country ?? ctx.countryHint)
    const prevCountry = getCountry(prev?.country ?? prev?.countryHint)
    if (!country || country.code === prevCountry?.code) return
    if (country.lang !== api.state().suggestedLang) {
      api.publish({ suggestedLang: country.lang === 'en' ? null : country.lang })
      if (country.lang !== 'en') {
        const lang = LANGUAGES.find((l) => l.code === country.lang)
        api.emit({
          key: 'translate-lang',
          kind: 'info',
          priority: 0,
          ttl: 6 * 3600_000,
          title: `Translator ready for ${lang?.name ?? country.lang}`,
          body: PHRASEBOOK[country.lang]
            ? `Offline phrasebook for ${lang?.name} is loaded: food, medical, transport and bargaining.`
            : `Live translation set to ${lang?.name ?? country.lang}. Phrasebook not available offline for this language.`,
          action: { label: 'Translate', type: 'tab', payload: 'translate' },
        })
      }
    }
  },
  tasks: {
    detect: (p: { text: string }) => detect(p.text),
    translate: (p: { text: string; from: string; to: string }, api) => translate(p, api),
    configure: (p: { endpoint: string }, api) => api.publish({ endpoint: p.endpoint }),
    romanize: (p: { text: string; lang: string }) => romanize(p.text, p.lang) ?? null,
  },
})
