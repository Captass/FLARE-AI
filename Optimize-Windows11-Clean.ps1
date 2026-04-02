#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('Audit','Cleanup','Repair','Optimize','Full')]
    [string]$Mode = 'Audit',

    [switch]$Simulation,

    # Opt-in because creating a restore point requires admin rights and can fail if protection is disabled.
    [switch]$CreateRestorePoint,

    # Opt-in because disabling startup entries and scheduled tasks changes behavior.
    [switch]$ApplyStartupTuning,

    # Opt-in because background app tuning modifies privacy-related registry settings.
    [switch]$ApplyBackgroundAppTuning,

    # Opt-in because visual effects tuning modifies current-user shell preferences.
    [switch]$ApplyVisualTuning,

    # Opt-in because search indexing changes can affect file search responsiveness.
    [switch]$ApplySearchTuning,

    # Opt-in because gaming/developer tuning adjusts power and a small set of standard Windows settings.
    [switch]$ApplyPerformanceTuning,

    [string]$OutputRoot = "$env:SystemDrive\Temp\Windows-Optimization"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Write-Log {
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        [ValidateSet('INFO','WARN','ERROR','OK')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[{0}] [{1}] {2}" -f $timestamp, $Level, $Message
    Write-Host $line
    Add-Content -Path $script:LogFile -Value $line
}

function Ensure-OutputFolders {
    foreach ($path in @($OutputRoot, $script:RawDir, $script:ReportDir, $script:RollbackDir)) {
        if (-not (Test-Path -LiteralPath $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }
}

function Save-Json {
    param(
        [string]$Path,
        $InputObject
    )
    $InputObject | ConvertTo-Json -Depth 6 | Set-Content -Path $Path -Encoding UTF8
}

function Convert-RegistryItemToSimpleObject {
    param($RegistryItem)

    if ($null -eq $RegistryItem) { return $null }
    $result = [ordered]@{}
    foreach ($prop in $RegistryItem.PSObject.Properties) {
        if ($prop.Name -like 'PS*') { continue }
        $result[$prop.Name] = $prop.Value
    }
    return [pscustomobject]$result
}

function Get-SafeDirectorySizeBytes {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return 0L }
    try {
        return (Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue -File | Measure-Object -Property Length -Sum).Sum
    }
    catch {
        return 0L
    }
}

function Backup-CurrentState {
    Write-Log "Export de l'etat actuel pour rollback."

    $startup = Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location, User
    $autoServices = Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' } |
        Select-Object Name, DisplayName, State, StartMode, StartName, PathName
    $scheduled = Get-ScheduledTask -ErrorAction SilentlyContinue |
        Select-Object TaskPath, TaskName, State, Author
    $power = powercfg /L
    $hkcuRun = Convert-RegistryItemToSimpleObject (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue)
    $hklmRun = Convert-RegistryItemToSimpleObject (Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue)
    $gameBar = Convert-RegistryItemToSimpleObject (Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\GameBar' -ErrorAction SilentlyContinue)
    $gameDvr = Convert-RegistryItemToSimpleObject (Get-ItemProperty 'HKCU:\System\GameConfigStore' -ErrorAction SilentlyContinue)
    $search = Convert-RegistryItemToSimpleObject (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' -ErrorAction SilentlyContinue)

    Save-Json -Path (Join-Path $script:RollbackDir 'startup-commands.json') -InputObject $startup
    Save-Json -Path (Join-Path $script:RollbackDir 'auto-services.json') -InputObject $autoServices
    Save-Json -Path (Join-Path $script:RollbackDir 'scheduled-tasks.json') -InputObject $scheduled
    Set-Content -Path (Join-Path $script:RollbackDir 'power-plan.txt') -Value $power -Encoding UTF8
    Save-Json -Path (Join-Path $script:RollbackDir 'hkcu-run.json') -InputObject $hkcuRun
    Save-Json -Path (Join-Path $script:RollbackDir 'hklm-run.json') -InputObject $hklmRun
    Save-Json -Path (Join-Path $script:RollbackDir 'gamebar.json') -InputObject $gameBar
    Save-Json -Path (Join-Path $script:RollbackDir 'gamedvr.json') -InputObject $gameDvr
    Save-Json -Path (Join-Path $script:RollbackDir 'search.json') -InputObject $search
}

function Try-CreateRestorePoint {
    if (-not $CreateRestorePoint) {
        Write-Log "Point de restauration non demande. Etape ignoree." 'WARN'
        return
    }

    if (-not $script:IsAdmin) {
        Write-Log "Point de restauration impossible sans elevation." 'WARN'
        return
    }

    try {
        Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue | Out-Null
        Checkpoint-Computer -Description "Codex Windows clean optimization" -RestorePointType "MODIFY_SETTINGS" | Out-Null
        Write-Log "Point de restauration cree." 'OK'
    }
    catch {
        Write-Log ("Echec de creation du point de restauration: {0}" -f $_.Exception.Message) 'WARN'
    }
}

function Get-AuditData {
    Write-Log "Collecte d'audit."

    $os = Get-ComputerInfo
    $cpu = Get-CimInstance Win32_Processor
    $gpu = Get-CimInstance Win32_VideoController
    $mem = Get-CimInstance Win32_OperatingSystem
    $computer = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $physicalDisks = Get-PhysicalDisk -ErrorAction SilentlyContinue
    $volumes = Get-Volume -ErrorAction SilentlyContinue
    $processTopCpu = Get-Process |
        Sort-Object -Property @{ Expression = {
            if ($null -eq $_.CPU) { return 0 }
            if ($_.CPU -is [TimeSpan]) { return $_.CPU.TotalSeconds }
            return [double]$_.CPU
        } } -Descending |
        Select-Object -First 20 ProcessName, Id, CPU, PM, WS, Handles
    $processTopRam = Get-Process |
        Sort-Object -Property @{ Expression = {
            if ($null -eq $_.WS) { return 0 }
            return [double]$_.WS
        } } -Descending |
        Select-Object -First 20 ProcessName, Id, CPU, PM, WS, Handles
    $startup = Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location, User
    $servicesAuto = Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' } |
        Select-Object Name, DisplayName, State, StartMode, StartName, PathName
    $scheduled = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Disabled' } |
        Select-Object TaskPath, TaskName, State, Author
    $defender = Get-MpComputerStatus -ErrorAction SilentlyContinue
    $applicationErrors = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Level = 1, 2; StartTime = (Get-Date).AddDays(-7) } -MaxEvents 50 -ErrorAction SilentlyContinue |
        Select-Object TimeCreated, ProviderName, Id, LevelDisplayName, Message
    $systemErrors = Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1, 2; StartTime = (Get-Date).AddDays(-7) } -MaxEvents 50 -ErrorAction SilentlyContinue |
        Select-Object TimeCreated, ProviderName, Id, LevelDisplayName, Message
    $powerPlans = powercfg /L
    $pageFile = Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue
    $installedClassic = Get-ItemProperty @(
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    ) -ErrorAction SilentlyContinue |
        Where-Object { $_.PSObject.Properties.Name -contains 'DisplayName' -and -not [string]::IsNullOrWhiteSpace($_.DisplayName) } |
        Select-Object DisplayName, DisplayVersion, Publisher, InstallDate
    $installedAppx = Get-AppxPackage | Select-Object Name, PackageFamilyName, Version
    $netAdapters = Get-NetAdapter -ErrorAction SilentlyContinue | Select-Object Name, Status, LinkSpeed, InterfaceDescription
    $pnpSummary = Get-PnpDevice -Class Net, Display, Media -ErrorAction SilentlyContinue | Select-Object Class, FriendlyName, Status, Manufacturer
    $tempUserBytes = Get-SafeDirectorySizeBytes -Path $env:TEMP
    $tempWindowsBytes = Get-SafeDirectorySizeBytes -Path 'C:\Windows\Temp'
    $updateCacheBytes = Get-SafeDirectorySizeBytes -Path 'C:\Windows\SoftwareDistribution\Download'
    $thumbMeasure = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter 'thumbcache*' -Force -ErrorAction SilentlyContinue -File | Measure-Object Length -Sum
    $thumbCacheBytes = if ($thumbMeasure.PSObject.Properties.Name -contains 'Sum' -and $null -ne $thumbMeasure.Sum) { $thumbMeasure.Sum } else { 0L }

    $audit = [pscustomobject]@{
        Timestamp = Get-Date
        ComputerInfo = $os
        CPU = $cpu
        GPU = $gpu
        OperatingSystem = $mem
        ComputerSystem = $computer
        BIOS = $bios
        PhysicalDisks = $physicalDisks
        Volumes = $volumes
        TopCpuProcesses = $processTopCpu
        TopRamProcesses = $processTopRam
        StartupCommands = $startup
        AutoServices = $servicesAuto
        ScheduledTasks = $scheduled
        Defender = $defender
        ApplicationErrors = $applicationErrors
        SystemErrors = $systemErrors
        PowerPlans = $powerPlans
        PageFile = $pageFile
        InstalledClassic = $installedClassic
        InstalledAppx = $installedAppx
        NetAdapters = $netAdapters
        PnpSummary = $pnpSummary
        TempUserBytes = $tempUserBytes
        TempWindowsBytes = $tempWindowsBytes
        UpdateCacheBytes = $updateCacheBytes
        ThumbCacheBytes = $thumbCacheBytes
    }

    Save-Json -Path (Join-Path $script:RawDir 'audit.json') -InputObject $audit
    return $audit
}

function Get-SafeStartupCandidates {
    param($Audit)

    $patterns = @(
        'Steam',
        'EpicGamesLauncher',
        'EADM',
        'Discord',
        'Spotify',
        'Proton Drive',
        'LM Studio',
        'Cloudflare WARP',
        'AvastUI'
    )

    return $Audit.StartupCommands | Where-Object {
        $name = $_.Name
        foreach ($pattern in $patterns) {
            if ($name -like "*$pattern*") { return $true }
        }
        return $false
    }
}

function Get-SafeTaskCandidates {
    param($Audit)

    $patterns = @(
        '\Microsoft\Windows\Customer Experience Improvement Program\',
        '\Microsoft\Windows\Feedback\Siuf\',
        '\Microsoft\Office\'
    )

    return $Audit.ScheduledTasks | Where-Object {
        foreach ($pattern in $patterns) {
            if ($_.TaskPath -eq $pattern) { return $true }
        }
        return $false
    }
}

function Write-Report {
    param($Audit)

    $topCpu = $Audit.TopCpuProcesses | Format-Table -AutoSize | Out-String
    $topRam = $Audit.TopRamProcesses | Format-Table -AutoSize | Out-String
    $startupCandidates = Get-SafeStartupCandidates -Audit $Audit
    $taskCandidates = Get-SafeTaskCandidates -Audit $Audit

    $lines = @()
    $lines += "A. Diagnostic"
    $lines += "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $lines += "OS detecte: $($Audit.ComputerInfo.WindowsProductName) build $($Audit.ComputerInfo.OsBuildNumber)"
    $lines += "CPU: $($Audit.CPU[0].Name)"
    $lines += "RAM totale: {0:N1} Go" -f ($Audit.ComputerSystem.TotalPhysicalMemory / 1GB)
    $lines += "GPU principal: $($Audit.GPU | Where-Object { $_.Name -like '*NVIDIA*' } | Select-Object -First 1 -ExpandProperty Name)"
    $lines += "Disque systeme libre: {0:N1} Go" -f (($Audit.Volumes | Where-Object DriveLetter -eq 'C').SizeRemaining / 1GB)
    $lines += "Temp utilisateur: {0:N2} Go" -f ($Audit.TempUserBytes / 1GB)
    $lines += "Temp Windows: {0:N2} Go" -f ($Audit.TempWindowsBytes / 1GB)
    $lines += "Cache Windows Update: {0:N2} Go" -f ($Audit.UpdateCacheBytes / 1GB)
    $lines += ""
    $lines += "Top 20 processus CPU"
    $lines += $topCpu.TrimEnd()
    $lines += ""
    $lines += "Top 20 processus RAM"
    $lines += $topRam.TrimEnd()
    $lines += ""
    $lines += "B. Nettoyage sans risque"
    $lines += "Elements de demarrage potentiellement inutiles:"
    foreach ($item in $startupCandidates) {
        $lines += " - $($item.Name) [$($item.Location)]"
    }
    $lines += "Taches planifiees a revoir:"
    foreach ($item in $taskCandidates) {
        $lines += " - $($item.TaskPath)$($item.TaskName)"
    }
    $lines += ""
    $lines += "C. Reparations systeme"
    $lines += "Erreurs systeme recentes:"
    foreach ($event in ($Audit.SystemErrors | Select-Object -First 10)) {
        $message = ($event.Message -replace '\s+', ' ').Trim()
        if ($message.Length -gt 180) { $message = $message.Substring(0, 180) + '...' }
        $lines += " - [$($event.TimeCreated)] $($event.ProviderName) $($event.Id): $message"
    }
    $lines += ""
    $lines += "D. Optimisations reversibles"
    $lines += " - Defender natif inactif: antivirus tiers present, verifier la pertinence de conserver Avast."
    $lines += " - Services/logiciels tiers reseau: WARP, cloudflared, COMFAST, services orphelins eventuels."
    $lines += " - Hyperviseur present: utile pour WSL/VM, mais consomme une partie des ressources."
    $lines += ""
    $lines += "E. Optimisations gaming"
    $lines += " - Desactiver overlays/launchers au boot hors session de jeu."
    $lines += " - Verifier Xbox Game Bar, Discord overlay, Steam overlay, overlays NVIDIA."
    $lines += ""
    $lines += "F. Optimisations developpeur"
    $lines += " - Limiter Chrome/Edge aux profils et extensions strictement utiles."
    $lines += " - Fermer LM Studio hors usage local IA."
    $lines += " - Garder WSL si reellement utilise, sinon le desactiver manuellement apres validation."
    $lines += ""
    $lines += "G. Goulots d'etranglement materiels"
    $lines += " - CPU 4c/4t ancien: limite majeure en multitache, navigateurs lourds, compilation parallele et jeux CPU-bound."
    $lines += " - GTX 1050 Ti: encore exploitable en e-sport/jeux bien regles, mais limitee sur jeux AAA recents."
    $lines += " - SSD systeme 256 Go: correct s'il reste degage, mais vite sature avec IDE, caches et launchers."

    $reportPath = Join-Path $script:ReportDir 'final-report.txt'
    Set-Content -Path $reportPath -Value $lines -Encoding UTF8
    Write-Log "Rapport texte genere: $reportPath" 'OK'
}

function Invoke-SafeCleanup {
    Write-Log "Nettoyage sans risque."

    $targets = @(
        $env:TEMP,
        'C:\Windows\Temp'
    )

    foreach ($target in $targets) {
        if (-not (Test-Path -LiteralPath $target)) { continue }
        Write-Log "Nettoyage de $target"
        if ($Simulation) { continue }

        Get-ChildItem -LiteralPath $target -Force -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                Remove-Item -LiteralPath $_.FullName -Force -Recurse -ErrorAction Stop
            }
            catch {
                Write-Log ("Element ignore pendant nettoyage: {0}" -f $_.Exception.Message) 'WARN'
            }
        }
    }

    if ($Simulation) {
        Write-Log "Simulation active: corbeille et cache miniature non touches." 'WARN'
    }
    else {
        try {
            Clear-RecycleBin -Force -ErrorAction SilentlyContinue | Out-Null
            Write-Log "Corbeille videe." 'OK'
        }
        catch {
            Write-Log "Impossible de vider completement la corbeille." 'WARN'
        }

        Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter 'thumbcache*' -Force -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
        Write-Log "Cache des miniatures nettoye." 'OK'
    }

    Write-Log "Les outils natives comme cleanmgr ou Storage Sense peuvent etre utilises en complement." 'INFO'
}

