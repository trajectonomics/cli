# Data lives in one directory at `~/.traj`

All state is one directory, `~/.traj`, holding `traj.db` and a `bin/` cache of downloaded binaries. It is resolved through `os.homedir()` on every platform and overridden by `TRAJ_HOME`. One path that is identical on Linux, macOS and Windows means an agent skill can hardcode it, `--help` prints a single string, and tests isolate with `TRAJ_HOME=$(mktemp -d)` instead of branching per operating system.

## Considered options

XDG — `$XDG_DATA_HOME/traj`, defaulting to `~/.local/share/traj` — is the polite convention on Linux, but it only helps the users who actually set `XDG_DATA_HOME`, and macOS and Windows still need their own branch. Platform-native paths (`~/Library/Application Support/…`, `%APPDATA%\…`) triple the surface for a tool whose users are agents that read `--help` once and then hardcode what it said.

This is hard to reverse once anyone has data in it, which is why it is recorded rather than left to the implementation.

The `bin/` cache is written by the npm package's launcher, holds one binary per installed version, and is safe to delete: a different `TRAJ_HOME` simply downloads again.
