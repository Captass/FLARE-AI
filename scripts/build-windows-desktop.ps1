$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$sourceTauriDir = Join-Path $repoRoot "desktop\\tauri\\src-tauri"
$outputDir = Join-Path $repoRoot "artifacts\\native\\windows"
$tempRoot = Join-Path $env:USERPROFILE "tools\\flare-ai-tauri-build"
$stableInstallerName = "flare-ai-windows-setup.exe"

$tauriCli = Join-Path $frontendDir "node_modules\\.bin\\tauri.cmd"
if (-not (Test-Path $tauriCli)) {
    throw "Tauri CLI was not found at $tauriCli. Run npm ci in frontend first."
}

Push-Location $frontendDir
try {
    npm run build
} finally {
    Pop-Location
}

if (Test-Path $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null
Copy-Item -Path $sourceTauriDir -Destination (Join-Path $tempRoot "src-tauri") -Recurse
Copy-Item -Path (Join-Path $frontendDir "out") -Destination (Join-Path $tempRoot "out") -Recurse

$tempConfigPath = Join-Path $tempRoot "src-tauri\\tauri.conf.json"
$config = Get-Content -Path $tempConfigPath -Raw | ConvertFrom-Json
$config.build.beforeBuildCommand = ""
$config.build.beforeDevCommand = ""
$config.build.distDir = "../out"
$config.build.devPath = "http://localhost:3000"
$config.tauri.bundle.active = $true
$config.tauri.bundle.targets = @("nsis")
$configJson = $config | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText(
    $tempConfigPath,
    $configJson,
    [System.Text.UTF8Encoding]::new($false)
)

Push-Location $tempRoot
try {
    & $tauriCli build --bundles nsis --config src-tauri/tauri.conf.json
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$installerDir = Join-Path $tempRoot "src-tauri\\target\\release\\bundle\\nsis"
if (-not (Test-Path $installerDir)) {
    throw "Expected NSIS bundle directory was not produced: $installerDir"
}

$builtInstaller = Get-ChildItem -Path $installerDir -Filter "*.exe" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $builtInstaller) {
    throw "Expected NSIS installer was not produced in: $installerDir"
}

Copy-Item -Path $builtInstaller.FullName -Destination (Join-Path $outputDir $stableInstallerName) -Force
Write-Output "Windows NSIS installer copied to $outputDir\\$stableInstallerName"
