$ErrorActionPreference = "Stop"

$TEAMS = @("Obsidian", "RoyalPurple", "Teal", "Emerald", "Crimson", "MidnightBlue")
$REPOS_PATH = "$PSScriptRoot\runner\repos"
$EXCLUDED_AUTHORS = @("Wouter Van Schandevijl", "Laoujin", "Bert Vermorgen", "BertVermorgen", "Olivier Van de Perre")
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
        # Get all commits, then filter out excluded authors
        $allCommitShas = git rev-list HEAD 2>$null
        if (-not $allCommitShas) {
            $allCommitShas = @()
        }

        # Filter out commits by excluded authors
        $commitShas = @()
        foreach ($sha in $allCommitShas) {
            $authorLine = git log -1 --format="%an" $sha
            if ($authorLine -notin $EXCLUDED_AUTHORS) {
                $commitShas += $sha
            }
        }

        $people = @{}
        $biggestCommit = $null
        $biggestChurn = 0
        $totalLinesAdded = 0
        $totalLinesRemoved = 0
        $firstCommit = $null
        $firstCommitDate = $null

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

            # Track first commit (earliest date)
            $commitDate = git log -1 --format="%aI" $sha
            if ($commitDate -and (-not $firstCommitDate -or $commitDate -lt $firstCommitDate)) {
                $firstCommitDate = $commitDate
                $firstCommit = @{
                    sha = $sha.Substring(0, 7)
                    author = $authorLine
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
