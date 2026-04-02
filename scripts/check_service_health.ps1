param(
    [Parameter(Mandatory = $true)]
    [string[]]$Url
)

foreach ($item in $Url) {
    $target = $item.Trim()
    if (-not $target) {
        continue
    }

    Write-Host ""
    Write-Host "Checking: $target"
    try {
        $response = Invoke-RestMethod -Uri $target -Method Get -TimeoutSec 20
        $response | ConvertTo-Json -Depth 6
    }
    catch {
        Write-Error "Health check failed for $target"
        throw
    }
}
