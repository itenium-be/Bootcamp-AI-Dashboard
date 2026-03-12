AI Bootcamp Dashboard
=====================

Real-time dashboard showing team progress during the AI Bootcamp.

## Dashboard Hosting

```bash
bunx serve -l 8080
```

## Runner

Runs all 6 team applications via Docker.

```powershell
cd runner

# Setup (first time only)
cp .env.example .env
# Edit .env with GITHUB_USER and GITHUB_TOKEN (read:packages scope)

# Pull latest code & start
.\update.ps1
docker compose up -d --build

# Stop all
docker compose down
```

| Team         | Frontend | Backend | DB   |
|--------------|----------|---------|------|
| Obsidian     | :5180    | :5010   | :5440|
| RoyalPurple  | :5181    | :5011   | :5441|
| Teal         | :5182    | :5012   | :5442|
| Emerald      | :5183    | :5013   | :5443|
| Crimson      | :5184    | :5014   | :5444|
| MidnightBlue | :5185    | :5015   | :5445|
