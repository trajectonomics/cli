#!/bin/sh
# The round trip every install channel must survive: one version, one init pair,
# one account, the schema, and one error envelope. Usage:
#
#   smoke.sh <version> <command...>
#
# The command is a binary path for the artifact smoke, or
# `npx --yes @trajectonomics/cli@<version>` for the channel smoke.
set -eu

version=$1
shift

fail() {
	echo "smoke: $*" >&2
	exit 1
}

[ "$("$@" --version)" = "$version" ] || fail "--version did not report $version"

export TRAJ_HOME="$(mktemp -d)"
"$@" init --json | grep -q '"created":true' || fail "init did not report created"
"$@" init --json | grep -q '"created":false' || fail "init was not idempotent"
"$@" account add Cash --type asset --currency THB --json >/dev/null || fail "account add failed"
"$@" account list --json | grep -q '"name":"Cash"' || fail "account list lost the account"
"$@" schema --json | grep -q '"commands"' || fail "schema did not list the commands"

status=0
envelope="$(mktemp)"
"$@" --nope --json 2>"$envelope" >/dev/null || status=$?
[ "$status" -eq 2 ] || fail "an unknown flag exited $status, not 2"
grep -q 'unknown_flag' "$envelope" || fail "the error envelope did not name unknown_flag"

echo "smoke: $version ok"