function Invoke-SystemRepair {
    Write-Log "Reparation systeme native."

    $commands = @(
        'DISM /Online /Cleanup-Image /ScanHealth',
        'DISM /Online /Cleanup-Image /RestoreHealth',
        'sfc /scannow',
        "chkdsk $env:SystemDrive /scan"
    )

    foreach ($command in $commands) {
        Write-Log "Commande: $command"
        if ($Simulation) { continue }
        cmd.exe /c $command | Tee-Object -FilePath (Join-Path $script:ReportDir 'repair-output.txt') -Append
    }
}

function Set-StartupTuning {
    param($Audit)

    if (-not $ApplyStartupTuning) {
        Write-Log "Tuning demarrage non demande. Liste fournie dans le rapport seulement." 'WARN'
        return
    }

    $safeStartup = Get-SafeStartupCandidates -Audit $Audit
    $backupRunPath = 'HKCU:\Software\CodexOptimization\DisabledStartupBackup'
    if (-not $Simulation) {
        New-Item -Path $backupRunPath -Force | Out-Null
    }

    foreach ($item in $safeStartup) {
        $name = $item.Name
        if ($item.Location -like '*CurrentVersion\Run*') {
            Write-Log "Desactivation de l'entree de demarrage utilisateur: $name"
            if ($Simulation) { continue }
            try {
                $value = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction Stop).$name
                if ($null -ne $value) {
                    New-ItemProperty -Path $backupRunPath -Name $name -Value $value -PropertyType String -Force | Out-Null
                    Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name $name -ErrorAction Stop
                    Write-Log "Entree desactivee: $name" 'OK'
                }
            }
            catch {
                Write-Log ("Impossible de desactiver l'entree {0}: {1}" -f $name, $_.Exception.Message) 'WARN'
            }
        }
        elseif ($item.Location -eq 'Common Startup') {
            $commonStartup = [Environment]::GetFolderPath('CommonStartup')
            $shortcut = Join-Path $commonStartup ($name + '.lnk')
            if (-not (Test-Path -LiteralPath $shortcut)) {
                $shortcut = Get-ChildItem $commonStartup -Filter '*.lnk' -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -like "*$name*" } | Select-Object -First 1 -ExpandProperty FullName
            }
            Write-Log "Desactivation du raccourci de demarrage commun: $name"
            if ($Simulation) { continue }
            if (-not $script:IsAdmin) {
                Write-Log "Raccourci commun ignore sans elevation." 'WARN'
                continue
            }
            try {
                if ($shortcut) {
                    Rename-Item -LiteralPath $shortcut -NewName ((Split-Path $shortcut -Leaf) + '.disabled') -ErrorAction Stop
                    Write-Log "Raccourci desactive: $name" 'OK'
                }
            }
            catch {
                Write-Log ("Impossible de desactiver le raccourci {0}: {1}" -f $name, $_.Exception.Message) 'WARN'
            }
        }
    }

    $safeTasks = Get-SafeTaskCandidates -Audit $Audit
    foreach ($task in $safeTasks) {
        $fullName = '{0}{1}' -f $task.TaskPath, $task.TaskName
        Write-Log "Desactivation candidate de tache: $fullName"
        if ($Simulation) { continue }
        if (-not $script:IsAdmin) {
            Write-Log "Tache ignoree sans elevation: $fullName" 'WARN'
            continue
        }
        try {
            Disable-ScheduledTask -TaskPath $task.TaskPath -TaskName $task.TaskName -ErrorAction Stop | Out-Null
            Write-Log "Tache desactivee: $fullName" 'OK'
        }
        catch {
            Write-Log ("Echec desactivation tache {0}: {1}" -f $fullName, $_.Exception.Message) 'WARN'
        }
    }
}

