/**
 * Audio Scout: song recognition and catalogue lookups.
 *  - AudD (api.audd.io) recognises a short recording; asks for Spotify and
 *    Apple Music metadata so we get artwork, preview URLs and IDs.
 *  - iTunes Search (keyless) fills the cover flow with more tracks by the
 *    artist and supplies 30-second previews when Spotify has none.
 * Spotify's own Web API needs a client secret, which can't live in a PWA, so
 * Spotify is reached through AudD metadata and open.spotify.com deep links.
 */
import { createStore, get, set } from 'idb-keyval'
import { keys } from '@/lib/settings'
import { AudioError, auddRecognize, micError } from './audd'

export interface Track {
  id: string
  title: string
  artist: string
  album?: string
  year?: string
  artwork?: string
  previewUrl?: string
  spotifyId?: string
  appleUrl?: string
  songLink?: string
  source: 'audd' | 'itunes'
  recognizedAt?: number
}

export const spotifyUrl = (t: Track) =>
  t.spotifyId ? `https://open.spotify.com/track/${t.spotifyId}` : `https://open.spotify.com/search/${encodeURIComponent(`${t.artist} ${t.title}`)}`

export { AudioError, TOKEN_CODES, type AudioErrorCode } from './audd'

/** Recorder mime types in order of preference; iOS Safari only does audio/mp4. */
const MIME_PREFS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus', 'audio/ogg']

export const canRecord = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'

export function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined
  return MIME_PREFS.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m)
    } catch {
      return false
    }
  })
}

/** Open the microphone, throwing AudioError('mic-denied' | 'mic-unsupported'). */
export async function openMic(): Promise<MediaStream> {
  if (!canRecord()) throw new AudioError('mic-unsupported')
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  } catch (e) {
    if ((e as { name?: string })?.name === 'OverconstrainedError') {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (e2) {
        throw micError(e2)
      }
    }
    throw micError(e)
  }
}

/** Record from the mic for `ms`, returning the audio blob. */
export async function recordClip(stream: MediaStream, ms = 8000, onTick?: (p: number) => void): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') throw new AudioError('mic-unsupported')
  const mime = pickMime()
  let rec: MediaRecorder
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  } catch (e) {
    throw micError(e)
  }
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || chunks[0]?.type || mime || 'audio/webm' }))
    rec.onerror = (ev) => reject(micError((ev as Event & { error?: unknown }).error ?? ev))
  })
  const started = Date.now()
  const id = setInterval(() => onTick?.(Math.min(1, (Date.now() - started) / ms)), 100)
  try {
    rec.start(250)
    await new Promise((r) => setTimeout(r, ms))
  } catch (e) {
    throw micError(e)
  } finally {
    clearInterval(id)
    if (rec.state !== 'inactive') rec.stop()
  }
  const blob = await done
  if (!blob.size) throw new AudioError('bad-audio', 'empty recording')
  return blob
}

/** Identify a clip. Throws AudioError; `no-match` when AudD found nothing. */
export async function recognize(clip: Blob): Promise<Track> {
  const r = await auddRecognize(clip, keys.audd())
  const art = r.spotify?.album?.images?.[0]?.url ?? r.apple_music?.artwork?.url?.replace('{w}', '600').replace('{h}', '600')
  return {
    id: `audd-${r.spotify?.id ?? `${r.artist}-${r.title}`}`,
    title: r.title,
    artist: r.artist,
    album: r.album,
    year: r.release_date?.slice(0, 4),
    artwork: art,
    previewUrl: r.spotify?.preview_url ?? r.apple_music?.previews?.[0]?.url,
    spotifyId: r.spotify?.id,
    appleUrl: r.apple_music?.url,
    songLink: r.song_link,
    source: 'audd',
    recognizedAt: Date.now(),
  }
}

interface ItunesRow {
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
  releaseDate?: string
}

const fromItunes = (r: ItunesRow): Track => ({
  id: `it-${r.trackId}`,
  title: r.trackName,
  artist: r.artistName,
  album: r.collectionName,
  year: r.releaseDate?.slice(0, 4),
  artwork: r.artworkUrl100?.replace('100x100bb', '600x600bb'),
  previewUrl: r.previewUrl,
  appleUrl: r.trackViewUrl,
  source: 'itunes',
})

export async function searchTracks(term: string, limit = 12): Promise<Track[]> {
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`)
  if (!res.ok) throw new Error('search failed')
  const data: { results: ItunesRow[] } = await res.json()
  // De-duplicate re-releases of the same song.
  const seen = new Set<string>()
  return data.results.map(fromItunes).filter((t) => {
    const k = `${t.artist}|${t.title}`.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Fill gaps (artwork, preview) on a recognised track from iTunes. */
export async function enrich(t: Track): Promise<Track> {
  if (t.artwork && t.previewUrl) return t
  try {
    const [hit] = await searchTracks(`${t.artist} ${t.title}`, 3)
    return hit ? { ...t, artwork: t.artwork ?? hit.artwork, previewUrl: t.previewUrl ?? hit.previewUrl, appleUrl: t.appleUrl ?? hit.appleUrl } : t
  } catch {
    return t
  }
}

const db = createStore('backpack-audio', 'kv')
export const loadHistory = () => get<Track[]>('history', db).then((h) => h ?? [])
export const saveHistory = (h: Track[]) => set('history', h.slice(0, 40), db)
