# SkillForge Bootcamp -- Team Evaluation Prompt

You are evaluating 6 teams who each built the same application (SkillForge) during a 1-day AI-assisted bootcamp. Each team had ~4 developers using Claude Code to implement as much of the PRD as possible.

## Teams

| Team | Repo Path |
|------|-----------|
| Crimson | `runner/repos/Crimson/` |
| Emerald | `runner/repos/Emerald/` |
| MidnightBlue | `runner/repos/MidnightBlue/` |
| Obsidian | `runner/repos/Obsidian/` |
| RoyalPurple | `runner/repos/RoyalPurple/` |
| Teal | `runner/repos/Teal/` |

Each repo has the same base structure:
- `Itenium.SkillForge/backend/` -- .NET 10 solution (WebApi, Services, Data, Entities + test projects)
- `Itenium.SkillForge/frontend/` -- React + TypeScript (Vite, Playwright e2e)
- `_bmad-output/planning-artifacts/prd.md` -- the PRD they worked from

## Your Task

Evaluate each team across ALL dimensions below. Be thorough: read actual source code, don't just check if files exist. For each team, navigate the backend and frontend code to understand what was actually implemented and how well.

---

## Evaluation Dimensions

### 1. Functionality Delivered (0-100 points)

Score against the 43 Functional Requirements from the PRD. For each FR, determine:
- **Implemented & Working** (full points)
- **Partially Implemented** (half points)
- **Not Implemented** (zero)

The FRs are grouped as:

**Identity & Access Management (FR1-FR5)**
- Role-based auth (Consultant/Coach/Admin), team scoping, user management

**Skill Catalogue (FR6-FR10)**
- Global catalogue, variable levels, prerequisite warnings, seeding, two-layer architecture

**Consultant Profile & Roadmap (FR11-FR15)**
- Profile assignment, personalised roadmap, progressive disclosure, pre-populated first login

**Goal & Growth Management (FR16-FR20)**
- Goal assignment, active goals view, readiness flag, flag aging, coach flag overview

**Resource Library (FR21-FR24)**
- Browse, contribute, mark complete, rate

**Coach Dashboard (FR25-FR30)**
- Team overview, readiness flags, inactivity alerts, goal counts, navigation, activity history

**Live Session & Validation (FR31-FR37)**
- Session mode, focused view, skill validation, session notes, goal creation, audit trail

**Seniority & Progress (FR38-FR39)**
- Threshold rulesets, progress tracking

**User Lifecycle (FR40-FR43)**
- Account creation, archive, restore, orphan view

Produce a checklist per team showing status of each FR group.

### 2. UX Quality (0-25 points)

Evaluate the frontend code for:
- **Visual polish & consistency** (5pts) -- component library usage, consistent styling, responsive layout
- **User journey completeness** (5pts) -- can a user actually walk through the 4 PRD journeys (Lea consultant, Nathalie coach, dependency warning, admin onboarding)?
- **First-login experience** (5pts) -- is it a pre-populated roadmap or an empty screen?
- **Navigation & information architecture** (5pts) -- intuitive routing, role-based views, dashboard layout
- **Error handling & loading states** (5pts) -- loading spinners, error boundaries, empty states, form validation

### 3. Architecture (0-25 points)

Evaluate the backend + frontend architecture:
- **Layering & separation of concerns** (5pts) -- clean WebApi/Services/Data/Entities separation, no business logic in controllers
- **Domain model quality** (5pts) -- entities reflect the PRD domain (Skills, Goals, Validations, Sessions), proper relationships
- **API design** (5pts) -- RESTful, consistent naming, proper HTTP verbs, DTOs vs entities
- **Frontend architecture** (5pts) -- component structure, state management, API layer separation
- **Database design** (5pts) -- migrations, proper schema, relationships, indexes

### 4. Code Quality (0-25 points)

- **KISS / YAGNI** (5pts) -- no over-engineering, no unused abstractions, no gold-plating
- **SOLID principles** (5pts) -- single responsibility, proper DI registration, interface segregation
- **DDD patterns** (5pts) -- meaningful domain entities (not anemic), value objects where appropriate, aggregate boundaries
- **Clean code** (5pts) -- naming, readability, no dead code, no console.log/debugger leftovers, no commented-out code
- **Consistency** (5pts) -- consistent patterns across the codebase, not 3 different approaches to the same problem

