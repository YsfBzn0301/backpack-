export interface Language {
  code: string
  name: string
  native: string
  /** BCP-47 tag for SpeechRecognition / SpeechSynthesis. */
  speech: string
  rtl?: boolean
  /** Script ranges used for offline language detection. */
  script?: RegExp
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English', speech: 'en-US' },
  { code: 'th', name: 'Thai', native: 'ไทย', speech: 'th-TH', script: /[฀-๿]/ },
  { code: 'ja', name: 'Japanese', native: '日本語', speech: 'ja-JP', script: /[぀-ヿ]/ },
  { code: 'zh', name: 'Chinese', native: '中文', speech: 'zh-CN', script: /[一-鿿]/ },
  { code: 'ko', name: 'Korean', native: '한국어', speech: 'ko-KR', script: /[가-힯ᄀ-ᇿ]/ },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', speech: 'vi-VN', script: /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', speech: 'id-ID' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', speech: 'ms-MY' },
  { code: 'tl', name: 'Filipino', native: 'Filipino', speech: 'fil-PH' },
  { code: 'km', name: 'Khmer', native: 'ខ្មែរ', speech: 'km-KH', script: /[ក-៿]/ },
  { code: 'lo', name: 'Lao', native: 'ລາວ', speech: 'lo-LA', script: /[຀-໿]/ },
  { code: 'my', name: 'Burmese', native: 'မြန်မာ', speech: 'my-MM', script: /[က-႟]/ },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN', script: /[ऀ-ॿ]/ },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', speech: 'ne-NP' },
  { code: 'ar', name: 'Arabic', native: 'العربية', speech: 'ar-SA', rtl: true, script: /[؀-ۿ]/ },
  { code: 'he', name: 'Hebrew', native: 'עברית', speech: 'he-IL', rtl: true, script: /[֐-׿]/ },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', speech: 'tr-TR', script: /[ğışĞİŞ]/ },
  { code: 'es', name: 'Spanish', native: 'Español', speech: 'es-ES', script: /[ñ¿¡]/i },
  { code: 'pt', name: 'Portuguese', native: 'Português', speech: 'pt-BR', script: /[ãõ]/i },
  { code: 'fr', name: 'French', native: 'Français', speech: 'fr-FR', script: /[œæ]|\b(je|vous|est|où)\b/i },
  { code: 'de', name: 'German', native: 'Deutsch', speech: 'de-DE', script: /[ß]|\b(ich|nicht|ist|wo)\b/i },
  { code: 'it', name: 'Italian', native: 'Italiano', speech: 'it-IT' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', speech: 'nl-NL' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', speech: 'el-GR', script: /[Ͱ-Ͽ]/ },
  { code: 'ru', name: 'Russian', native: 'Русский', speech: 'ru-RU', script: /[Ѐ-ӿ]/ },
  { code: 'pl', name: 'Polish', native: 'Polski', speech: 'pl-PL', script: /[ąęłńśźż]/i },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', speech: 'sw-KE' },
]

export const LANG_BY_CODE: Record<string, Language> = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]))
export const langName = (code: string) => LANG_BY_CODE[code]?.name ?? code.toUpperCase()
