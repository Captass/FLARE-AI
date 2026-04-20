param(
    [ValidateSet("Debug", "Release")]
    [string]$BuildType = "Debug"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$androidDir = Join-Path $frontendDir "android"
$outputDir = Join-Path $androidDir "dist"

if (-not $env:JAVA_HOME) {
    $defaultJava = Join-Path $env:USERPROFILE "tools\\jdk21"
    if (Test-Path $defaultJava) {
        $env:JAVA_HOME = $defaultJava
    }
}

if (-not $env:ANDROID_SDK_ROOT) {
    $defaultSdk = Join-Path $env:USERPROFILE "tools\\android-sdk"
    if (Test-Path $defaultSdk) {
        $env:ANDROID_SDK_ROOT = $defaultSdk
        $env:ANDROID_HOME = $defaultSdk
    }
}

if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
    throw "JAVA_HOME is not configured or does not exist."
}

if (-not $env:ANDROID_SDK_ROOT -or -not (Test-Path $env:ANDROID_SDK_ROOT)) {
    throw "ANDROID_SDK_ROOT is not configured or does not exist."
}

$env:PATH = "$($env:JAVA_HOME)\\bin;$env:PATH"

Push-Location $frontendDir
try {
    npm run build
    npx cap sync android
} finally {
    Pop-Location
}

$gradleTask = if ($BuildType -eq "Release") { "assembleRelease" } else { "assembleDebug" }

Push-Location $androidDir
try {
    & .\gradlew.bat $gradleTask
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$artifactPath = if ($BuildType -eq "Release") {
    Join-Path $androidDir "app\\build\\outputs\\apk\\release\\app-release.apk"
} else {
    Join-Path $androidDir "app\\build\\outputs\\apk\\debug\\app-debug.apk"
}

if (-not (Test-Path $artifactPath)) {
    throw "Expected Android APK was not produced: $artifactPath"
}

$targetName = if ($BuildType -eq "Release") { "FLARE-AI-android-release.apk" } else { "FLARE-AI-android-debug.apk" }
Copy-Item -Path $artifactPath -Destination (Join-Path $outputDir $targetName) -Force
Write-Output "Android APK copied to $outputDir"
