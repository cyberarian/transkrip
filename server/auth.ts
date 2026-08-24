import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const SCRYPT_OPTIONS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const PASSWORD_BYTES = 32
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,49}$/

export type PasswordCredential = { hash: string; salt: string }

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase()
  if (!USERNAME.test(username)) throw new Error('Username harus 3–50 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.')
  return username
}

export function validatePassword(value: string) {
  if (value.length < 12 || value.length > 128) throw new Error('Password harus terdiri dari 12–128 karakter.')
  return value
}

export async function hashPassword(password: string): Promise<PasswordCredential> {
  validatePassword(password)
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, PASSWORD_BYTES, SCRYPT_OPTIONS) as Buffer
  return { hash: derived.toString('hex'), salt: salt.toString('hex') }
}

export async function verifyPassword(password: string, credential: PasswordCredential) {
  const expected = Buffer.from(credential.hash, 'hex')
  const salt = Buffer.from(credential.salt, 'hex')
  if (expected.length !== PASSWORD_BYTES || salt.length !== 16 || password.length > 128) return false
  const actual = await scrypt(password, salt, PASSWORD_BYTES, SCRYPT_OPTIONS) as Buffer
  return timingSafeEqual(actual, expected)
}

export function newSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
