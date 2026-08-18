// The version arithmetic behind the release flow, kept free of git and of the
// filesystem so every rule below can be tested without cutting a release.
//
// The flow it encodes: every merge into develop mints a release candidate
// (1.4.0-rc.1, -rc.2, ...), and the merge into main promotes the candidate that
// got there into the stable version (1.4.0).

import semver from 'semver'

export const PREID = 'rc'

/**
 * The stable version the commit range implies, derived from the tag rather than
 * accumulated onto the version currently in package.json.
 *
 * Applying the bump to the current version re-counts the same commits on every
 * merge: one `feat` since the last tag yields 1.3.0, then 1.4.0, then 1.5.0. With
 * a breaking change that walks the major on every merge. Deriving from the tag
 * makes the target idempotent — it stays put until the range changes level.
 */
export function stableTarget(tag, releaseType) {
  // Strict on purpose: `semver.coerce` would happily read "2026.8.17" out of a
  // tag named `deploy-2026-08-17` and release it.
  const baseline = semver.valid(String(tag).replace(/^v/, ''))
  if (!baseline) throw new Error(`Cannot read a version out of the tag "${tag}"`)
  return semver.inc(baseline, releaseType)
}

/**
 * The candidate to mint. While the target holds, only the rc counter advances,
 * so every merge gets a distinct build without inflating the stable number.
 * A target that moved starts a new series at rc.1.
 */
export function nextCandidate(current, target, preid = PREID) {
  const continuesSeries =
    semver.valid(current) !== null &&
    semver.prerelease(current) !== null &&
    semver.eq(`${semver.major(current)}.${semver.minor(current)}.${semver.patch(current)}`, target)

  return continuesSeries
    ? semver.inc(current, 'prerelease', preid)
    : `${target}-${preid}.1`
}

/** Strips the prerelease part: 1.6.0-rc.3 -> 1.6.0. */
export function promotedVersion(current) {
  if (!semver.valid(current)) {
    throw new Error(`package.json has an invalid version: ${current}`)
  }
  if (semver.prerelease(current) === null) {
    throw new Error(`Version ${current} is already stable, so there is nothing to promote.`)
  }
  return `${semver.major(current)}.${semver.minor(current)}.${semver.patch(current)}`
}

/**
 * The image tag ladder for a version: the exact tag plus the rolling major and
 * minor ones (1.4.2 -> "1.4" and "1").
 *
 * A prerelease gets no rolling tags. `:1` moving to a release candidate is the
 * whole failure this guards against — it would hand a candidate to anyone who
 * pinned the major, which is the pin most deployments actually use.
 */
export function dockerTags(version) {
  if (!semver.valid(version)) {
    throw new Error(`Cannot read a version out of "${version}"`)
  }
  const stable = semver.prerelease(version) === null
  return {
    version,
    minor: stable ? `${semver.major(version)}.${semver.minor(version)}` : '',
    major: stable ? String(semver.major(version)) : '',
  }
}
