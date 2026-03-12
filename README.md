AI Bootcamp Dashboard
=====================

Real-time dashboard showing team progress during the AI Bootcamp.

- GitHub activity: commits, PRs, issues, build status, test results
- Token usage: per-team token burn from Anthropic Admin API

## Runner

Runs the dashboard and all 6 team applications via Docker.

```powershell
cd runner

# Setup (first time only)
cp .env.example .env
# Edit .env:
#   GITHUB_USER / GITHUB_TOKEN (read:packages scope)
#   ANTHROPIC_ADMIN_KEY (sk-ant-admin-xxx for token tracking)

# Pull latest code & start
.\update.ps1
docker compose up -d --build

# Stop all
docker compose down
```

| Service      | Port  |
|--------------|-------|
| Dashboard    | :8080 |

| Team         | Frontend | Backend | DB    |
|--------------|----------|---------|-------|
| Obsidian     | :5180    | :5010   | :5440 |
| RoyalPurple  | :5181    | :5011   | :5441 |
| Teal         | :5182    | :5012   | :5442 |
| Emerald      | :5183    | :5013   | :5443 |
| Crimson      | :5184    | :5014   | :5444 |
| MidnightBlue | :5185    | :5015   | :5445 |

## Standalone Development

```bash
cd dashboard
export ANTHROPIC_ADMIN_KEY=sk-ant-admin-xxx
bun run server.ts
```
