# Releasing runbook

One release is one dispatch of `release.yml` from `main`. It publishes the npm package,
creates the tag `vX.Y.Z` and the GitHub release, then builds five binaries, smokes them
and attaches them with both install scripts and one `checksums.txt`. Nobody edits
`version` in `package.json`; the workflow stamps it from the tag before compiling.

The decisions behind this are in [ADR 0023](../adr/0023-release-artifacts.md); the shared
publisher is `trajectonomics/cicd`'s `publish.yml@v1`.

## The one-time bootstrap (owner)

npm cannot attach a trusted publisher to a package that does not exist yet, so the first
version goes up by hand.

1. Publish a placeholder, below the version `scripts/version.ts` will compute, to a
   throwaway dist-tag so `latest` never points at it, then restore `package.json`:

   ```bash
   npm version 0.0.1-bootstrap.0 --no-git-tag-version
   npm publish --access public --provenance=false --tag bootstrap
   git checkout package.json
   ```

2. On npm, add a Trusted Publisher for `@trajectonomics/cli`: repository
   `trajectonomics/cli`, workflow `release.yml`, no environment, "allow publish directly".
3. Prove it within two days: one successful CI publish, or npm expires the unproven entry.
4. Dispatch `Release` from `main` once. That is the first real tag and release.

## Cutting a stable release

Actions → **Release** → *Run workflow* on `main`, choosing a bump. `auto` reads the
conventional-commit subjects since the last tag (`feat:` is a minor, anything else a
patch, `!` or `BREAKING CHANGE` a major; while on 0.x an inferred breaking change bumps
the minor).

Then, in order: `bun run check` → the version is computed → `npm version` → the package is
published with `latest` → the tag and the GitHub release are created → the `binaries` job
resolves the tag at that commit, stamps the version, compiles the five assets, writes
`checksums.txt` and stages the install scripts → the artifact smoke runs one binary on a
runner of its own platform → the binaries and scripts are attached, then the checksums →
the channel smoke installs through `npx` and `bunx`.

Never run a stable release from a branch other than `main`; the shared workflow refuses it.

## What a green release means

- npm serves `@trajectonomics/cli@X.Y.Z`.
- The release `vX.Y.Z` carries eight assets: `traj-darwin-arm64`, `traj-darwin-x64`,
  `traj-linux-arm64`, `traj-linux-x64`, `traj-windows-x64.exe`, `install.sh`,
  `install.ps1` and `checksums.txt`.
- The artifact smoke ran each binary on its own OS and architecture *before* anything was
  attached, so a wrong asset never reached the release.
- The channel smoke installed through `npx` (and `bunx` on Linux) and ran the round trip,
  so the public URL, the launcher, the checksums and the cache all work together.
- `traj --version` prints the tag's version, not `0.0.0`, on every channel.

## The npm-first window

npm publishes before the binaries exist. For a few minutes `npx @trajectonomics/cli@X.Y.Z`
prints one `retrying` line on stderr and the install script says the release is still being
built. That is expected, not a failure; both retry, and `releases/latest/download` only
404s during that window.

## Re-running

"Re-run failed jobs" is always the right move:

- The npm publish skips a version that is already on npm, and the tag and release are
  skipped when they already exist, so a re-run cannot publish twice.
- The `binaries` job rebuilds and clobbers every asset. It must: a Bun compile is not
  byte-reproducible, so each checksums file belongs to the build that produced it.

A re-run does not publish a new version, move the tag, or create a second release. It also
cannot replace a *wrong* binary under the same version: a published version number is
spent, so cut a patch instead.

## Repairing a release whose binaries failed

When the publish job succeeded and the binaries job failed, the version is on npm and its
release has missing or stale assets.

1. Actions → **Binaries** → *Run workflow* with `tag: vX.Y.Z`. Dispatch mode checks out the
   tag, ignores the dispatched commit, rebuilds, smokes, and clobbers every asset.
2. Read its log: `gh release view vX.Y.Z --json assets` must list the eight assets, and the
   channel smoke must be green.

Do not delete and re-create the release: `install.sh` resolves
`releases/latest/download`, so deleting the newest release moves that redirect backwards.

## Where the pieces live

| Path | What it is |
| --- | --- |
| `.github/workflows/release.yml` | the thin caller npm trusted publishing validates |
| `.github/workflows/binaries.yml` | assets, two smoke stages, the upload |
| `.github/workflows/installer-smoke.yml` | the installers' test on every pull request |
| `.github/smoke.sh` | the round trip every channel runs |
| `install.sh`, `install.ps1` | the installers, attached to every release |
| `bin/` | the npm launcher, the only published files besides the manifest |
