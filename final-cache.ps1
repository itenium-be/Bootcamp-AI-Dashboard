$ErrorActionPreference = "Stop"

$TEAMS = @("Obsidian", "RoyalPurple", "Teal", "Emerald", "Crimson", "MidnightBlue")
$REPOS_PATH = "$PSScriptRoot\runner\repos"
$PREP_COMMIT_COUNT = 118  # Prep commits to skip (119 in main repo, but team repos are 1 behind)
$EXCLUDED_AUTHORS = @("Wouter Van Schandevijl", "Laoujin", "Bert Vermorgen", "BertVermorgen", "Olivier Van de Perre")

# Map alternate names to canonical names
$NAME_ALIASES = @{
    "Mike D" = "Mikedonna"
    "mikedonna" = "Mikedonna"
}
$GITHUB_REPOS = @{
    "Obsidian" = "itenium-be/Bootcamp-AI-Obsidian"
    "RoyalPurple" = "itenium-be/Bootcamp-AI-RoyalPurple"
    "Teal" = "itenium-be/Bootcamp-AI-Teal"
    "Emerald" = "itenium-be/Bootcamp-AI-Emerald"
    "Crimson" = "itenium-be/Bootcamp-AI-Crimson"
    "MidnightBlue" = "itenium-be/Bootcamp-AI-MidnightBlue"
}

function Count-BackendTests($repoPath) {
    $testFiles = Get-ChildItem -Path "$repoPath\backend" -Filter "*Tests.cs" -Recurse -ErrorAction SilentlyContinue
    $count = 0
    foreach ($file in $testFiles) {
        $content = Get-Content $file.FullName -Raw
        # xUnit
        $count += ([regex]::Matches($content, '\[Fact\]')).Count
        $count += ([regex]::Matches($content, '\[Theory\]')).Count
        # NUnit
        $count += ([regex]::Matches($content, '\[Test\]')).Count
        $count += ([regex]::Matches($content, '\[TestCase\b')).Count
    }
    return $count
}

function Count-FrontendTests($repoPath) {
    $testFiles = Get-ChildItem -Path "$repoPath\frontend\src" -Filter "*.test.ts*" -Recurse -ErrorAction SilentlyContinue
    $count = 0
    foreach ($file in $testFiles) {
        $content = Get-Content $file.FullName -Raw
        $count += ([regex]::Matches($content, '\bit\s*\(')).Count
        $count += ([regex]::Matches($content, '\btest\s*\(')).Count
    }
    return $count
}

function Count-E2ETests($repoPath) {
    $testFiles = Get-ChildItem -Path "$repoPath\frontend\e2e" -Filter "*.spec.ts" -ErrorAction SilentlyContinue
    $count = 0
    foreach ($file in $testFiles) {
        $content = Get-Content $file.FullName -Raw
        $count += ([regex]::Matches($content, '\btest\s*\(')).Count
    }
    return $count
}

function Get-TeamData($teamName) {
    $repoPath = "$REPOS_PATH\$teamName\Itenium.SkillForge"

    if (-not (Test-Path $repoPath)) {
        Write-Warning "Repo not found: $repoPath"
        return $null
    }

    Push-Location $repoPath
    try {
        # Get bootcamp commits only (skip prep commits)
        $totalCommits = [int](git rev-list --count HEAD 2>$null)
        $bootcampCount = $totalCommits - $PREP_COMMIT_COUNT

        if ($bootcampCount -le 0) {
            $commitShas = @()
        } else {
            $commitShas = @(git rev-list HEAD -n $bootcampCount 2>$null)
        }

        $people = @{}
        $biggestCommit = $null
        $biggestChurn = 0
        $totalLinesAdded = 0
        $totalLinesRemoved = 0
        $firstCommit = $null
        $firstCommitDate = $null
        $actualCommitCount = 0

        foreach ($sha in $commitShas) {
            # Get commit details
            $authorLine = git log -1 --format="%an" $sha

            # Skip excluded authors
            if ($authorLine -in $EXCLUDED_AUTHORS) {
                continue
            }

            # Normalize author name using aliases
            $authorName = if ($NAME_ALIASES.ContainsKey($authorLine)) { $NAME_ALIASES[$authorLine] } else { $authorLine }

            $messageLine = git log -1 --format="%s" $sha
            $statsLine = git show --stat --format="" $sha | Select-Object -Last 1

            $added = 0
            $removed = 0
            if ($statsLine -match '(\d+) insertions?\(\+\)') {
                $added = [int]$Matches[1]
            }
            if ($statsLine -match '(\d+) deletions?\(-\)') {
                $removed = [int]$Matches[1]
            }

            $totalLinesAdded += $added
            $totalLinesRemoved += $removed
            $actualCommitCount++

            # Track per person
            if (-not $people.ContainsKey($authorName)) {
                $people[$authorName] = @{
                    commits = 0
                    linesAdded = 0
                    linesRemoved = 0
                    prs = 0
                }
            }
            $people[$authorName].commits++
            $people[$authorName].linesAdded += $added
            $people[$authorName].linesRemoved += $removed

            # Track biggest commit
            $churn = $added + $removed
            if ($churn -gt $biggestChurn) {
                $biggestChurn = $churn
                $biggestCommit = @{
                    sha = $sha.Substring(0, 7)
                    author = $authorName
                    message = $messageLine
                    linesAdded = $added
                    linesRemoved = $removed
                }
            }

            # Track first commit (earliest date)
            $commitDate = git log -1 --format="%aI" $sha
            if ($commitDate -and (-not $firstCommitDate -or $commitDate -lt $firstCommitDate)) {
                $firstCommitDate = $commitDate
                $firstCommit = @{
                    sha = $sha.Substring(0, 7)
                    author = $authorName
                    message = $messageLine
                    date = $commitDate
                }
            }
        }

        # Count PRs per person using gh CLI
        $ghRepo = $GITHUB_REPOS[$teamName]
        if ($ghRepo) {
            try {
                $prs = gh pr list --repo $ghRepo --state merged --limit 500 --json author 2>$null | ConvertFrom-Json
                foreach ($pr in $prs) {
                    $prAuthor = $pr.author.login
                    # Match PR author to people (check if any person key contains the author or vice versa)
                    foreach ($personName in $people.Keys) {
                        if ($personName -like "*$prAuthor*" -or $prAuthor -like "*$personName*") {
                            $people[$personName].prs++
                            break
                        }
                    }
                }
            } catch {
                Write-Warning "Failed to fetch PRs for $teamName"
            }
        }

        # Count tests
        $tests = @{
            backend = Count-BackendTests $repoPath
            frontend = Count-FrontendTests $repoPath
            e2e = Count-E2ETests $repoPath
        }

        return @{
            tests = $tests
            totalLinesAdded = $totalLinesAdded
            totalLinesRemoved = $totalLinesRemoved
            biggestCommit = $biggestCommit
            firstCommit = $firstCommit
            totalCommits = $actualCommitCount
            people = $people
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "Calculating final stats..." -ForegroundColor Cyan

$result = @{
    generatedAt = (Get-Date).ToString("o")
    teams = @{}
}

foreach ($team in $TEAMS) {
    Write-Host "  Processing $team..." -ForegroundColor Gray
    $data = Get-TeamData $team
    if ($data) {
        $result.teams[$team] = $data
    }
}

$outputPath = "$PSScriptRoot\final-cache.json"
$result | ConvertTo-Json -Depth 10 | Set-Content $outputPath -Encoding UTF8

Write-Host "Written to $outputPath" -ForegroundColor Green
