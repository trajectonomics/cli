# One version binds the tag, the npm package and what the binary reports

A release is one tag `vX.Y.Z` with its artifacts attached: a compiled binary for each supported platform, one checksums file, and both install scripts. The npm package carries no runtime of its own; its command is a launcher that resolves the asset for its own package version, verifies the published SHA-256, caches the binary under the data directory's `bin/` with the version in the file name, and runs it with the caller's arguments, exit status and signals. The binary's version is stamped from the tag before compiling, because the compiler inlines the package version at build time; keeping those two numbers equal is what makes `traj --version` a sentinel an agent skill can trust, since the tag, the npm package and stdout must all agree.

The binaries are built by a job inside the release workflow rather than by a workflow triggered on a tag or a release, because an event caused by the workflow's own token starts no run: a tag or release trigger would never fire for the release that was just created. The cost is a window in which npm has a version whose assets are not attached yet. It lasts minutes, happens only on a deliberate dispatch, and is repaired by rebuilding for that tag; a binary that is wrong rather than missing cannot be repaired in place, because a published version number is spent.

## Considered options

A `postinstall` downloader, rejected because Bun's `trustedDependencies` gate and pnpm's default skip a dependency's lifecycle scripts, so the package would work under one runner and silently fail under the other. A package per platform wired through `optionalDependencies`, rejected because the shared publisher publishes exactly one package per release and each extra package needs its own trusted publisher. Shipping the binaries inside the tarball, rejected at roughly ninety to a hundred and twenty megabytes each.

## Consequences

The launcher is plain Node with no imports beyond the standard library, because it has to start where nothing else is installed, and it sits outside the command contract: it cannot honour the JSON format (an exception to ADR-0010) and it is not governed by the rule that only the entry point exits the process. The data directory gains a `bin/` cache, recorded in ADR-0014.
