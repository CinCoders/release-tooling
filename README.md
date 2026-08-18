# @cincoders/release-tooling

Conventional-commit release automation shared by the CInCoders projects.

The flow it implements, in one line: **every merge into `develop` mints a release
candidate; the merge into `main` promotes the candidate that got there into the
stable version.**

```
develop   1.4.0-rc.1 → 1.4.0-rc.2 → 1.4.0-rc.3 ─┐
main                                            └→ 1.4.0 → tag v1.4.0
```

## Install

```bash
npm install --save-dev @cincoders/release-tooling
```

Add the two conveniences for checking a computation locally:

```json
{
  "scripts": {
    "release:prepare": "release-prepare",
    "release:promote": "release-promote"
  }
}
```

## Commands

| Command | Where | What it does |
| --- | --- | --- |
| `release-prepare` | `develop` | Applies the next release candidate to `package.json` |
| `release-promote` | `main` | Turns the candidate into the stable version and writes `CHANGELOG.md` |
| `release-version` | CI | Prints `VERSION`, `VERSION_MINOR`, `VERSION_MAJOR` as dotenv lines |

None of them commits, tags or pushes — that is the CI job's part. It also means
any of them can be run with `--dry-run` to see the number without producing it:

```bash
npm run release:prepare -- --dry-run
npm run release:promote -- --dry-run
```

The CI side lives in the pipeline template, which calls these commands:
`cincoders/intranet/ci-templates`.

## Two properties worth stating, because both were defects once

- **The stable target is derived from the last tag, never accumulated onto the
  current version.** Applying the bump to whatever `package.json` holds re-counts
  the same commits on every merge: one `feat` becomes 1.3.0, then 1.4.0, then
  1.5.0, and a breaking change walks the major every single time.
- **The candidate counter is what makes builds distinguishable.** Twenty merges
  between two releases produce twenty images with twenty versions, while the
  stable number stays put. Without it every dev build between releases would
  carry the same version.

## Requirements

- A baseline tag. The computation starts from the last **stable semver tag**;
  with none, `release-prepare` refuses to run rather than invent a number:
  ```bash
  git tag -a v1.0.0 -m "1.0.0" && git push origin v1.0.0
  ```
- Commits following [Conventional Commits](https://www.conventionalcommits.org).
  The subject becomes, literally, the changelog entry — so write them in English.

## Changelog sections

`release-promote` renders with a preset that shows **every** commit type, not
just `feat`/`fix`/`perf`/`revert`. The bump level starts at patch, so a `chore`
or a `ci` commit does produce a new version; hiding it would leave a release
whose changelog says nothing changed. The bump commit itself (`chore(release):`)
is filtered out, since it only narrates the heading above it.

A project that wants different sections can drop its own `changelog.config.mjs`
at its root — it takes precedence over the packaged one.
