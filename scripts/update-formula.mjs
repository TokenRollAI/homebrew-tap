import { createHash } from 'node:crypto'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const packageName = '@tool-bridge/cli'
const metadataUrl = 'https://registry.npmjs.org/@tool-bridge/cli/latest'
const formulaPath = new URL('../Formula/tool-bridge.rb', import.meta.url)

export function stableVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error('Expected a stable major.minor.patch version')
  }
  return value.split('.').map(BigInt)
}

export function compareVersions(left, right) {
  const a = stableVersion(left)
  const b = stableVersion(right)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  }
  return 0
}

export function validateMetadata(metadata) {
  if (metadata?.name !== packageName) throw new Error('Unexpected npm package name')
  stableVersion(metadata.version)
  const expectedUrl = `https://registry.npmjs.org/@tool-bridge/cli/-/cli-${metadata.version}.tgz`
  if (metadata.dist?.tarball !== expectedUrl) throw new Error('Unexpected npm tarball URL')
  if (typeof metadata.dist.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(metadata.dist.integrity)) {
    throw new Error('Expected npm SHA512 integrity')
  }
  return { version: metadata.version, url: expectedUrl, integrity: metadata.dist.integrity }
}

function fieldPattern(name) {
  return new RegExp(`^  ${name} "([^"\\r\\n]+)"$`, 'gm')
}

function readField(formula, name) {
  const matches = [...formula.matchAll(fieldPattern(name))]
  if (matches.length !== 1) throw new Error(`Expected exactly one top-level ${name} field`)
  return matches[0][1]
}

function currentRelease(formula) {
  const url = readField(formula, 'url')
  const match = /^https:\/\/registry\.npmjs\.org\/@tool-bridge\/cli\/-\/cli-([^/]+)\.tgz$/.exec(url)
  if (!match) throw new Error('Unexpected current formula tarball URL')
  const version = match[1]
  stableVersion(version)
  const explicit = [...formula.matchAll(fieldPattern('version'))]
  if (explicit.length > 1) throw new Error('Expected at most one top-level version field')
  if (explicit.length === 1 && explicit[0][1] !== version) {
    throw new Error('Explicit formula version does not match its URL')
  }
  return { url, version, hasExplicitVersion: explicit.length === 1 }
}

export function updateFormula(formula, metadata, tarball) {
  const release = validateMetadata(metadata)
  const current = currentRelease(formula)
  const comparison = compareVersions(release.version, current.version)
  if (comparison < 0) throw new Error(`Refusing downgrade from ${current.version} to ${release.version}`)
  const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`
  if (integrity !== release.integrity) throw new Error('npm tarball integrity mismatch')
  const sha256 = createHash('sha256').update(tarball).digest('hex')
  const oldSha256 = readField(formula, 'sha256')
  if (comparison === 0 && (current.url !== release.url || oldSha256 !== sha256)) {
    throw new Error('Refusing to change the artifact for an existing version')
  }
  let updated = formula
  const fields = { url: release.url, sha256 }
  if (current.hasExplicitVersion) fields.version = release.version
  for (const [name, value] of Object.entries(fields)) {
    updated = updated.replace(fieldPattern(name), `  ${name} "${value}"`)
  }
  return { formula: updated, version: release.version, changed: updated !== formula }
}

async function download(url, limit) {
  // Neither registry metadata nor tarballs may redirect outside the allowlisted origin.
  if (new URL(url).origin !== 'https://registry.npmjs.org') throw new Error('Unexpected registry origin')
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`)
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > limit) throw new Error('npm response exceeds size limit')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function main() {
  const metadata = JSON.parse((await download(metadataUrl, 2 * 1024 * 1024)).toString('utf8'))
  const release = validateMetadata(metadata)
  const current = await readFile(formulaPath, 'utf8')
  // Reject a regressed latest tag before downloading its tarball.
  if (compareVersions(release.version, currentRelease(current).version) < 0) {
    throw new Error('Refusing npm latest version downgrade')
  }
  const tarball = await download(release.url, 100 * 1024 * 1024)
  const result = updateFormula(current, metadata, tarball)
  if (result.changed) await writeFile(formulaPath, result.formula)
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `version=${result.version}\nchanged=${result.changed}\n`)
  }
  console.log(`${result.changed ? 'Updated' : 'Already current'}: tool-bridge ${result.version}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
