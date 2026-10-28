import { describe, expect, it, vi } from 'vitest'

// Worker modules register a message loop on import; give them a fake `self`.
vi.stubGlobal('self', { postMessage() {}, onmessage: null })
vi.mock('idb-keyval', () => ({ createStore: () => null, get: async () => undefined, set: async () => {}, del: async () => {}, entries: async () => [] }))

const { extractPrices } = await import('@/agents/budget.worker')
const { detect } = await import('@/agents/translate.worker')
const { romanize } = await import('@/agents/translit')

describe('BudgetAgent price extraction', () => {
  it('finds prices, currencies and skips years', () => {
    const r = extractPrices('PAD THAI ....... 120฿\nOpen since 1998\nIced latte  €4,50\nPho bo 45.000đ', 'THB')
    expect(r).toEqual([
      { label: 'PAD THAI', amount: 120, currency: 'THB' },
      { label: 'Iced latte', amount: 4.5, currency: 'EUR' },
      { label: 'Pho bo', amount: 45000, currency: 'VND' },
    ])
  })
})

describe('TranslateAgent', () => {
  it('detects languages by script and stopwords', () => {
    expect(['こんにちは', '谢谢', 'Dónde está el baño', 'Where is the bus', 'Xin chào bạn', 'Wo ist der Bahnhof bitte', 'Спасибо'].map((t) => detect(t).lang)).toEqual(['ja', 'zh', 'es', 'en', 'vi', 'de', 'ru'])
  })
  it('romanizes Korean with sound changes, kana with macrons, Greek and Cyrillic', () => {
    expect(romanize('한국어', 'ko')).toBe('hangugeo')
    expect(romanize('감사합니다', 'ko')).toBe('gamsahamnida')
    expect(romanize('トーキョー', 'ja')).toBe('tōkyō')
    expect(romanize('Ευχαριστώ', 'el')).toBe('Efcharistó')
    expect(romanize('Спасибо', 'ru')).toBe('Spasibo')
    expect(romanize('東京', 'ja')).toBeUndefined()
  })
})
