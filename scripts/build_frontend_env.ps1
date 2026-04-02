param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
)

$frontendDir = Resolve-Path (Join-Path $PSScriptRoot "..\\frontend")
$resolvedApiUrl = $ApiUrl.TrimEnd("/")

Push-Location $frontendDir
try {
    $env:NEXT_PUBLIC_APP_ENV = $Environment
    $env:NEXT_PUBLIC_API_URL = $resolvedApiUrl

    Write-Host "Building frontend for environment: $Environment"
    Write-Host "Using API URL: $resolvedApiUrl"
    npm run build
}
finally {
    Pop-Location
}
