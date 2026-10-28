/** Offline romanization for scripts where a table or algorithm is reliable enough. */

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
}

const GREEK: Record<string, string> = {
  α: 'a', ά: 'á', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'é', ζ: 'z', η: 'i', ή: 'í', θ: 'th', ι: 'i', ί: 'í', ϊ: 'i', ΐ: 'í',
  κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', ό: 'ó', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'ý', ϋ: 'y',
  ΰ: 'ý', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'ó',
}

// Revised Romanization of Korean (simplified, no cross-syllable assimilation).
const L = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const V = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const T = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't']

// Coda as it sounds when the next syllable starts with silent ㅇ (liaison).
const T_LIAISON = ['', 'g', 'kk', 'ks', 'n', 'nj', 'nh', 'd', 'r', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', '']

function hangul(text: string) {
  const chars = [...text]
  const syl = (ch?: string) => {
    const c = ch?.codePointAt(0) ?? 0
    return c >= 0xac00 && c <= 0xd7a3 ? c - 0xac00 : -1
  }
  let out = ''
  for (let n = 0; n < chars.length; n++) {
    const i = syl(chars[n])
    if (i < 0) {
      out += chars[n]
      continue
    }
    const t = i % 28
    const next = syl(chars[n + 1])
    const nextL = next >= 0 ? Math.floor(next / 588) : -1
    let coda = T[t]
    if (t && nextL === 11) coda = T_LIAISON[t] // 한국어 → hangugeo
    else if (t && (nextL === 2 || nextL === 6)) {
      // Nasalisation before ㄴ/ㅁ: 감사합니다 → gamsahamnida
      if (coda === 'p') coda = 'm'
      else if (coda === 'k') coda = 'ng'
      else if (coda === 't') coda = 'n'
    }
    out += L[Math.floor(i / 588)] + V[Math.floor((i % 588) / 28)] + coda
  }
  return out
}

const KANA_BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', さ: 'sa', し: 'shi', す: 'su',
  せ: 'se', そ: 'so', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho', ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu',
  よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ん: 'n', が: 'ga', ぎ: 'gi', ぐ: 'gu',
  げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ぁ: 'a', ぃ: 'i',
  ぅ: 'u', ぇ: 'e', ぉ: 'o', ゔ: 'vu',
}
const SMALL_Y: Record<string, string> = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo' }
const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' }

function kana(text: string) {
  // Katakana → hiragana so one table covers both.
  const hira = [...text].map((ch) => {
    const c = ch.codePointAt(0)!
    return c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch
  })
  let out = ''
  for (let i = 0; i < hira.length; i++) {
    const ch = hira[i]
    const next = hira[i + 1]
    if (ch === 'っ' && next && KANA_BASE[next]) {
      out += KANA_BASE[next][0]
      continue
    }
    if (ch === 'ー') {
      // Long vowel mark: put a macron on the previous vowel (トーキョー → tōkyō).
      const last = out.slice(-1)
      out = out.slice(0, -1) + (MACRON[last] ?? last)
      continue
    }
    const base = KANA_BASE[ch]
    if (base && next && SMALL_Y[next]) {
      const stem = base.endsWith('i') ? base.slice(0, -1) : base
      out += (/^(sh|ch|j)$/.test(stem) ? stem + SMALL_Y[next].slice(1) : stem + SMALL_Y[next])
      i++
      continue
    }
    out += base ?? ch
  }
  return out
}

const table = (map: Record<string, string>) => (text: string) =>
  [...text]
    .map((ch) => {
      const lower = ch.toLowerCase()
      const r = map[lower]
      if (r == null) return ch
      return ch !== lower && r ? r[0].toUpperCase() + r.slice(1) : r
    })
    .join('')

export function romanize(text: string, lang: string): string | undefined {
  switch (lang) {
    case 'ru':
    case 'uk':
    case 'bg':
    case 'sr':
    case 'mn':
      return /[Ѐ-ӿ]/.test(text) ? table(CYRILLIC)(text) : undefined
    case 'el': {
      if (!/[Ͱ-Ͽἀ-῿]/.test(text)) return undefined
      // Vowel pairs first: ου → ou; αυ/ευ → af/ef before voiceless consonants, else av/ev.
      const pairs = text
        .replace(/ου/g, 'ou')
        .replace(/Ου/g, 'Ou')
        .replace(/ού/g, 'oú')
        .replace(/([αεΑΕ])[υύ](?=[θκξπσςτφχψ]|$)/g, '$1f')
        .replace(/([αεΑΕ])[υύ]/g, '$1v')
      return table(GREEK)(pairs)
    }
    case 'ko':
      return /[가-힣]/.test(text) ? hangul(text) : undefined
    case 'ja': {
      // Only romanize if the text is kana-only; kanji needs a dictionary.
      if (/[一-鿿]/.test(text)) return undefined
      return /[぀-ヿ]/.test(text) ? kana(text) : undefined
    }
    default:
      return undefined
  }
}
