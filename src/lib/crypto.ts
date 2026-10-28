/**
 * Vault crypto: AES-GCM 256 with a key derived from the user's passphrase via
 * PBKDF2-SHA256 (310k iterations). The key only lives in memory while unlocked.
 */
const ITERATIONS = 310_000
const enc = new TextEncoder()

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export async function deriveKey(passphrase: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encrypt(key: CryptoKey, data: ArrayBuffer | Uint8Array) {
  const iv = randomBytes(12)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource)
  return { iv, cipher }
}

export async function decrypt(key: CryptoKey, iv: Uint8Array, cipher: ArrayBuffer) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, cipher)
}

/** A known plaintext encrypted with the key, used to check a passphrase without storing it. */
const CANARY = 'backpack-vault-v1'
export async function makeVerifier(key: CryptoKey) {
  return encrypt(key, enc.encode(CANARY))
}
export async function checkVerifier(key: CryptoKey, v: { iv: Uint8Array; cipher: ArrayBuffer }) {
  try {
    const out = await decrypt(key, v.iv, v.cipher)
    return new TextDecoder().decode(out) === CANARY
  } catch {
    return false
  }
}
