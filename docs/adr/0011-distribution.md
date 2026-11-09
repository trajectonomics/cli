# Distribute as compiled binaries, an npm package and an install script

Releases ship `bun build --compile` binaries on GitHub Releases, plus an npm package for quick use and an install script. Homebrew follows after launch. An MCP server is deferred until the command contract is stable, since it would otherwise freeze an interface that is still moving.

The artifact set, the version binding and the launcher's first-run download are recorded in ADR-0023.
