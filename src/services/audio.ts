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

/** Record from the mic for `ms`, returning the audio blob. */
export async function recordClip(stream: MediaStream, ms = 8000, onTick?: (p: number) => void): Promise<Blob> {
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<Blob>((resolve) => (rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))))
  rec.start(250)
  const started = Date.now()
  const id = setInterval(() => onTick?.(Math.min(1, (Date.now() - started) / ms)), 100)
  await new Promise((r) => setTimeout(r, ms))
  clearInterval(id)
  rec.stop()
  return done
}

interface AuddResult {
  artist: string
  title: string
  album?: string
  release_date?: string
  song_link?: string
  apple_music?: { url?: string; artwork?: { url?: string }; previews?: { url: string }[] }
  spotify?: { id?: string; preview_url?: string | null; album?: { images?: { url: string }[] } }
}

export async function recognize(clip: Blob): Promise<Track | null> {
  const token = keys.audd()
  if (!token) throw new Error('no-token')
  const fd = new FormData()
  fd.append('api_token', token)
  fd.append('return', 'spotify,apple_music')
  fd.append('file', clip, clip.type.includes('mp4') ? 'clip.m4a' : 'clip.webm')
  const res = await fetch('https://api.audd.io/', { method: 'POST', body: fd })
  const data: { status: string; result: AuddResult | null; error?: { error_message?: string } } = await res.json()
  if (data.status !== 'success') throw new Error(data.error?.error_message ?? 'recognition failed')
  const r = data.result
  if (!r) return null
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