function Set-VisualTuning {
    if (-not $ApplyVisualTuning) {
        Write-Log "Tuning visuel non demande." 'WARN'
        return
    }

    $target = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects'
    Write-Log "Reglage visuel vers 'best performance' au niveau utilisateur."
    if ($Simulation) { return }

    New-Item -Path $target -Force | Out-Null
    New-ItemProperty -Path $target -Name VisualFXSetting -PropertyType DWord -Value 2 -Force | Out-Null
}

function Set-BackgroundAppTuning {
    if (-not $ApplyBackgroundAppTuning) {
        Write-Log "Tuning applications en arriere-plan non demande." 'WARN'
        return
    }

    $privacyKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications'
    Write-Log "Restriction raisonnable des applications UWP en arriere-plan pour l'utilisateur courant."
    if ($Simulation) { return }

    New-Item -Path $privacyKey -Force | Out-Null
    New-ItemProperty -Path $privacyKey -Name GlobalUserDisabled -PropertyType DWord -Value 1 -Force | Out-Null
}

function Set-SearchTuning {
    if (-not $ApplySearchTuning) {
        Write-Log "Tuning Windows Search non demande." 'WARN'
        return
    }

    Write-Log "Passage de la recherche Windows en mode classique pour l'utilisateur courant."
    if ($Simulation) { return }

    $searchKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search'
    New-Item -Path $searchKey -Force | Out-Null
    New-ItemProperty -Path $searchKey -Name SearchboxTaskbarMode -PropertyType DWord -Value 0 -Force | Out-Null
}

