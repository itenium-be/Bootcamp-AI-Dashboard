# Start all team applications
param(
    [switch]$StopOnly
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logsDir = Join-Path $scriptDir "logs"
$pidFile = Join-Path $scriptDir "pids.json"

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

$teams = @(
    @{ Name = "Obsidian";      FrontendPort = 5173; BackendPort = 5000; DbPort = 5433 },
    @{ Name = "RoyalPurple";   FrontendPort = 5174; BackendPort = 5001; DbPort = 5434 },
    @{ Name = "Teal";          FrontendPort = 5175; BackendPort = 5002; DbPort = 5435 },
    @{ Name = "Emerald";       FrontendPort = 5176; BackendPort = 5003; DbPort = 5436 },
    @{ Name = "Crimson";       FrontendPort = 5177; BackendPort = 5004; DbPort = 5437 },
    @{ Name = "MidnightBlue";  FrontendPort = 5178; BackendPort = 5005; DbPort = 5438 }
)

function Stop-TrackedProcesses {
    if (Test-Path $pidFile) {
        $pids = Get-Content $pidFile | ConvertFrom-Json
        foreach ($pid in $pids) {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "Stopping process $pid ($($proc.Name))..." -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
        Remove-Item $pidFile -Force
    }
    docker compose -f "$scriptDir\docker-compose.yml" down 2>$null
}

if ($StopOnly) {
    Write-Host "Stopping processes..." -ForegroundColor Yellow
    Stop-TrackedProcesses
    Write-Host "All processes stopped." -ForegroundColor Green
    exit 0
}

# Stop any previously started processes
Stop-TrackedProcesses

# Start databases
Write-Host "Starting databases..." -ForegroundColor Cyan
docker compose -f "$scriptDir\docker-compose.yml" up -d

Write-Host "Waiting for databases to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Track PIDs
$allPids = @()

# Start all teams
foreach ($team in $teams) {
    $name = $team.Name
    $repoPath = Join-Path $scriptDir "repos\$name\Itenium.SkillForge"
    $frontendPath = Join-Path $repoPath "frontend"
    $backendPath = Join-Path $repoPath "backend"
    $webApiPath = Join-Path $backendPath "Itenium.SkillForge.WebApi"

    Write-Host "Starting $name (Frontend: $($team.FrontendPort), Backend: $($team.BackendPort))..." -ForegroundColor Cyan

    # Start backend with custom DB port via cmd to properly pass env vars
    $connStr = "Host=localhost;Port=$($team.DbPort);Database=skillforge;Username=skillforge;Password=skillforge"
    $backendLog = Join-Path $logsDir "$name-backend.log"
    $backendProc = Start-Process cmd -ArgumentList "/c", "set ConnectionStrings__DefaultConnection=$connStr && dotnet run --project `"$webApiPath`" --urls http://localhost:$($team.BackendPort) > `"$backendLog`" 2>&1" -WindowStyle Hidden -PassThru
    $allPids += $backendProc.Id

    # Start frontend with custom API URL
    $frontendLog = Join-Path $logsDir "$name-frontend.log"
    $frontendProc = Start-Process cmd -ArgumentList "/c", "set VITE_API_URL=http://localhost:$($team.BackendPort) && cd /d `"$frontendPath`" && bun run dev --port $($team.FrontendPort) > `"$frontendLog`" 2>&1" -WindowStyle Hidden -PassThru
    $allPids += $frontendProc.Id
}

# Save PIDs
$allPids | ConvertTo-Json | Set-Content $pidFile

Write-Host ""
Write-Host "All teams started!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend URLs:" -ForegroundColor Cyan
foreach ($team in $teams) {
    Write-Host "  $($team.Name.PadRight(14)) http://localhost:$($team.FrontendPort)"
}
Write-Host ""
Write-Host "Backend URLs:" -ForegroundColor Cyan
foreach ($team in $teams) {
    Write-Host "  $($team.Name.PadRight(14)) http://localhost:$($team.BackendPort)"
}
Write-Host ""
Write-Host "Logs: $logsDir" -ForegroundColor Gray
Write-Host "Stop: .\start.ps1 -StopOnly" -ForegroundColor Gray
