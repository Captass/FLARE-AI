# FLARE AI deploy -> Render (see docs/instructions/DEVELOPER_GUIDE.md)
# git push main triggers Render rebuild (flare-frontend + flare-backend).
# Usage:
#   .\scripts\render-deploy.ps1
#   .\scripts\render-deploy.ps1 -Commit
#   .\scripts\render-deploy.ps1 -Commit -Message "fix: ..."
#   .\scripts\render-deploy.ps1 -Build

param(
    [switch]$Commit,
    [string]$Message = "chore: Render deploy (main)",
    [switch]$Build
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $RepoRoot

Write-Host "=== FLARE AI deploy (repo: $RepoRoot) ===" -ForegroundColor Cyan

if ($Build) {
    $frontend = Join-Path $RepoRoot "frontend"
    if (-not (Test-Path -LiteralPath $frontend)) { throw "frontend folder not found." }
    Set-Location -LiteralPath $frontend
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }
    Set-Location -LiteralPath $RepoRoot
}

Write-Host ""
Write-Host "--- git status ---" -ForegroundColor Yellow
& git status -sb

if ($Commit) {
    & git add -A
    $porcelain = & git status --porcelain
    if ([string]::IsNullOrWhiteSpace($porcelain)) {
        Write-Host "Nothing to commit." -ForegroundColor DarkGray
    }
    else {
        & git commit -m $Message
        if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
    }
}

Write-Host ""
Write-Host "--- git push origin main ---" -ForegroundColor Yellow
& git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed." }

Write-Host ""
Write-Host "Render: https://dashboard.render.com (flare-frontend, flare-backend)" -ForegroundColor Green
Write-Host "Public: https://flareai.ramsflare.com" -ForegroundColor Green
Write-Host "Done." -ForegroundColor Green
