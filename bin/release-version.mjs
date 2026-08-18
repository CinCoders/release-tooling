#!/usr/bin/env node
// Prints the version and its rolling image tags as dotenv lines, for the CI job
// that exports them to the jobs which tag images and create releases.
//
// It exists as a job of its own because the `release:` keyword cannot see
// variables created in its own script, and because the release jobs run on
// images with no JSON parser available.

import { currentVersion } from '../lib/project.mjs'
import { dockerTags } from '../lib/versions.mjs'

const { version, minor, major } = dockerTags(currentVersion())

console.log(`VERSION=${version}`)
console.log(`VERSION_MINOR=${minor}`)
console.log(`VERSION_MAJOR=${major}`)
