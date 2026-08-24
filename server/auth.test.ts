import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, hashSessionToken, normalizeUsername, newSessionToken, verifyPassword } from './auth.ts'

test('hashes and verifies passwords without retaining plaintext', async () => {
  const credential = await hashPassword('correct horse battery staple')
  assert.notEqual(credential.hash, 'correct horse battery staple')
  assert.equal(await verifyPassword('correct horse battery staple', credential), true)
  assert.equal(await verifyPassword('wrong password value', credential), false)
})

test('normalizes and validates usernames consistently', () => {
  assert.equal(normalizeUsername('  Adnuri.Admin  '), 'adnuri.admin')
  assert.throws(() => normalizeUsername('a'), /username/i)
  assert.throws(() => normalizeUsername('admin@example.com'), /username/i)
})

test('creates opaque session tokens and stores only stable digests', () => {
  const token = newSessionToken()
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/)
  assert.equal(hashSessionToken(token), hashSessionToken(token))
  assert.notEqual(hashSessionToken(token), token)
})
