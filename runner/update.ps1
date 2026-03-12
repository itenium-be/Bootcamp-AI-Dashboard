# Update all team repositories and install dependencies
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Resetting local changes in submodules..." -ForegroundColor Cyan
git submodule foreach --recursive git checkout .

Write-Host "Updating all submodules..." -ForegroundColor Cyan
git submodule update --remote --merge

$teams = @("Obsidian", "RoyalPurple", "Teal", "Emerald", "Crimson", "MidnightBlue")

# Run updates in parallel
$jobs = @()

foreach ($team in $teams) {
    $repoPath = Join-Path $scriptDir "repos\$team\Itenium.SkillForge"

    $jobs += Start-Job -Name $team -ScriptBlock {
        param($team, $repoPath)

        $frontendPath = Join-Path $repoPath "frontend"
        $backendPath = Join-Path $repoPath "backend"

        Write-Output "[$team] Installing frontend dependencies..."
        Push-Location $frontendPath
        bun install 2>&1
        Pop-Location

        Write-Output "[$team] Restoring backend packages..."
        Push-Location $backendPath
        dotnet restore 2>&1
        Pop-Location

        Write-Output "[$team] Done!"
    } -ArgumentList $team, $repoPath
}

Write-Host "Waiting for all updates to complete..." -ForegroundColor Cyan

foreach ($job in $jobs) {
    $result = Receive-Job -Job $job -Wait
    Write-Host $result
    Remove-Job -Job $job
}

Write-Host "All teams updated!" -ForegroundColor Green
