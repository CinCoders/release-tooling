#!/usr/bin/env node
// Computes the next version for develop from the conventional commits since the
// last stable tag, and applies it to package.json as a release candidate.
//
// It deliberately does not commit or push: that is the CI job's part, so the
// computation can be checked locally with `npx release-prepare --dry-run`.
//
// The CHANGELOG is not generated here. Every merge into develop produces an rc,
// and a section per rc would fill the file with noise nobody reads. The
// changelog is written once, at promotion — see release-promote.

import { Bumper } from 'conventional-recommended-bump'
import semver from 'semver'
import { nextCandidate, stableTarget } from '../lib/versions.mjs'
import { applyVersion, currentVersion } from '../lib/project.mjs'

const dryRun = process.argv.includes('--dry-run')

const bumper = new Bumper(process.cwd()).loadPreset('conventionalcommits')

// `git describe --tags` would return the most recent tag of any kind, while the
// bumper measures from the last *semver* tag. One non-semver tag is enough to
// make the script report one tag while computing from another.
//
// Only stable tags exist: they are created by tag-release, which runs on main,
// and main only ever carries a promoted version.
const tag = await bumper.getLastSemverTag()

// With no tag, conventional-recommended-bump scans the whole history and returns
// a meaningless number. The baseline is a prerequisite, not a detail.
if (!tag) {
  console.error(
    'No tags found in this repository.\n' +
      'The version is computed from the commits since the last stable tag, so create the baseline first:\n' +
      '  git tag -a v1.0.0 -m "1.0.0" && git push origin v1.0.0',
  )
  process.exit(1)
}

const { releaseType, reason, commits } = await bumper.bump()

// The bump level starts at patch and is never empty, so an empty range still
// reports "patch". Emptiness has to be decided from the commit list instead, or
// the back-merge that follows every release would mint a candidate out of
// nothing. Merge commits are already dropped by the parser.
const releasable = commits.filter((commit) => commit.type)

if (!releaseType || releasable.length === 0) {
  console.log(`No relevant commits since ${tag}. Nothing to release.`)
  process.exit(0)
}

const current = currentVersion()
const target = stableTarget(tag, releaseType)
const next = nextCandidate(current, target)

console.log(`Last stable tag: ${tag}`)
console.log(`Current version: ${current}`)
console.log(`Bump:            ${releaseType} (${reason})`)
console.log(`Target stable:   ${target}`)
console.log(`Next:            ${next}`)

// In steady state the candidate is always ahead: the range level only ever rises
// between two stable tags. Going backwards means package.json carries a number
// the tags do not justify — which is what an accumulating computation leaves
// behind. Fail loudly instead of quietly downgrading.
if (!semver.gt(next, current)) {
  console.error(
    `\n${next} is not ahead of the current ${current}.\n` +
      'This happens while a repository still carries a version inflated by an\n' +
      'accumulating computation. Release the current version first, so the tag\n' +
      'catches up with package.json, and this resolves itself.',
  )
  process.exit(1)
}

if (dryRun) {
  console.log('\n--dry-run: nothing was changed.')
  process.exit(0)
}

applyVersion(next)

console.log(`\nNew version: ${currentVersion()}`)
