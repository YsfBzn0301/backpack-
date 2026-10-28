/**
 * AudD (api.audd.io) request + typed error mapping. Kept free of browser-only
 * imports so the mapping can be unit-tested in node.
 *
 * AudD lets a handful of requests through without an api_token, so callers
 * send the request even when no token is configured and only ask the user for
 * a key once AudD answers with the "no token / limit reached" error.
 */

export type AudioErrorCode =
  | 'no-token'
  | 'bad-token'
  | 'limit'
  | 'no-match'
  | 'bad-audio'
  | 'mic-denied'
  | 'mic-unsupported'
  | 'network'
  | 'timeout'
  | 'service'

export class AudioError extends Error {
  readonly code: AudioErrorCode
  /** AudD's numeric error_code, when the error came from AudD. */
  readonly auddCode?: number
  constructor(code: AudioErrorCode, message?: string, auddCode?: number) {
    super(message ?? code)
    this.name = 'AudioError'
    this.code = code
    this.auddCode = auddCode
  }
}

/** Codes that are fixed by adding/replacing the AudD token in Settings. */
export const TOKEN_CODES: readonly AudioErrorCode[] = ['no-token', 'bad-token', 'limit']

/**
 * Map an AudD `error.error_code` to our error code.
 *  900 wrong/invalid token · 901 no token passed and the free limit is used up ·
 *  902 limit reached for this token · 300 fingerprinting failed (silence, noise,
 *  too short) · 400/500/600/700 the audio itself couldn't be used (too big,
 *  unreadable, bad URL, nothing sent) · anything else is a service problem.
 */
export function mapAuddErrorCode(code: number | undefined, hadToken: boolean): AudioErrorCode {
  switch (code) {
    case 900:
    case 904:
      return hadToken ? 'bad-token' : 'no-token'
    case 901:
      return hadToken ? 'limit' : 'no-token'
    case 902:
      return hadToken ? 'limit' : 'no-token'
    case 300:
      return 'no-match'
    case 400:
    case 500:
    case 600:
    case 700:
      return 'bad-audio'
    default:
      return 'service'
  }
}

export interface AuddResult {
  artist: string
  title: string
  album?: string
  release_date?: string
  song_link?: string
  apple_music?: { url?: string; artwork?: { url?: string }; previews?: { url: string }[] }
  spotify?: { id?: string; preview_url?: string | null; album?: { images?: { url: string }[] } }
}

interface AuddResponse {
  status?: string
  result?: AuddResult | null
  error?: { error_code?: number; error_message?: string }
}

/** File extension AudD should see for a given recorder mime type. */
export function clipFilename(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4') || m.includes('aac') || m.includes('m4a')) return 'clip.m4a'
  if (m.includes('ogg')) return 'clip.ogg'
  if (m.includes('wav')) return 'clip.wav'
  if (m.includes('mpeg') || m.includes('mp3')) return 'clip.mp3'
  return 'clip.webm'
}

const timeoutSignal = (ms: number): AbortSignal | undefined => {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) return AbortSignal.timeout(ms)
  if (typeof AbortController === 'undefined') return undefined
  const c = new AbortController()
  setTimeout(() => c.abort(new DOMException('timeout', 'TimeoutError')), ms)
  return c.signal
}

/**
 * POST a clip to AudD. Resolves with the match; throws AudioError for every
 * failure, including `no-match` when AudD recognised nothing.
 */
export async function auddRecognize(clip: Blob, token: string, timeoutMs = 20000): Promise<AuddResult> {
  const fd = new FormData()
  if (token) fd.append('api_token', token)
  fd.append('return', 'spotify,apple_music')
  fd.append('file', clip, clipFilename(clip.type))

  let res: Response
  try {
    res = await fetch('https://api.audd.io/', { method: 'POST', body: fd, signal: timeoutSignal(timeoutMs) })
  } catch (e) {
    const name = (e as { name?: string })?.name
    if (name === 'TimeoutError' || name === 'AbortError') throw new AudioError('timeout')
    // TypeError: offline, DNS, CORS-blocked, connection reset.
    throw new AudioError('network', e instanceof Error ? e.message : String(e))
  }

  let data: AuddResponse
  try {
    data = await res.json()
  } catch {
    throw new AudioError('service', `HTTP ${res.status}`)
  }

  if (data.status === 'error' || data.error) {
    const code = data.error?.error_code
    throw new AudioError(mapAuddErrorCode(code, Boolean(token)), data.error?.error_message, code)
  }
  if (data.status !== 'success') throw new AudioError('service', `HTTP ${res.status}`)
  if (!data.result) throw new AudioError('no-match')
  return data.result
}

/** Turn a getUserMedia / MediaRecorder failure into an AudioError. */
export function micError(e: unknown): AudioError {
  if (e instanceof AudioError) return e
  const name = (e as { name?: string })?.name ?? ''
  const msg = e instanceof Error ? e.message : String(e)
  if (name === 'NotAllowedError' || name === 'SecurityError' || /denied|not allowed|permission/i.test(msg)) return new AudioError('mic-denied', msg)
  return new AudioError('mic-unsupported', msg)
}