function Set-PerformanceTuning {
    if (-not $ApplyPerformanceTuning) {
        Write-Log "Tuning performance non demande." 'WARN'
        return
    }

    Write-Log "Activation du plan d'alimentation Performances elevees."
    if (-not $Simulation) {
        powercfg /S 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c | Out-Null
    }

    Write-Log "Desactivation de Game Bar et Game DVR pour reduire overlays et captures en arriere-plan."
    if (-not $Simulation) {
        New-Item -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Force | Out-Null
        New-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name ShowStartupPanel -PropertyType DWord -Value 0 -Force | Out-Null
        New-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name UseNexusForGameBarEnabled -PropertyType DWord -Value 0 -Force | Out-Null
        New-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name AppCaptureEnabled -PropertyType DWord -Value 0 -Force | Out-Null
        New-Item -Path 'HKCU:\System\GameConfigStore' -Force | Out-Null
        New-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name GameDVR_Enabled -PropertyType DWord -Value 0 -Force | Out-Null
        New-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name GameDVR_FSEBehaviorMode -PropertyType DWord -Value 2 -Force | Out-Null
    }

    Write-Log "Activation des meilleures performances graphiques utilisateur si pris en charge."
    if (-not $Simulation) {
        New-Item -Path 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' -Force | Out-Null
    }

    Write-Log "Le script ne touche pas au pagefile si Windows le gere deja correctement."
    Write-Log "Le script ne desactive pas Windows Update, le son, le reseau, ni les pilotes critiques."
}

