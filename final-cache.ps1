$ErrorActionPreference = "Stop"

$PREP_COMMIT_SHA = "731e4ad50e34e6587258a6a67ceeb895e10b5366"
$TEAMS = @("Obsidian", "RoyalPurple", "Teal", "Emerald", "Crimson", "MidnightBlue")
$REPOS_PATH = "$PSScriptRoot\runner\repos"

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
        # Get all commits after PREP_COMMIT_SHA
        $commitShas = git rev-list "$PREP_COMMIT_SHA..HEAD" 2>$null
        if (-not $commitShas) {
            $commitShas = @()
        }

        $people = @{}
        $biggestCommit = $null
        $biggestChurn = 0
        $totalLinesAdded = 0
        $totalLinesRemoved = 0

        foreach ($sha in $commitShas) {
            # Get commit details
            $authorLine = git log -1 --format="%an" $sha
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

            # Track per person
            if (-not $people.ContainsKey($authorLine)) {
                $people[$authorLine] = @{
                    commits = 0
                    linesAdded = 0
                    linesRemoved = 0
                    prs = 0
                }
            }
            $people[$authorLine].commits++
            $people[$authorLine].linesAdded += $added
            $people[$authorLine].linesRemoved += $removed

            # Track biggest commit
            $churn = $added + $removed
            if ($churn -gt $biggestChurn) {
                $biggestChurn = $churn
                $biggestCommit = @{
                    sha = $sha.Substring(0, 7)
                    author = $authorLine
                    message = $messageLine
                    linesAdded = $added
                    linesRemoved = $removed
                }
            }
        }

        # Count PRs per person (merged PRs from git log)
        # Look for "Merge pull request" commits
        foreach ($sha in $commitShas) {
            $messageLine = git log -1 --format="%s" $sha
            $authorLine = git log -1 --format="%an" $sha
            if ($messageLine -match "^Merge pull request") {
                if ($people.ContainsKey($authorLine)) {
                    $people[$authorLine].prs++
                }
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
            totalCommits = $commitShas.Count
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
