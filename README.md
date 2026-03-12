AI Bootcamp Dashboard
=====================

Real-time dashboard showing team progress during the AI Bootcamp.

## Dashboard Hosting

```bash
bunx serve -l 8080
```

## Runner

Runs all team applications locally.

```powershell
cd runner

# Pull latest & install dependencies
.\update.ps1

# Start all (databases + frontend + backend)
.\start.ps1

# Stop all
.\start.ps1 -StopOnly
```
