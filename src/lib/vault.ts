/**
 * Encrypted document vault in IndexedDB. File bytes *and* metadata (name,
 * type, label) are encrypted; only an opaque id and timestamps are in the clear.
 */
import { createStore, del, entries, get, set } from 'idb-keyval'
import { checkVerifier, decrypt, deriveKey, encrypt, makeVerifier, randomBytes } from './crypto'
import { uid } from './format'

const db = createStore('backpack-vault', 'docs')
const META_KEY = '__vault_meta__'

interface VaultMeta {
  salt: Uint8Array
  verifier: { iv: Uint8Array; cipher: ArrayBuffer }
  createdAt: number
}

interface StoredDoc {
  id: string
  addedAt: number
  iv: Uint8Array
  cipher: ArrayBuffer
  metaIv: Uint8Array
  metaCipher: ArrayBuffer
}

export type DocLabel = 'passport' | 'insurance' | 'booking' | 'visa' | 'other'

export interface DocInfo {
  id: string
  name: string
  type: string
  size: number
  label: DocLabel
  addedAt: number
}

const enc = new TextEncoder()
const dec = new TextDecoder()

export const isVaultSetUp = async () => Boolean(await get<VaultMeta>(META_KEY, db))

export async function setupVault(passphrase: string) {
  const salt = randomBytes(16)
  const key = await deriveKey(passphrase, salt)
  const verifier = await makeVerifier(key)
  await set(META_KEY, { salt, verifier, createdAt: Date.now() } satisfies VaultMeta, db)
  return key
}

export async function unlockVault(passphrase: string) {
  const meta = await get<VaultMeta>(META_KEY, db)
  if (!meta) throw new Error('Vault not set up')
  const key = await deriveKey(passphrase, meta.salt)
  if (!(await checkVerifier(key, meta.verifier))) throw new Error('Wrong passphrase')
  return key
}

export async function addDoc(key: CryptoKey, file: File, label: DocLabel): Promise<DocInfo> {
  const bytes = await file.arrayBuffer()
  const info: DocInfo = { id: uid(), name: file.name, type: file.type || 'application/octet-stream', size: file.size, label, addedAt: Date.now() }
  const body = await encrypt(key, bytes)
  const meta = await encrypt(key, enc.encode(JSON.stringify(info)))
  const rec: StoredDoc = { id: info.id, addedAt: info.addedAt, iv: body.iv, cipher: body.cipher, metaIv: meta.iv, metaCipher: meta.cipher }
  await set(info.id, rec, db)
  return info
}

export async function listDocs(key: CryptoKey): Promise<DocInfo[]> {
  const all = await entries<string, StoredDoc | VaultMeta>(db)
  const docs: DocInfo[] = []
  for (const [k, v] of all) {
    if (k === META_KEY) continue
    const d = v as StoredDoc
    try {
      docs.push(JSON.parse(dec.decode(await decrypt(key, d.metaIv, d.metaCipher))))
    } catch {
      /* unreadable record: skip */
    }
  }
  return docs.sort((a, b) => b.addedAt - a.addedAt)
}

export async function openDoc(key: CryptoKey, info: DocInfo) {
  const d = await get<StoredDoc>(info.id, db)
  if (!d) throw new Error('Document missing')
  const bytes = await decrypt(key, d.iv, d.cipher)
  return new Blob([bytes], { type: info.type })
}

export const deleteDoc = (id: string) => del(id, db)
