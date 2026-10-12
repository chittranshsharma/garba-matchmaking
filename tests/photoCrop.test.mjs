import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cropGeometry, clampCropOffset } from '../src/photoCrop.ts'

test('crop always covers the frame, including after a quarter turn', () => {
  const upright = cropGeometry(800, 1200, 0, 1)
  assert.ok(800 * upright.scale >= 420)
  assert.ok(1200 * upright.scale >= 400)
  const turned = cropGeometry(800, 1200, 90, 1)
  assert.ok(1200 * turned.scale >= 420)
  assert.ok(800 * turned.scale >= 400)
  assert.deepEqual(clampCropOffset({ x: 9999, y: -9999 }, turned.maxX, turned.maxY), { x: turned.maxX, y: -turned.maxY })
})
