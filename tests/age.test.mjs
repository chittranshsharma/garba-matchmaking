import { test } from 'node:test'
import assert from 'node:assert/strict'
import { age } from '../src/age.ts'

test('age changes on the birthday', () => {
  assert.equal(age('2008-10-13', new Date('2026-10-12T12:00:00Z')), 17)
  assert.equal(age('2008-10-13', new Date('2026-10-13T12:00:00Z')), 18)
})
