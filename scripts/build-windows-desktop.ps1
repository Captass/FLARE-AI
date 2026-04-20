$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$sourceTauriDir = Join-Path $repoRoot "desktop\\tauri\\src-tauri"
$outputDir = Join-Path $repoRoot "desktop\\tauri\\dist\\windows"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\\bin"
$w64Root = Join-Path $env:USERPROFILE "tools\\w64devkit\\w64devkit"
$w64Bin = Join-Path $w64Root "bin"
$gccLibDir = Join-Path $w64Root "lib\\gcc\\x86_64-w64-mingw32\\15.2.0"
$targetDir = Join-Path $env:USERPROFILE "tools\\tauri-target-gnu"
$tempRoot = Join-Path $env:USERPROFILE "tools\\flare-ai-tauri-build"

foreach ($path in @($cargoBin, $w64Bin, $gccLibDir)) {
    if (-not (Test-Path $path)) {
        throw "Missing required Windows build dependency: $path"
    }
}

$libgccEh = Join-Path $gccLibDir "libgcc_eh.a"
if (-not (Test-Path $libgccEh)) {
    Copy-Item (Join-Path $gccLibDir "libgcc.a") $libgccEh
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
$configJson = $config | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText(
    $tempConfigPath,
    $configJson,
    [System.Text.UTF8Encoding]::new($false)
)

$env:PATH = "$cargoBin;$w64Bin;$env:PATH"
$env:LIBRARY_PATH = "$($w64Root)\\lib;$gccLibDir"
$env:CARGO_TARGET_DIR = $targetDir

Push-Location $tempRoot
try {
    & (Join-Path $frontendDir "node_modules\\.bin\\tauri.cmd") build --target x86_64-pc-windows-gnu --bundles none --config src-tauri/tauri.conf.json
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$builtExe = Join-Path $targetDir "x86_64-pc-windows-gnu\\release\\FLARE AI.exe"
if (-not (Test-Path $builtExe)) {
    throw "Expected Windows executable was not produced: $builtExe"
}

Copy-Item -Path $builtExe -Destination (Join-Path $outputDir "FLARE AI.exe") -Force
Write-Output "Windows desktop executable copied to $outputDir"
