// Runs the commands against real git repositories.
//
// The unit tests cover the arithmetic, which is where the rules live, but twice
// now a defect has slipped through them by living in the *inputs* instead: what
// counts as the baseline tag, and what range the changelog measures. Neither is
// visible without a repository, so these build one.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const binDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin')

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function run(cwd, script, ...args) {
  return execFileSync(process.execPath, [path.join(binDir, script), ...args], {
    cwd,
    encoding: 'utf8',
  })
}

function setVersion(cwd, version) {
  writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ name: 'fixture', version, private: true }),
  )
}

/**
 * A repository at v1.0.0 with three features on top, each one tagged as a
 * release candidate — the shape the flow produces if candidates are tagged.
 */
function repoWithCandidateTags() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'release-flow-'))
  git(cwd, 'init', '-q', '.')
  git(cwd, 'config', 'user.email', 'test@example.com')
  git(cwd, 'config', 'user.name', 'test')
  setVersion(cwd, '1.0.0')
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-qm', 'chore: init')
  git(cwd, 'tag', '-a', 'v1.0.0', '-m', '1.0.0')

  for (const n of [1, 2, 3]) {
    writeFileSync(path.join(cwd, `f${n}`), String(n))
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-qm', `feat: capability number ${n}`)
    git(cwd, 'tag', '-a', `v1.1.0-rc.${n}`, '-m', `rc${n}`)
  }
  return cwd
}

describe('a prerelease tag does not become the baseline', () => {
  let cwd

  before(() => {
    cwd = repoWithCandidateTags()
  })

  after(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it('measures from the last stable tag, not the last candidate', () => {
    const out = run(cwd, 'release-prepare.mjs', '--dry-run')

    // Without skipUnstable this reads v1.1.0-rc.3, and the range collapses to
    // the commits after it — none.
    assert.match(out, /Last stable tag: v1\.0\.0/)
    assert.match(out, /3 features/)
    assert.match(out, /Target stable:\s+1\.1\.0/)
  })

  it('writes the whole release into the changelog, not just the last candidate', () => {
    setVersion(cwd, '1.1.0-rc.3')
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-qm', 'chore(release): 1.1.0-rc.3')

    run(cwd, 'release-promote.mjs')

    const changelog = readFileSync(path.join(cwd, 'CHANGELOG.md'), 'utf8')
    for (const n of [1, 2, 3]) {
      assert.match(changelog, new RegExp(`capability number ${n}`))
    }
    // The bump commit narrates the heading above it and is filtered out.
    assert.doesNotMatch(changelog, /chore\(release\)/)
  })
})
