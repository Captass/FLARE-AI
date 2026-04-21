param(
    [ValidateSet("Debug", "Release")]
    [string]$BuildType = "Debug"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$androidDir = Join-Path $frontendDir "android"
$outputDir = Join-Path $repoRoot "artifacts\\native\\android"
$targetName = if ($BuildType -eq "Release") { "flare-ai-android.apk" } else { "flare-ai-android-debug.apk" }

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

if ($BuildType -eq "Release") {
    $requiredReleaseVars = @(
        "FLARE_ANDROID_KEYSTORE_PATH",
        "FLARE_ANDROID_KEYSTORE_PASSWORD",
        "FLARE_ANDROID_KEY_ALIAS",
        "FLARE_ANDROID_KEY_PASSWORD"
    )

    foreach ($releaseVar in $requiredReleaseVars) {
        $releaseValue = [Environment]::GetEnvironmentVariable($releaseVar)
        if (-not $releaseValue) {
            throw "Missing required release signing environment variable: $releaseVar"
        }
    }

    if (-not (Test-Path $env:FLARE_ANDROID_KEYSTORE_PATH)) {
        throw "Keystore file not found: $($env:FLARE_ANDROID_KEYSTORE_PATH)"
    }
}

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
    Join-Path $androidDir "app\\build\\outputs\\apk\\release\\$targetName"
} else {
    Join-Path $androidDir "app\\build\\outputs\\apk\\debug\\$targetName"
}

if (-not (Test-Path $artifactPath)) {
    $fallbackArtifactPath = if ($BuildType -eq "Release") {
        Join-Path $androidDir "app\\build\\outputs\\apk\\release\\app-release.apk"
    } else {
        Join-Path $androidDir "app\\build\\outputs\\apk\\debug\\app-debug.apk"
    }

    if (Test-Path $fallbackArtifactPath) {
        $artifactPath = $fallbackArtifactPath
    }
}

if (-not (Test-Path $artifactPath)) {
    throw "Expected Android APK was not produced: $artifactPath"
}

Copy-Item -Path $artifactPath -Destination (Join-Path $outputDir $targetName) -Force
Write-Output "Android APK copied to $outputDir"
