import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioError, auddRecognize, clipFilename, mapAuddErrorCode, micError } from '@/services/audd'

const clip = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' })
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(AudioError)
    return (e as AudioError).code
  }
  throw new Error('expected rejection')
}

afterEach(() => vi.unstubAllGlobals())

describe('AudD error mapping', () => {
  it('maps token and limit codes depending on whether a token was sent', () => {
    expect(mapAuddErrorCode(901, false)).toBe('no-token')
    expect(mapAuddErrorCode(901, true)).toBe('limit')
    expect(mapAuddErrorCode(902, true)).toBe('limit')
    expect(mapAuddErrorCode(900, true)).toBe('bad-token')
    expect(mapAuddErrorCode(900, false)).toBe('no-token')
  })
  it('maps audio problems and unknown codes', () => {
    expect(mapAuddErrorCode(300, true)).toBe('no-match')
    expect([400, 500, 600, 700].map((c) => mapAuddErrorCode(c, true))).toEqual(['bad-audio', 'bad-audio', 'bad-audio', 'bad-audio'])
    expect(mapAuddErrorCode(19, true)).toBe('service')
    expect(mapAuddErrorCode(undefined, false)).toBe('service')
  })
  it('names the clip after its mime type', () => {
    expect(clipFilename('audio/mp4')).toBe('clip.m4a')
    expect(clipFilename('audio/webm;codecs=opus')).toBe('clip.webm')
    expect(clipFilename('audio/ogg')).toBe('clip.ogg')
    expect(clipFilename('')).toBe('clip.webm')
  })
  it('classifies microphone failures', () => {
    expect(micError(Object.assign(new Error('x'), { name: 'NotAllowedError' })).code).toBe('mic-denied')
    expect(micError(Object.assign(new Error('x'), { name: 'NotFoundError' })).code).toBe('mic-unsupported')
  })
})

describe('auddRecognize', () => {
  it('sends without api_token when none is set and maps 901 to no-token', async () => {
    const f = reply({ status: 'error', error: { error_code: 901, error_message: 'No api_token passed, and the limit was reached' } })
    vi.stubGlobal('fetch', f)
    expect(await codeOf(auddRecognize(clip(), ''))).toBe('no-token')
    const fd = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
    expect(fd.has('api_token')).toBe(false)
    expect((fd.get('file') as File).name).toBe('clip.m4a')
  })
  it('sends the token when set', async () => {
    const f = reply({ status: 'error', error: { error_code: 900, error_message: 'wrong token' } })
    vi.stubGlobal('fetch', f)
    expect(await codeOf(auddRecognize(clip(), 'abc'))).toBe('bad-token')
    const fd = (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
    expect(fd.get('api_token')).toBe('abc')
  })
  it('treats a null result as no-match', async () => {
    vi.stubGlobal('fetch', reply({ status: 'success', result: null }))
    expect(await codeOf(auddRecognize(clip(), ''))).toBe('no-match')
  })
  it('returns the match on success', async () => {
    vi.stubGlobal('fetch', reply({ status: 'success', result: { artist: 'A', title: 'T' } }))
    await expect(auddRecognize(clip(), '')).resolves.toMatchObject({ artist: 'A', title: 'T' })
  })
  it('maps network failures, timeouts and non-JSON replies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Load failed'))))
    expect(await codeOf(auddRecognize(clip(), ''))).toBe('network')
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('t', 'TimeoutError'))))
    expect(await codeOf(auddRecognize(clip(), ''))).toBe('timeout')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    expect(await codeOf(auddRecognize(clip(), ''))).toBe('service')
  })
})
