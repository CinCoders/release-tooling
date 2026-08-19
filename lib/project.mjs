// The thin layer between the version arithmetic and the repository it runs in.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function currentVersion(cwd = process.cwd()) {
  return JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8')).version
}

/** Writes the version through npm, so package-lock.json stays in step. */
export function applyVersion(version) {
  execFileSync('npm', ['version', version, '--no-git-tag-version'], { stdio: 'inherit' })
}

/**
 * The changelog preset to render with: the project's own if it has one, so a
 * repository can still override the sections, otherwise the packaged default.
 */
export function changelogConfig(cwd = process.cwd()) {
  const local = path.join(cwd, 'changelog.config.mjs')
  return existsSync(local) ? local : path.join(packageRoot, 'changelog.config.mjs')
}

/**
 * Runs conventional-changelog against this package's own copy.
 *
 * Resolved rather than invoked through `npx`: the CLI is a dependency of this
 * package, not of the project consuming it, so whether `npx` finds it depends on
 * how npm happened to hoist. Resolving is the same lookup Node would do for an
 * import, and it either works or fails loudly.
 */
export function writeChangelog(cwd = process.cwd()) {
  const cli = require.resolve('conventional-changelog-cli/cli.js')
  execFileSync(
    process.execPath,
    // --skip-unstable for the same reason release-prepare skips them: a
    // prerelease tag would cut the range at the last candidate and leave the
    // release notes almost empty.
    [cli, '-n', changelogConfig(cwd), '-i', 'CHANGELOG.md', '-s', '--skip-unstable'],
    { stdio: 'inherit', cwd },
  )
}
