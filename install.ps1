# Install traj on Windows: one checksum-verified binary from a GitHub release.
#
#   irm https://github.com/trajectonomics/cli/releases/latest/download/install.ps1 | iex
#
# TRAJ_VERSION=X.Y.Z installs a pinned release instead of the latest one.
# TRAJ_INSTALL_DIR overrides the directory (default: %LOCALAPPDATA%\traj\bin).
# TRAJ_DOWNLOAD_BASE_URL replaces the releases root, which is how CI tests it.
$ErrorActionPreference = "Stop"

$DEFAULT_BASE = "https://github.com/trajectonomics/cli/releases"
$SUPPORTED = "windows/x64"

function Say($message) { Write-Host "traj: $message" }
function Die($message) {
	Write-Host "traj: $message" -ForegroundColor Red
	exit 1
}

if ($env:OS -ne "Windows_NT") { Die "unsupported operating system. Supported: $SUPPORTED." }
if ($env:PROCESSOR_ARCHITECTURE -ne "AMD64") {
	Die "unsupported architecture: $env:PROCESSOR_ARCHITECTURE. Supported: $SUPPORTED."
}
$asset = "traj-windows-x64.exe"

$base = if ($env:TRAJ_DOWNLOAD_BASE_URL) { $env:TRAJ_DOWNLOAD_BASE_URL } else { $DEFAULT_BASE }
$prefix = if ($env:TRAJ_VERSION) { "$base/download/v$($env:TRAJ_VERSION)" } else { "$base/latest/download" }

function Fetch($url, $out) {
	try {
		Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
	}
	catch {
		$status = $_.Exception.Response.StatusCode
		$code = if ($status) { [int]$status } else { 0 }
		if ($code -eq 404) {
			Die "the release at $url is not there yet; it may still be building. Retry shortly."
		}
		Die "$url answered $code."
	}
}

Say "downloading $asset from $prefix"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("traj-" + [System.Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
	Fetch "$prefix/checksums.txt" (Join-Path $tmp "checksums.txt")
	Fetch "$prefix/$asset" (Join-Path $tmp $asset)

	$checksums = Get-Content (Join-Path $tmp "checksums.txt")
	$expected = $checksums |
		Where-Object { $_ -match "\s\*?$([regex]::Escape($asset))$" } |
		ForEach-Object { ($_ -split '\s+')[0] } |
		Select-Object -First 1
	if (-not $expected) { Die "checksums.txt has no entry for $asset." }

	$actual = (Get-FileHash -Path (Join-Path $tmp $asset) -Algorithm SHA256).Hash
	if ($actual -ne $expected.ToLower()) {
		Die "checksum mismatch for $asset`: expected $($expected.ToLower()), got $($actual.ToLower())."
	}

	$directory = if ($env:TRAJ_INSTALL_DIR) {
		$env:TRAJ_INSTALL_DIR
	}
	else {
		Join-Path $env:LOCALAPPDATA "traj\bin"
	}
	New-Item -ItemType Directory -Path $directory -Force | Out-Null
	$destination = Join-Path $directory "traj.exe"
	Move-Item -Path (Join-Path $tmp $asset) -Destination $destination -Force

	$version = & $destination --version
	Say "$version installed to $destination"

	$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
	$parts = @()
	if ($userPath) { $parts = @($userPath -split ';' | Where-Object { $_ }) }
	if ($parts -notcontains $directory) {
		[Environment]::SetEnvironmentVariable("PATH", (($parts + $directory) -join ';'), "User")
		Say "added $directory to the user PATH; a new shell is needed to pick it up."
	}
	if (($env:PATH -split ';') -notcontains $directory) { $env:PATH = "$env:PATH;$directory" }
	if ($env:GITHUB_PATH) { Add-Content -Path $env:GITHUB_PATH -Value $directory }
}
finally {
	Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
