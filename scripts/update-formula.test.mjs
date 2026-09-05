import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { compareVersions, updateFormula, validateMetadata } from './update-formula.mjs'

const tarball = Buffer.from('fixture tarball')
const sha256 = createHash('sha256').update(tarball).digest('hex')
const metadata = {
  name: '@tool-bridge/cli',
  version: '0.32.0',
  dist: {
    tarball: 'https://registry.npmjs.org/@tool-bridge/cli/-/cli-0.32.0.tgz',
    integrity: `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
  },
}
const formula = `class ToolBridge < Formula
  desc "Keep this text unchanged"
  url "https://registry.npmjs.org/@tool-bridge/cli/-/cli-0.31.0.tgz"
  sha256 "${'a'.repeat(64)}"
  depends_on "node"
end
`

test('updates only release fields and is idempotent', () => {
  const result = updateFormula(formula, metadata, tarball)
  assert.equal(result.changed, true)
  assert.equal(result.formula, formula.replaceAll('0.31.0', '0.32.0').replace('a'.repeat(64), sha256))
  assert.equal(updateFormula(result.formula, metadata, tarball).changed, false)
})

test('also updates an optional explicit version without adding one by default', () => {
  const explicit = formula.replace('  sha256', '  version "0.31.0"\n  sha256')
  assert.match(updateFormula(explicit, metadata, tarball).formula, /  version "0\.32\.0"/)
  assert.doesNotMatch(updateFormula(formula, metadata, tarball).formula, /  version /)
  assert.throws(() => updateFormula(explicit.replace('version "0.31.0"', 'version "0.30.0"'), metadata, tarball), /does not match/)
  assert.throws(() => updateFormula(formula.replace('registry.npmjs.org', 'evil.example'), metadata, tarball), /current formula tarball URL/)
})

test('orders versions numerically and refuses downgrades', () => {
  assert.equal(compareVersions('0.100.0', '0.99.9'), 1)
  assert.throws(() => updateFormula(formula.replaceAll('0.31.0', '0.33.0'), metadata, tarball), /downgrade/)
})

test('rejects package, version, URL and integrity metadata substitution', () => {
  assert.throws(() => validateMetadata({ ...metadata, name: 'another-package' }), /package name/)
  for (const version of ['0.32.0-beta.1', '0.32.0\nmalicious=true', '00.32.0']) {
    assert.throws(() => validateMetadata({ ...metadata, version }), /stable/)
  }
  for (const url of ['http://registry.npmjs.org/a.tgz', 'https://registry.npmjs.org.evil.example/a.tgz', `${metadata.dist.tarball}?extra=1`]) {
    assert.throws(() => validateMetadata({ ...metadata, dist: { ...metadata.dist, tarball: url } }), /tarball URL/)
  }
  assert.throws(() => validateMetadata({ ...metadata, dist: { ...metadata.dist, integrity: 'sha1-untrusted' } }), /SHA512/)
})

test('rejects corrupt tarball, duplicate fields and same-version artifact drift', () => {
  assert.throws(() => updateFormula(formula, metadata, Buffer.from('corrupt')), /integrity mismatch/)
  assert.throws(() => updateFormula(`${formula}  version "0.31.0"\n  version "0.31.0"\n`, metadata, tarball), /at most one/)
  assert.throws(() => updateFormula(`${formula}  sha256 "duplicate"\n`, metadata, tarball), /exactly one/)
  assert.throws(() => updateFormula(formula.replaceAll('0.31.0', '0.32.0'), metadata, tarball), /existing version/)
})