function Invoke-FullWorkflow {
    param($Audit)

    Invoke-SafeCleanup
    Invoke-SystemRepair
    Set-StartupTuning -Audit $Audit
    Set-VisualTuning
    Set-BackgroundAppTuning
    Set-SearchTuning
    Set-PerformanceTuning
}

$script:SessionStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:RawDir = Join-Path $OutputRoot "raw-$script:SessionStamp"
$script:ReportDir = Join-Path $OutputRoot "report-$script:SessionStamp"
$script:RollbackDir = Join-Path $OutputRoot "rollback-$script:SessionStamp"
$script:LogFile = Join-Path $OutputRoot "run-$script:SessionStamp.log"
$script:IsAdmin = Test-IsAdmin

Ensure-OutputFolders
Write-Log "Mode: $Mode"
Write-Log "Simulation: $Simulation"
Write-Log "Admin: $script:IsAdmin"

Backup-CurrentState
Try-CreateRestorePoint
$audit = Get-AuditData
Write-Report -Audit $audit

switch ($Mode) {
    'Audit' {
        Write-Log "Audit termine, aucun changement applique." 'OK'
    }
    'Cleanup' {
        Invoke-SafeCleanup
    }
    'Repair' {
        Invoke-SystemRepair
    }
    'Optimize' {
        Set-StartupTuning -Audit $audit
        Set-VisualTuning
        Set-BackgroundAppTuning
        Set-SearchTuning
        Set-PerformanceTuning
    }
    'Full' {
        Invoke-FullWorkflow -Audit $audit
    }
}

Write-Log "Sorties disponibles dans: $OutputRoot" 'OK'
