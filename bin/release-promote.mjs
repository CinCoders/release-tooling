#!/usr/bin/env node
// Promotes the release candidate that reached main into the stable version:
// 1.6.0-rc.3 becomes 1.6.0. This is where the production version is born.
//
// The CHANGELOG is generated here rather than per rc on develop, so the file
// carries one section per published version instead of one per merge.
//
// It deliberately does not commit or push: that is the CI job's part, so the
// promotion can be checked with `npx release-promote --dry-run`.

import { promotedVersion } from '../lib/versions.mjs'
import { applyVersion, currentVersion, writeChangelog } from '../lib/project.mjs'

const dryRun = process.argv.includes('--dry-run')
const current = currentVersion()

let stable
try {
  stable = promotedVersion(current)
} catch (error) {
  // Already stable means main received a version that did not come through
  // develop's release-candidate flow. Fail loudly: carrying on silently would
  // leave main without a tag and without a release, and the symptom would only
  // surface when someone looked for the release and could not find it.
  console.error(error.message)
  console.error(
    'A release reaches main as a release candidate produced on develop.\n' +
      'If this version really should be released, tag it by hand:\n' +
      `  git tag -a v${current} -m "${current}" && git push origin v${current}`,
  )
  process.exit(1)
}

console.log(`Promoting ${current} to ${stable}`)

if (dryRun) {
  console.log('\n--dry-run: nothing was changed.')
  process.exit(0)
}

applyVersion(stable)

// conventional-changelog reads the version already applied to package.json to
// title the new section, which is why it runs after the bump.
writeChangelog()

console.log(`\nPromoted to ${currentVersion()}`)
