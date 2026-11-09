#!/bin/sh
# Install traj: one checksum-verified binary from a GitHub release.
#
#   curl -fsSL https://github.com/trajectonomics/cli/releases/latest/download/install.sh | sh
#
# TRAJ_VERSION=X.Y.Z installs a pinned release instead of the latest one.
# TRAJ_INSTALL_DIR overrides the directory (default: $HOME/.local/bin).
# TRAJ_DOWNLOAD_BASE_URL replaces the releases root, which is how CI tests it.
set -eu

DEFAULT_BASE="https://github.com/trajectonomics/cli/releases"
SUPPORTED="darwin/arm64, darwin/x64, linux/x64, linux/arm64"

say() { printf 'traj: %s\n' "$*" >&2; }
die() {
	say "$*"
	exit 1
}

case "$(uname -s)" in
Linux) os=linux ;;
Darwin) os=darwin ;;
*) die "unsupported operating system: $(uname -s). Supported: $SUPPORTED." ;;
esac

case "$(uname -m)" in
x86_64 | amd64) arch=x64 ;;
arm64 | aarch64) arch=arm64 ;;
*) die "unsupported architecture: $(uname -m). Supported: $SUPPORTED." ;;
esac

asset="traj-$os-$arch"

base="${TRAJ_DOWNLOAD_BASE_URL:-$DEFAULT_BASE}"
if [ -n "${TRAJ_VERSION:-}" ]; then
	prefix="$base/download/v$TRAJ_VERSION"
else
	prefix="$base/latest/download"
fi

# Only a 200 is a download: a 404 during a release window means "still building".
fetch() {
	code=$(curl -sSL -o "$2" -w '%{http_code}' "$1" || true)
	case "$code" in
	200) ;;
	404) die "the release at $1 is not there yet; it may still be building. Retry shortly." ;;
	*) die "$1 answered ${code:-nothing}." ;;
	esac
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM

fetch "$prefix/checksums.txt" "$tmp/checksums.txt"
fetch "$prefix/$asset" "$tmp/$asset"

expected=$(awk -v name="$asset" '$2 == name || $2 == "*" name { print $1; exit }' "$tmp/checksums.txt")
[ -n "$expected" ] || die "checksums.txt has no entry for $asset."

if command -v sha256sum >/dev/null 2>&1; then
	actual=$(sha256sum "$tmp/$asset" | awk '{ print $1 }')
elif command -v shasum >/dev/null 2>&1; then
	actual=$(shasum -a 256 "$tmp/$asset" | awk '{ print $1 }')
else
	die "neither sha256sum nor shasum is available to verify the download."
fi
[ "$actual" = "$expected" ] || die "checksum mismatch for $asset: expected $expected, got $actual."

dir="${TRAJ_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$dir"
dest="$dir/traj"
mv "$tmp/$asset" "$dest"
chmod 0755 "$dest"

version=$("$dest" --version)
printf 'traj %s installed to %s\n' "$version" "$dest"

case ":$PATH:" in
*":$dir:"*) ;;
*) say "$dir is not on PATH; add it there to run traj by name." ;;
esac
