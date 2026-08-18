import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dockerTags, nextCandidate, promotedVersion, stableTarget } from '../lib/versions.mjs'

describe('stableTarget', () => {
  it('derives from the tag, so the same range never inflates across merges', () => {
    // One feat since v1.2.0. Every later merge still sees it in the range, and
    // every one of them must land on the same target.
    assert.equal(stableTarget('v1.2.0', 'minor'), '1.3.0')
    assert.equal(stableTarget('v1.2.0', 'minor'), '1.3.0')
    assert.equal(stableTarget('v1.2.0', 'minor'), '1.3.0')
  })

  it('does not walk the major while a breaking change stays in the range', () => {
    assert.equal(stableTarget('v1.0.0', 'major'), '2.0.0')
    assert.equal(stableTarget('v1.0.0', 'major'), '2.0.0')
  })

  it('handles every release level', () => {
    assert.equal(stableTarget('v1.2.3', 'patch'), '1.2.4')
    assert.equal(stableTarget('v1.2.3', 'minor'), '1.3.0')
    assert.equal(stableTarget('v1.2.3', 'major'), '2.0.0')
  })

  it('accepts a tag with or without the leading v', () => {
    assert.equal(stableTarget('1.2.3', 'patch'), stableTarget('v1.2.3', 'patch'))
  })

  it('refuses a tag that carries no version instead of inventing one', () => {
    assert.throws(() => stableTarget('deploy-2026-08-17', 'patch'), /Cannot read a version/)
  })
})

describe('nextCandidate', () => {
  it('opens a new series at rc.1 when coming from a stable version', () => {
    assert.equal(nextCandidate('1.2.0', '1.3.0'), '1.3.0-rc.1')
  })

  it('advances only the counter while the target holds', () => {
    assert.equal(nextCandidate('1.3.0-rc.1', '1.3.0'), '1.3.0-rc.2')
    assert.equal(nextCandidate('1.3.0-rc.2', '1.3.0'), '1.3.0-rc.3')
  })

  it('gives every merge a distinct build without inflating the stable number', () => {
    let current = '1.2.0'
    const target = '1.3.0'
    const minted = []
    for (let i = 0; i < 5; i++) {
      current = nextCandidate(current, target)
      minted.push(current)
    }
    assert.deepEqual(minted, [
      '1.3.0-rc.1',
      '1.3.0-rc.2',
      '1.3.0-rc.3',
      '1.3.0-rc.4',
      '1.3.0-rc.5',
    ])
    // The stable target did not move across any of the five merges.
    assert.ok(minted.every((v) => v.startsWith('1.3.0-')))
  })

  it('restarts at rc.1 when the range escalates the target', () => {
    // Seven fixes produced 1.2.1-rc.7; then a feat raises the target.
    assert.equal(nextCandidate('1.2.1-rc.7', '1.3.0'), '1.3.0-rc.1')
  })

  it('restarts at rc.1 when a breaking change raises the major', () => {
    assert.equal(nextCandidate('1.3.0-rc.4', '2.0.0'), '2.0.0-rc.1')
  })

  it('opens a new series when the current version is not valid semver', () => {
    assert.equal(nextCandidate('not-a-version', '1.3.0'), '1.3.0-rc.1')
  })
})

describe('promotedVersion', () => {
  it('drops the candidate suffix', () => {
    assert.equal(promotedVersion('1.6.0-rc.3'), '1.6.0')
    assert.equal(promotedVersion('2.0.0-rc.1'), '2.0.0')
  })

  it('does not care how far the counter went', () => {
    assert.equal(promotedVersion('1.6.0-rc.17'), '1.6.0')
  })

  it('refuses a version that is already stable', () => {
    // main receiving a stable version means it skipped develop's rc flow.
    // Failing here is what keeps the release from silently going untagged.
    assert.throws(() => promotedVersion('1.6.0'), /already stable/)
  })

  it('refuses an invalid version instead of guessing', () => {
    assert.throws(() => promotedVersion('vamos-ver'), /invalid version/)
  })
})

describe('dockerTags', () => {
  it('gives a stable version the full ladder', () => {
    assert.deepEqual(dockerTags('1.4.2'), { version: '1.4.2', minor: '1.4', major: '1' })
  })

  it('leaves the rolling tags empty for a candidate', () => {
    // :1 pointing at a release candidate would hand one to everyone who pinned
    // the major, which is the pin most deployments actually use.
    assert.deepEqual(dockerTags('1.4.0-rc.3'), { version: '1.4.0-rc.3', minor: '', major: '' })
  })

  it('handles a major beyond one digit', () => {
    assert.deepEqual(dockerTags('10.11.12'), { version: '10.11.12', minor: '10.11', major: '10' })
  })

  it('refuses a version it cannot read', () => {
    assert.throws(() => dockerTags('latest'), /Cannot read a version/)
  })
})