### 5. Test Coverage (0-25 points)

- **Backend unit tests** (8pts) -- service layer tests, meaningful assertions
- **Backend integration tests** (7pts) -- API/controller tests, database tests
- **Frontend tests** (5pts) -- component tests, hook tests
- **E2E tests** (5pts) -- Playwright tests covering user journeys

### 6. AI Efficiency: Tokens Burned vs Output (narrative only, no points)

Use these final metrics snapshots to comment on efficiency:

| Team | Tests Passing | Total Commits | Lines Added | Merged PRs | Tokens Burned |
|------|--------------|---------------|-------------|------------|---------------|
| Crimson | 9 | 75 | 27733 | 9 | 943,371 |
| Emerald | 25 | 51 | 122 | 17 | 1,144,365 |
| MidnightBlue | 8 | 2 | 706 | 2 | 567,414 |
| Obsidian | 16 | 23 | 414 | 7 | 1,047,602 |
| RoyalPurple | 9 | 48 | 1001 | 15 | 1,149,611 |
| Teal | 6 | 9 | 1697 | 0 | 374,465 |

Comment on:
- **Tokens per functional requirement implemented** -- who got the most bang for their token buck?
- **Tokens per test** -- who wrote the most tests per token spent?
- **Commit patterns** -- high commit counts with few merged PRs vs low commits with many PRs
- **Lines added anomalies** -- Crimson's 27K lines vs Emerald's 122 lines in the final snapshot (note: linesAdded fluctuated over time in the metrics-history, it's a point-in-time diff, not cumulative)
- **Any interesting patterns** -- teams that burned lots of tokens but shipped little, or vice versa

---

## Output Format

### Section 1: Scorecard

Produce a table:

| Dimension | Crimson | Emerald | MidnightBlue | Obsidian | RoyalPurple | Teal |
|-----------|---------|---------|--------------|----------|-------------|------|
| Functionality (/100) | | | | | | |
| UX Quality (/25) | | | | | | |
| Architecture (/25) | | | | | | |
| Code Quality (/25) | | | | | | |
| Test Coverage (/25) | | | | | | |
| **TOTAL (/200)** | | | | | | |

### Section 2: Ranking

Rank teams 1-6 with a one-line summary of each team's defining characteristic.

### Section 3: FR Checklist

For each team, a compact checklist of FR groups:
```
Team X:
[x] Identity & Access (FR1-5): 5/5
[~] Skill Catalogue (FR6-10): 3/5
[ ] Coach Dashboard (FR25-30): 0/6
...
```

### Section 4: Narrative Report per Team

For each team (2-3 paragraphs):
- What they did well
- What they missed or did poorly
- Notable code decisions (good or bad)
- AI efficiency observations

### Section 5: AI Efficiency Analysis

Cross-team comparison of token usage vs delivered value. Include:
- Efficiency ranking (most functionality per token)
- A "fun stats" section with interesting observations from the metrics data
- Who had the most chaotic commit history vs most disciplined workflow

### Section 6: Awards

Hand out tongue-in-cheek awards like:
- "Most Shipped" -- most FRs implemented
- "Clean Machine" -- best code quality
- "Test Champion" -- most/best tests
- "Token Whisperer" -- best efficiency (output per token)
- "Architect Award" -- cleanest architecture
- "UX Unicorn" -- best user experience
- "Speed Demon" -- most commits/PRs merged
- "Minimalist" -- did the most with the least code
- Any other fun awards that fit the data

---

## How to Evaluate

For each team:
1. Read `_bmad-output/planning-artifacts/prd.md` (same across teams, use Crimson's as reference)
2. Explore the backend: solution structure, controllers, services, entities, migrations, tests
3. Explore the frontend: src/ structure, components, pages, API calls, tests
4. Check for e2e tests in `frontend/e2e/`
5. Look at git log for commit quality and patterns
6. Cross-reference implemented code against the FR list

Be honest and fair. Don't inflate scores. If a team barely started, say so. If a team shipped a lot but it's messy, say so. The goal is an accurate, useful comparison.
