# Update all team repositories
$ErrorActionPreference = "Stop"

Write-Host "Pruning stale remote references..." -ForegroundColor Cyan
git submodule foreach --recursive git remote prune origin 2>&1 | Out-Null

Write-Host "Resetting local changes in submodules..." -ForegroundColor Cyan
git submodule foreach --recursive git checkout .

Write-Host "Updating all submodules..." -ForegroundColor Cyan
git submodule update --remote --merge

Write-Host "All teams updated!" -ForegroundColor Green
Write-Host "Run 'docker compose up -d --build' to rebuild" -ForegroundColor Gray
