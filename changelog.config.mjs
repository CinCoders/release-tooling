// Changelog configuration for conventional-changelog.
//
// The default conventionalcommits preset hides everything except feat, fix, perf
// and revert. That is misleading here: the bump level starts at patch, so a chore
// or a ci commit *does* produce a new version — it just would not show up
// anywhere. Every type that can bump the version is listed, so a release never
// ends up with an empty changelog.
//
// The preset returns { parser, writer }; the CLI reads { parserOpts, writerOpts }.
// Hence the rename below.

import createPreset from 'conventional-changelog-conventionalcommits'

const preset = await createPreset({
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'feature', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'perf', section: 'Performance Improvements' },
    { type: 'revert', section: 'Reverts' },
    { type: 'refactor', section: 'Code Refactoring' },
    { type: 'build', section: 'Build System' },
    { type: 'ci', section: 'Continuous Integration' },
    { type: 'test', section: 'Tests' },
    { type: 'docs', section: 'Documentation' },
    { type: 'style', section: 'Styles' },
    { type: 'chore', section: 'Chores' },
  ],
})

const baseTransform = preset.writer.transform

export default {
  parserOpts: preset.parser,
  writerOpts: {
    ...preset.writer,
    /**
     * Drops the bump commit the release job itself creates. With `chore` visible
     * it would otherwise appear in every section as "release: 1.2.0" — an entry
     * that only narrates the heading right above it.
     */
    transform: (commit, context) => {
      if (commit.type === "chore" && commit.scope === "release") return false
      return baseTransform(commit, context)
    },
  },
}
